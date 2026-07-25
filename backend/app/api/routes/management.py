from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.database import execute, execute_many, row, rows
from app.schemas import BracketSavePayload, NotificationSendPayload, TournamentCitiesPayload, TournamentRegistrationWindowPayload, TournamentTeamSizePayload, WinnerAdvancePayload
from app.services.audit import log

router = APIRouter(prefix="/management", tags=["management"])


@router.get("/dashboard")
def dashboard(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok({
        "assignedTournaments": rows("SELECT * FROM tournaments WHERE status IN ('Registration Open', 'Live')"),
        "pendingRegistrations": rows("SELECT * FROM registrations WHERE status IN ('pending_payment', 'pending_approval')"),
        "liveMatches": rows("SELECT * FROM live_matches"),
    })


@router.get("/tournaments")
def tournaments(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM tournaments ORDER BY name"))


@router.patch("/tournaments/{tournament_slug}/team-size")
def update_team_size(tournament_slug: str, payload: TournamentTeamSizePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    execute("UPDATE tournaments SET team_size = ? WHERE slug = ?", (payload.team_size, tournament_slug))
    log(user["email"], "tournament_team_size_updated", "tournament", tournament_slug, f"Team size set to {payload.team_size}")
    return ok(row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)), "Tournament team size updated")


@router.patch("/tournaments/{tournament_slug}/registration-window")
def update_registration_window(tournament_slug: str, payload: TournamentRegistrationWindowPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    execute(
        "UPDATE tournaments SET status = ?, registration_start = ?, registration_end = ? WHERE slug = ?",
        (payload.status, payload.registration_start, payload.registration_end, tournament_slug),
    )
    log(user["email"], "tournament_registration_window_updated", "tournament", tournament_slug, f"{payload.status}: {payload.registration_start} to {payload.registration_end}")
    return ok(row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)), "Tournament registration window updated")


@router.patch("/tournaments/{tournament_slug}/cities")
def update_tournament_cities(tournament_slug: str, payload: TournamentCitiesPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,))
    if not item:
        return ok({"updated": False, "reason": "Tournament not found"}, "Tournament not found")
    clean_cities: list[str] = []
    for city in payload.cities:
        value = " ".join(city.strip().split())
        if value and value.lower() not in [existing.lower() for existing in clean_cities]:
            clean_cities.append(value)
    if not clean_cities:
        return ok({"updated": False, "reason": "At least one city is required"}, "At least one city is required")
    execute("DELETE FROM tournament_cities WHERE tournament_slug = ?", (tournament_slug,))
    statements = [
        (
            "INSERT INTO tournament_cities(id, tournament_slug, city, sort_order) VALUES (?, ?, ?, ?)",
            (f"city_{uuid4().hex[:10]}", tournament_slug, city, index),
        )
        for index, city in enumerate(clean_cities, start=1)
    ]
    execute_many(statements)
    log(user["email"], "tournament_cities_updated", "tournament", tournament_slug, f"Cities set to {', '.join(clean_cities)}")
    return ok({
        "tournament": row("SELECT * FROM tournaments WHERE slug = ?", (tournament_slug,)),
        "cities": rows("SELECT city FROM tournament_cities WHERE tournament_slug = ? ORDER BY sort_order", (tournament_slug,)),
    }, "Tournament cities updated")


@router.post("/registrations/{registration_id}/approve")
def approve_registration(registration_id: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        return ok({"approved": False, "reason": "Registration not found"}, "Registration not found")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("accepted", registration_id))
    log(user["email"], "registration_accepted", "registration", registration_id, f"Accepted {item['team_name']}")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration accepted")


@router.post("/registrations/{registration_id}/reject")
def reject_registration(registration_id: str, user: dict = Depends(require_roles("super_admin", "management"))):
    item = row("SELECT * FROM registrations WHERE id = ?", (registration_id,))
    if not item:
        return ok({"rejected": False, "reason": "Registration not found"}, "Registration not found")
    execute("UPDATE registrations SET status = ? WHERE id = ?", ("rejected", registration_id))
    log(user["email"], "registration_rejected", "registration", registration_id, f"Rejected {item['team_name']}")
    return ok(row("SELECT * FROM registrations WHERE id = ?", (registration_id,)), "Registration rejected")


@router.get("/brackets/{tournament_slug}")
def bracket_workspace(tournament_slug: str, _: dict = Depends(require_roles("super_admin", "management"))):
    accepted = rows(
        """SELECT id, team_name AS name, captain_name, status
           FROM registrations
           WHERE tournament_slug = ? AND status = 'accepted'
           ORDER BY created_at""",
        (tournament_slug,),
    )
    if not accepted:
        accepted = rows("SELECT slug AS id, name, sport AS captain_name, 'Accepted' AS status FROM teams ORDER BY rating DESC LIMIT 8")
    return ok({
        "acceptedTeams": accepted,
        "nodes": rows("SELECT id, label, team, round, x, y, status FROM bracket_nodes WHERE tournament_slug = ? ORDER BY x, y", (tournament_slug,)),
        "connections": rows("SELECT id, source_id, target_id FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,)),
        "notifications": rows("SELECT * FROM notification_events WHERE tournament_slug = ? ORDER BY created_at DESC LIMIT 10", (tournament_slug,)),
    })


@router.post("/brackets/{tournament_slug}/save")
def save_bracket(tournament_slug: str, payload: BracketSavePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    execute("DELETE FROM bracket_connections WHERE tournament_slug = ?", (tournament_slug,))
    execute("DELETE FROM bracket_nodes WHERE tournament_slug = ?", (tournament_slug,))
    statements: list[tuple[str, tuple]] = []
    for node in payload.nodes:
        statements.append((
            "INSERT INTO bracket_nodes(id, tournament_slug, label, team, round, x, y, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (node.id, tournament_slug, node.label, node.team or "", node.round, node.x, node.y, node.status),
        ))
    for connection in payload.connections:
        statements.append((
            "INSERT INTO bracket_connections(id, tournament_slug, source_id, target_id) VALUES (?, ?, ?, ?)",
            (connection.id or f"conn_{uuid4().hex[:10]}", tournament_slug, connection.source_id, connection.target_id),
        ))
    execute_many(statements)
    log(user["email"], "bracket_saved", "tournament", tournament_slug, payload.audit_reason)
    return bracket_workspace(tournament_slug, user)


@router.post("/brackets/{tournament_slug}/advance-winner")
def advance_winner(tournament_slug: str, payload: WinnerAdvancePayload, user: dict = Depends(require_roles("super_admin", "management"))):
    execute(
        "UPDATE bracket_nodes SET team = ?, label = ?, status = ? WHERE tournament_slug = ? AND id = ?",
        (payload.winner_team, payload.winner_team, "winner", tournament_slug, payload.target_node_id),
    )
    log(user["email"], "winner_advanced", "bracket_node", payload.target_node_id, payload.audit_reason)
    return ok(row("SELECT * FROM bracket_nodes WHERE tournament_slug = ? AND id = ?", (tournament_slug, payload.target_node_id)), "Winner advanced")


@router.post("/brackets/{tournament_slug}/notify")
def notify_bracket(tournament_slug: str, payload: NotificationSendPayload, user: dict = Depends(require_roles("super_admin", "management"))):
    event_id = f"notify_{uuid4().hex[:12]}"
    execute(
        "INSERT INTO notification_events(id, tournament_slug, audience, channels, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event_id, tournament_slug, payload.audience, ",".join(payload.channels), payload.message, "local_sent", datetime.now(timezone.utc).isoformat()),
    )
    log(user["email"], "manual_notification_sent", "notification", event_id, f"Sent bracket notification via {', '.join(payload.channels)}")
    return ok(row("SELECT * FROM notification_events WHERE id = ?", (event_id,)), "Manual notification stored locally")


@router.get("/matches")
def matches(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok(rows("SELECT * FROM live_matches ORDER BY id"))


@router.get("/players")
def players(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok([
        {"name": "Rohan Sharma", "team": "India Forge", "status": "Verified"},
        {"name": "Aryan Patel", "team": "Mumbai Mavericks", "status": "Pending Documents"},
        {"name": "Kavin Raj", "team": "Chennai Chargers", "status": "Verified"},
    ])


@router.get("/reports")
def reports(_: dict = Depends(require_roles("super_admin", "management"))):
    return ok([
        {"name": "Tournament revenue", "status": "Ready"},
        {"name": "Registration funnel", "status": "Ready"},
        {"name": "Venue utilization", "status": "Draft"},
        {"name": "Live score audit", "status": "Ready"},
    ])
