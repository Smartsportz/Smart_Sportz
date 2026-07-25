from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import CmsUpdate
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
