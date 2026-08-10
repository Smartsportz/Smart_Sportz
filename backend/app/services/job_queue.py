from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.db.database import sync_mirror
from app.services.database_architecture import export_json_backups
from app.services.metrics import set_worker_queue_depth, worker_job_recorded

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover
    Redis = None

    class RedisError(Exception):
        pass


QUEUE_NAME = "smart_sportz:jobs"
HANDLERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {}


def handler(name: str):
    def register(func: Callable[[dict[str, Any]], dict[str, Any]]):
        HANDLERS[name] = func
        return func

    return register


def _redis():
    if Redis is None or not settings.redis_url:
        return None
    try:
        client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.5)
        client.ping()
        return client
    except (RedisError, ValueError):
        return None


def enqueue(job_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    job = {
        "id": f"job_{uuid4().hex[:12]}",
        "type": job_type,
        "payload": payload or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    client = _redis()
    if client is None:
        result = run_job(job)
        return {**job, "queued": False, "status": "completed_inline", "result": result}
    client.rpush(QUEUE_NAME, json.dumps(job, separators=(",", ":")))
    try:
        set_worker_queue_depth(int(client.llen(QUEUE_NAME)))
    except RedisError:
        pass
    return {**job, "queued": True, "status": "queued"}


def run_job(job: dict[str, Any]) -> dict[str, Any]:
    job_type = str(job.get("type", "unknown"))
    worker_job_recorded(job_type, "started")
    callback = HANDLERS.get(job_type)
    if callback is None:
        worker_job_recorded(job_type, "failed")
        raise ValueError(f"Unknown job type: {job_type}")
    try:
        result = callback(dict(job.get("payload") or {}))
        worker_job_recorded(job_type, "completed")
        return result
    except Exception:
        worker_job_recorded(job_type, "failed")
        raise


def worker_loop(poll_seconds: float = 2.0) -> None:
    while True:
        client = _redis()
        if client is None:
            time.sleep(poll_seconds)
            continue
        try:
            item = client.blpop(QUEUE_NAME, timeout=int(max(1, poll_seconds)))
            set_worker_queue_depth(int(client.llen(QUEUE_NAME)))
        except RedisError:
            time.sleep(poll_seconds)
            continue
        if not item:
            continue
        _, encoded = item
        try:
            run_job(json.loads(encoded))
        except Exception:
            continue


@handler("database.mirror_sync")
def _mirror_sync(_: dict[str, Any]) -> dict[str, Any]:
    sync_mirror()
    return {"status": "synced"}


@handler("database.json_backup")
def _json_backup(_: dict[str, Any]) -> dict[str, Any]:
    return export_json_backups()


@handler("social.like_event")
def _social_like_event(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "stored": True,
        "type": payload.get("type", ""),
        "key": payload.get("key", ""),
        "liked": bool(payload.get("liked", False)),
    }
