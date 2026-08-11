from __future__ import annotations

from datetime import datetime, timezone

from celery import Celery

from app.core.config import settings
from app.db.database import sync_mirror
from app.services.database_architecture import export_json_backups


broker_url = settings.redis_url or "redis://127.0.0.1:6379/0"

celery_app = Celery("smart_sportz", broker=broker_url, backend=broker_url)
celery_app.conf.update(
    timezone="UTC",
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "smart-sportz-heartbeat": {
            "task": "smart_sportz.heartbeat",
            "schedule": 300.0,
        },
    },
)


@celery_app.task(name="smart_sportz.heartbeat")
def heartbeat() -> dict:
    return {"ok": True, "at": datetime.now(timezone.utc).isoformat()}


@celery_app.task(name="smart_sportz.database_mirror_sync")
def database_mirror_sync() -> dict:
    sync_mirror()
    return {"status": "synced"}


@celery_app.task(name="smart_sportz.database_json_backup")
def database_json_backup() -> dict:
    return export_json_backups()


@celery_app.task(name="smart_sportz.social_like_event")
def social_like_event(payload: dict) -> dict:
    return {
        "stored": True,
        "type": payload.get("type", ""),
        "key": payload.get("key", ""),
        "liked": bool(payload.get("liked", False)),
    }
