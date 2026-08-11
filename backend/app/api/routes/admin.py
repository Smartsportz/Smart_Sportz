from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.api.deps import require_roles
from app.core.responses import ok
from app.core.security import hash_password
from app.db.database import audit_rows, execute, execute_many, row, rows
from app.schemas import (
    AdminTeamUpdatePayload,
    AdminUserCreatePayload,
    AdminUserUpdatePayload,
    AnnouncementCreatePayload,
    AnnouncementUpdatePayload,
    CmsUpdate,
    HomeDiscoveryCardUpdate,
    LiveHighlightUpdate,
    ManagerCitiesPayload,
    ManagerCreatePayload,
    ManagerUpdatePayload,
    NewsPostPayload,
    OrganizerCardUpdate,
    SponsorLogoUpdate,
)
from app.services.audit import log
from app.services.cache import cache_key
from app.services.database_architecture import compare_primary_mirror, database_status
from app.services.job_queue import enqueue
from app.services.media import normalize_media_record, normalize_media_records
from app.services.runtime_state import runtime_state

router = APIRouter(prefix="/admin", tags=["admin"])


def slugify(title: str) -> str:
    """Generate a URL-friendly slug from a title."""
    value = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return value or f"news-{uuid4().hex[:8]}"


def clear_public_cache(*news_slugs: str) -> None:
    keys = [
        cache_key("public:home"),
        cache_key("public:tournaments"),
        cache_key("content:news"),
    ]
    keys.extend(cache_key("public:tournament", slug) for slug in news_slugs if slug)
    keys.extend(cache_key("public:bracket", slug) for slug in news_slugs if slug)
    keys.extend(cache_key("content:news-detail", slug) for slug in news_slugs if slug)
    for key in keys:
        runtime_state.delete(key)


def optional_tournament_slug(value: str | None) -> str | None:
    cleaned = (value or "").strip()
    return cleaned or None


def ensure_city_access(user: dict, city: str) -> None:
    """Ensure the user has access to the given city."""
    if not city:
        return
    if user["role"] == "super_admin":
        return
    allowed_cities = [c.lower() for c in manager_cities(user)]
    if city and city.lower() not in allowed_cities:
        raise HTTPException(
            status_code=403,
            detail=f"Manager does not have access to city: {city}"
        )


def ensure_announcement_access(user: dict, announcement: dict) -> None:
    """Ensure the user has access to the announcement."""
    if user["role"] == "super_admin":
        return
    # For managers, check if they have access to the city
    if announcement.get("city"):
        allowed_cities = [c.lower() for c in manager_cities(user)]
        if announcement["city"].lower() not in allowed_cities:
            raise HTTPException(
                status_code=403,
                detail="Manager does not have access to this announcement's city"
            )
    # If no city specified, check if they own the announcement
    if announcement.get("created_by") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Manager does not have access to this announcement"
        )


def manager_cities(user: dict) -> list[str]:
    """Get cities assigned to a manager."""
    if user["role"] == "super_admin":
        return []
    return [
        item["city"]
        for item in rows(
            "SELECT city FROM manager_city_assignments WHERE manager_user_id = ?",
            (user["id"],)
        )
    ]


def ensure_tournament_access(user: dict, item: dict) -> None:
    """Ensure the user has access to the tournament."""
    if user["role"] == "super_admin":
        return
    allowed_cities = [city.lower() for city in manager_cities(user)]
    if str(item.get("location", "")).lower() in allowed_cities:
        return
    if item.get("slug") in manager_tournament_slugs(user):
        return
    raise HTTPException(
        status_code=403,
        detail="Manager is not assigned to this tournament"
    )


def manager_tournament_slugs(user: dict) -> list[str]:
    """Get tournament slugs assigned to a manager."""
    if user["role"] == "super_admin":
        return []
    return [
        item["tournament_slug"]
        for item in rows(
            "SELECT tournament_slug FROM tournament_manager_assignments WHERE manager_user_id = ?",
            (user["id"],)
        )
    ]


# ==================== ANNOUNCEMENT CRUD OPERATIONS ====================

@router.get("/announcements")
def get_announcements(
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get all announcements with optional filters."""
    try:
        query = """
            SELECT a.*, u.name AS created_by_name, u.email AS created_by_email
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE 1=1
        """
        params = []

        # If manager, filter by assigned cities
        if user["role"] != "super_admin":
            cities = manager_cities(user)
            if cities:
                placeholders = ",".join(["?"] * len(cities))
                query += f" AND (a.city IN ({placeholders}) OR a.created_by = ?)"
                params.extend(cities)
                params.append(user["id"])
            else:
                # If manager has no cities, only show their own announcements
                query += " AND a.created_by = ?"
                params.append(user["id"])

        query += " ORDER BY a.created_at DESC"
        announcements = rows(query, tuple(params))
        
        return ok(announcements)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/announcements/{announcement_id}")
def get_announcement(
    announcement_id: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get a single announcement by ID."""
    try:
        announcement = row(
            """
            SELECT a.*, u.name AS created_by_name, u.email AS created_by_email
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.id = ?
            """,
            (announcement_id,)
        )
        
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        # Check access
        ensure_announcement_access(user, announcement)
        
        return ok(announcement)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/announcements")
def create_announcement(
    payload: AnnouncementCreatePayload,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Create a new announcement."""
    try:
        # Generate unique ID
        announcement_id = f"ann_{uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        # Insert announcement
        execute(
            """
            INSERT INTO announcements(
                id, title, description, image, date_from, date_to,
                published, created_by, city, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                announcement_id,
                payload.title,
                payload.description,
                payload.image,
                payload.date_from,
                payload.date_to,
                int(payload.published),
                user["id"],
                payload.city,
                now,
                now,
            ),
        )

        log(
            user["email"],
            "announcement_created",
            "announcement",
            announcement_id,
            f"Announcement created: {payload.title}"
        )

        # Return created announcement
        result = row(
            """
            SELECT a.*, u.name AS created_by_name, u.email AS created_by_email
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.id = ?
            """,
            (announcement_id,)
        )

        return ok(result, "Announcement created successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/announcements/{announcement_id}")
def update_announcement(
    announcement_id: str,
    payload: AnnouncementUpdatePayload,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Update an existing announcement."""
    try:
        # Get existing announcement
        announcement = row("SELECT * FROM announcements WHERE id = ?", (announcement_id,))
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")

        # Check access
        ensure_announcement_access(user, announcement)

        now = datetime.now(timezone.utc).isoformat()

        # Update announcement
        execute(
            """
            UPDATE announcements
            SET title = ?, description = ?, image = ?,
                date_from = ?, date_to = ?, published = ?,
                city = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                payload.title,
                payload.description,
                payload.image,
                payload.date_from,
                payload.date_to,
                int(payload.published),
                payload.city,
                now,
                announcement_id,
            ),
        )

        log(
            user["email"],
            "announcement_updated",
            "announcement",
            announcement_id,
            f"Announcement updated: {payload.title}"
        )

        # Return updated announcement
        result = row(
            """
            SELECT a.*, u.name AS created_by_name, u.email AS created_by_email
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.id = ?
            """,
            (announcement_id,)
        )

        return ok(result, "Announcement updated successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/announcements/{announcement_id}/publish")
def toggle_announcement_publish(
    announcement_id: str,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Toggle announcement published status."""
    try:
        announcement = row("SELECT * FROM announcements WHERE id = ?", (announcement_id,))
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")

        ensure_announcement_access(user, announcement)

        new_status = not bool(announcement["published"])
        now = datetime.now(timezone.utc).isoformat()

        execute(
            """
            UPDATE announcements
            SET published = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                int(new_status),
                now,
                announcement_id,
            ),
        )

        log(
            user["email"],
            "announcement_publish_toggled",
            "announcement",
            announcement_id,
            f"Announcement {'published' if new_status else 'hidden'}"
        )

        result = row(
            """
            SELECT a.*, u.name AS created_by_name, u.email AS created_by_email
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.id = ?
            """,
            (announcement_id,)
        )

        return ok(result, f"Announcement {'published' if new_status else 'hidden'}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/announcements/{announcement_id}")
def delete_announcement(
    announcement_id: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Delete an announcement."""
    try:
        announcement = row("SELECT * FROM announcements WHERE id = ?", (announcement_id,))
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")

        ensure_announcement_access(user, announcement)

        execute("DELETE FROM announcements WHERE id = ?", (announcement_id,))

        log(
            user["email"],
            "announcement_deleted",
            "announcement",
            announcement_id,
            f"Announcement deleted: {announcement['title']}"
        )

        return ok({"deleted": True, "id": announcement_id}, "Announcement deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/announcements/published")
def get_published_announcements(
    user: dict = Depends(require_roles("super_admin", "management", "user"))
):
    """Get all published announcements (for public display)."""
    try:
        query = """
            SELECT a.*, u.name AS created_by_name
            FROM announcements a
            LEFT JOIN users u ON u.id = a.created_by
            WHERE a.published = 1
        """
        params = []

        # If user is manager, filter by assigned cities
        if user["role"] == "management":
            cities = manager_cities(user)
            if cities:
                placeholders = ",".join(["?"] * len(cities))
                query += f" AND (a.city IN ({placeholders}) OR a.created_by = ?)"
                params.extend(cities)
                params.append(user["id"])
            else:
                query += " AND a.created_by = ?"
                params.append(user["id"])

        query += " ORDER BY a.created_at DESC"
        announcements = rows(query, tuple(params))
        
        return ok(announcements)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/announcements/stats/summary")
def get_announcement_stats(
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get announcement statistics."""
    try:
        total = row("SELECT COUNT(*) AS count FROM announcements")["count"]
        published = row("SELECT COUNT(*) AS count FROM announcements WHERE published = 1")["count"]
        hidden = row("SELECT COUNT(*) AS count FROM announcements WHERE published = 0")["count"]

        return ok({
            "total": total,
            "published": published,
            "hidden": hidden
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DASHBOARD ====================

@router.get("/dashboard")
def dashboard(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok({
        "tournaments": row("SELECT COUNT(*) AS count FROM tournaments")["count"],
        "teams": row("SELECT COUNT(*) AS count FROM teams")["count"],
        "registrations": row("SELECT COUNT(*) AS count FROM registrations")["count"],
        "payments": row("SELECT COALESCE(SUM(amount), 0) AS amount FROM payments")["amount"],
        "liveMatches": row("SELECT COUNT(*) AS count FROM live_matches WHERE status LIKE '%Live%'")["count"],
    })


def _admin_tournament_detail(item: dict) -> dict:
    detail = dict(item)
    slug = detail["slug"]
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
    detail["cities"] = [
        city["city"]
        for city in rows(
            "SELECT city FROM tournament_cities WHERE tournament_slug = ? ORDER BY city",
            (slug,),
        )
    ]
    detail["prizes"] = rows(
        "SELECT position, label, amount FROM tournament_prizes WHERE tournament_slug = ? ORDER BY position",
        (slug,),
    )
    try:
        detail["fee_breakdown"] = json.loads(detail.get("fee_breakdown_json") or "[]")
    except (TypeError, json.JSONDecodeError):
        detail["fee_breakdown"] = []
    filled_slots = row(
        """
        SELECT COUNT(*) AS count
        FROM registrations
        WHERE tournament_slug = ?
          AND COALESCE(status, '') NOT IN ('rejected', 'cancelled')
        """,
        (slug,),
    )["count"]
    capacity = int(detail.get("capacity") or 0)
    detail["registered_count"] = filled_slots
    detail["filled_slots"] = filled_slots
    detail["slots_full"] = bool(capacity and filled_slots >= capacity)
    return detail


@router.get("/tournaments")
def admin_tournaments(_: dict = Depends(require_roles("super_admin", "management"))):
    records = rows("SELECT * FROM tournaments ORDER BY name")
    return ok([_admin_tournament_detail(item) for item in records])


@router.post("/tournaments/{tournament_slug}/delete")
def delete_tournament(
    tournament_slug: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Tournament not found")
    ensure_tournament_access(user, item)
    registration_ids = [item["id"] for item in rows("SELECT id FROM registrations WHERE tournament_slug = ?", (tournament_slug,))]
    for registration_id in registration_ids:
        execute("DELETE FROM registration_documents WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM registration_members WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM payments WHERE registration_id = ?", (registration_id,))
    for post in rows("SELECT slug FROM news_posts WHERE tournament_slug = ?", (tournament_slug,)):
        execute("DELETE FROM news_blocks WHERE post_slug = ?", (post["slug"],))
        execute("DELETE FROM news_social WHERE news_slug = ?", (post["slug"],))
    for table in [
        "registrations",
        "payment_intents",
        "news_posts",
        "tournament_prizes",
        "tournament_cities",
        "tournament_manager_assignments",
        "bracket_round_schedules",
        "group_bracket_matches",
        "bracket_connections",
        "bracket_nodes",
        "notification_events"
    ]:
        execute(f"DELETE FROM {table} WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM tournaments WHERE slug = ?", (tournament_slug,))
    log(
        user["email"],
        "tournament_deleted",
        "tournament",
        tournament_slug,
        f"Deleted {item['name']}"
    )
    return ok({"deleted": True, "slug": tournament_slug}, "Tournament deleted")


@router.get("/tournaments/{tournament_slug}/teams")
def admin_tournament_teams(
    tournament_slug: str,
    _: dict = Depends(require_roles("super_admin"))
):
    tournament = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    registrations = rows(
        """
        SELECT
          r.id,
          r.user_id,
          r.team_name,
          r.team_code,
          r.captain_name,
          r.sub_captain_name,
          r.coach_name,
          r.email,
          r.phone,
          r.city,
          r.category,
          r.status,
          r.payment_status,
          r.selected_jersey_image AS selected_jersey,
          r.amount,
          r.created_at,
          u.name AS user_name,
          u.email AS user_email,
          COUNT(m.id) AS players_count
        FROM registrations r
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN registration_members m ON m.registration_id = r.id
        WHERE r.tournament_slug = ?
        GROUP BY r.id
        ORDER BY r.created_at DESC
        """,
        (tournament_slug,),
    )
    for registration in registrations:
        registration["members"] = rows(
            "SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ? ORDER BY id",
            (registration["id"],),
        )
    return ok({"tournament": tournament, "teams": registrations})


@router.get("/teams")
def admin_teams(_: dict = Depends(require_roles("super_admin"))):
    records = rows(
        """
        SELECT
          r.id,
          r.user_id,
          r.tournament_slug,
          r.team_name,
          r.team_code,
          r.captain_name,
          r.sub_captain_name,
          r.coach_name,
          r.email,
          r.phone,
          r.city,
          r.status,
          r.payment_status,
          r.selected_jersey_image AS selected_jersey,
          r.team_logo,
          r.team_motto,
          r.created_at,
          t.name AS tournament_name,
          t.sport,
          t.location,
          u.name AS user_name,
          u.email AS user_email,
          COUNT(DISTINCT m.id) AS players_count,
          COUNT(DISTINCT p.id) AS payments_count,
          COALESCE(MAX(p.amount), 0) AS latest_payment
        FROM registrations r
        LEFT JOIN tournaments t ON t.slug = r.tournament_slug
        LEFT JOIN users u ON u.id = r.user_id
        LEFT JOIN registration_members m ON m.registration_id = r.id
        LEFT JOIN payments p ON p.registration_id = r.id
        GROUP BY r.id
        ORDER BY r.created_at DESC
        """
    )
    for record in records:
        record["members"] = rows(
            "SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ? ORDER BY id",
            (record["id"],),
        )
    return ok(records)


@router.get("/registrations/{registration_id}/team-detail")
def admin_registration_team_detail(
    registration_id: str,
    _: dict = Depends(require_roles("super_admin"))
):
    registration = row(
        """
        SELECT r.*, t.name AS tournament_name, t.sport, t.location, t.date, t.image,
               u.name AS user_name, u.email AS user_email
        FROM registrations r
        LEFT JOIN tournaments t ON t.slug = r.tournament_slug
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.id = ?
        """,
        (registration_id,),
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    return ok({
        "registration": registration,
        "players": rows(
            "SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ? ORDER BY id",
            (registration_id,)
        ),
        "documents": rows(
            "SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ? ORDER BY uploaded_at DESC",
            (registration_id,)
        ),
        "payments": rows(
            "SELECT id, status, amount, method, receipt_number, created_at FROM payments WHERE registration_id = ? ORDER BY created_at DESC",
            (registration_id,)
        ),
    })


@router.patch("/teams/{registration_id}")
def admin_update_team(
    registration_id: str,
    payload: AdminTeamUpdatePayload,
    user: dict = Depends(require_roles("super_admin"))
):
    existing = row("SELECT id, team_name, tournament_slug FROM registrations WHERE id = ?", (registration_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Registration team not found")
    duplicate = row(
        """
        SELECT id FROM registrations
        WHERE tournament_slug = (SELECT tournament_slug FROM registrations WHERE id = ?)
        AND LOWER(team_name) = LOWER(?) AND id <> ?
        """,
        (registration_id, payload.team_name.strip(), registration_id),
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A team with this name is already registered for this tournament"
        )
    execute(
        """
        UPDATE registrations
        SET team_name = ?, captain_name = ?, sub_captain_name = ?, coach_name = ?,
            email = ?, phone = ?, city = ?, team_logo = ?, team_motto = ?
        WHERE id = ?
        """,
        (
            payload.team_name.strip(),
            payload.captain_name.strip(),
            payload.sub_captain_name.strip(),
            payload.coach_name.strip(),
            payload.email,
            payload.phone.strip(),
            payload.city.strip(),
            payload.team_logo.strip(),
            payload.team_motto.strip(),
            registration_id,
        ),
    )
    log(
        user["email"],
        "admin_team_updated",
        "registration",
        registration_id,
        f"Updated team {payload.team_name}"
    )
    return admin_registration_team_detail(registration_id, user)


@router.delete("/teams/{registration_id}")
def admin_delete_team(
    registration_id: str,
    user: dict = Depends(require_roles("super_admin"))
):
    existing = row("SELECT id, team_name FROM registrations WHERE id = ?", (registration_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Registration team not found")
    execute("DELETE FROM payments WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registration_documents WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registration_members WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registrations WHERE id = ?", (registration_id,))
    log(
        user["email"],
        "admin_team_deleted",
        "registration",
        registration_id,
        f"Deleted team {existing['team_name']}"
    )
    clear_public_cache(existing["tournament_slug"])
    return ok({"id": registration_id}, "Team deleted")


# ==================== NEWS CRUD OPERATIONS ====================

@router.get("/news")
def admin_news(
    category: str | None = Query(None),
    city: str | None = Query(None),
    sport: str | None = Query(None),
    status: str | None = Query(None),
    tournament_slug: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get all news articles with optional filters."""
    try:
        query = "FROM news_posts WHERE 1=1"
        params = []

        if category:
            query += " AND category = ?"
            params.append(category)
        if city:
            query += " AND city = ?"
            params.append(city)
        if sport:
            query += " AND sport = ?"
            params.append(sport)
        if status:
            query += " AND status = ?"
            params.append(status)
        if tournament_slug:
            query += " AND tournament_slug = ?"
            params.append(tournament_slug)

        # If manager, filter by assigned cities
        if user["role"] != "super_admin":
            cities = manager_cities(user)
            if cities:
                placeholders = ",".join(["?"] * len(cities))
                query += f" AND city IN ({placeholders})"
                params.extend(cities)
            else:
                return ok([], meta={"total": 0, "limit": limit, "offset": offset, "hasMore": False})

        total = int(row(f"SELECT COUNT(*) AS count {query}", tuple(params))["count"] or 0)
        news_posts = normalize_media_records(
            rows(f"SELECT * {query} ORDER BY created_at DESC LIMIT ? OFFSET ?", tuple([*params, limit, offset])),
            "admin-news",
            {"image"},
        )

        # Get blocks for each news post
        for post in news_posts:
            post["blocks"] = rows(
                "SELECT * FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
                (post["slug"],)
            )

        return ok(news_posts, meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/news")
def create_news(
    payload: NewsPostPayload,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Create a new news article."""
    try:
        # Check city access
        ensure_city_access(user, payload.city)

        # Generate unique slug
        base_slug = slugify(payload.title)
        slug = base_slug
        counter = 2
        while row("SELECT slug FROM news_posts WHERE slug = ?", (slug,)):
            slug = f"{base_slug}-{counter}"
            counter += 1

        now = datetime.now(timezone.utc).isoformat()
        published_at = now if payload.status == "published" else None

        # Insert news post
        execute(
            """
            INSERT INTO news_posts(
                slug, title, short_description, image, category, sport,
                tournament_slug, city, status, is_highlight, author_id,
                published_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                slug,
                payload.title,
                payload.short_description,
                payload.image,
                payload.category,
                payload.sport,
                optional_tournament_slug(payload.tournament_slug),
                payload.city,
                payload.status,
                int(payload.is_highlight),
                user["id"],
                published_at,
                now,
                now,
            ),
        )

        # Insert blocks
        if payload.blocks:
            statements = []
            for index, block in enumerate(payload.blocks, start=1):
                statements.append((
                    """
                    INSERT INTO news_blocks(
                        id, post_slug, block_type, content_json, sort_order
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        f"nblock_{uuid4().hex[:10]}",
                        slug,
                        block.block_type,
                        json.dumps({"text": block.content}),
                        index,
                    ),
                ))
            if statements:
                execute_many(statements)

        log(
            user["email"],
            "news_created",
            "news",
            slug,
            f"News post created: {payload.title} in {payload.city}"
        )

        # Return created news with blocks
        result = normalize_media_record(row("SELECT * FROM news_posts WHERE slug = ?", (slug,)) or {}, "admin-news", {"image"})
        result["blocks"] = rows(
            "SELECT * FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
            (slug,)
        )
        clear_public_cache(slug)

        return ok(result, "News post created successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/{identifier}")
def get_news_by_id(
    identifier: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get a single news article by slug or ID."""
    try:
        # Try by slug first, then by ID
        news = row("SELECT * FROM news_posts WHERE slug = ?", (identifier,))
        if not news and identifier.isdigit():
            news = row("SELECT * FROM news_posts WHERE id = ?", (int(identifier),))

        if not news:
            raise HTTPException(status_code=404, detail="News article not found")

        # Check city access
        ensure_city_access(user, news["city"])

        # Get blocks
        news["blocks"] = rows(
            "SELECT * FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
            (news["slug"],)
        )

        # Get author name
        if news["author_id"]:
            author = row("SELECT name FROM users WHERE id = ?", (news["author_id"],))
            news["author_name"] = author["name"] if author else None

        return ok(normalize_media_record(news, "admin-news", {"image"}))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/news/{identifier}")
def update_news(
    identifier: str,
    payload: NewsPostPayload,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Update an existing news article."""
    try:
        # Get existing news
        news = row("SELECT * FROM news_posts WHERE slug = ?", (identifier,))
        if not news and identifier.isdigit():
            news = row("SELECT * FROM news_posts WHERE id = ?", (int(identifier),))

        if not news:
            raise HTTPException(status_code=404, detail="News article not found")

        # Check city access for existing and new city
        ensure_city_access(user, news["city"])
        ensure_city_access(user, payload.city)

        # If title changed, generate new slug
        slug = news["slug"]
        if payload.title != news["title"]:
            base_slug = slugify(payload.title)
            slug = base_slug
            counter = 2
            while row("SELECT slug FROM news_posts WHERE slug = ? AND slug != ?", (slug, news["slug"])):
                slug = f"{base_slug}-{counter}"
                counter += 1

        now = datetime.now(timezone.utc).isoformat()
        published_at = news["published_at"] or (now if payload.status == "published" else None)

        # Update news post
        execute(
            """
            UPDATE news_posts
            SET slug = ?, title = ?, short_description = ?, image = ?,
                category = ?, sport = ?, tournament_slug = ?, city = ?,
                status = ?, is_highlight = ?, published_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                slug,
                payload.title,
                payload.short_description,
                payload.image,
                payload.category,
                payload.sport,
                optional_tournament_slug(payload.tournament_slug),
                payload.city,
                payload.status,
                int(payload.is_highlight),
                published_at,
                now,
                news["id"],
            ),
        )

        # Update blocks (delete existing and insert new)
        execute("DELETE FROM news_blocks WHERE post_slug = ?", (news["slug"],))
        if payload.blocks:
            statements = []
            for index, block in enumerate(payload.blocks, start=1):
                statements.append((
                    """
                    INSERT INTO news_blocks(
                        id, post_slug, block_type, content_json, sort_order
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        f"nblock_{uuid4().hex[:10]}",
                        slug,
                        block.block_type,
                        json.dumps({"text": block.content}),
                        index,
                    ),
                ))
            if statements:
                execute_many(statements)

        log(
            user["email"],
            "news_updated",
            "news",
            slug,
            f"News post updated: {payload.title} in {payload.city}"
        )

        # Return updated news with blocks
        result = normalize_media_record(row("SELECT * FROM news_posts WHERE slug = ?", (slug,)) or {}, "admin-news", {"image"})
        result["blocks"] = rows(
            "SELECT * FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
            (slug,)
        )
        clear_public_cache(news["slug"], slug)

        return ok(result, "News post updated successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/news/{identifier}")
def delete_news(
    identifier: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Delete a news article."""
    try:
        # Get existing news
        news = row("SELECT * FROM news_posts WHERE slug = ?", (identifier,))
        if not news and identifier.isdigit():
            news = row("SELECT * FROM news_posts WHERE id = ?", (int(identifier),))

        if not news:
            raise HTTPException(status_code=404, detail="News article not found")

        # Check city access
        ensure_city_access(user, news["city"])

        # Delete blocks first
        execute("DELETE FROM news_blocks WHERE post_slug = ?", (news["slug"],))

        # Delete the news post
        execute("DELETE FROM news_posts WHERE id = ?", (news["id"],))

        log(
            user["email"],
            "news_deleted",
            "news",
            news["slug"],
            f"News post deleted: {news['title']}"
        )
        clear_public_cache(news["slug"])

        return ok({"deleted": True, "slug": news["slug"]}, "News post deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/categories/list")
def get_news_categories(
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get all distinct news categories."""
    try:
        categories = rows(
            "SELECT DISTINCT category FROM news_posts WHERE category IS NOT NULL AND category != '' ORDER BY category"
        )
        return ok([cat["category"] for cat in categories])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/stats/summary")
def get_news_stats(
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get news statistics."""
    try:
        total = row("SELECT COUNT(*) AS count FROM news_posts")["count"]
        published = row("SELECT COUNT(*) AS count FROM news_posts WHERE status = 'published'")["count"]
        drafts = row("SELECT COUNT(*) AS count FROM news_posts WHERE status = 'draft'")["count"]
        archived = row("SELECT COUNT(*) AS count FROM news_posts WHERE status = 'archived'")["count"]
        highlight = row("SELECT COUNT(*) AS count FROM news_posts WHERE is_highlight = 1")["count"]

        return ok({
            "total": total,
            "published": published,
            "drafts": drafts,
            "archived": archived,
            "highlight": highlight
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/news/tournament/{tournament_slug}")
def get_news_by_tournament(
    tournament_slug: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    """Get all news articles for a specific tournament."""
    try:
        news_posts = rows(
            "SELECT * FROM news_posts WHERE tournament_slug = ? ORDER BY created_at DESC",
            (tournament_slug,)
        )

        for post in news_posts:
            post["blocks"] = rows(
                "SELECT * FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
                (post["slug"],)
            )

        return ok(news_posts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tournaments/{tournament_slug}/payments")
def admin_tournament_payments(
    tournament_slug: str,
    _: dict = Depends(require_roles("super_admin"))
):
    return ok(_admin_tournament_payments_payload(tournament_slug))


def _admin_tournament_payments_payload(tournament_slug: str):
    tournament = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    payment_rows = rows(
        """
        SELECT
          p.id,
          p.registration_id,
          p.status,
          p.amount,
          p.method,
          p.receipt_number,
          p.refund_destination,
          p.refund_reference,
          p.action_note,
          p.action_at,
          p.created_at,
          r.team_name,
          r.captain_name,
          r.email,
          r.city,
          r.payment_status,
          r.status AS registration_status
        FROM payments p        INNER JOIN registrations r ON r.id = p.registration_id
        WHERE r.tournament_slug = ?
        ORDER BY p.created_at DESC
        """,
        (tournament_slug,),
    )
    total_paid = sum(int(item["amount"] or 0) for item in payment_rows if item["status"] == "paid")
    return {
        "tournament": tournament,
        "summary": {
            "total": total_paid,
            "paidPayments": len([item for item in payment_rows if item["status"] == "paid"]),
            "payments": len(payment_rows),
            "teams": row(
                "SELECT COUNT(*) AS count FROM registrations WHERE tournament_slug = ?",
                (tournament_slug,)
            )["count"],
            "pendingPayments": row(
                "SELECT COUNT(*) AS count FROM registrations WHERE tournament_slug = ? AND payment_status <> 'paid'",
                (tournament_slug,)
            )["count"],
        },
        "payments": payment_rows,
    }


@router.post("/payments/{payment_id}/refund")
def admin_refund_payment(
    payment_id: str,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_roles("super_admin"))
):
    payment = row(
        """
        SELECT p.*, r.tournament_slug, r.team_name
        FROM payments p
        INNER JOIN registrations r ON r.id = p.registration_id
        WHERE p.id = ?
        """,
        (payment_id,),
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    execute(
        """
        UPDATE payments
        SET status = 'refunded', refund_destination = ?, refund_reference = ?,
            action_note = ?, action_at = ?
        WHERE id = ?
        """,
        (
            str(payload.get("refund_destination") or ""),
            str(payload.get("refund_reference") or ""),
            str(payload.get("note") or ""),
            datetime.now(timezone.utc).isoformat(),
            payment_id,
        ),
    )
    execute(
        "UPDATE registrations SET payment_status = 'refunded' WHERE id = ?",
        (payment["registration_id"],)
    )
    log(
        user["email"],
        "payment_refunded",
        "payment",
        payment_id,
        f"Refund recorded for {payment['team_name']}"
    )
    return ok(
        _admin_tournament_payments_payload(payment["tournament_slug"]),
        "Payment refund recorded"
    )


@router.post("/payments/{payment_id}/cancel")
def admin_cancel_payment(
    payment_id: str,
    payload: dict = Body(default_factory=dict),
    user: dict = Depends(require_roles("super_admin"))
):
    payment = row(
        """
        SELECT p.*, r.tournament_slug, r.team_name
        FROM payments p
        INNER JOIN registrations r ON r.id = p.registration_id
        WHERE p.id = ?
        """,
        (payment_id,),
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    execute(
        "UPDATE payments SET status = 'cancelled', action_note = ?, action_at = ? WHERE id = ?",
        (str(payload.get("note") or ""), datetime.now(timezone.utc).isoformat(), payment_id),
    )
    execute(
        "UPDATE registrations SET payment_status = 'cancelled' WHERE id = ?",
        (payment["registration_id"],)
    )
    log(
        user["email"],
        "payment_cancelled",
        "payment",
        payment_id,
        f"Payment cancelled for {payment['team_name']}"
    )
    return ok(
        _admin_tournament_payments_payload(payment["tournament_slug"]),
        "Payment cancelled"
    )


@router.get("/registrations")
def admin_registrations(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_roles("super_admin", "management")),
):
    total = int(row("SELECT COUNT(*) AS count FROM registrations")["count"] or 0)
    items = rows("SELECT * FROM registrations ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
    return ok(normalize_media_records(items, "admin-registration", {"team_logo", "selected_jersey_image"}), meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


def user_with_counts(user: dict) -> dict:
    user["registrations_count"] = row(
        "SELECT COUNT(*) AS count FROM registrations WHERE user_id = ?",
        (user["id"],)
    )["count"]
    user["payments_count"] = row(
        """
        SELECT COUNT(*) AS count
        FROM payments p
        INNER JOIN registrations r ON r.id = p.registration_id
        WHERE r.user_id = ?
        """,
        (user["id"],),
    )["count"]
    return user


def user_detail_payload(user_id: str, role: str = "user") -> dict:
    user = row(
        """
        SELECT id, email, name, role, phone, email_verified, phone_verified, created_at
        FROM users WHERE id = ? AND role = ?
        """,
        (user_id, role)
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    registrations = normalize_media_records(rows(
        """
        SELECT r.*, t.name AS tournament_name, t.sport, t.location, t.date, t.image
        FROM registrations r
        LEFT JOIN tournaments t ON t.slug = r.tournament_slug
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
        """,
        (user_id,),
    ), "admin-user-registration", {"team_logo", "selected_jersey_image", "image"})
    registration_ids = [item["id"] for item in registrations]
    payments: list[dict] = []
    documents: list[dict] = []
    members: list[dict] = []
    if registration_ids:
        placeholders = ",".join(["?"] * len(registration_ids))
        payments = rows(
            f"SELECT * FROM payments WHERE registration_id IN ({placeholders}) ORDER BY created_at DESC",
            tuple(registration_ids)
        )
        documents = rows(
            f"SELECT * FROM registration_documents WHERE registration_id IN ({placeholders}) ORDER BY uploaded_at DESC",
            tuple(registration_ids)
        )
        members = rows(
            f"SELECT * FROM registration_members WHERE registration_id IN ({placeholders}) ORDER BY id",
            tuple(registration_ids)
        )
    return {
        "user": user,
        "registrations": registrations,
        "payments": payments,
        "documents": documents,
        "members": members,
    }


@router.get("/users")
def admin_users(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_roles("super_admin")),
):
    total = int(row("SELECT COUNT(*) AS count FROM users WHERE role = 'user'")["count"] or 0)
    return ok([
        user_with_counts(item)
        for item in rows(
            "SELECT id, email, name, role, phone, email_verified, phone_verified, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
    ], meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.post("/users")
def create_user(
    payload: AdminUserCreatePayload,
    user: dict = Depends(require_roles("super_admin"))
):
    existing = row("SELECT id FROM users WHERE email = ?", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="User email already exists")
    user_id = f"user_{uuid4().hex[:12]}"
    execute(
        """
        INSERT INTO users(
            id, email, name, role, password_hash, phone,
            email_verified, phone_verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            str(payload.email),
            payload.name,
            "user",
            hash_password(payload.password),
            payload.phone,
            1,
            1,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    detail = user_detail_payload(user_id)
    detail["temporary_password"] = payload.password
    log(user["email"], "user_created", "user", user_id, f"User {payload.email} created")
    return ok(detail, "User created")


@router.get("/users/{user_id}")
def admin_user_detail(
    user_id: str,
    _: dict = Depends(require_roles("super_admin"))
):
    return ok(user_detail_payload(user_id))


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: AdminUserUpdatePayload,
    user: dict = Depends(require_roles("super_admin"))
):
    item = row("SELECT id FROM users WHERE id = ? AND role = 'user'", (user_id,))
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    email_owner = row("SELECT id FROM users WHERE email = ? AND id <> ?", (payload.email, user_id))
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already belongs to another account")
    if payload.password:
        execute(
            """
            UPDATE users SET name = ?, email = ?, phone = ?, password_hash = ?
            WHERE id = ? AND role = 'user'
            """,
            (payload.name, str(payload.email), payload.phone, hash_password(payload.password), user_id),
        )
    else:
        execute(
            "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ? AND role = 'user'",
            (payload.name, str(payload.email), payload.phone, user_id),
        )
    log(
        user["email"],
        "user_updated",
        "user",
        user_id,
        f"User {payload.email} updated"
    )
    return ok(user_detail_payload(user_id), "User updated")


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    user: dict = Depends(require_roles("super_admin"))
):
    item = row("SELECT id, email FROM users WHERE id = ? AND role = 'user'", (user_id,))
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    registration_ids = [
        record["id"]
        for record in rows("SELECT id FROM registrations WHERE user_id = ?", (user_id,))
    ]
    for registration_id in registration_ids:
        execute("DELETE FROM payments WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM registration_documents WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM registration_members WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registrations WHERE user_id = ?", (user_id,))
    execute("DELETE FROM users WHERE id = ? AND role = 'user'", (user_id,))
    log(
        user["email"],
        "user_deleted",
        "user",
        user_id,
        f"User {item['email']} deleted"
    )
    return ok({"id": user_id}, "User deleted")


def manager_with_cities(manager: dict) -> dict:
    manager["cities"] = [
        item["city"]
        for item in rows(
            "SELECT city FROM manager_city_assignments WHERE manager_user_id = ? ORDER BY city",
            (manager["id"],)
        )
    ]
    return manager


@router.get("/managers")
def managers(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _: dict = Depends(require_roles("super_admin")),
):
    total = int(row("SELECT COUNT(*) AS count FROM users WHERE role = 'management'")["count"] or 0)
    return ok([
        manager_with_cities(item)
        for item in rows("SELECT id, email, name, role, created_at FROM users WHERE role = 'management' ORDER BY name LIMIT ? OFFSET ?", (limit, offset))
    ], meta={"total": total, "limit": limit, "offset": offset, "hasMore": offset + limit < total})


@router.get("/places")
def places(_: dict = Depends(require_roles("super_admin"))):
    values = set()
    for item in rows("SELECT location FROM tournaments WHERE location <> ''"):
        values.add(item["location"])
    for item in rows("SELECT city FROM tournament_cities WHERE city <> ''"):
        values.add(item["city"])
    for item in rows("SELECT city FROM manager_city_assignments WHERE city <> ''"):
        values.add(item["city"])
    return ok(sorted(values))


@router.post("/managers")
def create_manager(
    payload: ManagerCreatePayload,
    user: dict = Depends(require_roles("super_admin"))
):
    existing = row("SELECT id FROM users WHERE email = ?", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="Manager email already exists")
    manager_id = str(uuid4())
    execute(
        """
        INSERT INTO users(id, email, name, role, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            manager_id,
            payload.email,
            payload.name,
            "management",
            hash_password(payload.password),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    update_manager_cities(manager_id, ManagerCitiesPayload(cities=payload.cities), user)
    log(
        user["email"],
        "manager_created",
        "user",
        manager_id,
        f"Manager {payload.email} created"
    )
    created_manager = manager_with_cities(row(
            "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
            (manager_id,)
        ))
    created_manager["temporary_password"] = payload.password
    return ok(
        created_manager,
        "Manager created"
    )


@router.get("/managers/{manager_id}")
def manager_detail(
    manager_id: str,
    _: dict = Depends(require_roles("super_admin"))
):
    manager = row(
        "SELECT id, email, name, role, created_at FROM users WHERE id = ? AND role = 'management'",
        (manager_id,)
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    manager = manager_with_cities(manager)
    assigned = rows(
        """
        SELECT DISTINCT t.*
        FROM tournaments t
        LEFT JOIN tournament_manager_assignments tma ON tma.tournament_slug = t.slug
        WHERE tma.manager_user_id = ?
        """,
        (manager_id,),
    )
    if manager["cities"]:
        city_assigned = rows(
            f"""
            SELECT * FROM tournaments
            WHERE location IN ({','.join(['?'] * len(manager['cities']))})
            ORDER BY name
            """,
            tuple(manager["cities"]),
        )
        seen = {item["slug"] for item in assigned}
        assigned.extend([item for item in city_assigned if item["slug"] not in seen])
    manager["assigned_tournaments"] = sorted(assigned, key=lambda item: item["name"])
    return ok(manager)


@router.patch("/managers/{manager_id}")
def update_manager(
    manager_id: str,
    payload: ManagerUpdatePayload,
    user: dict = Depends(require_roles("super_admin"))
):
    manager = row("SELECT id FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    email_owner = row("SELECT id FROM users WHERE email = ? AND id <> ?", (payload.email, manager_id))
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already belongs to another account")
    if payload.password:
        execute(
            """
            UPDATE users SET name = ?, email = ?, password_hash = ?
            WHERE id = ? AND role = 'management'
            """,
            (payload.name, str(payload.email), hash_password(payload.password), manager_id),
        )
    else:
        execute(
            "UPDATE users SET name = ?, email = ? WHERE id = ? AND role = 'management'",
            (payload.name, str(payload.email), manager_id),
        )
    update_manager_cities(manager_id, ManagerCitiesPayload(cities=payload.cities), user)
    log(
        user["email"],
        "manager_updated",
        "user",
        manager_id,
        f"Manager {payload.email} updated"
    )
    return manager_detail(manager_id, user)


@router.delete("/managers/{manager_id}")
def delete_manager(
    manager_id: str,
    user: dict = Depends(require_roles("super_admin"))
):
    manager = row("SELECT id, email FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    execute("DELETE FROM manager_city_assignments WHERE manager_user_id = ?", (manager_id,))
    execute("DELETE FROM tournament_manager_assignments WHERE manager_user_id = ?", (manager_id,))
    execute("DELETE FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    log(
        user["email"],
        "manager_deleted",
        "user",
        manager_id,
        f"Manager {manager['email']} deleted"
    )
    return ok({"id": manager_id}, "Manager deleted")


@router.patch("/managers/{manager_id}/cities")
def update_manager_cities(
    manager_id: str,
    payload: ManagerCitiesPayload,
    user: dict = Depends(require_roles("super_admin"))
):
    manager = row(
        "SELECT id, email, name, role, created_at FROM users WHERE id = ? AND role = 'management'",
        (manager_id,)
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    clean_cities: list[str] = []
    for city in payload.cities:
        value = " ".join(city.strip().split())
        if value and value.lower() not in [existing.lower() for existing in clean_cities]:
            clean_cities.append(value)
    execute("DELETE FROM manager_city_assignments WHERE manager_user_id = ?", (manager_id,))
    for city in clean_cities:
        execute(
            """
            INSERT OR IGNORE INTO manager_city_assignments(id, manager_user_id, city)
            VALUES (?, ?, ?)
            """,
            (f"mcity_{uuid4().hex[:10]}", manager_id, city),
        )
    log(
        user["email"],
        "manager_cities_updated",
        "user",
        manager_id,
        f"Manager cities: {', '.join(clean_cities)}"
    )
    return ok(manager_with_cities(manager), "Manager city access updated")


@router.post("/registrations/{registration_id}/approve")
def approve_registration(
    registration_id: str,
    user: dict = Depends(require_roles("super_admin", "management"))
):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    if item["status"] == "approved":
        return ok(item, "Registration already approved")
    if item["payment_status"] != "paid":
        raise HTTPException(status_code=409, detail="Registration payment is not complete")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("approved", registration_id))
    execute("UPDATE tournaments SET teams = teams + 1 WHERE slug = ?", (item["tournament_slug"],))
    clear_public_cache(item["tournament_slug"])
    log(
        user["email"],
        "registration_approved",
        "registration",
        registration_id,
        "Registration approved"
    )
    return ok(
        row("SELECT * FROM registrations WHERE id = ?", (registration_id,)),
        "Registration approved"
    )


@router.get("/payments")
def admin_payments(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM payments ORDER BY created_at DESC"))


@router.get("/cms")
def cms_sections(_: dict = Depends(require_roles("super_admin"))):
    return ok(rows("SELECT * FROM cms_content WHERE slug <> 'regional-masters-highlights' ORDER BY title"))


@router.patch("/cms/{slug}")
def update_cms(
    slug: str,
    payload: CmsUpdate,
    user: dict = Depends(require_roles("super_admin"))
):
    item = row("SELECT * FROM cms_content WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="CMS content not found")
    execute(
        "UPDATE cms_content SET title = ?, body = ?, published = ? WHERE slug = ?",
        (payload.title, payload.body, int(payload.published), slug)
    )
    log(user["email"], "cms_updated", "cms", slug, "CMS content updated")
    return ok(row("SELECT * FROM cms_content WHERE slug = ?", (slug,)), "CMS content updated")


@router.get("/home-content")
def admin_home_content(_: dict = Depends(require_roles("super_admin"))):
    return ok({
        "discoveryCards": rows("SELECT * FROM home_discovery_cards ORDER BY sort_order, title"),
        "sponsorLogos": rows("SELECT * FROM sponsor_logos ORDER BY sort_order, name"),
        "organizerCards": rows("SELECT * FROM home_organizer_cards ORDER BY sort_order, title"),
    })


@router.post("/home-content/discovery")
def create_home_discovery(payload: HomeDiscoveryCardUpdate, user: dict = Depends(require_roles("super_admin"))):
    slug = slugify(payload.title)
    counter = 2
    while row("SELECT slug FROM home_discovery_cards WHERE slug = ?", (slug,)):
        slug = f"{slugify(payload.title)}-{counter}"
        counter += 1
    execute(
        """INSERT INTO home_discovery_cards(
            slug, label, title, sport, tournament_slug, sponsor_name, sponsor_image,
            image, event_date, description, sponsor_details, register_path, sort_order, published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (slug, payload.label, payload.title, payload.sport, payload.tournament_slug, payload.sponsor_name, payload.sponsor_image, payload.image, payload.event_date, payload.description, payload.sponsor_details, payload.register_path, payload.sort_order, int(payload.published)),
    )
    log(user["email"], "home_discovery_created", "home_discovery", slug, "Home discovery card created")
    clear_public_cache()
    return ok(row("SELECT * FROM home_discovery_cards WHERE slug = ?", (slug,)), "Discovery card created")


@router.get("/home-content/discovery/{slug}")
def get_home_discovery(slug: str, _: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT * FROM home_discovery_cards WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Discovery card not found")
    return ok(item)


@router.patch("/home-content/discovery/{slug}")
def update_home_discovery(
    slug: str,
    payload: HomeDiscoveryCardUpdate,
    user: dict = Depends(require_roles("super_admin"))
):
    if not row("SELECT slug FROM home_discovery_cards WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Discovery card not found")
    execute(
        """
        UPDATE home_discovery_cards
        SET label = ?, title = ?, sport = ?, tournament_slug = ?,
            sponsor_name = ?, sponsor_image = ?, image = ?,
            event_date = ?, description = ?, sponsor_details = ?,
            register_path = ?, sort_order = ?, published = ?
        WHERE slug = ?
        """,
        (
            payload.label,
            payload.title,
            payload.sport,
            payload.tournament_slug,
            payload.sponsor_name,
            payload.sponsor_image,
            payload.image,
            payload.event_date,
            payload.description,
            payload.sponsor_details,
            payload.register_path,
            payload.sort_order,
            int(payload.published),
            slug,
        ),
    )
    clear_public_cache()
    log(
        user["email"],
        "home_discovery_updated",
        "home_discovery",
        slug,
        "Home discovery card updated"
    )
    return ok(
        row("SELECT * FROM home_discovery_cards WHERE slug = ?", (slug,)),
        "Discovery card updated"
    )


@router.delete("/home-content/discovery/{slug}")
def delete_home_discovery(slug: str, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM home_discovery_cards WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Discovery card not found")
    execute("DELETE FROM home_discovery_cards WHERE slug = ?", (slug,))
    log(user["email"], "home_discovery_deleted", "home_discovery", slug, "Home discovery card deleted")
    clear_public_cache()
    return ok({"deleted": True, "slug": slug}, "Discovery card deleted")


@router.post("/home-content/live-highlight")
def create_live_highlight(payload: LiveHighlightUpdate, user: dict = Depends(require_roles("super_admin"))):
    item_id = f"live_{uuid4().hex[:10]}"
    execute(
        """INSERT INTO live_highlights(
            id, match_id, title, stage_label, home_team, away_team, home_score,
            away_score, image, description, impact_notes, link_path, sort_order, published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (item_id, payload.match_id, payload.title, payload.stage_label, payload.home_team, payload.away_team, payload.home_score, payload.away_score, payload.image, payload.description, payload.impact_notes, payload.link_path, payload.sort_order, int(payload.published)),
    )
    log(user["email"], "live_highlight_created", "live_highlight", item_id, "Homepage live highlight created")
    clear_public_cache()
    return ok(row("SELECT * FROM live_highlights WHERE id = ?", (item_id,)), "Live highlight created")


@router.get("/home-content/live-highlight/{item_id}")
def get_live_highlight(item_id: str, _: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT * FROM live_highlights WHERE id = ?", (item_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Live highlight not found")
    return ok(item)


@router.patch("/home-content/live-highlight/{item_id}")
def update_live_highlight(
    item_id: str,
    payload: LiveHighlightUpdate,
    user: dict = Depends(require_roles("super_admin"))
):
    if not row("SELECT id FROM live_highlights WHERE id = ?", (item_id,)):
        raise HTTPException(status_code=404, detail="Live highlight not found")
    execute(
        """
        UPDATE live_highlights
        SET match_id = ?, title = ?, stage_label = ?, home_team = ?, away_team = ?,
            home_score = ?, away_score = ?, image = ?, description = ?,
            impact_notes = ?, link_path = ?, sort_order = ?, published = ?
        WHERE id = ?
        """,
        (
            payload.match_id,
            payload.title,
            payload.stage_label,
            payload.home_team,
            payload.away_team,
            payload.home_score,
            payload.away_score,
            payload.image,
            payload.description,
            payload.impact_notes,
            payload.link_path,
            payload.sort_order,
            int(payload.published),
            item_id,
        ),
    )
    clear_public_cache()
    log(
        user["email"],
        "live_highlight_updated",
        "live_highlight",
        item_id,
        "Homepage live highlight updated"
    )
    return ok(
        row("SELECT * FROM live_highlights WHERE id = ?", (item_id,)),
        "Live highlight updated"
    )


@router.delete("/home-content/live-highlight/{item_id}")
def delete_live_highlight(item_id: str, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT id FROM live_highlights WHERE id = ?", (item_id,)):
        raise HTTPException(status_code=404, detail="Live highlight not found")
    execute("DELETE FROM live_highlights WHERE id = ?", (item_id,))
    log(user["email"], "live_highlight_deleted", "live_highlight", item_id, "Homepage live highlight deleted")
    clear_public_cache()
    return ok({"deleted": True, "id": item_id}, "Live highlight deleted")


@router.post("/home-content/sponsor")
def create_sponsor_logo(payload: SponsorLogoUpdate, user: dict = Depends(require_roles("super_admin"))):
    slug = slugify(payload.name)
    counter = 2
    while row("SELECT slug FROM sponsor_logos WHERE slug = ?", (slug,)):
        slug = f"{slugify(payload.name)}-{counter}"
        counter += 1
    execute(
        "INSERT INTO sponsor_logos(slug, name, image, link_url, sort_order, published) VALUES (?, ?, ?, ?, ?, ?)",
        (slug, payload.name, payload.image, payload.link_url, payload.sort_order, int(payload.published)),
    )
    log(user["email"], "sponsor_logo_created", "sponsor", slug, "Sponsor logo created")
    clear_public_cache()
    return ok(row("SELECT * FROM sponsor_logos WHERE slug = ?", (slug,)), "Sponsor logo created")


@router.get("/home-content/sponsor/{slug}")
def get_sponsor_logo(slug: str, _: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT * FROM sponsor_logos WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Sponsor logo not found")
    return ok(item)


@router.patch("/home-content/sponsor/{slug}")
def update_sponsor_logo(
    slug: str,
    payload: SponsorLogoUpdate,
    user: dict = Depends(require_roles("super_admin"))
):
    if not row("SELECT slug FROM sponsor_logos WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Sponsor logo not found")
    execute(
        """
        UPDATE sponsor_logos
        SET name = ?, image = ?, link_url = ?, sort_order = ?, published = ?
        WHERE slug = ?
        """,
        (payload.name, payload.image, payload.link_url, payload.sort_order, int(payload.published), slug),
    )
    clear_public_cache()
    log(
        user["email"],
        "sponsor_logo_updated",
        "sponsor",
        slug,
        "Sponsor logo updated"
    )
    return ok(
        row("SELECT * FROM sponsor_logos WHERE slug = ?", (slug,)),
        "Sponsor logo updated"
    )


@router.delete("/home-content/sponsor/{slug}")
def delete_sponsor_logo(slug: str, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM sponsor_logos WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Sponsor logo not found")
    execute("DELETE FROM sponsor_logos WHERE slug = ?", (slug,))
    log(user["email"], "sponsor_logo_deleted", "sponsor", slug, "Sponsor logo deleted")
    clear_public_cache()
    return ok({"deleted": True, "slug": slug}, "Sponsor logo deleted")


@router.post("/home-content/organizer")
def create_organizer_card(payload: OrganizerCardUpdate, user: dict = Depends(require_roles("super_admin"))):
    slug = slugify(payload.title)
    counter = 2
    while row("SELECT slug FROM home_organizer_cards WHERE slug = ?", (slug,)):
        slug = f"{slugify(payload.title)}-{counter}"
        counter += 1
    execute(
        "INSERT INTO home_organizer_cards(slug, title, description, sort_order, published) VALUES (?, ?, ?, ?, ?)",
        (slug, payload.title, payload.description, payload.sort_order, int(payload.published)),
    )
    log(user["email"], "organizer_card_created", "home_organizer", slug, "Organizer card created")
    clear_public_cache()
    return ok(row("SELECT * FROM home_organizer_cards WHERE slug = ?", (slug,)), "Organizer card created")


@router.get("/home-content/organizer/{slug}")
def get_organizer_card(slug: str, _: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT * FROM home_organizer_cards WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="Organizer card not found")
    return ok(item)


@router.patch("/home-content/organizer/{slug}")
def update_organizer_card(slug: str, payload: OrganizerCardUpdate, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM home_organizer_cards WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Organizer card not found")
    execute(
        "UPDATE home_organizer_cards SET title = ?, description = ?, sort_order = ?, published = ? WHERE slug = ?",
        (payload.title, payload.description, payload.sort_order, int(payload.published), slug),
    )
    log(user["email"], "organizer_card_updated", "home_organizer", slug, "Organizer card updated")
    clear_public_cache()
    return ok(row("SELECT * FROM home_organizer_cards WHERE slug = ?", (slug,)), "Organizer card updated")


@router.delete("/home-content/organizer/{slug}")
def delete_organizer_card(slug: str, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM home_organizer_cards WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Organizer card not found")
    execute("DELETE FROM home_organizer_cards WHERE slug = ?", (slug,))
    log(user["email"], "organizer_card_deleted", "home_organizer", slug, "Organizer card deleted")
    clear_public_cache()
    return ok({"deleted": True, "slug": slug}, "Organizer card deleted")


@router.get("/logs")
def logs(_: dict = Depends(require_roles("super_admin"))):
    return ok(audit_rows("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200"))


@router.get("/database/status")
def database_health(_: dict = Depends(require_roles("super_admin"))):
    return ok(database_status())


@router.get("/database/compare")
def database_compare(_: dict = Depends(require_roles("super_admin"))):
    return ok(compare_primary_mirror())


@router.post("/database/mirror/sync")
def database_mirror_sync(user: dict = Depends(require_roles("super_admin"))):
    job = enqueue("database.mirror_sync")
    log(user["email"], "mirror_sync_queued", "database", "db2", "DB-2 mirror sync queued")
    return ok({"job": job, "database": database_status()}, "Mirror synchronization queued")


@router.post("/database/backups/json")
def database_json_backup(user: dict = Depends(require_roles("super_admin"))):
    result = enqueue("database.json_backup")
    log(
        user["email"],
        "json_backup_queued",
        "database",
        "db1_db2",
        "DB-1 and DB-2 JSON backup queued"
    )
    return ok(result, "JSON backup queued")
