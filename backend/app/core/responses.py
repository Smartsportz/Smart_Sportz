from __future__ import annotations

from typing import Any


def ok(data: Any = None, message: str = "Success", meta: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"success": True, "message": message, "data": data, "meta": meta or {}}


def fail(message: str, code: str = "BAD_REQUEST", details: Any = None) -> dict[str, Any]:
    return {"success": False, "message": message, "error": {"code": code, "details": details}}
