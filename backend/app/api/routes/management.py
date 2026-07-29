from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.config import settings
from app.core.responses import ok
from app.db.database import execute, execute_many, row, rows
from app.schemas import BracketSavePayload, NewsPostPayload, NotificationSendPayload, SportHomeVisibilityPayload, TournamentCitiesPayload, TournamentRegistrationWindowPayload, TournamentTeamSizePayload, WinnerAdvancePayload
from app.services.audit import log
from app.services.cache import cache_key, get_or_set_json
from app.services.tournament_status import apply_registration_window_statuses, runtime_status, accent_for_status

router = APIRouter(prefix="/management", tags=["management"])


def manager_cities(user: dict) -> list[str]:
    if user["role"] == "super_admin":
        return [item["city"] for item in rows("SELECT DISTINCT city FROM tournament_cities ORDER BY city")]
    return [
        item["city"]
        for item in rows("SELECT city FROM manager_city_assignments WHERE manager_user_id = ? ORDER BY city", (user["id"],))
    ]


def ensure_city_access(user: dict, city: str) -> None:
    if user["role"] == "super_admin":
        return
    if city.lower() not in [item.lower() for item in manager_cities(user)]:
        raise HTTPException(status_code=403, detail="Manager is not assigned to this city")


def slugify(title: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return value or f"news-{uuid4().hex[:8]}"


@router.get("/dashboard")
def dashboard(user: dict = Depends(require_roles("super_admin", "management"))):
    def build():
        cities = manager_cities(user)
        if user["role"] != "super_admin" and not cities:
            return {"assignedCities": [], "assignedTournaments": [], "pendingRegistrations": [], "liveMatches": []}
        tournament_filter = "" if user["role"] == "super_admin" else f" AND location IN ({','.join(['?'] * len(cities))})"
        registration_filter = "" if user["role"] == "super_admin" else f" AND city IN ({','.join(['?'] * len(cities))})"
        return {
            "assignedCities": cities,
            "assignedTournaments": rows(f"SELECT * FROM tournaments WHERE status IN ('Registration Open', 'Live'){tournament_filter}", cities),
            "pendingRegistrations": rows(f"SELECT * FROM registrations WHERE status IN ('pending_payment', 'pending_approval'){registration_filter}", cities),
            "liveMatches": rows("SELECT * FROM live_matches"),
        }

    return ok(get_or_set_json(cache_key("management:dashboard", user["id"], user["role"]), build, settings.dashboard_cache_ttl_seconds))


@router.get("/tournaments")
def tournaments(user: dict = Depends(require_roles("super_admin", "management"))):
    def build():
        cities = manager_cities(user)
        if user["role"] == "super_admin" or not cities:
            return rows("SELECT * FROM tournaments ORDER BY name")
        return rows(f"SELECT * FROM tournaments WHERE location IN ({','.join(['?'] * len(cities))}) ORDER BY name", cities)

    return ok(get_or_set_json(cache_key("management:tournaments", user["id"], user["role"]), build, settings.dashboard_cache_ttl_seconds))


@router.get("/news")
def manager_news(user: dict = Depends(require_roles("super_admin", "management"))):
    def build():
        cities = manager_cities(user)
        if user["role"] != "super_admin" and not cities:
            return {"assignedCities": [], "posts": [], "sports": []}
        params = [] if user["role"] == "super_admin" else cities
        where = "" if user["role"] == "super_admin" else f"WHERE city IN ({','.join(['?'] * len(cities))})"
        return {
            "assignedCities": cities,
            "posts": rows(f"SELECT * FROM news_posts {where} ORDER BY updated_at DESC", params),
            "sports": rows(
                """SELECT s.slug, s.name, s.color, COALESCE(v.show_on_home, 0) AS show_on_home, COALESCE(v.sort_order, 99) AS sort_order
                   FROM sports s LEFT JOIN sport_home_visibility v ON v.sport_slug = s.slug
                   ORDER BY COALESCE(v.sort_order, 99), s.name"""
            ),
        }

    return ok(get_or_set_json(cache_key("management:news", user["id"], user["role"]), build, settings.dashboard_cache_ttl_seconds))


@router.post("/news")
def create_news(payload: NewsPostPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    ensure_city_access(user, payload.city)
    base_slug = slugify(payload.title)
    slug = base_slug
    counter = 2
    while row("SELECT slug FROM news_posts WHERE slug = ?", (slug,)):
        slug = f"{base_slug}-{counter}"
        counter += 1
    now = datetime.now(timezone.utc).isoformat()
    published_at = now if payload.status == "published" else None
    execute(
        """INSERT INTO news_posts(slug, title, short_description, image, category, sport, tournament_slug, city, status, author_id, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (slug, payload.title, payload.short_description, payload.image, payload.category, payload.sport, payload.tournament_slug, payload.city, payload.status, user["id"], published_at, now, now),
    )
    statements = [
        (
            "INSERT INTO news_blocks(id, post_slug, block_type, content_json, sort_order) VALUES (?, ?, ?, ?, ?)",
            (f"nblock_{uuid4().hex[:10]}", slug, block.block_type, json.dumps({"text": block.content}), index),
        )
        for index, block in enumerate(payload.blocks, start=1)
    ]
    if statements:
        execute_many(statements)
    log(user["email"], "news_created", "news", slug, f"News post created for {payload.city}")
    return ok(row("SELECT * FROM news_posts WHERE slug = ?", (slug,)), "News post created")


@router.patch("/news/{slug}")
def update_news(slug: str, payload: NewsPostPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM news_posts WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="News post not found")
    ensure_city_access(user, item["city"])
    ensure_city_access(user, payload.city)
    now = datetime.now(timezone.utc).isoformat()
    published_at = item["published_at"] or (now if payload.status == "published" else None)
    execute(
        """UPDATE news_posts
           SET title = ?, short_description = ?, image = ?, category = ?, sport = ?, tournament_slug = ?, city = ?, status = ?, published_at = ?, updated_at = ?
           WHERE slug = ?""",
        (payload.title, payload.short_description, payload.image, payload.category, payload.sport, payload.tournament_slug, payload.city, payload.status, published_at, now, slug),
    )
    execute("DELETE FROM news_blocks WHERE post_slug = ?", (slug,))
    statements = [
        (
            "INSERT INTO news_blocks(id, post_slug, block_type, content_json, sort_order) VALUES (?, ?, ?, ?, ?)",
            (f"nblock_{uuid4().hex[:10]}", slug, block.block_type, json.dumps({"text": block.content}), index),
        )
        for index, block in enumerate(payload.blocks, start=1)
    ]
    if statements:
        execute_many(statements)
    log(user["email"], "news_updated", "news", slug, f"News post updated for {payload.city}")
    return ok(row("SELECT * FROM news_posts WHERE slug = ?", (slug,)), "News post updated")


@router.patch("/sports/{sport_slug}/home-visibility")
def update_sport_home_visibility(sport_slug: str, payload: SportHomeVisibilityPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    sport = row("SELECT slug FROM sports WHERE slug = ?", (sport_slug,))
    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")
    execute(
        """INSERT INTO sport_home_visibility(sport_slug, show_on_home, sort_order, updated_by)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(sport_slug) DO UPDATE SET show_on_home = excluded.show_on_home, sort_order = excluded.sort_order, updated_by = excluded.updated_by""",
        (sport_slug, int(payload.show_on_home), payload.sort_order, user["id"]),
    )
    log(user["email"], "sport_home_visibility_updated", "sport", sport_slug, f"Show on home: {payload.show_on_home}")
    return ok(row("SELECT * FROM sport_home_visibility WHERE sport_slug = ?", (sport_slug,)), "Sport homepage visibility updated")


@router.patch("/tournaments/{tournament_slug}/team-size")
def update_team_size(tournament_slug: str, payload: TournamentTeamSizePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    execute("UPDATE tournaments SET team_size = ? WHERE slug = ?", (payload.team_size, tournament_slug))
    log(user["email"], "tournament_team_size_updated", "tournament", tournament_slug, f"Team size set to {payload.team_size}")
    return ok(row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)), "Tournament team size updated")


@router.patch("/tournaments/{tournament_slug}/registration-window")
def update_registration_window(tournament_slug: str, payload: TournamentRegistrationWindowPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    draft = {**item, "status": payload.status, "registration_start": payload.registration_start, "registration_end": payload.registration_end}
    computed_status = runtime_status(draft)
    computed_accent = accent_for_status(computed_status, item.get("accent", "blue"))
    execute(
        "UPDATE tournaments SET status = ?, accent = ?, registration_start = ?, registration_end = ? WHERE slug = ?",
        (computed_status, computed_accent, payload.registration_start, payload.registration_end, tournament_slug),
    )
    apply_registration_window_statuses()
    log(user["email"], "tournament_registration_window_updated", "tournament", tournament_slug, f"{payload.status}: {payload.registration_start} to {payload.registration_end}")
    return ok(row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)), "Tournament registration window updated")


@router.patch("/tournaments/{tournament_slug}/cities")
def update_tournament_cities(tournament_slug: str, payload: TournamentCitiesPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    clean_cities: list[str] = []
    for city in payload.cities:
        value = " ".join(city.strip().split())
        if value and value.lower() not in [existing.lower() for existing in clean_cities]:
            clean_cities.append(value)
    if not clean_cities:
        return ok({"updated": False, "reason": "At least one city is required"}, "At least one city is required")
    execute("DELETE FROM tournament_cities WHERE tournament_slug = ?", (tournament_slug,))
    statements = [
        (
            "INSERT INTO tournament_cities(id, tournament_slug, city, sort_order) VALUES (?, ?, ?, ?)",
            (f"city_{uuid4().hex[:10]}", tournament_slug, city, index),
        )
        for index, city in enumerate(clean_cities, start=1)
    ]
    execute_many(statements)
    log(user["email"], "tournament_cities_updated", "tournament", tournament_slug, f"Cities set to {', '.join(clean_cities)}")
    return ok({
        "tournament": row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)),
        "cities": rows("SELECT city FROM tournament_cities WHERE tournament_slug = ? ORDER BY sort_order", (tournament_slug,)),
    }, "Tournament cities updated")


@router.post("/registrations/{registration_id}/approve")
def approve_registration(registration_id: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        return ok({"approved": False, "reason": "Registration not found"}, "Registration not found")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("accepted", registration_id))
    log(user["email"], "registration_accepted", "registration", registration_id, f"Accepted {item['team_name']}")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration accepted")


@router.post("/registrations/{registration_id}/reject")
def reject_registration(registration_id: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        return ok({"rejected": False, "reason": "Registration not found"}, "Registration not found")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("rejected", registration_id))
    log(user["email"], "registration_rejected", "registration", registration_id, f"Rejected {item['team_name']}")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration rejected")


@router.get("/brackets/{tournament_slug}")
def bracket_workspace(tournament_slug: str, _: dict = Depends(require_roles("super_admin", "management"))):
    accepted = rows(
        """SELECT id, team_name AS name, captain_name, status
           FROM registrations
           WHERE tournament_slug = ? AND status = 'accepted'
           ORDER BY created_at""",
        (tournament_slug,),
    )
    if not accepted:
        accepted = rows("SELECT slug AS id, name, sport AS captain_name, 'Accepted' AS status FROM teams ORDER BY rating DESC LIMIT 8")
    return ok({
        "acceptedTeams": accepted,
        "nodes": rows("SELECT id, label, team, round, x, y, status FROM bracket_nodes WHERE tournament_slug = ? ORDER BY x, y", (tournament_slug,)),
        "connections": rows("SELECT id, source_id, target_id FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,)),
        "notifications": rows("SELECT * FROM notification_events WHERE tournament_slug = ? ORDER BY created_at DESC LIMIT 10", (tournament_slug,)),
    })


@router.post("/brackets/{tournament_slug}/save")
def save_bracket(tournament_slug: str, payload: BracketSavePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    execute("DELETE FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM bracket_nodes WHERE tournament_slug = ?", (tournament_slug,))
    statements: list[tuple[str, tuple]] = []
    for node in payload.nodes:
        statements.append((
            "INSERT INTO bracket_nodes(id, tournament_slug, label, team, round, x, y, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (node.id, tournament_slug, node.label, node.team or "", node.round, node.x, node.y, node.status),
        ))
    for connection in payload.connections:
        statements.append((
            "INSERT INTO bracket_connections(id, tournament_slug, source_id, target_id) VALUES (?, ?, ?, ?)",
            (connection.id or f"conn_{uuid4().hex[:10]}", tournament_slug, connection.source_id, connection.target_id),
        ))
    execute_many(statements)
    log(user["email"], "bracket_saved", "tournament", tournament_slug, payload.audit_reason)
    return bracket_workspace(tournament_slug, user)


@router.post("/brackets/{tournament_slug}/advance-winner")
def advance_winner(tournament_slug: str, payload: WinnerAdvancePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    execute(
        "UPDATE bracket_nodes SET team = ?, label = ?, status = ? WHERE tournament_slug = ? AND id = ?",
        (payload.winner_team, payload.winner_team, "winner", tournament_slug, payload.target_node_id),
    )
    log(user["email"], "winner_advanced", "bracket_node", payload.target_node_id, payload.audit_reason)
    return ok(row("SELECT * FROM bracket_nodes WHERE tournament_slug = ? AND id = ?", (tournament_slug, payload.target_node_id)), "Winner advanced")


@router.post("/brackets/{tournament_slug}/notify")
def notify_bracket(tournament_slug: str, payload: NotificationSendPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    event_id = f"notify_{uuid4().hex[:12]}"
    execute(
        "INSERT INTO notification_events(id, tournament_slug, audience, channels, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event_id, tournament_slug, payload.audience, ",".join(payload.channels), payload.message, "local_sent", datetime.now(timezone.utc).isoformat()),
    )
    log(user["email"], "manual_notification_sent", "notification", event_id, f"Sent bracket notification via {', '.join(payload.channels)}")
    return ok(row("SELECT * FROM notification_events WHERE id = ?", (event_id,)), "Manual notification stored locally")


@router.get("/matches")
def matches(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(get_or_set_json(cache_key("management:matches"), lambda: rows("SELECT * FROM live_matches ORDER BY id"), 10))


@router.get("/players")
def players(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok([
        {"name": "Rohan Sharma", "team": "India Forge", "status": "Verified"},
        {"name": "Aryan Patel", "team": "Mumbai Mavericks", "status": "Pending Documents"},
        {"name": "Kavin Raj", "team": "Chennai Chargers", "status": "Verified"},
    ])


@router.get("/reports")
def reports(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok([
        {"name": "Tournament revenue", "status": "Ready"},
        {"name": "Registration funnel", "status": "Ready"},
        {"name": "Venue utilization", "status": "Draft"},
        {"name": "Live score audit", "status": "Ready"},
    ])
