from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import current_user
from app.core.config import settings
from app.core.responses import ok
from app.db.database import rows
from app.services.cache import cache_key, get_or_set_json

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/dashboard")
def dashboard(user: dict = Depends(current_user)):
    def build():
        registrations = rows(
            """
            SELECT
              r.id,
              r.tournament_slug,
              r.team_name,
              r.team_code,
              r.captain_name,
              r.city,
              r.status,
              r.payment_status,
              r.amount,
              r.confirmation_code,
              r.created_at,
              t.name AS tournament_name,
              t.sport,
              t.location,
              t.date,
              t.image
            FROM registrations r
            LEFT JOIN tournaments t ON t.slug = r.tournament_slug
            WHERE r.user_id = ?
            ORDER BY r.created_at DESC
            """,
            (user["id"],),
        )
        registration_ids = [item["id"] for item in registrations]
        payments = []
        documents = []
        members = []
        if registration_ids:
            placeholders = ",".join(["?"] * len(registration_ids))
            payments = rows(
                f"SELECT id, registration_id, status, amount, method, receipt_number, created_at FROM payments WHERE registration_id IN ({placeholders}) ORDER BY created_at DESC",
                tuple(registration_ids),
            )
            documents = rows(
                f"SELECT registration_id, document_type, file_name, status, uploaded_at FROM registration_documents WHERE registration_id IN ({placeholders}) ORDER BY uploaded_at DESC",
                tuple(registration_ids),
            )
            members = rows(
                f"SELECT registration_id, name, role, jersey, contact FROM registration_members WHERE registration_id IN ({placeholders}) ORDER BY id",
                tuple(registration_ids),
            )
        paid_count = len([payment for payment in payments if payment["status"] == "paid"])
        pending_documents = len([document for document in documents if document["status"] != "uploaded"])
        certificates = len([item for item in registrations if item["status"] in ("approved", "accepted")])
        return {
            "profile": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            },
            "summary": {
                "registrations": len(registrations),
                "paidPayments": paid_count,
                "certificates": certificates,
                "pendingDocuments": pending_documents,
            },
            "registrations": registrations,
            "payments": payments,
            "documents": documents,
            "members": members,
        }

    return ok(get_or_set_json(cache_key("user:dashboard", user["id"], user["email"]), build, settings.dashboard_cache_ttl_seconds))
