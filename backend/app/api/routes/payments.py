from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote_plus
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.core.config import settings
from app.core.responses import ok
from app.db.database import ensure_column, execute, row, rows
from app.schemas import PaymentIntentConfirm, PaymentIntentCreate
from app.services.audit import log

router = APIRouter(prefix="/payments", tags=["payments"])

_payment_intent_columns_ready = False


def ensure_payment_intent_columns() -> None:
    global _payment_intent_columns_ready
    if _payment_intent_columns_ready:
        return
    columns = {
        "receiver_upi_id": "TEXT NOT NULL DEFAULT ''",
        "transaction_reference": "TEXT NOT NULL DEFAULT ''",
        "verified_at": "TEXT NOT NULL DEFAULT ''",
        "verified_by": "TEXT NOT NULL DEFAULT ''",
        "verification_note": "TEXT NOT NULL DEFAULT ''",
    }
    for column, definition in columns.items():
        ensure_column("payment_intents", column, definition)
    _payment_intent_columns_ready = True


def payment_intent_response(payment_id: str) -> dict:
    item = row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,))
    if item:
        item["receiver_upi_id"] = item.get("receiver_upi_id") or settings.phonepe_upi_id
        item["payee_name"] = settings.phonepe_payee_name
    return item or {}


@router.get("")
def payments():
    return ok(rows("SELECT * FROM payments ORDER BY created_at DESC"))


@router.post("/local-intent")
def create_local_payment_intent(payload: PaymentIntentCreate):
    ensure_payment_intent_columns()
    tournament = row("SELECT slug, name FROM tournaments WHERE slug = ?", (payload.tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    now = datetime.now(timezone.utc).isoformat()
    payment_id = f"rzp_local_{uuid4().hex[:14]}"
    receipt_number = f"SS-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    qr_payload = None
    if payload.method == "upi":
        qr_values = {
            "pa": settings.phonepe_upi_id,
            "pn": settings.phonepe_payee_name,
            "am": f"{payload.amount / 100:.2f}",
            "cu": "INR",
            "tr": payment_id,
            "tid": payment_id,
            "tn": f"{tournament['name']} - {payload.team_name}",
        }
        qr_payload = "upi://pay?" + "&".join(f"{key}={quote_plus(value)}" for key, value in qr_values.items())

    execute(
        """
        INSERT INTO payment_intents (
          id, tournament_slug, team_name, amount, method, contact, status,
          receipt_number, qr_payload, receiver_upi_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payment_id,
            payload.tournament_slug,
            payload.team_name,
            payload.amount,
            payload.method,
            payload.contact,
            "pending",
            receipt_number,
            qr_payload,
            settings.phonepe_upi_id if payload.method == "upi" else "",
            now,
            now,
        ),
    )
    return ok(payment_intent_response(payment_id), "PhonePe UPI payment intent created")


@router.post("/local-intent/{payment_id}/confirm")
def confirm_local_payment_intent(payment_id: str, payload: PaymentIntentConfirm, user: dict = Depends(require_roles("super_admin", "management"))):
    ensure_payment_intent_columns()
    intent = row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,))
    if not intent:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    if payload.status == "paid" and not payload.transaction_reference.strip():
        raise HTTPException(status_code=400, detail="Transaction reference is required to verify payment")

    now = datetime.now(timezone.utc).isoformat()
    execute(
        """UPDATE payment_intents
           SET status = ?, method = ?, transaction_reference = ?, verified_at = ?, verified_by = ?, verification_note = ?, updated_at = ?
           WHERE id = ?""",
        (
            payload.status,
            payload.method,
            payload.transaction_reference.strip(),
            now if payload.status == "paid" else "",
            user["id"] if payload.status == "paid" else "",
            payload.verification_note.strip(),
            now,
            payment_id,
        ),
    )
    log(user["email"], "payment_intent_verified", "payment_intent", payment_id, f"Payment intent marked {payload.status}")
    return ok(payment_intent_response(payment_id), "Payment status updated")


@router.get("/{payment_id}")
def payment_detail(payment_id: str):
    ensure_payment_intent_columns()
    item = row("SELECT * FROM payments WHERE id = ?", (payment_id,)) or row(
        "SELECT * FROM payment_intents WHERE id = ?",
        (payment_id,),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Payment not found")
    if str(item.get("id", "")).startswith("rzp_local_"):
        item["receiver_upi_id"] = item.get("receiver_upi_id") or settings.phonepe_upi_id
        item["payee_name"] = settings.phonepe_payee_name
    return ok(item)


@router.get("/{payment_id}/receipt")
def payment_receipt(payment_id: str):
    payment = row("SELECT * FROM payments WHERE id = ?", (payment_id,))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    registration = row("SELECT * FROM registrations WHERE id = ?", (payment["registration_id"],))
    return ok({"payment": payment, "registration": registration}, "Receipt generated from local payment store")
