from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.responses import ok
from app.db.database import execute, row, rows
from app.services.cache import cache_key, get_or_set_json
from app.services.tournament_status import apply_registration_window_statuses

router = APIRouter(tags=["content"])


class NewsLikePayload(BaseModel):
    slug: str = Field(min_length=2, max_length=220)
    liked: bool = True


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
            "content": json.loads(block["content_json"]).get("text", ""),
            "sortOrder": block["sort_order"],
        }
        for block in blocks
    ]
    return post


@router.get("/news/social")
def news_social():
    items = rows("SELECT news_slug, likes, comments_json FROM news_social")
    return ok({
        item["news_slug"]: {
            "likes": item["likes"],
            "comments": parse_comments(item["comments_json"]),
        }
        for item in items
    })


@router.post("/news/social/like")
def news_like(payload: NewsLikePayload):
    if not row("SELECT slug FROM news_posts WHERE slug = ? AND status = 'published'", (payload.slug,)):
        raise HTTPException(status_code=404, detail="News post not found")
    existing = row("SELECT likes FROM news_social WHERE news_slug = ?", (payload.slug,))
    likes = max(0, int(existing["likes"]) + (1 if payload.liked else -1)) if existing else (1 if payload.liked else 0)
    execute(
        """
        INSERT INTO news_social(news_slug, likes, comments_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(news_slug) DO UPDATE SET likes = excluded.likes, updated_at = excluded.updated_at
        """,
        (payload.slug, likes, "[]", now_iso()),
    )
    return ok({"slug": payload.slug, "likes": likes})


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
def news():
    return ok(get_or_set_json(cache_key("content:news"), lambda: [
        attach_news_blocks(item)
        for item in rows("SELECT * FROM news_posts WHERE status = 'published' ORDER BY published_at DESC, created_at DESC")
    ]))


@router.get("/news/{slug}")
def news_detail(slug: str):
    def build():
        post = row("SELECT * FROM news_posts WHERE slug = ? AND status = 'published'", (slug,))
        if not post:
            raise HTTPException(status_code=404, detail="News post not found")
        related = rows(
            """SELECT slug, title, image, category, short_description
               FROM news_posts
               WHERE status = 'published' AND slug != ? AND (sport = ? OR city = ?)
               ORDER BY published_at DESC LIMIT 3""",
            (slug, post["sport"], post["city"]),
        )
        post = attach_news_blocks(post)
        post["related"] = related
        return post

    return ok(get_or_set_json(cache_key("content:news-detail", slug), build))


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
