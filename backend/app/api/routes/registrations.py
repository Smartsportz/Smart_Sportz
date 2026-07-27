from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import LocalPaymentCreate, RegistrationCreate
from app.services.audit import log

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _confirmation_code(registration_id: str) -> str:
    return f"SS-{registration_id.replace('reg_', '').upper()[:8]}"


def _prizes_for_tournament(tournament_slug: str) -> list[dict]:
    return rows(
        "SELECT position, label, amount, sort_order FROM tournament_prizes WHERE tournament_slug = ? ORDER BY sort_order, position",
        (tournament_slug,),
    )


@router.post("")
def create_registration(payload: RegistrationCreate):
    tournament = row("SELECT * FROM tournaments WHERE slug = ?", (payload.tournament_slug,))
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament["teams"] >= tournament["capacity"]:
        raise HTTPException(status_code=409, detail="Tournament capacity is full")
    required_members = int(tournament.get("team_size") or 16)
    if payload.members and len(payload.members) != required_members:
        raise HTTPException(status_code=422, detail=f"This tournament requires exactly {required_members} member names, including captain and sub-captain")
    city_allowed = row(
        "SELECT id FROM tournament_cities WHERE tournament_slug = ? AND lower(city) = lower(?)",
        (payload.tournament_slug, payload.city),
    )
    if not city_allowed:
        raise HTTPException(status_code=422, detail="Selected city is not configured for this tournament")
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
             id, tournament_slug, team_name, team_code, captain_name, sub_captain_name, coach_name,
             email, phone, city, district_state, team_logo, primary_jersey_color, secondary_jersey_color,
             team_motto, category, confirmation_code, confirmation_qr_payload, status, payment_status, amount, created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            registration_id,
            payload.tournament_slug,
            payload.team_name,
            payload.team_code,
            payload.captain_name,
            payload.sub_captain_name,
            payload.coach_name,
            payload.email,
            payload.phone,
            payload.city,
            payload.district_state,
            payload.team_logo,
            payload.primary_jersey_color,
            payload.secondary_jersey_color,
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
            "INSERT INTO registration_members(id, registration_id, name, role, jersey, contact) VALUES (?, ?, ?, ?, ?, ?)",
            (f"mem_{uuid4().hex[:10]}", registration_id, data["name"], data.get("role", "Player"), data.get("jersey"), data.get("contact")),
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
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration created")


@router.get("/{registration_id}")
def registration_detail(registration_id: str):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    item["payments"] = rows("SELECT * FROM payments WHERE registration_id = ?", (registration_id,))
    item["members"] = rows("SELECT name, role, jersey, contact FROM registration_members WHERE registration_id = ?", (registration_id,))
    item["documents"] = rows("SELECT document_type, file_name, file_path, status, uploaded_at FROM registration_documents WHERE registration_id = ?", (registration_id,))
    item["prizes"] = _prizes_for_tournament(item["tournament_slug"])
    return ok(item)


@router.post("/{registration_id}/local-payment")
def local_payment(registration_id: str, payload: LocalPaymentCreate):
    if payload.registration_id != registration_id:
        raise HTTPException(status_code=400, detail="Registration ID mismatch")
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    payment_id = f"pay_{uuid4().hex[:12]}"
    receipt_number = f"SS-RCPT-{datetime.now().strftime('%Y%m%d')}-{uuid4().hex[:5].upper()}"
    confirmation_code = _confirmation_code(registration_id)
    tournament = row("SELECT name, slug FROM tournaments WHERE slug = ?", (item["tournament_slug"],))
    qr_payload = {
        "type": "SmartSportzTeamVerification",
        "registrationId": registration_id,
        "confirmationCode": confirmation_code,
        "teamCode": item.get("team_code", ""),
        "teamName": item["team_name"],
        "tournamentSlug": item["tournament_slug"],
        "tournamentName": tournament["name"] if tournament else item["tournament_slug"],
        "captainName": item["captain_name"],
        "city": item["city"],
        "paymentReceipt": receipt_number,
        "receiptNumber": receipt_number,
        "verificationPath": f"/registrations/{registration_id}",
    }
    execute(
        "INSERT INTO payments(id, registration_id, status, amount, method, receipt_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (payment_id, registration_id, "paid", item["amount"], payload.method, receipt_number, datetime.now(timezone.utc).isoformat()),
    )
    execute(
        "UPDATE registrations SET status = ?, payment_status = ?, confirmation_code = ?, confirmation_qr_payload = ? WHERE id = ?",
        ("pending_approval", "paid", confirmation_code, json.dumps(qr_payload, separators=(",", ":")), registration_id),
    )
    log(item["email"], "local_payment_paid", "payment", payment_id, "Local simulated payment completed")
    return ok(row("SELECT * FROM payments WHERE id = ?", (payment_id,)), "Local payment completed")
