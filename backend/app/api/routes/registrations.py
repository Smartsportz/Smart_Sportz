from __future__ import annotations

import json
from datetime import datetime, timezone
import secrets
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.api.deps import current_user
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import LocalPaymentCreate, RegistrationCreate
from app.services.audit import log
from app.services.cache import cache_key
from app.services.notifications import send_registration_payment_success
from app.services.registration_pass_pdf import build_registration_pass_pdf
from app.services.runtime_state import runtime_state
from app.services.tournament_status import apply_registration_window_statuses, registration_is_open

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _confirmation_code(registration_id: str) -> str:
    return f"SS-{registration_id.replace('reg_', '').upper()[:8]}"


def _random_team_code(tournament_slug: str) -> str:
    while True:
        code = f"SST-{secrets.token_hex(4).upper()}"
        existing = row(
            "SELECT id FROM registrations WHERE tournament_slug = ? AND lower(team_code) = lower(?)",
            (tournament_slug, code),
        )
        if not existing:
            return code


def _prizes_for_tournament(tournament_slug: str) -> list[dict]:
    return rows(
        "SELECT position, label, amount, sort_order FROM tournament_prizes WHERE tournament_slug = ? ORDER BY sort_order, position",
        (tournament_slug,),
    )


def _ensure_registration_access(item: dict, user: dict) -> None:
    if user["role"] in {"super_admin", "management"}:
        return
    if item.get("user_id") == user["id"]:
        return
    raise HTTPException(status_code=403, detail="You do not have access to this registration")


def _invalidate_user_dashboard(user: dict) -> None:
    runtime_state.delete(cache_key("user:dashboard", user["id"], user["email"]))


def _invalidate_tournament_cache(tournament_slug: str) -> None:
    runtime_state.delete(cache_key("public:home"))
    runtime_state.delete(cache_key("public:tournaments"))
    runtime_state.delete(cache_key("public:tournament", tournament_slug))


def _registration_pass_payload(registration_id: str, user: dict) -> dict:
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    _ensure_registration_access(item, user)
    tournament = row("SELECT * FROM tournaments WHERE slug = ?", (item["tournament_slug"],))
    payments = rows("SELECT * FROM payments WHERE registration_id = ? ORDER BY created_at DESC", (registration_id,))
    members = rows("SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ? ORDER BY id", (registration_id,))
    documents = rows("SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ?", (registration_id,))
    return {
        "registration": item,
        "tournament": tournament or {"slug": item["tournament_slug"], "name": item["tournament_slug"]},
        "payments": payments,
        "members": members,
        "documents": documents,
    }


@router.get("/check-team-name")
def check_team_name(
    tournament_slug: str = Query(...),
    team_name: str = Query(...),
    _: dict = Depends(current_user),
):
    name = team_name.strip()
    if len(name) < 2:
        return ok({"exists": False})
    existing = row(
        """
        SELECT id FROM registrations
        WHERE tournament_slug = ?
        AND lower(trim(team_name)) = lower(trim(?))
        AND COALESCE(status, '') NOT IN ('rejected', 'cancelled')
        LIMIT 1
        """,
        (tournament_slug, name),
    )
    return ok({"exists": bool(existing)})


@router.post("")
def create_registration(payload: RegistrationCreate, user: dict = Depends(current_user)):
    apply_registration_window_statuses()
    tournament = row("SELECT * FROM tournaments WHERE slug = ?", (payload.tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if not registration_is_open(tournament):
        raise HTTPException(status_code=409, detail="Registration is not open for this tournament")
    registration_count = row(
        """
        SELECT COUNT(*) AS count
        FROM registrations
        WHERE tournament_slug = ? AND status NOT IN ('rejected', 'cancelled')
        """,
        (payload.tournament_slug,),
    )
    limit_reached = int(registration_count["count"] or 0) >= int(tournament.get("capacity") or 0)
    if limit_reached:
        raise HTTPException(status_code=409, detail="Tournament slots are full")
    if int(tournament.get("block_repeat_registration") or 0):
        existing_user_registration = row(
            "SELECT id FROM registrations WHERE tournament_slug = ? AND user_id = ? LIMIT 1",
            (payload.tournament_slug, user["id"]),
        )
        if existing_user_registration:
            raise HTTPException(status_code=409, detail="You are already registered for this tournament")
    required_members = int(tournament.get("team_size") or 16)
    if payload.members and len(payload.members) != required_members:
        raise HTTPException(status_code=422, detail=f"This tournament requires exactly {required_members} member names, including captain and sub-captain")
    city_allowed = row(
        "SELECT id FROM tournament_cities WHERE tournament_slug = ? AND lower(city) = lower(?)",
        (payload.tournament_slug, payload.city),
    )
    if not city_allowed:
        raise HTTPException(status_code=422, detail="Selected city is not configured for this tournament")
    existing_team_name = row(
        """
        SELECT id FROM registrations
        WHERE tournament_slug = ?
        AND lower(trim(team_name)) = lower(trim(?))
        AND COALESCE(status, '') NOT IN ('rejected', 'cancelled')
        """,
        (payload.tournament_slug, payload.team_name),
    )
    if existing_team_name:
        raise HTTPException(status_code=409, detail="This team name is already registered for this tournament")
    if payload.team_code:
        existing_code = row(
            "SELECT id FROM registrations WHERE tournament_slug = ? AND lower(team_code) = lower(?)",
            (payload.tournament_slug, payload.team_code),
        )
        if existing_code:
            raise HTTPException(status_code=409, detail="Team code already exists for this tournament")

    registration_id = f"reg_{uuid4().hex[:12]}"
    amount = 250000
    execute(
        """INSERT INTO registrations(
             id, user_id, tournament_slug, team_name, team_code, captain_name, sub_captain_name, coach_name,
             email, phone, city, district_state, team_logo, selected_jersey_image,
             team_motto, category, confirmation_code, confirmation_qr_payload, status, payment_status, amount, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            registration_id,
            user["id"],
            payload.tournament_slug,
            payload.team_name,
            payload.team_code or "",
            payload.captain_name,
            payload.sub_captain_name,
            payload.coach_name,
            payload.email,
            payload.phone,
            payload.city,
            payload.district_state,
            payload.team_logo,
            payload.selected_jersey_image,
            payload.team_motto,
            payload.category,
            "",
            "",
            "pending_payment",
            "pending",
            amount,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    members = payload.members or []
    if not members:
        members = [{"name": payload.captain_name, "role": "Captain", "jersey": None, "contact": payload.phone}]
    for member in members:
        data = member if isinstance(member, dict) else member.model_dump()
        execute(
            "INSERT INTO registration_members(id, registration_id, name, role, jersey, contact, age, jersey_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"mem_{uuid4().hex[:10]}",
                registration_id,
                data["name"],
                data.get("role", "Player"),
                data.get("jersey"),
                data.get("contact"),
                int(data.get("age") or 0),
                data.get("jersey_size") or "",
            ),
        )
    for document in payload.documents:
        data = document.model_dump()
        execute(
            "INSERT INTO registration_documents(id, registration_id, document_type, file_name, file_path, status, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                f"doc_{uuid4().hex[:10]}",
                registration_id,
                data["document_type"],
                data["file_name"],
                data["file_path"],
                data["status"],
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    log(payload.email, "registration_created", "registration", registration_id, f"Registration created for {payload.team_name}")
    _invalidate_user_dashboard(user)
    _invalidate_tournament_cache(payload.tournament_slug)
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration created")


@router.get("/by-tournament/{tournament_slug}/mine")
def my_completed_registration_for_tournament(tournament_slug: str, user: dict = Depends(current_user)):
    item = row(
        """
        SELECT
          r.*,
          t.name AS tournament_name,
          t.sport AS tournament_sport,
          t.location AS tournament_location,
          t.image AS tournament_image
        FROM registrations r
        LEFT JOIN tournaments t ON t.slug = r.tournament_slug
        WHERE r.tournament_slug = ? AND r.user_id = ? AND r.payment_status = 'paid'
        ORDER BY r.created_at DESC
        LIMIT 1
        """,
        (tournament_slug, user["id"]),
    )
    if not item:
        raise HTTPException(status_code=404, detail="No completed registration found for this tournament")
    item["payments"] = rows("SELECT * FROM payments WHERE registration_id = ? ORDER BY created_at DESC", (item["id"],))
    item["members"] = rows("SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ?", (item["id"],))
    item["documents"] = rows("SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ?", (item["id"],))
    item["prizes"] = _prizes_for_tournament(item["tournament_slug"])
    return ok(item)


@router.get("/{registration_id}/pass.pdf")
def registration_pass_pdf(registration_id: str, user: dict = Depends(current_user)):
    payload = _registration_pass_payload(registration_id, user)
    pdf = build_registration_pass_pdf(payload)
    team_code = payload["registration"].get("team_code") or payload["registration"].get("confirmation_code") or registration_id
    filename = f"smart-sportz-registration-pass-{team_code}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{registration_id}")
def registration_detail(registration_id: str, user: dict = Depends(current_user)):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    _ensure_registration_access(item, user)
    item["payments"] = rows("SELECT * FROM payments WHERE registration_id = ?", (registration_id,))
    item["members"] = rows("SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ?", (registration_id,))
    item["documents"] = rows("SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ?", (registration_id,))
    item["prizes"] = _prizes_for_tournament(item["tournament_slug"])
    return ok(item)


@router.post("/{registration_id}/local-payment")
def local_payment(registration_id: str, payload: LocalPaymentCreate, user: dict = Depends(current_user)):
    if payload.registration_id != registration_id:
        raise HTTPException(status_code=400, detail="Registration ID mismatch")
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    _ensure_registration_access(item, user)
    intent = None
    if payload.payment_intent_id:
        intent = row("SELECT * FROM payment_intents WHERE id = ?", (payload.payment_intent_id,))
        if not intent:
            raise HTTPException(status_code=404, detail="Payment intent not found")
        if intent["tournament_slug"] != item["tournament_slug"] or intent["team_name"].strip().lower() != item["team_name"].strip().lower():
            raise HTTPException(status_code=400, detail="Payment intent does not match this registration")
        if int(intent["amount"] or 0) != int(payload.amount or item["amount"]):
            raise HTTPException(status_code=400, detail="Payment amount does not match")
        if intent["status"] != "paid":
            raise HTTPException(status_code=409, detail="Payment not received yet. Please complete PhonePe UPI payment and wait for verification.")
    elif payload.method == "upi":
        raise HTTPException(status_code=409, detail="Payment not received yet. PhonePe UPI payment must be verified before registration completion.")
    payment_id = f"pay_{uuid4().hex[:12]}"
    receipt_number = intent["receipt_number"] if intent else f"SS-RCPT-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:5].upper()}"
    confirmation_code = _confirmation_code(registration_id)
    team_code = item.get("team_code") or _random_team_code(item["tournament_slug"])
    tournament = row("SELECT name, slug FROM tournaments WHERE slug = ?", (item["tournament_slug"],))
    qr_payload = {
        "type": "SmartSportzTeamVerification",
        "registrationId": registration_id,
        "confirmationCode": confirmation_code,
        "teamCode": team_code,
        "teamName": item["team_name"],
        "tournamentSlug": item["tournament_slug"],
        "tournamentName": tournament["name"] if tournament else item["tournament_slug"],
        "captainName": item["captain_name"],
        "city": item["city"],
        "paymentReceipt": receipt_number,
        "receiptNumber": receipt_number,
        "verificationPath": f"/registrations/{registration_id}",
    }
    paid_amount = payload.amount or item["amount"]
    execute(
        "INSERT INTO payments(id, registration_id, status, amount, method, receipt_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (payment_id, registration_id, "paid", paid_amount, payload.method, receipt_number, datetime.now(timezone.utc).isoformat()),
    )
    execute(
        "UPDATE registrations SET status = ?, payment_status = ?, team_code = ?, confirmation_code = ?, confirmation_qr_payload = ? WHERE id = ?",
        (
            "waiting" if item.get("status") == "waiting" else "pending_approval",
            "paid",
            team_code,
            confirmation_code,
            json.dumps(qr_payload, separators=(",", ":")),
            registration_id,
        ),
    )
    members = rows("SELECT name, role, jersey, contact, age, jersey_size FROM registration_members WHERE registration_id = ?", (registration_id,))
    delivery_results = send_registration_payment_success(
        item["email"],
        item["phone"],
        {
            "tournamentName": qr_payload["tournamentName"],
            "teamName": item["team_name"],
            "teamCode": team_code,
            "captainName": item["captain_name"],
            "receiptNumber": receipt_number,
            "confirmationCode": confirmation_code,
            "qrPayload": json.dumps(qr_payload, separators=(",", ":")),
            "members": members,
        },
    )
    for result in delivery_results:
        log(item["email"], "registration_notification", result.provider, registration_id, result.message)
    log(item["email"], "local_payment_paid", "payment", payment_id, "Local simulated payment completed")
    _invalidate_user_dashboard(user)
    _invalidate_tournament_cache(item["tournament_slug"])
    return ok(row("SELECT * FROM payments WHERE id = ?", (payment_id,)), "Local payment completed")
