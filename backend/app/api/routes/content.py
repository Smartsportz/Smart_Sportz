from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import optional_current_user
from app.core.config import settings
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.services.cache import cache_key, get_or_set_json
from app.services.job_queue import enqueue
from app.services.likes import like_states
from app.services.media import materialize_data_url, normalize_media_record, normalize_media_records
from app.services.tournament_status import apply_registration_window_statuses

router = APIRouter(tags=["content"])


class NewsLikePayload(BaseModel):
    slug: str = Field(min_length=2, max_length=220)
    liked: bool = True
    actor_key: str = Field(min_length=8, max_length=160)


class NewsCommentPayload(BaseModel):
    slug: str = Field(min_length=2, max_length=220)
    comment: str = Field(min_length=1, max_length=600)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_comments(value: str | None) -> list[dict]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def attach_news_blocks(post: dict) -> dict:
    blocks = rows(
        "SELECT block_type, content_json, sort_order FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
        (post["slug"],),
    )
    post["blocks"] = [
        {
            "type": block["block_type"],
            "content": materialize_data_url(json.loads(block["content_json"]).get("text", ""), f"news-block-{post['slug']}"),
            "sortOrder": block["sort_order"],
        }
        for block in blocks
    ]
    return post


def news_social_map(actor_key: str = "", slugs: list[str] | None = None, user_id: str | None = None) -> dict:
    params: tuple[str, ...] = ()
    where_clause = ""
    if slugs:
        placeholders = ",".join(["?"] * len(slugs))
        where_clause = f"WHERE news_slug IN ({placeholders})"
        params = tuple(slugs)
    items = rows(f"SELECT news_slug, likes, comments_json FROM news_social {where_clause}", params)
    liked_slugs: set[str] = set()
    if actor_key:
        if slugs:
            placeholders = ",".join(["?"] * len(slugs))
            liked_rows = rows(
                f"SELECT news_slug FROM news_likes WHERE actor_key = ? AND news_slug IN ({placeholders})",
                (actor_key, *slugs),
            )
        else:
            liked_rows = rows("SELECT news_slug FROM news_likes WHERE actor_key = ?", (actor_key,))
        liked_slugs = {item["news_slug"] for item in liked_rows}
    like_map = like_states("news", slugs or [item["news_slug"] for item in items], user_id)
    social = {
        item["news_slug"]: {
            "likes": like_map.get(item["news_slug"], {}).get("like_count", 0),
            "like_count": like_map.get(item["news_slug"], {}).get("like_count", 0),
            "comments": parse_comments(item["comments_json"]),
            "liked": like_map.get(item["news_slug"], {}).get("liked_by_me", item["news_slug"] in liked_slugs),
            "liked_by_me": like_map.get(item["news_slug"], {}).get("liked_by_me", False),
        }
        for item in items
    }
    for slug in slugs or []:
        like_item = like_map.get(slug, {"like_count": 0, "liked_by_me": False})
        social.setdefault(slug, {
            "likes": like_item["like_count"],
            "like_count": like_item["like_count"],
            "comments": [],
            "liked": like_item["liked_by_me"] or slug in liked_slugs,
            "liked_by_me": like_item["liked_by_me"],
        })
    return social


def paged_news_posts(limit: int, offset: int) -> tuple[int, list[dict]]:
    safe_limit = max(1, min(limit, 48))
    safe_offset = max(0, offset)
    total = int(row("SELECT COUNT(*) AS count FROM news_posts WHERE status = 'published'")["count"] or 0)
    posts = get_or_set_json(
        cache_key("content:news", safe_limit, safe_offset),
        lambda: normalize_media_records(rows(
            """
            SELECT slug, title, short_description, image, category, sport, city,
                   tournament_slug, is_highlight, published_at, created_at
            FROM news_posts
            WHERE status = 'published'
            ORDER BY published_at DESC, created_at DESC
            LIMIT ? OFFSET ?
            """,
            (safe_limit, safe_offset),
        ), "news", {"image"}, "news_posts"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    )
    return total, posts


@router.get("/news/social")
def news_social(actor_key: str = "", user: dict | None = Depends(optional_current_user)):
    return ok(news_social_map(actor_key, user_id=user["id"] if user else None))


@router.post("/news/social/like")
def news_like(payload: NewsLikePayload):
    if not row("SELECT slug FROM news_posts WHERE slug = ? AND status = 'published'", (payload.slug,)):
        raise HTTPException(status_code=404, detail="News post not found")
    liked = bool(row("SELECT id FROM news_likes WHERE news_slug = ? AND actor_key = ?", (payload.slug, payload.actor_key)))
    if payload.liked and not liked:
        execute(
            "INSERT INTO news_likes(id, news_slug, actor_key, created_at) VALUES (?, ?, ?, ?)",
            (f"news_like_{uuid4().hex[:12]}", payload.slug, payload.actor_key, now_iso()),
        )
    if not payload.liked and liked:
        execute("DELETE FROM news_likes WHERE news_slug = ? AND actor_key = ?", (payload.slug, payload.actor_key))
    likes = int(row("SELECT COUNT(*) AS count FROM news_likes WHERE news_slug = ?", (payload.slug,))["count"])
    execute(
        """
        INSERT INTO news_social(news_slug, likes, comments_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(news_slug) DO UPDATE SET likes = excluded.likes, updated_at = excluded.updated_at
        """,
        (payload.slug, likes, "[]", now_iso()),
    )
    enqueue("social.like_event", {"type": "news", "key": payload.slug, "actor": payload.actor_key, "liked": payload.liked})
    return ok({"slug": payload.slug, "likes": likes, "liked": payload.liked})


@router.post("/news/social/comment")
def news_comment(payload: NewsCommentPayload):
    if not row("SELECT slug FROM news_posts WHERE slug = ? AND status = 'published'", (payload.slug,)):
        raise HTTPException(status_code=404, detail="News post not found")
    existing = row("SELECT likes, comments_json FROM news_social WHERE news_slug = ?", (payload.slug,))
    comments = parse_comments(existing["comments_json"] if existing else "[]")
    comments.append({"text": payload.comment.strip(), "createdAt": now_iso()})
    execute(
        """
        INSERT INTO news_social(news_slug, likes, comments_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(news_slug) DO UPDATE SET comments_json = excluded.comments_json, updated_at = excluded.updated_at
        """,
        (payload.slug, existing["likes"] if existing else 0, json.dumps(comments), now_iso()),
    )
    return ok({"slug": payload.slug, "comments": comments})


@router.get("/news")
def news(limit: int = Query(12, ge=1, le=48), offset: int = Query(0, ge=0), user: dict | None = Depends(optional_current_user)):
    total, posts = paged_news_posts(limit, offset)
    like_map = like_states("news", [item["slug"] for item in posts], user["id"] if user else None)
    for item in posts:
        state = like_map.get(item["slug"], {"like_count": 0, "liked_by_me": False})
        item["like_count"] = state["like_count"]
        item["liked_by_me"] = state["liked_by_me"]
    return ok(posts, meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.get("/news/bootstrap")
def news_bootstrap(actor_key: str = "", limit: int = Query(12, ge=1, le=48), offset: int = Query(0, ge=0), user: dict | None = Depends(optional_current_user)):
    total, posts = paged_news_posts(limit, offset)
    slugs = [item["slug"] for item in posts]
    social = news_social_map(actor_key, slugs, user["id"] if user else None)
    for item in posts:
        state = social.get(item["slug"], {"like_count": 0, "liked_by_me": False})
        item["like_count"] = state["like_count"]
        item["liked_by_me"] = state["liked_by_me"]
    return ok({"posts": posts, "social": social}, meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.get("/news/{slug}")
def news_detail(slug: str, user: dict | None = Depends(optional_current_user)):
    def build():
        post = row("SELECT * FROM news_posts WHERE slug = ? AND status = 'published'", (slug,))
        if not post:
            raise HTTPException(status_code=404, detail="News post not found")
        related = normalize_media_records(rows(
            """SELECT slug, title, image, category, short_description
               FROM news_posts
               WHERE status = 'published' AND slug != ? AND (sport = ? OR city = ?)
               ORDER BY published_at DESC LIMIT 3""",
            (slug, post["sport"], post["city"]),
        ), "news-related", {"image"}, "news_posts")
        post = attach_news_blocks(normalize_media_record(post, "news-detail", {"image"}, "news_posts"))
        post["related"] = related
        return post

    post = dict(get_or_set_json(cache_key("content:news-detail", slug), build))
    state = like_states("news", [post["slug"]], user["id"] if user else None).get(post["slug"], {"like_count": 0, "liked_by_me": False})
    post["like_count"] = state["like_count"]
    post["liked_by_me"] = state["liked_by_me"]
    return ok(post)


@router.get("/home/sports")
def home_sports():
    def build():
        apply_registration_window_statuses()
        data = []
        for sport in rows(
            """SELECT s.slug, s.name, s.active, s.color, COALESCE(v.show_on_home, 0) AS show_on_home,
                      COALESCE(v.sort_order, 99) AS sort_order
               FROM sports s
               LEFT JOIN sport_home_visibility v ON v.sport_slug = s.slug
               WHERE COALESCE(v.show_on_home, 0) = 1
               ORDER BY COALESCE(v.sort_order, 99), s.name"""
        ):
            counts = row(
                """SELECT
                     SUM(CASE WHEN status IN ('Registration Open', 'Upcoming', 'Registration Closed') THEN 1 ELSE 0 END) AS upcoming,
                     SUM(CASE WHEN status = 'Live' THEN 1 ELSE 0 END) AS live,
                     SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS old
                   FROM tournaments WHERE lower(sport) = lower(?)""",
                (sport["name"],),
            )
            sport["counts"] = {
                "upcoming": counts["upcoming"] or 0,
                "live": counts["live"] or 0,
                "old": counts["old"] or 0,
            }
            data.append(sport)
        return data

    return ok(get_or_set_json(cache_key("content:home-sports"), build))


@router.get("/leaderboards")
def leaderboards(sport: str = Query(default="Cricket")):
    records = get_or_set_json(cache_key("content:leaderboards", sport), lambda: rows(
        """SELECT sport, team_name, city, rank, tournaments_won, win_rate, points, record_label
           FROM leaderboard_records
           WHERE lower(sport) = lower(?)
           ORDER BY rank ASC, points DESC""",
        (sport,),
    ))
    return ok(records)
