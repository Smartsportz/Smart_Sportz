from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException

from app.api.deps import require_roles
from app.core.responses import ok
from app.core.security import hash_password
from app.db.database import audit_rows, execute, row, rows, sync_mirror
from app.schemas import AdminTeamUpdatePayload, AdminUserCreatePayload, AdminUserUpdatePayload, CmsUpdate, HomeDiscoveryCardUpdate, LiveHighlightUpdate, ManagerCitiesPayload, ManagerCreatePayload, ManagerUpdatePayload, SponsorLogoUpdate
from app.services.audit import log
from app.services.database_architecture import compare_primary_mirror, database_status, export_json_backups

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard")
def dashboard(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok({
        "tournaments": row("SELECT COUNT(*) AS count FROM tournaments")["count"],
        "teams": row("SELECT COUNT(*) AS count FROM teams")["count"],
        "registrations": row("SELECT COUNT(*) AS count FROM registrations")["count"],
        "payments": row("SELECT COALESCE(SUM(amount), 0) AS amount FROM payments")["amount"],
        "liveMatches": row("SELECT COUNT(*) AS count FROM live_matches WHERE status LIKE '%Live%'")["count"],
    })


@router.get("/tournaments")
def admin_tournaments(_: dict = Depends(require_roles("super_admin", "management"))):
    records = rows("SELECT * FROM tournaments ORDER BY name")
    for item in records:
        item["assigned_managers"] = rows(
            """
            SELECT u.id, u.name, u.email
            FROM tournament_manager_assignments tma
            INNER JOIN users u ON u.id = tma.manager_user_id
            WHERE tma.tournament_slug = ?
            ORDER BY u.name
            """,
            (item["slug"],),
        )
        item["assigned_manager_ids"] = [manager["id"] for manager in item["assigned_managers"]]
    return ok(records)


@router.get("/tournaments/{tournament_slug}/teams")
def admin_tournament_teams(tournament_slug: str, _: dict = Depends(require_roles("super_admin"))):
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
    return ok(records)


@router.get("/registrations/{registration_id}/team-detail")
def admin_registration_team_detail(registration_id: str, _: dict = Depends(require_roles("super_admin"))):
    registration = row(
        """
        SELECT r.*, t.name AS tournament_name, t.sport, t.location, t.date, t.image, u.name AS user_name, u.email AS user_email
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
        "players": rows("SELECT name, role, jersey, contact FROM registration_members WHERE registration_id = ? ORDER BY id", (registration_id,)),
        "documents": rows("SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ? ORDER BY uploaded_at DESC", (registration_id,)),
        "payments": rows("SELECT id, status, amount, method, receipt_number, created_at FROM payments WHERE registration_id = ? ORDER BY created_at DESC", (registration_id,)),
    })


@router.patch("/teams/{registration_id}")
def admin_update_team(registration_id: str, payload: AdminTeamUpdatePayload, user: dict = Depends(require_roles("super_admin"))):
    existing = row("SELECT id, team_name FROM registrations WHERE id = ?", (registration_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Registration team not found")
    duplicate = row(
        "SELECT id FROM registrations WHERE tournament_slug = (SELECT tournament_slug FROM registrations WHERE id = ?) AND LOWER(team_name) = LOWER(?) AND id <> ?",
        (registration_id, payload.team_name.strip(), registration_id),
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A team with this name is already registered for this tournament")
    execute(
        """
        UPDATE registrations
        SET team_name = ?, captain_name = ?, sub_captain_name = ?, coach_name = ?, email = ?, phone = ?, city = ?, team_logo = ?, team_motto = ?
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
    log(user["email"], "admin_team_updated", "registration", registration_id, f"Updated team {payload.team_name}")
    return admin_registration_team_detail(registration_id, user)


@router.delete("/teams/{registration_id}")
def admin_delete_team(registration_id: str, user: dict = Depends(require_roles("super_admin"))):
    existing = row("SELECT id, team_name FROM registrations WHERE id = ?", (registration_id,))
    if not existing:
        raise HTTPException(status_code=404, detail="Registration team not found")
    execute("DELETE FROM payments WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registration_documents WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registration_members WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registrations WHERE id = ?", (registration_id,))
    log(user["email"], "admin_team_deleted", "registration", registration_id, f"Deleted team {existing['team_name']}")
    return ok({"id": registration_id}, "Team deleted")


@router.get("/tournaments/{tournament_slug}/payments")
def admin_tournament_payments(tournament_slug: str, _: dict = Depends(require_roles("super_admin"))):
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
        FROM payments p
        INNER JOIN registrations r ON r.id = p.registration_id
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
            "teams": row("SELECT COUNT(*) AS count FROM registrations WHERE tournament_slug = ?", (tournament_slug,))["count"],
            "pendingPayments": row("SELECT COUNT(*) AS count FROM registrations WHERE tournament_slug = ? AND payment_status <> 'paid'", (tournament_slug,))["count"],
        },
        "payments": payment_rows,
    }


@router.post("/payments/{payment_id}/refund")
def admin_refund_payment(payment_id: str, payload: dict = Body(default_factory=dict), user: dict = Depends(require_roles("super_admin"))):
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
        SET status = 'refunded', refund_destination = ?, refund_reference = ?, action_note = ?, action_at = ?
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
    execute("UPDATE registrations SET payment_status = 'refunded' WHERE id = ?", (payment["registration_id"],))
    log(user["email"], "payment_refunded", "payment", payment_id, f"Refund recorded for {payment['team_name']}")
    return ok(_admin_tournament_payments_payload(payment["tournament_slug"]), "Payment refund recorded")


@router.post("/payments/{payment_id}/cancel")
def admin_cancel_payment(payment_id: str, payload: dict = Body(default_factory=dict), user: dict = Depends(require_roles("super_admin"))):
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
    execute("UPDATE registrations SET payment_status = 'cancelled' WHERE id = ?", (payment["registration_id"],))
    log(user["email"], "payment_cancelled", "payment", payment_id, f"Payment cancelled for {payment['team_name']}")
    return ok(_admin_tournament_payments_payload(payment["tournament_slug"]), "Payment cancelled")


@router.get("/registrations")
def admin_registrations(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM registrations ORDER BY created_at DESC"))


def user_with_counts(user: dict) -> dict:
    user["registrations_count"] = row("SELECT COUNT(*) AS count FROM registrations WHERE user_id = ?", (user["id"],))["count"]
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
    user = row("SELECT id, email, name, role, phone, email_verified, phone_verified, created_at FROM users WHERE id = ? AND role = ?", (user_id, role))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    registrations = rows(
        """
        SELECT r.*, t.name AS tournament_name, t.sport, t.location, t.date, t.image
        FROM registrations r
        LEFT JOIN tournaments t ON t.slug = r.tournament_slug
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
        """,
        (user_id,),
    )
    registration_ids = [item["id"] for item in registrations]
    payments: list[dict] = []
    documents: list[dict] = []
    members: list[dict] = []
    if registration_ids:
        placeholders = ",".join(["?"] * len(registration_ids))
        payments = rows(f"SELECT * FROM payments WHERE registration_id IN ({placeholders}) ORDER BY created_at DESC", tuple(registration_ids))
        documents = rows(f"SELECT * FROM registration_documents WHERE registration_id IN ({placeholders}) ORDER BY uploaded_at DESC", tuple(registration_ids))
        members = rows(f"SELECT * FROM registration_members WHERE registration_id IN ({placeholders}) ORDER BY id", tuple(registration_ids))
    return {
        "user": user,
        "registrations": registrations,
        "payments": payments,
        "documents": documents,
        "members": members,
    }


@router.get("/users")
def admin_users(_: dict = Depends(require_roles("super_admin"))):
    return ok([
        user_with_counts(item)
        for item in rows("SELECT id, email, name, role, phone, email_verified, phone_verified, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC")
    ])


@router.post("/users")
def create_user(payload: AdminUserCreatePayload, user: dict = Depends(require_roles("super_admin"))):
    existing = row("SELECT id FROM users WHERE email = ?", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="User email already exists")
    user_id = f"user_{uuid4().hex[:12]}"
    execute(
        "INSERT INTO users(id, email, name, role, password_hash, phone, email_verified, phone_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, str(payload.email), payload.name, "user", hash_password(payload.password), payload.phone, 1, 1, datetime.now(timezone.utc).isoformat()),
    )
    log(user["email"], "user_created", "user", user_id, f"User {payload.email} created")
    return ok(user_detail_payload(user_id), "User created")


@router.get("/users/{user_id}")
def admin_user_detail(user_id: str, _: dict = Depends(require_roles("super_admin"))):
    return ok(user_detail_payload(user_id))


@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: AdminUserUpdatePayload, user: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT id FROM users WHERE id = ? AND role = 'user'", (user_id,))
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    email_owner = row("SELECT id FROM users WHERE email = ? AND id <> ?", (payload.email, user_id))
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already belongs to another account")
    if payload.password:
        execute(
            "UPDATE users SET name = ?, email = ?, phone = ?, password_hash = ? WHERE id = ? AND role = 'user'",
            (payload.name, str(payload.email), payload.phone, hash_password(payload.password), user_id),
        )
    else:
        execute(
            "UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ? AND role = 'user'",
            (payload.name, str(payload.email), payload.phone, user_id),
        )
    log(user["email"], "user_updated", "user", user_id, f"User {payload.email} updated")
    return ok(user_detail_payload(user_id), "User updated")


@router.delete("/users/{user_id}")
def delete_user(user_id: str, user: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT id, email FROM users WHERE id = ? AND role = 'user'", (user_id,))
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    registration_ids = [record["id"] for record in rows("SELECT id FROM registrations WHERE user_id = ?", (user_id,))]
    for registration_id in registration_ids:
        execute("DELETE FROM payments WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM registration_documents WHERE registration_id = ?", (registration_id,))
        execute("DELETE FROM registration_members WHERE registration_id = ?", (registration_id,))
    execute("DELETE FROM registrations WHERE user_id = ?", (user_id,))
    execute("DELETE FROM users WHERE id = ? AND role = 'user'", (user_id,))
    log(user["email"], "user_deleted", "user", user_id, f"User {item['email']} deleted")
    return ok({"id": user_id}, "User deleted")


def manager_with_cities(manager: dict) -> dict:
    manager["cities"] = [
        item["city"]
        for item in rows("SELECT city FROM manager_city_assignments WHERE manager_user_id = ? ORDER BY city", (manager["id"],))
    ]
    return manager


@router.get("/managers")
def managers(_: dict = Depends(require_roles("super_admin"))):
    return ok([
        manager_with_cities(item)
        for item in rows("SELECT id, email, name, role, created_at FROM users WHERE role = 'management' ORDER BY name")
    ])


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
def create_manager(payload: ManagerCreatePayload, user: dict = Depends(require_roles("super_admin"))):
    existing = row("SELECT id FROM users WHERE email = ?", (payload.email,))
    if existing:
        raise HTTPException(status_code=409, detail="Manager email already exists")
    manager_id = str(uuid4())
    execute(
        "INSERT INTO users(id, email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (manager_id, payload.email, payload.name, "management", hash_password(payload.password), datetime.now(timezone.utc).isoformat()),
    )
    update_manager_cities(manager_id, ManagerCitiesPayload(cities=payload.cities), user)
    log(user["email"], "manager_created", "user", manager_id, f"Manager {payload.email} created")
    return ok(manager_with_cities(row("SELECT id, email, name, role, created_at FROM users WHERE id = ?", (manager_id,))), "Manager created")


@router.get("/managers/{manager_id}")
def manager_detail(manager_id: str, _: dict = Depends(require_roles("super_admin"))):
    manager = row("SELECT id, email, name, role, created_at FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    manager = manager_with_cities(manager)
    assigned = []
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
            f"SELECT * FROM tournaments WHERE location IN ({','.join(['?'] * len(manager['cities']))}) ORDER BY name",
            tuple(manager["cities"]),
        )
        seen = {item["slug"] for item in assigned}
        assigned.extend([item for item in city_assigned if item["slug"] not in seen])
    manager["assigned_tournaments"] = sorted(assigned, key=lambda item: item["name"])
    return ok(manager)


@router.patch("/managers/{manager_id}")
def update_manager(manager_id: str, payload: ManagerUpdatePayload, user: dict = Depends(require_roles("super_admin"))):
    manager = row("SELECT id FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    email_owner = row("SELECT id FROM users WHERE email = ? AND id <> ?", (payload.email, manager_id))
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already belongs to another account")
    if payload.password:
        execute(
            "UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ? AND role = 'management'",
            (payload.name, str(payload.email), hash_password(payload.password), manager_id),
        )
    else:
        execute(
            "UPDATE users SET name = ?, email = ? WHERE id = ? AND role = 'management'",
            (payload.name, str(payload.email), manager_id),
        )
    update_manager_cities(manager_id, ManagerCitiesPayload(cities=payload.cities), user)
    log(user["email"], "manager_updated", "user", manager_id, f"Manager {payload.email} updated")
    return manager_detail(manager_id, user)


@router.delete("/managers/{manager_id}")
def delete_manager(manager_id: str, user: dict = Depends(require_roles("super_admin"))):
    manager = row("SELECT id, email FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    execute("DELETE FROM manager_city_assignments WHERE manager_user_id = ?", (manager_id,))
    execute("DELETE FROM tournament_manager_assignments WHERE manager_user_id = ?", (manager_id,))
    execute("DELETE FROM users WHERE id = ? AND role = 'management'", (manager_id,))
    log(user["email"], "manager_deleted", "user", manager_id, f"Manager {manager['email']} deleted")
    return ok({"id": manager_id}, "Manager deleted")


@router.patch("/managers/{manager_id}/cities")
def update_manager_cities(manager_id: str, payload: ManagerCitiesPayload, user: dict = Depends(require_roles("super_admin"))):
    manager = row("SELECT id, email, name, role, created_at FROM users WHERE id = ? AND role = 'management'", (manager_id,))
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
            "INSERT OR IGNORE INTO manager_city_assignments(id, manager_user_id, city) VALUES (?, ?, ?)",
            (f"mcity_{uuid4().hex[:10]}", manager_id, city),
        )
    log(user["email"], "manager_cities_updated", "user", manager_id, f"Manager cities: {', '.join(clean_cities)}")
    return ok(manager_with_cities(manager), "Manager city access updated")


@router.post("/registrations/{registration_id}/approve")
def approve_registration(registration_id: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    if item["status"] == "approved":
        return ok(item, "Registration already approved")
    if item["payment_status"] != "paid":
        raise HTTPException(status_code=409, detail="Registration payment is not complete")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("approved", registration_id))
    execute("UPDATE tournaments SET teams = teams + 1 WHERE slug = ?", (item["tournament_slug"],))
    log(user["email"], "registration_approved", "registration", registration_id, "Registration approved")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration approved")


@router.get("/payments")
def admin_payments(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM payments ORDER BY created_at DESC"))


@router.get("/cms")
def cms_sections(_: dict = Depends(require_roles("super_admin"))):
    return ok(rows("SELECT * FROM cms_content ORDER BY title"))


@router.patch("/cms/{slug}")
def update_cms(slug: str, payload: CmsUpdate, user: dict = Depends(require_roles("super_admin"))):
    item = row("SELECT * FROM cms_content WHERE slug = ?", (slug,))
    if not item:
        raise HTTPException(status_code=404, detail="CMS content not found")
    execute("UPDATE cms_content SET title = ?, body = ?, published = ? WHERE slug = ?", (payload.title, payload.body, int(payload.published), slug))
    log(user["email"], "cms_updated", "cms", slug, "CMS content updated")
    return ok(row("SELECT * FROM cms_content WHERE slug = ?", (slug,)), "CMS content updated")


@router.get("/home-content")
def admin_home_content(_: dict = Depends(require_roles("super_admin"))):
    return ok({
        "discoveryCards": rows("SELECT * FROM home_discovery_cards ORDER BY sort_order, title"),
        "liveHighlights": rows("SELECT * FROM live_highlights ORDER BY sort_order, title"),
        "sponsorLogos": rows("SELECT * FROM sponsor_logos ORDER BY sort_order, name"),
    })


@router.patch("/home-content/discovery/{slug}")
def update_home_discovery(slug: str, payload: HomeDiscoveryCardUpdate, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM home_discovery_cards WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Discovery card not found")
    execute(
        """
        UPDATE home_discovery_cards
        SET label = ?, title = ?, sport = ?, tournament_slug = ?, sponsor_name = ?, sponsor_image = ?, image = ?,
            event_date = ?, description = ?, sponsor_details = ?, register_path = ?, sort_order = ?, published = ?
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
    log(user["email"], "home_discovery_updated", "home_discovery", slug, "Home discovery card updated")
    return ok(row("SELECT * FROM home_discovery_cards WHERE slug = ?", (slug,)), "Discovery card updated")


@router.patch("/home-content/live-highlight/{item_id}")
def update_live_highlight(item_id: str, payload: LiveHighlightUpdate, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT id FROM live_highlights WHERE id = ?", (item_id,)):
        raise HTTPException(status_code=404, detail="Live highlight not found")
    execute(
        """
        UPDATE live_highlights
        SET match_id = ?, title = ?, stage_label = ?, home_team = ?, away_team = ?, home_score = ?, away_score = ?,
            image = ?, description = ?, impact_notes = ?, link_path = ?, sort_order = ?, published = ?
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
    log(user["email"], "live_highlight_updated", "live_highlight", item_id, "Homepage live highlight updated")
    return ok(row("SELECT * FROM live_highlights WHERE id = ?", (item_id,)), "Live highlight updated")


@router.patch("/home-content/sponsor/{slug}")
def update_sponsor_logo(slug: str, payload: SponsorLogoUpdate, user: dict = Depends(require_roles("super_admin"))):
    if not row("SELECT slug FROM sponsor_logos WHERE slug = ?", (slug,)):
        raise HTTPException(status_code=404, detail="Sponsor logo not found")
    execute(
        "UPDATE sponsor_logos SET name = ?, image = ?, link_url = ?, sort_order = ?, published = ? WHERE slug = ?",
        (payload.name, payload.image, payload.link_url, payload.sort_order, int(payload.published), slug),
    )
    log(user["email"], "sponsor_logo_updated", "sponsor", slug, "Sponsor logo updated")
    return ok(row("SELECT * FROM sponsor_logos WHERE slug = ?", (slug,)), "Sponsor logo updated")


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
    sync_mirror()
    log(user["email"], "mirror_synced", "database", "db2", "DB-2 mirror synchronized from DB-1")
    return ok(database_status(), "Mirror synchronized")


@router.post("/database/backups/json")
def database_json_backup(user: dict = Depends(require_roles("super_admin"))):
    result = export_json_backups()
    log(user["email"], "json_backup_created", "database", "db1_db2", "DB-1 and DB-2 JSON backups generated")
    return ok(result, "JSON backups generated")
