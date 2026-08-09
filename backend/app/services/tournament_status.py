from __future__ import annotations

from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any

from app.db.database import execute, row, rows
from app.services.audit import log
from app.services.notifications import send_whatsapp_message


LOCKED_STATUSES = {"Live", "Completed"}
OPEN_STATUS = "Registration Open"
CLOSED_STATUS = "Registration Closed"
UPCOMING_STATUS = "Upcoming"


def _parse_registration_date(value: str | None):
    if not value:
        return None
    for fmt in ("%b %d, %Y", "%B %d, %Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    try:
        return parsedate_to_datetime(value).date()
    except Exception:
        return None


def runtime_status(tournament: dict[str, Any], today=None) -> str:
    current_status = str(tournament.get("status") or "")
    if current_status in LOCKED_STATUSES:
        return current_status
    start = _parse_registration_date(tournament.get("registration_start"))
    end = _parse_registration_date(tournament.get("registration_end"))
    if not start or not end:
        return current_status or UPCOMING_STATUS
    current_day = today or datetime.now().date()
    if current_day < start:
        return UPCOMING_STATUS
    if current_day > end:
        return CLOSED_STATUS
    return OPEN_STATUS


def accent_for_status(status: str, fallback: str = "blue") -> str:
    if status == OPEN_STATUS:
        return "emerald"
    if status == UPCOMING_STATUS:
        return "blue"
    if status == CLOSED_STATUS:
        return "slate"
    return fallback


def with_runtime_status(tournament: dict[str, Any]) -> dict[str, Any]:
    status = runtime_status(tournament)
    tournament["status"] = status
    tournament["accent"] = accent_for_status(status, str(tournament.get("accent") or "blue"))
    return tournament


def _manager_phones_for_tournament(tournament_slug: str) -> list[str]:
    assigned = rows(
        """SELECT DISTINCT u.phone
           FROM users u
           JOIN manager_city_assignments m ON m.manager_user_id = u.id
           JOIN tournament_cities c ON lower(c.city) = lower(m.city)
           WHERE u.role = 'management' AND c.tournament_slug = ?""",
        (tournament_slug,),
    )
    phones = [item["phone"] for item in assigned if item.get("phone")]
    if phones:
        return phones
    return [item["phone"] for item in rows("SELECT phone FROM users WHERE role = 'management'") if item.get("phone")]


def _notify_open_registration(tournament: dict[str, Any]) -> None:
    message = (
        f"{tournament['name']} registration is now open. "
        f"Window: {tournament.get('registration_start')} to {tournament.get('registration_end')}."
    )
    for phone in _manager_phones_for_tournament(tournament["slug"]):
        result = send_whatsapp_message(phone, message)
        log(
            "system",
            "registration_open_manager_whatsapp",
            "tournament",
            tournament["slug"],
            f"{phone}: {result.provider} {result.message}",
        )


def apply_registration_window_statuses(notify: bool = True) -> int:
    changed = 0
    for tournament in rows("SELECT * FROM tournaments"):
        current_status = str(tournament.get("status") or "")
        if current_status in LOCKED_STATUSES:
            continue
        next_status = runtime_status(tournament)
        next_accent = accent_for_status(next_status, str(tournament.get("accent") or "blue"))
        if next_status == current_status and next_accent == tournament.get("accent"):
            continue
        execute(
            "UPDATE tournaments SET status = ?, accent = ? WHERE slug = ?",
            (next_status, next_accent, tournament["slug"]),
        )
        changed += 1
        log("system", "tournament_runtime_status_updated", "tournament", tournament["slug"], f"{current_status} -> {next_status}")
        if notify and next_status == OPEN_STATUS:
            _notify_open_registration({**tournament, "status": next_status, "accent": next_accent})
    return changed


def registration_is_open(tournament: dict[str, Any]) -> bool:
    return runtime_status(tournament) == OPEN_STATUS
