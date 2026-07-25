from __future__ import annotations

from datetime import datetime, timezone

from app.db.database import execute


def log(actor: str, action: str, entity: str, entity_id: str, message: str) -> None:
    execute(
        "INSERT INTO audit_logs(actor, action, entity, entity_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (actor, action, entity, entity_id, message, datetime.now(timezone.utc).isoformat()),
    )
