from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.responses import ok
from app.core.security import hash_password
from app.db.database import execute, row, rows
from app.schemas import CmsUpdate, ManagerCitiesPayload, ManagerCreatePayload
from app.services.audit import log

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
    return ok(rows("SELECT * FROM tournaments ORDER BY name"))


@router.get("/registrations")
def admin_registrations(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM registrations ORDER BY created_at DESC"))


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


@router.get("/logs")
def logs(_: dict = Depends(require_roles("super_admin"))):
    return ok(rows("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200"))
