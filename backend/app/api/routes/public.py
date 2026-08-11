from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.services.cache import cache_key, get_or_set_json
from app.services.job_queue import enqueue
from app.services.media import normalize_media_record, normalize_media_records
from app.services.tournament_status import apply_registration_window_statuses, with_runtime_status

router = APIRouter(prefix="/public", tags=["public"])


class GalleryLikePayload(BaseModel):
    image_key: str = Field(min_length=3, max_length=220)
    liked: bool
    actor_key: str = Field(min_length=8, max_length=160)


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


def gallery_social_item(image_key: str, actor_key: str | None = None) -> dict:
    item = row("SELECT image_key, likes, comments_json FROM gallery_social WHERE image_key = ?", (image_key,))
    liked = bool(actor_key and row("SELECT id FROM gallery_likes WHERE image_key = ? AND actor_key = ?", (image_key, actor_key)))
    if not item:
        return {"image_key": image_key, "likes": 0, "comments": [], "liked": liked}
    return {
        "image_key": item["image_key"],
        "likes": item["likes"],
        "comments": parse_comments(item["comments_json"]),
        "liked": liked,
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


def gallery_album_records() -> list[dict]:
    return get_or_set_json(
        cache_key("public:gallery:albums"),
        lambda: normalize_media_records(rows(
            """
            SELECT slug, title, sport, city, date_label, month_label, day_count, cover, summary
            FROM gallery_albums
            WHERE published = 1
            ORDER BY sort_order, month_label DESC, title
            """
        ), "gallery", {"cover"}, "gallery_albums"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    )


def gallery_album_page(limit: int, offset: int) -> tuple[int, list[dict]]:
    safe_limit = max(1, min(limit, 48))
    safe_offset = max(0, offset)
    total = int(row("SELECT COUNT(*) AS count FROM gallery_albums WHERE published = 1")["count"] or 0)
    albums = get_or_set_json(
        cache_key("public:gallery:albums", safe_limit, safe_offset),
        lambda: normalize_media_records(rows(
            """
            SELECT slug, title, sport, city, date_label, month_label, day_count, cover, summary
            FROM gallery_albums
            WHERE published = 1
            ORDER BY sort_order, title
            LIMIT ? OFFSET ?
            """,
            (safe_limit, safe_offset),
        ), "gallery", {"cover"}, "gallery_albums"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    )
    return total, albums


def gallery_social_map(actor_key: str = "", image_keys: list[str] | None = None) -> dict:
    params: tuple[str, ...] = ()
    where_clause = ""
    if image_keys:
        placeholders = ",".join(["?"] * len(image_keys))
        where_clause = f"WHERE image_key IN ({placeholders})"
        params = tuple(image_keys)
    records = rows(
        f"SELECT image_key, likes, comments_json FROM gallery_social {where_clause} ORDER BY updated_at DESC",
        params,
    )
    liked_keys: set[str] = set()
    if actor_key:
        if image_keys:
            placeholders = ",".join(["?"] * len(image_keys))
            liked_rows = rows(
                f"SELECT image_key FROM gallery_likes WHERE actor_key = ? AND image_key IN ({placeholders})",
                (actor_key, *image_keys),
            )
        else:
            liked_rows = rows("SELECT image_key FROM gallery_likes WHERE actor_key = ?", (actor_key,))
        liked_keys = {item["image_key"] for item in liked_rows}
    social = {
        item["image_key"]: {
            "likes": item["likes"],
            "comments": parse_comments(item["comments_json"]),
            "liked": item["image_key"] in liked_keys,
        }
        for item in records
    }
    for image_key in image_keys or []:
        social.setdefault(image_key, {"likes": 0, "comments": [], "liked": image_key in liked_keys})
    return social


def attach_cities(item: dict) -> dict:
    return attach_tournament_metadata([item])[0]


def attach_tournament_metadata(items: list[dict]) -> list[dict]:
    if not items:
        return []
    slugs = [item["slug"] for item in items]
    placeholders = ",".join(["?"] * len(slugs))
    try:
        registration_rows = rows(
            f"""
            SELECT tournament_slug, COUNT(*) AS count
            FROM registrations
            WHERE tournament_slug IN ({placeholders}) AND COALESCE(status, '') NOT IN ('rejected', 'cancelled')
            GROUP BY tournament_slug
            """,
            tuple(slugs),
        )
    except Exception:
        registration_rows = []
    registration_counts = {item["tournament_slug"]: int(item["count"] or 0) for item in registration_rows}
    cities_by_slug: dict[str, list[str]] = {slug: [] for slug in slugs}
    try:
        city_rows = rows(
            f"SELECT tournament_slug, city FROM tournament_cities WHERE tournament_slug IN ({placeholders}) ORDER BY sort_order, city",
            tuple(slugs),
        )
    except Exception:
        city_rows = []
    for city in city_rows:
        cities_by_slug.setdefault(city["tournament_slug"], []).append(city["city"])
    prizes_by_slug: dict[str, list[dict]] = {slug: [] for slug in slugs}
    try:
        prize_rows = rows(
            f"SELECT tournament_slug, position, label, amount, sort_order FROM tournament_prizes WHERE tournament_slug IN ({placeholders}) ORDER BY sort_order, position",
            tuple(slugs),
        )
    except Exception:
        prize_rows = []
    for prize in prize_rows:
        prizes_by_slug.setdefault(prize["tournament_slug"], []).append(prize)
    try:
        published_matches = rows(
            f"SELECT tournament_slug, round FROM group_bracket_matches WHERE tournament_slug IN ({placeholders}) AND published = 1",
            tuple(slugs),
        )
    except Exception:
        published_matches = []
    match_counts: dict[str, int] = {slug: 0 for slug in slugs}
    rounds_by_slug: dict[str, set[str]] = {slug: set() for slug in slugs}
    for match in published_matches:
        slug = match["tournament_slug"]
        match_counts[slug] = match_counts.get(slug, 0) + 1
        if match.get("round"):
            rounds_by_slug.setdefault(slug, set()).add(match["round"])

    enriched: list[dict] = []
    for raw_item in items:
        item = with_runtime_status(raw_item)
        item["teams"] = registration_counts.get(item["slug"], 0)
        item["registered_count"] = item["teams"]
        capacity = int(item.get("capacity") or 0)
        item["slots_full"] = capacity > 0 and item["teams"] >= capacity
        item["cities"] = cities_by_slug.get(item["slug"], [])
        item["prizes"] = prizes_by_slug.get(item["slug"], [])
        item["published_match_count"] = match_counts.get(item["slug"], 0)
        item["published_round_count"] = len(rounds_by_slug.get(item["slug"], set()))
        try:
            item["fee_breakdown"] = json.loads(item.get("fee_breakdown_json") or "[]")
        except json.JSONDecodeError:
            item["fee_breakdown"] = []
        enriched.append(item)
    return enriched


def tournament_registration_count(tournament_slug: str) -> int:
    registration_count = row(
        """
        SELECT COUNT(*) AS count
        FROM registrations
        WHERE tournament_slug = ? AND status NOT IN ('rejected', 'cancelled')
        """,
        (tournament_slug,),
    )
    return int(registration_count["count"] or 0) if registration_count else 0


def default_jersey_svg(label: str, color: str) -> str:
    svg = (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='320' height='220' viewBox='0 0 320 220'>"
        "<rect width='320' height='220' rx='26' fill='#f5fbf6'/>"
        f"<path d='M111 31h98l22 18 34 12-17 35-25-8v96H77V88l-25 8-17-35 34-12 22-18z' fill='{color}' stroke='#0b1b33' stroke-width='6'/>"
        "<path d='M121 31c10 18 24 26 39 26s29-8 39-26' fill='none' stroke='#0b1b33' stroke-width='6' stroke-linecap='round'/>"
        f"<text x='160' y='188' text-anchor='middle' font-family='Arial,sans-serif' font-size='24' font-weight='700' fill='#0b1b33'>{label}</text>"
        "</svg>"
    )
    from urllib.parse import quote
    return f"data:image/svg+xml;utf8,{quote(svg)}"


def tournament_jersey_options(tournament_slug: str) -> list[dict]:
    tournament = row("SELECT slug, capacity FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    uploaded = rows(
        "SELECT id, label, image, sort_order FROM tournament_jerseys WHERE tournament_slug = ? ORDER BY sort_order, label",
        (tournament_slug,),
    )
    reserved = {
        item["selected_jersey_image"]
        for item in rows(
            "SELECT selected_jersey_image FROM registrations WHERE tournament_slug = ? AND payment_status = 'paid' AND selected_jersey_image <> ''",
            (tournament_slug,),
        )
    }
    return [{**item, "reserved": item["image"] in reserved} for item in uploaded]


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
            "featuredTournaments": attach_tournament_metadata(rows("SELECT * FROM tournaments LIMIT 3")),
            "liveMatches": normalize_media_records(rows("SELECT * FROM live_matches LIMIT 3"), "home-live-match", {"image"}, "live_matches", "id"),
            "discoveryCards": normalize_media_records(rows("SELECT * FROM home_discovery_cards WHERE published = 1 ORDER BY sort_order, title LIMIT 8"), "home-discovery", {"image", "sponsor_image"}, "home_discovery_cards"),
            "liveHighlight": normalize_media_record(row("SELECT * FROM live_highlights WHERE published = 1 ORDER BY sort_order, title LIMIT 1") or {}, "live-highlight", {"image"}, "live_highlights", "id") or None,
            "sponsorLogos": normalize_media_records(rows("SELECT * FROM sponsor_logos WHERE published = 1 ORDER BY sort_order, name LIMIT 12"), "sponsor", {"image"}, "sponsor_logos"),
            "organizerCards": rows("SELECT * FROM home_organizer_cards WHERE published = 1 ORDER BY sort_order, title LIMIT 6"),
            "announcements": normalize_media_records(rows("SELECT * FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 3"), "announcement", {"image"}, "announcements", "id"),
            "newsPosts": normalize_media_records(rows(
                """
                SELECT slug, title, short_description, image, category, sport, city,
                       tournament_slug, is_highlight, published_at, created_at
                FROM news_posts
                WHERE status = 'published'
                ORDER BY published_at DESC, created_at DESC
                LIMIT 6
                """
            ), "home-news", {"image"}, "news_posts"),
        }

    return ok(get_or_set_json(cache_key("public:home"), build))


@router.get("/home/notice")
def home_notice():
    return ok(get_or_set_json(
        cache_key("public:home:notice"),
        lambda: normalize_media_records(rows("SELECT * FROM announcements WHERE published = 1 ORDER BY created_at DESC LIMIT 3"), "announcement", {"image"}, "announcements", "id"),
    ))


@router.get("/home/discovery")
def home_discovery(limit: int = Query(8, ge=1, le=24), offset: int = Query(0, ge=0)):
    return ok(get_or_set_json(
        cache_key("public:home:discovery", limit, offset),
        lambda: normalize_media_records(rows("SELECT * FROM home_discovery_cards WHERE published = 1 ORDER BY sort_order, title LIMIT ? OFFSET ?", (limit, offset)), "home-discovery", {"image", "sponsor_image"}, "home_discovery_cards"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    ))


@router.get("/home/live-highlight")
def home_live_highlight():
    return ok(get_or_set_json(
        cache_key("public:home:live-highlight"),
        lambda: normalize_media_record(row("SELECT * FROM live_highlights WHERE published = 1 ORDER BY sort_order, title LIMIT 1") or {}, "live-highlight", {"image"}, "live_highlights", "id") or None,
    ))


@router.get("/home/organizers")
def home_organizers(limit: int = Query(6, ge=1, le=24), offset: int = Query(0, ge=0)):
    return ok(get_or_set_json(
        cache_key("public:home:organizers", limit, offset),
        lambda: rows("SELECT * FROM home_organizer_cards WHERE published = 1 ORDER BY sort_order, title LIMIT ? OFFSET ?", (limit, offset)),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    ))


@router.get("/home/sponsors")
def home_sponsors(limit: int = Query(12, ge=1, le=48), offset: int = Query(0, ge=0)):
    return ok(get_or_set_json(
        cache_key("public:home:sponsors", limit, offset),
        lambda: normalize_media_records(rows("SELECT * FROM sponsor_logos WHERE published = 1 ORDER BY sort_order, name LIMIT ? OFFSET ?", (limit, offset)), "sponsor", {"image"}, "sponsor_logos"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    ))


@router.get("/home/news")
def home_news():
    return ok(get_or_set_json(
        cache_key("public:home:news"),
        lambda: normalize_media_records(rows(
            """
            SELECT slug, title, short_description, image, category, sport, city,
                   tournament_slug, is_highlight, published_at, created_at
            FROM news_posts
            WHERE status = 'published'
            ORDER BY published_at DESC, created_at DESC
            LIMIT 6
            """
        ), "home-news", {"image"}, "news_posts"),
        ttl_seconds=max(settings.public_cache_ttl_seconds, 300),
    ))


@router.get("/announcements")
def published_announcements():
    return ok(rows("SELECT * FROM announcements WHERE published = 1 ORDER BY created_at DESC"))


@router.get("/gallery/social")
def gallery_social(actor_key: str = ""):
    return ok(gallery_social_map(actor_key))


@router.get("/gallery/albums")
def gallery_albums(limit: int = Query(12, ge=1, le=48), offset: int = Query(0, ge=0)):
    total, albums = gallery_album_page(limit, offset)
    return ok(albums, meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.get("/gallery/bootstrap")
def gallery_bootstrap(actor_key: str = "", limit: int = Query(12, ge=1, le=48), offset: int = Query(0, ge=0)):
    total, albums = gallery_album_page(limit, offset)
    image_keys = [f"album:{item['slug']}" for item in albums]
    return ok({"albums": albums, "social": gallery_social_map(actor_key, image_keys)}, meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.post("/gallery/social/like")
def gallery_social_like(payload: GalleryLikePayload):
    current = gallery_social_item(payload.image_key, payload.actor_key)
    if payload.liked and not current["liked"]:
        execute(
            "INSERT INTO gallery_likes(id, image_key, actor_key, created_at) VALUES (?, ?, ?, ?)",
            (f"gallery_like_{uuid4().hex[:12]}", payload.image_key, payload.actor_key, now_iso()),
        )
    if not payload.liked and current["liked"]:
        execute("DELETE FROM gallery_likes WHERE image_key = ? AND actor_key = ?", (payload.image_key, payload.actor_key))
    likes = int(row("SELECT COUNT(*) AS count FROM gallery_likes WHERE image_key = ?", (payload.image_key,))["count"])
    updated = upsert_gallery_social(payload.image_key, likes, current["comments"])
    enqueue("social.like_event", {"type": "gallery", "key": payload.image_key, "actor": payload.actor_key, "liked": payload.liked})
    return ok({**updated, "liked": payload.liked})


@router.post("/gallery/social/comment")
def gallery_social_comment(payload: GalleryCommentPayload):
    current = gallery_social_item(payload.image_key)
    comments = [*current["comments"], payload.comment.strip()]
    return ok(upsert_gallery_social(payload.image_key, int(current["likes"]), comments))


@router.get("/tournaments")
def tournaments():
    def build():
        apply_registration_window_statuses()
        return normalize_media_records(attach_tournament_metadata(rows("SELECT * FROM tournaments ORDER BY name")), "tournament", {"image", "poster", "rules_pdf"}, "tournaments")

    return ok(get_or_set_json(cache_key("public:tournaments"), build))


@router.get("/tournaments/{slug}")
def tournament_detail(slug: str):
    def build():
        apply_registration_window_statuses()
        item = row("SELECT * FROM tournaments WHERE slug = ?", (slug,))
        if not item:
            raise HTTPException(status_code=404, detail="Tournament not found")
        return normalize_media_record(attach_cities(item), "tournament", {"image", "poster", "rules_pdf"}, "tournaments")

    return ok(get_or_set_json(cache_key("public:tournament", slug), build))


@router.get("/tournaments/{slug}/jerseys")
def tournament_jerseys(slug: str):
    return ok(tournament_jersey_options(slug))


@router.get("/tournaments/{slug}/bracket")
def tournament_bracket(slug: str):
    def build():
        apply_registration_window_statuses()
        item = row("SELECT * FROM tournaments WHERE slug = ?", (slug,))
        if not item:
            raise HTTPException(status_code=404, detail="Tournament not found")
        return {
            "tournament": item,
            "nodes": rows("SELECT id, label, team, round, x, y, status, bucket, scheduled_at FROM bracket_nodes WHERE tournament_slug = ? ORDER BY bucket, x, y", (slug,)),
            "connections": rows("SELECT id, source_id, target_id FROM bracket_connections WHERE tournament_slug = ?", (slug,)),
            "roundSchedules": rows("SELECT round, bucket, scheduled_at FROM bracket_round_schedules WHERE tournament_slug = ? ORDER BY round, bucket", (slug,)),
            "matches": rows(
                """SELECT id, round, team_1, team_2, starts_at, ends_at, status, sort_order
                   FROM group_bracket_matches
                   WHERE tournament_slug = ? AND published = 1
                   ORDER BY sort_order, round""",
                (slug,),
            ),
        }

    return ok(get_or_set_json(cache_key("public:bracket", slug), build))


@router.get("/sports")
def sports():
    return ok(get_or_set_json(cache_key("public:sports"), lambda: rows("SELECT * FROM sports ORDER BY name")))


@router.get("/home-discovery/{slug}")
def home_discovery_detail(slug: str):
    def build():
        apply_registration_window_statuses()
        card = row("SELECT * FROM home_discovery_cards WHERE slug = ? AND published = 1", (slug,))
        if not card:
            normalized = slug.lower().strip()
            for item in rows("SELECT * FROM home_discovery_cards WHERE published = 1 ORDER BY sort_order"):
                sport_slug = item["sport"].lower().replace(" ", "-")
                label_slug = item["label"].lower().replace(" ", "-")
                title_slug = item["title"].lower().replace(" ", "-")
                if normalized in {sport_slug, label_slug, title_slug}:
                    card = item
                    break
        if not card:
            sport = row("SELECT * FROM sports WHERE slug = ?", (slug,))
            if not sport:
                raise HTTPException(status_code=404, detail="Discovery card not found")
            tournament = row("SELECT * FROM tournaments WHERE lower(sport) = lower(?) ORDER BY show_on_home DESC, created_at DESC LIMIT 1", (sport["name"],))
            card = {
                "slug": sport["slug"],
                "label": f"{sport['name']} Program",
                "title": f"{sport['name']} Tournament Operations",
                "sport": sport["name"],
                "tournament_slug": tournament["slug"] if tournament else "",
                "sponsor_name": "SmartSportz",
                "sponsor_image": "/assets/logo.png",
                "image": sport["image"] if "image" in sport.keys() else "/assets/logo.png",
                "event_date": "Manager scheduled",
                "description": f"{sport['name']} programs can publish sponsors, tournament dates, registrations, live updates, gallery media, and manager-controlled public content from Smart Sportz.",
                "sponsor_details": "SmartSportz provides the tournament operations layer for discovery, registrations, brackets, scoring, gallery, and news content.",
                "register_path": f"/sports/{sport['slug']}",
                "sort_order": 99,
                "published": 1,
            }
        tournament = None
        if card["tournament_slug"]:
            tournament = row("SELECT * FROM tournaments WHERE slug = ?", (card["tournament_slug"],))
            if tournament:
                tournament = attach_cities(tournament)
        card["tournament"] = tournament
        return card

    return ok(get_or_set_json(cache_key("public:home-discovery", slug), build))


@router.get("/sports/{slug}")
def sport_detail(slug: str):
    def build():
        apply_registration_window_statuses()
        sport = row("SELECT * FROM sports WHERE slug = ?", (slug,))
        if not sport:
            raise HTTPException(status_code=404, detail="Sport not found")
        items = attach_tournament_metadata(rows("SELECT * FROM tournaments WHERE lower(sport) = lower(?)", (sport["name"],)))
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
