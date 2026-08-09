from __future__ import annotations

import json
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
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
        self._upstash = UpstashRestClient(settings.upstash_redis_rest_url, settings.upstash_redis_rest_token)
        self._redis = self._connect()

    def _connect(self):
        if Redis is None or not settings.redis_url:
            return None
        try:
            client = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.25)
            client.ping()
            return client
        except (RedisError, ValueError):
            return None

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [key for key, (expires_at, _) in self._fallback.items() if expires_at <= now]
        for key in expired:
            self._fallback.pop(key, None)

    def set_json(self, key: str, value: dict[str, Any], ttl_seconds: int) -> None:
        encoded = json.dumps(value, separators=(",", ":"))
        if self._upstash.enabled:
            try:
                self._upstash.setex(key, encoded, ttl_seconds)
                return
            except UpstashRestError:
                self._upstash.disable()
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl_seconds, encoded)
                return
            except RedisError:
                self._redis = None
        self._purge_expired()
        self._fallback[key] = (time.time() + ttl_seconds, encoded)

    def get_json(self, key: str) -> dict[str, Any] | None:
        if self._upstash.enabled:
            try:
                value = self._upstash.get(key)
                return json.loads(value) if value else None
            except UpstashRestError:
                self._upstash.disable()
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
        if self._upstash.enabled:
            try:
                self._upstash.delete(key)
                return
            except UpstashRestError:
                self._upstash.disable()
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

    def status(self) -> dict[str, Any]:
        self._purge_expired()
        return {
            "upstashConfigured": bool(settings.upstash_redis_rest_url and settings.upstash_redis_rest_token),
            "upstashActive": bool(self._upstash.enabled),
            "redisConfigured": bool(settings.redis_url),
            "redisActive": self._redis is not None,
            "fallbackKeys": len(self._fallback),
        }


class UpstashRestError(Exception):
    pass


class UpstashRestClient:
    def __init__(self, rest_url: str, token: str) -> None:
        self._rest_url = rest_url.rstrip("/")
        self._token = token
        self.enabled = bool(self._rest_url and self._token)

    def disable(self) -> None:
        self.enabled = False

    def _command(self, command: list[Any]) -> Any:
        if not self.enabled:
            raise UpstashRestError("Upstash Redis REST is not configured")
        request = Request(
            self._rest_url,
            data=json.dumps(command).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=0.75) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, json.JSONDecodeError) as exc:
            raise UpstashRestError(str(exc)) from exc
        if "error" in payload and payload["error"]:
            raise UpstashRestError(str(payload["error"]))
        return payload.get("result")

    def setex(self, key: str, value: str, ttl_seconds: int) -> None:
        self._command(["SET", key, value, "EX", ttl_seconds])

    def get(self, key: str) -> str | None:
        value = self._command(["GET", key])
        return str(value) if value is not None else None

    def delete(self, key: str) -> None:
        self._command(["DEL", key])


runtime_state = RuntimeState()
