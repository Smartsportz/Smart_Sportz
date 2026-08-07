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
from app.schemas import BracketSavePayload, NewsPostPayload, NotificationSendPayload, SportHomeVisibilityPayload, TournamentCitiesPayload, TournamentJerseysPayload, TournamentRegistrationWindowPayload, TournamentTeamSizePayload, TournamentUpsertPayload, WinnerAdvancePayload
from app.services.audit import log
from app.services.cache import cache_key, get_or_set_json
from app.services.notifications import send_sms_message, send_whatsapp_message
from app.services.tournament_status import apply_registration_window_statuses, runtime_status, accent_for_status

router = APIRouter(prefix="/management", tags=["management"])


def manager_cities(user: dict) -> list[str]:
    if user["role"] == "super_admin":
        return [item["city"] for item in rows("SELECT DISTINCT city FROM tournament_cities ORDER BY city")]
    return [
        item["city"]
        for item in rows("SELECT city FROM manager_city_assignments WHERE manager_user_id = ? ORDER BY city", (user["id"],))
    ]


def manager_tournament_slugs(user: dict) -> list[str]:
    if user["role"] == "super_admin":
        return []
    return [
        item["tournament_slug"]
        for item in rows("SELECT tournament_slug FROM tournament_manager_assignments WHERE manager_user_id = ? ORDER BY tournament_slug", (user["id"],))
    ]


def ensure_city_access(user: dict, city: str) -> None:
    if user["role"] == "super_admin":
        return
    if city.lower() not in [item.lower() for item in manager_cities(user)]:
        raise HTTPException(status_code=403, detail="Manager is not assigned to this city")


def ensure_tournament_access(user: dict, item: dict) -> None:
    if user["role"] == "super_admin":
        return
    allowed_cities = [city.lower() for city in manager_cities(user)]
    if str(item.get("location", "")).lower() in allowed_cities:
        return
    if item.get("slug") in manager_tournament_slugs(user):
        return
    raise HTTPException(status_code=403, detail="Manager is not assigned to this tournament")


def slugify(title: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return value or f"news-{uuid4().hex[:8]}"


def tournament_slugify(title: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return value or f"tournament-{uuid4().hex[:8]}"


def _clean_unique(values: list[str]) -> list[str]:
    clean: list[str] = []
    for item in values:
        value = " ".join(str(item).strip().split())
        if value and value.lower() not in [existing.lower() for existing in clean]:
            clean.append(value)
    return clean


def _save_tournament_children(slug: str, payload: TournamentUpsertPayload) -> None:
    clean_cities = _clean_unique(payload.cities or [payload.location])
    execute("DELETE FROM tournament_cities WHERE tournament_slug = ?", (slug,))
    execute("DELETE FROM tournament_prizes WHERE tournament_slug = ?", (slug,))
    execute("DELETE FROM tournament_manager_assignments WHERE tournament_slug = ?", (slug,))
    statements: list[tuple[str, tuple]] = []
    statements.extend(
        (
            "INSERT INTO tournament_cities(id, tournament_slug, city, sort_order) VALUES (?, ?, ?, ?)",
            (f"city_{uuid4().hex[:10]}", slug, city, index),
        )
        for index, city in enumerate(clean_cities, start=1)
    )
    statements.extend(
        (
            "INSERT INTO tournament_prizes(id, tournament_slug, position, label, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            (f"prize_{uuid4().hex[:10]}", slug, prize.position, prize.label, prize.amount, index),
        )
        for index, prize in enumerate(payload.prizes, start=1)
    )
    clean_manager_ids = _clean_unique(payload.assigned_manager_ids)
    if clean_manager_ids:
        placeholders = ",".join(["?"] * len(clean_manager_ids))
        valid_manager_ids = [
            item["id"]
            for item in rows(f"SELECT id FROM users WHERE role = 'management' AND id IN ({placeholders})", tuple(clean_manager_ids))
        ]
        statements.extend(
            (
                "INSERT INTO tournament_manager_assignments(id, tournament_slug, manager_user_id) VALUES (?, ?, ?)",
                (f"tmgr_{uuid4().hex[:10]}", slug, manager_id),
            )
            for manager_id in valid_manager_ids
        )
    if statements:
        execute_many(statements)


def _tournament_detail(slug: str) -> dict | None:
    item = row("SELECT * FROM tournaments WHERE slug = ?", (slug,))
    if not item:
        return None
    detail = dict(item)
    detail["cities"] = [entry["city"] for entry in rows("SELECT city FROM tournament_cities WHERE tournament_slug = ? ORDER BY sort_order", (slug,))]
    detail["prizes"] = rows("SELECT position, label, amount, sort_order FROM tournament_prizes WHERE tournament_slug = ? ORDER BY sort_order, position", (slug,))
    detail["assigned_managers"] = rows(
        """
        SELECT u.id, u.name, u.email
        FROM tournament_manager_assignments tma
        INNER JOIN users u ON u.id = tma.manager_user_id
        WHERE tma.tournament_slug = ?
        ORDER BY u.name
        """,
        (slug,),
    )
    detail["assigned_manager_ids"] = [manager["id"] for manager in detail["assigned_managers"]]
    try:
        detail["fee_breakdown"] = json.loads(detail.get("fee_breakdown_json") or "[]")
    except Exception:
        detail["fee_breakdown"] = []
    detail["status"] = runtime_status(detail)
    detail["accent"] = accent_for_status(detail["status"], detail.get("accent", "emerald"))
    return detail


@router.get("/dashboard")
def dashboard(user: dict = Depends(require_roles("super_admin", "management"))):
    def build():
        cities = manager_cities(user)
        assigned_slugs = manager_tournament_slugs(user)
        if user["role"] != "super_admin" and not cities and not assigned_slugs:
            return {"assignedCities": [], "assignedTournaments": [], "pendingRegistrations": [], "liveMatches": []}
        tournament_filter = ""
        tournament_params: list[str] = []
        if user["role"] != "super_admin":
            filters = []
            if cities:
                filters.append(f"location IN ({','.join(['?'] * len(cities))})")
                tournament_params.extend(cities)
            if assigned_slugs:
                filters.append(f"slug IN ({','.join(['?'] * len(assigned_slugs))})")
                tournament_params.extend(assigned_slugs)
            tournament_filter = f" AND ({' OR '.join(filters)})" if filters else " AND 1 = 0"
        registration_filter = "" if user["role"] == "super_admin" else (f" AND city IN ({','.join(['?'] * len(cities))})" if cities else " AND 1 = 0")
        return {
            "assignedCities": cities,
            "assignedTournaments": rows(f"SELECT * FROM tournaments WHERE 1 = 1{tournament_filter} ORDER BY name", tuple(tournament_params)),
            "pendingRegistrations": rows(f"SELECT * FROM registrations WHERE status IN ('pending_payment', 'pending_approval', 'waiting'){registration_filter}", cities),
            "liveMatches": rows("SELECT * FROM live_matches"),
        }

    return ok(get_or_set_json(cache_key("management:dashboard", user["id"], user["role"]), build, settings.dashboard_cache_ttl_seconds))


@router.get("/tournaments")
def tournaments(user: dict = Depends(require_roles("super_admin", "management"))):
    def build():
        cities = manager_cities(user)
        if user["role"] == "super_admin" or not cities:
            records = rows("SELECT * FROM tournaments ORDER BY name")
        else:
            assigned_slugs = manager_tournament_slugs(user)
            filters = []
            params: list[str] = []
            if cities:
                filters.append(f"location IN ({','.join(['?'] * len(cities))})")
                params.extend(cities)
            if assigned_slugs:
                filters.append(f"slug IN ({','.join(['?'] * len(assigned_slugs))})")
                params.extend(assigned_slugs)
            records = rows(f"SELECT * FROM tournaments WHERE {' OR '.join(filters)} ORDER BY name", tuple(params)) if filters else []
        order = {"Upcoming": 0, "Registration Open": 1, "Live": 2, "Registration Closed": 3, "Completed": 4}
        details = [_tournament_detail(item["slug"]) for item in records]
        return sorted([item for item in details if item], key=lambda item: (order.get(item["status"], 9), item["name"]))

    return ok(get_or_set_json(cache_key("management:tournaments", user["id"], user["role"]), build, settings.dashboard_cache_ttl_seconds))


@router.post("/tournaments")
def create_tournament(payload: TournamentUpsertPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    ensure_city_access(user, payload.location)
    sport_name = payload.new_sport_name.strip() if payload.new_sport_name else payload.sport
    sport_slug = tournament_slugify(sport_name)
    if payload.new_sport_name and not row("SELECT slug FROM sports WHERE slug = ?", (sport_slug,)):
        execute("INSERT INTO sports(slug, name, active, color) VALUES (?, ?, ?, ?)", (sport_slug, sport_name, 1, payload.accent or "emerald"))
        execute(
            """INSERT INTO sport_home_visibility(sport_slug, show_on_home, sort_order, updated_by)
               VALUES (?, ?, ?, ?) ON CONFLICT(sport_slug) DO UPDATE SET show_on_home = excluded.show_on_home""",
            (sport_slug, int(payload.show_on_home), 99, user["id"]),
        )
    tournament_slug = tournament_slugify(payload.slug or payload.name)
    base_slug = tournament_slug
    counter = 2
    while row("SELECT slug FROM tournaments WHERE slug = ?", (tournament_slug,)):
        tournament_slug = f"{base_slug}-{counter}"
        counter += 1
    draft = payload.model_dump()
    computed_status = runtime_status(draft)
    computed_accent = accent_for_status(computed_status, payload.accent)
    execute(
        """INSERT INTO tournaments(slug, name, sport, status, location, date, registration_start, registration_end, teams, capacity, team_size,
          min_team_size, max_team_size, min_age, max_age, prize, image, poster, accent, address, sport_description, tournament_description, fee_breakdown_json, show_on_home,
          block_repeat_registration)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            tournament_slug,
            payload.name,
            sport_name,
            computed_status,
            payload.location,
            payload.date,
            payload.registration_start,
            payload.registration_end,
            payload.teams,
            payload.capacity,
            payload.team_size,
            payload.min_team_size,
            payload.max_team_size,
            payload.min_age,
            payload.max_age,
            payload.prize,
            payload.image,
            payload.poster,
            computed_accent,
            payload.address,
            payload.sport_description,
            payload.tournament_description,
            json.dumps([item.model_dump() for item in payload.fee_breakdown], separators=(",", ":")),
            int(payload.show_on_home),
            int(payload.block_repeat_registration),
        ),
    )
    _save_tournament_children(tournament_slug, payload)
    log(user["email"], "tournament_created", "tournament", tournament_slug, f"Created {payload.name}")
    return ok(_tournament_detail(tournament_slug), "Tournament created")


@router.patch("/tournaments/{tournament_slug}")
def update_tournament(tournament_slug: str, payload: TournamentUpsertPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Tournament not found")
    ensure_tournament_access(user, item)
    ensure_city_access(user, payload.location)
    sport_name = payload.new_sport_name.strip() if payload.new_sport_name else payload.sport
    sport_slug = tournament_slugify(sport_name)
    if payload.new_sport_name and not row("SELECT slug FROM sports WHERE slug = ?", (sport_slug,)):
        execute("INSERT INTO sports(slug, name, active, color) VALUES (?, ?, ?, ?)", (sport_slug, sport_name, 1, payload.accent or "emerald"))
    draft = payload.model_dump()
    computed_status = runtime_status(draft)
    computed_accent = accent_for_status(computed_status, payload.accent)
    execute(
        """UPDATE tournaments SET name = ?, sport = ?, status = ?, location = ?, date = ?, registration_start = ?, registration_end = ?,
          teams = ?, capacity = ?, team_size = ?, min_team_size = ?, max_team_size = ?, min_age = ?, max_age = ?, prize = ?, image = ?, poster = ?, accent = ?, address = ?,
          sport_description = ?, tournament_description = ?, fee_breakdown_json = ?, show_on_home = ?, block_repeat_registration = ? WHERE slug = ?""",
        (
            payload.name,
            sport_name,
            computed_status,
            payload.location,
            payload.date,
            payload.registration_start,
            payload.registration_end,
            payload.teams,
            payload.capacity,
            payload.team_size,
            payload.min_team_size,
            payload.max_team_size,
            payload.min_age,
            payload.max_age,
            payload.prize,
            payload.image,
            payload.poster,
            computed_accent,
            payload.address,
            payload.sport_description,
            payload.tournament_description,
            json.dumps([item.model_dump() for item in payload.fee_breakdown], separators=(",", ":")),
            int(payload.show_on_home),
            int(payload.block_repeat_registration),
            tournament_slug,
        ),
    )
    _save_tournament_children(tournament_slug, payload)
    log(user["email"], "tournament_updated", "tournament", tournament_slug, f"Updated {payload.name}")
    return ok(_tournament_detail(tournament_slug), "Tournament updated")


@router.delete("/tournaments/{tournament_slug}")
def delete_tournament(tournament_slug: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Tournament not found")
    ensure_tournament_access(user, item)
    blockers = row("SELECT COUNT(*) AS count FROM registrations WHERE tournament_slug = ?", (tournament_slug,))
    if blockers and blockers["count"]:
        raise HTTPException(status_code=409, detail="Tournament has registrations. Archive or complete it instead of deleting.")
    ensure_tournament_access(user, item)
    for table in ["tournament_prizes", "tournament_cities", "tournament_manager_assignments", "bracket_connections", "bracket_nodes", "notification_events"]:
        execute(f"DELETE FROM {table} WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM tournaments WHERE slug = ?", (tournament_slug,))
    log(user["email"], "tournament_deleted", "tournament", tournament_slug, f"Deleted {item['name']}")
    return ok({"deleted": True, "slug": tournament_slug}, "Tournament deleted")


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
        """INSERT INTO news_posts(slug, title, short_description, image, category, sport, tournament_slug, city, status, is_highlight, author_id, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (slug, payload.title, payload.short_description, payload.image, payload.category, payload.sport, payload.tournament_slug, payload.city, payload.status, int(payload.is_highlight), user["id"], published_at, now, now),
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
           SET title = ?, short_description = ?, image = ?, category = ?, sport = ?, tournament_slug = ?, city = ?, status = ?, is_highlight = ?, published_at = ?, updated_at = ?
           WHERE slug = ?""",
        (payload.title, payload.short_description, payload.image, payload.category, payload.sport, payload.tournament_slug, payload.city, payload.status, int(payload.is_highlight), published_at, now, slug),
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


@router.patch("/tournaments/{tournament_slug}/jerseys")
def update_tournament_jerseys(tournament_slug: str, payload: TournamentJerseysPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Tournament not found")
    ensure_tournament_access(user, item)
    capacity = int(item.get("capacity") or 0)
    if len(payload.jerseys) != capacity:
        raise HTTPException(status_code=422, detail=f"Upload exactly {capacity} jersey images for this tournament")
    reserved_images = {
        record["selected_jersey_image"]
        for record in rows(
            "SELECT selected_jersey_image FROM registrations WHERE tournament_slug = ? AND payment_status = 'paid' AND selected_jersey_image <> ''",
            (tournament_slug,),
        )
    }
    incoming_images = {jersey.image for jersey in payload.jerseys}
    if reserved_images - incoming_images:
        raise HTTPException(status_code=409, detail="Completed registrations already locked one or more jerseys")
    execute("DELETE FROM tournament_jerseys WHERE tournament_slug = ?", (tournament_slug,))
    timestamp = datetime.now(timezone.utc).isoformat()
    for index, jersey in enumerate(payload.jerseys, start=1):
        execute(
            "INSERT INTO tournament_jerseys(id, tournament_slug, label, image, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (f"jersey_{uuid4().hex[:12]}", tournament_slug, jersey.label.strip(), jersey.image, index, timestamp),
        )
    log(user["email"], "tournament_jerseys_updated", "tournament", tournament_slug, f"Updated {len(payload.jerseys)} jerseys")
    return ok(rows("SELECT id, label, image, sort_order FROM tournament_jerseys WHERE tournament_slug = ? ORDER BY sort_order", (tournament_slug,)), "Tournament jerseys updated")


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
    return ok({
        "acceptedTeams": accepted,
        "nodes": rows("SELECT id, label, team, round, x, y, status, bucket, scheduled_at FROM bracket_nodes WHERE tournament_slug = ? ORDER BY bucket, x, y", (tournament_slug,)),
        "connections": rows("SELECT id, source_id, target_id FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,)),
        "roundSchedules": rows("SELECT round, bucket, scheduled_at FROM bracket_round_schedules WHERE tournament_slug = ? ORDER BY round, bucket", (tournament_slug,)),
        "notifications": rows("SELECT * FROM notification_events WHERE tournament_slug = ? ORDER BY created_at DESC LIMIT 10", (tournament_slug,)),
    })


@router.post("/brackets/{tournament_slug}/save")
def save_bracket(tournament_slug: str, payload: BracketSavePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    execute("DELETE FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM bracket_nodes WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM bracket_round_schedules WHERE tournament_slug = ?", (tournament_slug,))
    statements: list[tuple[str, tuple]] = []
    for node in payload.nodes:
        statements.append((
            "INSERT INTO bracket_nodes(id, tournament_slug, label, team, round, x, y, status, bucket, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (node.id, tournament_slug, node.label, node.team or "", node.round, node.x, node.y, node.status, node.bucket, node.scheduled_at),
        ))
    for connection in payload.connections:
        statements.append((
            "INSERT INTO bracket_connections(id, tournament_slug, source_id, target_id) VALUES (?, ?, ?, ?)",
            (connection.id or f"conn_{uuid4().hex[:10]}", tournament_slug, connection.source_id, connection.target_id),
        ))
    for schedule in payload.round_schedules:
        statements.append((
            "INSERT INTO bracket_round_schedules(id, tournament_slug, round, bucket, scheduled_at) VALUES (?, ?, ?, ?, ?)",
            (f"brs_{uuid4().hex[:10]}", tournament_slug, schedule.round, schedule.bucket, schedule.scheduled_at),
        ))
    execute_many(statements)
    log(user["email"], "bracket_saved", "tournament", tournament_slug, f"{payload.audit_reason} ({payload.bucket_mode} bucket mode)")
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
    delivery_results = []
    if "sms" in payload.channels:
        delivery_results.append(send_sms_message(settings.twilio_default_to or "", payload.message))
    if "whatsapp" in payload.channels:
        delivery_results.append(send_whatsapp_message(settings.twilio_default_to or "", payload.message))
    execute(
        "INSERT INTO notification_events(id, tournament_slug, audience, channels, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event_id, tournament_slug, payload.audience, ",".join(payload.channels), payload.message, "local_sent", datetime.now(timezone.utc).isoformat()),
    )
    log(user["email"], "manual_notification_sent", "notification", event_id, f"Sent bracket notification via {', '.join(payload.channels)}")
    return ok({
        "event": row("SELECT * FROM notification_events WHERE id = ?", (event_id,)),
        "deliveries": [{"provider": item.provider, "ok": item.ok, "message": item.message} for item in delivery_results],
    }, "Manual notification stored locally")


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
