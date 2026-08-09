from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import quote_plus
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import PaymentIntentConfirm, PaymentIntentCreate

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("")
def payments():
    return ok(rows("SELECT * FROM payments ORDER BY created_at DESC"))


@router.post("/local-intent")
def create_local_payment_intent(payload: PaymentIntentCreate):
    tournament = row("SELECT slug, name FROM tournaments WHERE slug = ?", (payload.tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    now = datetime.now(UTC).isoformat()
    payment_id = f"rzp_local_{uuid4().hex[:14]}"
    receipt_number = f"SS-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    qr_payload = None
    if payload.method == "upi":
        qr_values = {
            "pa": "smartsportz@upi",
            "pn": "SmartSportz",
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
          receipt_number, qr_payload, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            now,
            now,
        ),
    )
    return ok(row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,)), "Local Razorpay-style payment intent created")


@router.post("/local-intent/{payment_id}/confirm")
def confirm_local_payment_intent(payment_id: str, payload: PaymentIntentConfirm):
    intent = row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,))
    if not intent:
        raise HTTPException(status_code=404, detail="Payment intent not found")

    now = datetime.now(UTC).isoformat()
    execute(
        "UPDATE payment_intents SET status = ?, method = ?, updated_at = ? WHERE id = ?",
        (payload.status, payload.method, now, payment_id),
    )
    return ok(row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,)), "Local payment status updated")


@router.get("/{payment_id}")
def payment_detail(payment_id: str):
    item = row("SELECT * FROM payments WHERE id = ?", (payment_id,)) or row(
        "SELECT * FROM payment_intents WHERE id = ?",
        (payment_id,),
    )
    if not item:
        raise HTTPException(status_code=404, detail="Payment not found")
    return ok(item)


@router.get("/{payment_id}/receipt")
def payment_receipt(payment_id: str):
    payment = row("SELECT * FROM payments WHERE id = ?", (payment_id,))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    registration = row("SELECT * FROM registrations WHERE id = ?", (payment["registration_id"],))
    return ok({"payment": payment, "registration": registration}, "Receipt generated from local payment store")
