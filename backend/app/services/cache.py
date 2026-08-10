from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from typing import Any, TypeVar

from app.core.config import settings
from app.services.runtime_state import runtime_state

T = TypeVar("T")


def cache_key(namespace: str, *parts: Any) -> str:
    encoded = json.dumps(parts, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:24]
    return f"cache:{namespace}:{digest}"


def get_or_set_json(key: str, factory: Callable[[], T], ttl_seconds: int | None = None) -> T:
    ttl = ttl_seconds if ttl_seconds is not None else settings.public_cache_ttl_seconds
    if ttl <= 0:
        return factory()
    cached = runtime_state.get_json(key)
    if cached is not None and "value" in cached:
        return cached["value"]
    value = factory()
    runtime_state.set_json(key, {"value": value}, ttl)
    return value


def invalidate_prefix(prefix: str) -> None:
    runtime_state.delete_prefix(prefix)
