from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.responses import ok
from app.db.database import execute, row, rows
from app.services.cache import cache_key, get_or_set_json
from app.services.tournament_status import apply_registration_window_statuses, with_runtime_status

router = APIRouter(prefix="/public", tags=["public"])


class GalleryLikePayload(BaseModel):
    image_key: str = Field(min_length=3, max_length=220)
    liked: bool


class GalleryCommentPayload(BaseModel):
    image_key: str = Field(min_length=3, max_length=220)
    comment: str = Field(min_length=1, max_length=500)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_comments(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        return []
    return []


def gallery_social_item(image_key: str) -> dict:
    item = row("SELECT image_key, likes, comments_json FROM gallery_social WHERE image_key = ?", (image_key,))
    if not item:
        return {"image_key": image_key, "likes": 0, "comments": []}
    return {
        "image_key": item["image_key"],
        "likes": item["likes"],
        "comments": parse_comments(item["comments_json"]),
    }


def upsert_gallery_social(image_key: str, likes: int, comments: list[str]) -> dict:
    timestamp = now_iso()
    comments_json = json.dumps(comments)
    existing = row("SELECT image_key FROM gallery_social WHERE image_key = ?", (image_key,))
    if existing:
        execute(
            "UPDATE gallery_social SET likes = ?, comments_json = ?, updated_at = ? WHERE image_key = ?",
            (max(0, likes), comments_json, timestamp, image_key),
        )
    else:
        execute(
            "INSERT INTO gallery_social(image_key, likes, comments_json, updated_at) VALUES (?, ?, ?, ?)",
            (image_key, max(0, likes), comments_json, timestamp),
        )
    return gallery_social_item(image_key)


def attach_cities(item: dict) -> dict:
    item = with_runtime_status(item)
    item["cities"] = [
        city["city"]
        for city in rows("SELECT city FROM tournament_cities WHERE tournament_slug = ? ORDER BY sort_order, city", (item["slug"],))
    ]
    return item


@router.get("/home")
def home():
    def build():
        apply_registration_window_statuses()
        return {
            "stats": {
                "totalRevenue": "INR 12,84,500",
                "activeTournaments": 14,
                "totalTeams": 156,
                "liveMatches": 8,
            },
            "featuredTournaments": [with_runtime_status(item) for item in rows("SELECT * FROM tournaments LIMIT 3")],
            "liveMatches": rows("SELECT * FROM live_matches LIMIT 3"),
        }

    return ok(get_or_set_json(cache_key("public:home"), build))


@router.get("/gallery/social")
def gallery_social():
    records = rows("SELECT image_key, likes, comments_json FROM gallery_social ORDER BY updated_at DESC")
    return ok({
        item["image_key"]: {
            "likes": item["likes"],
            "comments": parse_comments(item["comments_json"]),
        }
        for item in records
    })


@router.get("/gallery/albums")
def gallery_albums():
    return ok(rows(
        """
        SELECT slug, title, sport, city, date_label, month_label, day_count, cover, summary
        FROM gallery_albums
        WHERE published = 1
        ORDER BY sort_order, month_label DESC, title
        """
    ))


@router.post("/gallery/social/like")
def gallery_social_like(payload: GalleryLikePayload):
    current = gallery_social_item(payload.image_key)
    likes = int(current["likes"]) + (1 if payload.liked else -1)
    return ok(upsert_gallery_social(payload.image_key, likes, current["comments"]))


@router.post("/gallery/social/comment")
def gallery_social_comment(payload: GalleryCommentPayload):
    current = gallery_social_item(payload.image_key)
    comments = [*current["comments"], payload.comment.strip()]
    return ok(upsert_gallery_social(payload.image_key, int(current["likes"]), comments))


@router.get("/tournaments")
def tournaments():
    def build():
        apply_registration_window_statuses()
        return [attach_cities(item) for item in rows("SELECT * FROM tournaments ORDER BY name")]

    return ok(get_or_set_json(cache_key("public:tournaments"), build))


@router.get("/tournaments/{slug}")
def tournament_detail(slug: str):
    def build():
        apply_registration_window_statuses()
        item = row("SELECT * FROM tournaments WHERE slug = ?", (slug,))
        if not item:
            raise HTTPException(status_code=404, detail="Tournament not found")
        return attach_cities(item)

    return ok(get_or_set_json(cache_key("public:tournament", slug), build))


@router.get("/tournaments/{slug}/bracket")
def tournament_bracket(slug: str):
    def build():
        apply_registration_window_statuses()
        item = row("SELECT * FROM tournaments WHERE slug = ?", (slug,))
        if not item:
            raise HTTPException(status_code=404, detail="Tournament not found")
        return {
            "tournament": item,
            "nodes": rows("SELECT id, label, team, round, x, y, status FROM bracket_nodes WHERE tournament_slug = ? ORDER BY x, y", (slug,)),
            "connections": rows("SELECT id, source_id, target_id FROM bracket_connections WHERE tournament_slug = ?", (slug,)),
        }

    return ok(get_or_set_json(cache_key("public:bracket", slug), build))


@router.get("/sports")
def sports():
    return ok(get_or_set_json(cache_key("public:sports"), lambda: rows("SELECT * FROM sports ORDER BY name")))


@router.get("/sports/{slug}")
def sport_detail(slug: str):
    def build():
        apply_registration_window_statuses()
        sport = row("SELECT * FROM sports WHERE slug = ?", (slug,))
        if not sport:
            raise HTTPException(status_code=404, detail="Sport not found")
        items = [attach_cities(item) for item in rows("SELECT * FROM tournaments WHERE lower(sport) = lower(?)", (sport["name"],))]
        sport["tournaments"] = items
        sport["groups"] = {
            "upcoming": [item for item in items if item["status"] in ("Registration Open", "Upcoming", "Registration Closed")],
            "live": [item for item in items if item["status"] == "Live"],
            "existing": [item for item in items if item["status"] == "Completed"],
        }
        return sport

    return ok(get_or_set_json(cache_key("public:sport", slug), build))


@router.get("/teams")
def teams():
    return ok(get_or_set_json(cache_key("public:teams"), lambda: rows("SELECT * FROM teams ORDER BY rating DESC")))


@router.get("/teams/{slug}")
def team_detail(slug: str):
    item = row("SELECT * FROM teams WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Team not found")
    return ok(item)


@router.get("/live")
def live_matches():
    return ok(get_or_set_json(cache_key("public:live"), lambda: rows("SELECT * FROM live_matches ORDER BY id"), ttl_seconds=10))


@router.get("/live/{match_id}")
def live_match(match_id: str):
    def build():
        match = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        match["timeline"] = rows("SELECT time, type, text, score, created_at FROM timeline_events WHERE match_id = ? ORDER BY id DESC", (match_id,))
        return match

    return ok(get_or_set_json(cache_key("public:live-match", match_id), build, ttl_seconds=10))


@router.get("/cms/{content_type}")
def cms(content_type: str):
    return ok(get_or_set_json(cache_key("public:cms", content_type), lambda: rows("SELECT * FROM cms_content WHERE lower(type) = lower(?) AND published = 1", (content_type,))))
