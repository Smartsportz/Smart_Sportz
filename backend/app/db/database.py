from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from app.core.config import settings


def ensure_storage() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)


def connect() -> sqlite3.Connection:
    ensure_storage()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with connect() as conn:
        return [dict(row) for row in conn.execute(sql, tuple(params)).fetchall()]


def row(sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    with connect() as conn:
        result = conn.execute(sql, tuple(params)).fetchone()
        return dict(result) if result else None


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    with connect() as conn:
        cur = conn.execute(sql, tuple(params))
        conn.commit()
        return int(cur.lastrowid)


def execute_many(statements: list[tuple[str, Iterable[Any]]]) -> None:
    with connect() as conn:
        for sql, params in statements:
            conn.execute(sql, tuple(params))
        conn.commit()


def db_path() -> Path:
    ensure_storage()
    return settings.database_path
