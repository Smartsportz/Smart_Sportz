from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import anyio
from fastapi import WebSocket

from app.core.config import settings
from app.services.events import event_hub

try:
    from redis import Redis
    from redis.exceptions import RedisError
    import redis.asyncio as async_redis
except Exception:  # pragma: no cover - redis can be disabled in local dev.
    Redis = None
    RedisError = Exception
    async_redis = None

REALTIME_CHANNEL = "smart_sportz:realtime"
WEBSOCKET_CHANNEL = "realtime"
_publisher: Redis | None = None


def realtime_event(
    event: str,
    *,
    entity: str = "database",
    action: str = "changed",
    payload: dict[str, Any] | None = None,
    invalidates: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"rt_{uuid4().hex[:16]}",
        "event": event,
        "entity": entity,
        "action": action,
        "payload": payload or {},
        "invalidates": invalidates or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _redis_publisher() -> Redis | None:
    global _publisher
    if Redis is None or not settings.redis_url:
        return None
    if _publisher is not None:
        return _publisher
    try:
        _publisher = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.35)
        _publisher.ping()
        return _publisher
    except Exception:
        _publisher = None
        return None


async def _broadcast_local(message: dict[str, Any]) -> None:
    await event_hub.broadcast(WEBSOCKET_CHANNEL, message)


def _broadcast_local_from_sync(message: dict[str, Any]) -> None:
    try:
        anyio.from_thread.run(_broadcast_local, message)
    except RuntimeError:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_broadcast_local(message))
        except RuntimeError:
            asyncio.run(_broadcast_local(message))


def publish_realtime(
    event: str,
    *,
    entity: str = "database",
    action: str = "changed",
    payload: dict[str, Any] | None = None,
    invalidates: list[str] | None = None,
) -> dict[str, Any]:
    message = realtime_event(event, entity=entity, action=action, payload=payload, invalidates=invalidates)
    publisher = _redis_publisher()
    if publisher is not None:
        try:
            publisher.publish(REALTIME_CHANNEL, json.dumps(message))
            return message
        except RedisError:
            pass
    _broadcast_local_from_sync(message)
    return message


async def publish_realtime_async(
    event: str,
    *,
    entity: str = "database",
    action: str = "changed",
    payload: dict[str, Any] | None = None,
    invalidates: list[str] | None = None,
) -> dict[str, Any]:
    message = realtime_event(event, entity=entity, action=action, payload=payload, invalidates=invalidates)
    if async_redis is not None and settings.redis_url:
        client = None
        try:
            client = async_redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.35)
            await client.publish(REALTIME_CHANNEL, json.dumps(message))
            return message
        except Exception:
            pass
        finally:
            if client is not None:
                await client.aclose()
    await _broadcast_local(message)
    return message


async def forward_redis_messages(websocket: WebSocket) -> None:
    if async_redis is None or not settings.redis_url:
        return
    try:
        client = async_redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.35)
        pubsub = client.pubsub()
    except Exception:
        return
    try:
        await pubsub.subscribe(REALTIME_CHANNEL)
        while True:
            item = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not item:
                await asyncio.sleep(0.05)
                continue
            data = item.get("data")
            if isinstance(data, str):
                try:
                    await websocket.send_json(json.loads(data))
                except json.JSONDecodeError:
                    await websocket.send_json({"event": "realtime:raw", "payload": {"message": data}})
    except Exception:
        return
    finally:
        await pubsub.unsubscribe(REALTIME_CHANNEL)
        await pubsub.aclose()
        await client.aclose()


def publish_database_change(sql: str) -> None:
    statement = sql.lstrip().split(None, 1)[0].lower() if sql.strip() else "write"
    publish_realtime(
        "database:changed",
        entity="database",
        action=statement,
        payload={"statement": statement},
        invalidates=["database"],
    )
