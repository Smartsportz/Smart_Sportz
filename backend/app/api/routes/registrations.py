from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import LocalPaymentCreate, RegistrationCreate
from app.services.audit import log

router = APIRouter(prefix="/registrations", tags=["registrations"])


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

    registration_id = f"reg_{uuid4().hex[:12]}"
    amount = 250000
    execute(
        """INSERT INTO registrations(id, tournament_slug, team_name, captain_name, email, phone, city, status, payment_status, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            registration_id,
            payload.tournament_slug,
            payload.team_name,
            payload.captain_name,
            payload.email,
            payload.phone,
            payload.city,
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
    log(payload.email, "registration_created", "registration", registration_id, f"Registration created for {payload.team_name}")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration created")


@router.get("/{registration_id}")
def registration_detail(registration_id: str):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Registration not found")
    item["payments"] = rows("SELECT * FROM payments WHERE registration_id = ?", (registration_id,))
    item["members"] = rows("SELECT name, role, jersey, contact FROM registration_members WHERE registration_id = ?", (registration_id,))
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
    execute(
        "INSERT INTO payments(id, registration_id, status, amount, method, receipt_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (payment_id, registration_id, "paid", item["amount"], payload.method, receipt_number, datetime.now(timezone.utc).isoformat()),
    )
    execute("UPDATE registrations SET status = ?, payment_status = ? WHERE id = ?", ("pending_approval", "paid", registration_id))
    log(item["email"], "local_payment_paid", "payment", payment_id, "Local simulated payment completed")
    return ok(row("SELECT * FROM payments WHERE id = ?", (payment_id,)), "Local payment completed")
