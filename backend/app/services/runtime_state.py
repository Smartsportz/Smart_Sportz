from __future__ import annotations

import json
import time
from typing import Any

from app.core.config import settings

try:
    from redis import Redis
    from redis.exceptions import RedisError
except Exception:  # pragma: no cover - local dev can run without redis installed
    Redis = None

    class RedisError(Exception):
        pass


class RuntimeState:
    def __init__(self) -> None:
        self._fallback: dict[str, tuple[float, str]] = {}
        self._redis = self._connect()

    def _connect(self):
        if Redis is None:
            return None
        try:
            client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.25)
            client.ping()
            return client
        except RedisError:
            return None

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [key for key, (expires_at, _) in self._fallback.items() if expires_at <= now]
        for key in expired:
            self._fallback.pop(key, None)

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        encoded = json.dumps(value, separators=(",", ":"))
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl_seconds, encoded)
                return
            except RedisError:
                self._redis = None
        self._purge_expired()
        self._fallback[key] = (time.time() + ttl_seconds, encoded)

    def get_json(self, key: str) -> dict[str, Any] | None:
        if self._redis is not None:
            try:
                value = self._redis.get(key)
                return json.loads(value) if value else None
            except RedisError:
                self._redis = None
        self._purge_expired()
        item = self._fallback.get(key)
        return json.loads(item[1]) if item else None

    def delete(self, key: str) -> None:
        if self._redis is not None:
            try:
                self._redis.delete(key)
                return
            except RedisError:
                self._redis = None
        self._fallback.pop(key, None)

    def mark_session(self, jti: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        self.set_json(f"session:{jti}", payload, ttl_seconds)

    def get_session(self, jti: str) -> dict[str, Any] | None:
        return self.get_json(f"session:{jti}")

    def revoke_token(self, jti: str, ttl_seconds: int) -> None:
        self.set_json(f"revoked:{jti}", {"revoked": True}, ttl_seconds)
        self.delete(f"session:{jti}")

    def is_token_revoked(self, jti: str) -> bool:
        return self.get_json(f"revoked:{jti}") is not None


runtime_state = RuntimeState()
