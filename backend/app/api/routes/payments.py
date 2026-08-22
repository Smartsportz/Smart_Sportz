from __future__ import annotations

import json
from datetime import datetime, timezone
from urllib.parse import quote_plus
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import current_user, require_roles
from app.core.config import settings
from app.core.responses import ok
from app.db.database import ensure_column, execute, row, rows
from app.schemas import PaymentIntentConfirm, PaymentIntentCreate, PaymentIntentSubmit
from app.services.audit import log
from app.services.runtime_state import runtime_state

router = APIRouter(prefix="/payments", tags=["payments"])

_payment_intent_columns_ready = False


def ensure_payment_intent_columns() -> None:
    global _payment_intent_columns_ready
    if _payment_intent_columns_ready:
        return
    columns = {
        "registration_id": "TEXT NOT NULL DEFAULT ''",
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


def _confirmation_code(registration_id: str) -> str:
    return f"SS-{registration_id.replace('reg_', '').upper()[:8]}"


def _random_team_code(tournament_slug: str) -> str:
    while True:
        code = f"SST-{uuid4().hex[:8].upper()}"
        existing = row(
            "SELECT id FROM registrations WHERE tournament_slug = ? AND lower(team_code) = lower(?)",
            (tournament_slug, code),
        )
        if not existing:
            return code


def _invalidate_registration_views(registration: dict) -> None:
    runtime_state.delete_prefix("cache:user:dashboard")
    runtime_state.delete_prefix("cache:management:dashboard")
    runtime_state.delete_prefix("cache:public:home")
    runtime_state.delete("cache:public:tournaments")
    if registration.get("tournament_slug"):
        runtime_state.delete(f"cache:public:tournament:{registration['tournament_slug']}")


def _finalize_paid_intent(intent: dict, method: str) -> dict:
    registration_id = intent.get("registration_id") or ""
    registration = row("SELECT * FROM registrations WHERE id = ?", (registration_id,)) if registration_id else None
    if not registration:
        registration = row(
            """
            SELECT * FROM registrations
            WHERE tournament_slug = ? AND lower(trim(team_name)) = lower(trim(?))
            ORDER BY created_at DESC LIMIT 1
            """,
            (intent["tournament_slug"], intent["team_name"]),
        )
    if not registration:
        raise HTTPException(status_code=404, detail="Linked registration not found")

    existing_payment = row(
        "SELECT * FROM payments WHERE receipt_number = ? OR (registration_id = ? AND status = 'paid') ORDER BY created_at DESC LIMIT 1",
        (intent["receipt_number"], registration["id"]),
    )
    confirmation_code = registration.get("confirmation_code") or _confirmation_code(registration["id"])
    team_code = registration.get("team_code") or _random_team_code(registration["tournament_slug"])
    tournament = row("SELECT name, slug FROM tournaments WHERE slug = ?", (registration["tournament_slug"],))
    qr_payload = {
        "type": "SmartSportzTeamVerification",
        "registrationId": registration["id"],
        "confirmationCode": confirmation_code,
        "teamCode": team_code,
        "teamName": registration["team_name"],
        "tournamentSlug": registration["tournament_slug"],
        "tournamentName": tournament["name"] if tournament else registration["tournament_slug"],
        "captainName": registration["captain_name"],
        "city": registration["city"],
        "paymentReceipt": intent["receipt_number"],
        "receiptNumber": intent["receipt_number"],
        "verificationPath": f"/registrations/{registration['id']}",
    }
    if not existing_payment:
        payment_id = f"pay_{uuid4().hex[:12]}"
        execute(
            "INSERT INTO payments(id, registration_id, status, amount, method, receipt_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (payment_id, registration["id"], "paid", int(intent["amount"] or registration["amount"] or 0), method, intent["receipt_number"], datetime.now(timezone.utc).isoformat()),
        )
        existing_payment = row("SELECT * FROM payments WHERE id = ?", (payment_id,))
    execute(
        "UPDATE registrations SET status = ?, payment_status = ?, team_code = ?, confirmation_code = ?, confirmation_qr_payload = ? WHERE id = ?",
        (
            "waiting" if registration.get("status") == "waiting" else "pending_approval",
            "paid",
            team_code,
            confirmation_code,
            json.dumps(qr_payload, separators=(",", ":")),
            registration["id"],
        ),
    )
    execute("UPDATE payment_intents SET registration_id = ? WHERE id = ?", (registration["id"], intent["id"]))
    _invalidate_registration_views(registration)
    return existing_payment


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
            "tn": f"{tournament['name']} - {payload.team_name}",
        }
        qr_payload = "upi://pay?" + "&".join(f"{key}={quote_plus(value)}" for key, value in qr_values.items())

    execute(
        """
        INSERT INTO payment_intents (
          id, registration_id, tournament_slug, team_name, amount, method, contact, status,
          receipt_number, qr_payload, receiver_upi_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payment_id,
            payload.registration_id,
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


@router.post("/local-intent/{payment_id}/submit")
def submit_local_payment_intent(payment_id: str, payload: PaymentIntentSubmit, user: dict = Depends(current_user)):
    ensure_payment_intent_columns()
    intent = row("SELECT * FROM payment_intents WHERE id = ?", (payment_id,))
    if not intent:
        raise HTTPException(status_code=404, detail="Payment intent not found")
    registration = None
    if intent.get("registration_id"):
        registration = row("SELECT * FROM registrations WHERE id = ?", (intent["registration_id"],))
    if not registration:
        registration = row(
            """
            SELECT * FROM registrations
            WHERE tournament_slug = ? AND lower(trim(team_name)) = lower(trim(?)) AND user_id = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (intent["tournament_slug"], intent["team_name"], user["id"]),
        )
    if not registration or registration.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="You do not have access to this payment")
    transaction_reference = payload.transaction_reference.strip()
    now = datetime.now(timezone.utc).isoformat()
    execute(
        """UPDATE payment_intents
           SET registration_id = ?, status = ?, transaction_reference = ?, verification_note = ?, updated_at = ?
           WHERE id = ?""",
        (
            registration["id"],
            "submitted",
            transaction_reference,
            "User submitted transaction ID and is waiting for admin verification.",
            now,
            payment_id,
        ),
    )
    execute(
        "UPDATE registrations SET payment_status = ?, status = ? WHERE id = ?",
        ("waiting_verification", "pending_payment", registration["id"]),
    )
    log(user["email"], "payment_intent_submitted", "payment_intent", payment_id, f"Submitted transaction {transaction_reference}")
    return ok(payment_intent_response(payment_id), "Payment submitted. Wait for admin verification.")


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
    if payload.status == "paid":
        _finalize_paid_intent({**intent, "transaction_reference": payload.transaction_reference.strip()}, payload.method)
    elif intent.get("registration_id"):
        registration_payment_status = "cancelled" if payload.status == "cancelled" else "failed"
        execute(
            "UPDATE registrations SET payment_status = ?, status = ? WHERE id = ?",
            (registration_payment_status, "pending_payment", intent["registration_id"]),
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
