from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

from app.core.config import settings

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - SQLite local dev does not require psycopg.
    psycopg = None
    dict_row = None


OPERATIONAL_TABLE_ORDER = [
    "users",
    "sports",
    "tournaments",
    "tournament_cities",
    "teams",
    "live_matches",
    "timeline_events",
    "registrations",
    "registration_members",
    "payments",
    "payment_intents",
    "bracket_nodes",
    "bracket_connections",
    "notification_events",
    "cms_content",
    "news_posts",
    "news_blocks",
    "sport_home_visibility",
    "manager_city_assignments",
    "leaderboard_records",
    "audit_logs",
]


def ensure_storage() -> None:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.mirror_database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.audit_database_path.parent.mkdir(parents=True, exist_ok=True)
    settings.backup_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)


def using_postgres() -> bool:
    return settings.database_backend == "postgres"


def _schema_for_path(path: Path | None = None) -> str:
    if path == settings.mirror_database_path:
        return settings.postgres_mirror_schema
    if path == settings.audit_database_path:
        return settings.postgres_audit_schema
    return settings.postgres_primary_schema


def _url_for_path(path: Path | None = None) -> str:
    if path == settings.mirror_database_path:
        return settings.mirror_database_url or settings.database_url
    if path == settings.audit_database_path:
        return settings.audit_database_url or settings.database_url
    return settings.database_url


def _translate_sql(sql: str) -> str:
    if not using_postgres():
        return sql
    translated = sql.replace("?", "%s")
    is_insert_ignore = "INSERT OR IGNORE INTO" in translated
    translated = translated.replace("INSERT OR IGNORE INTO", "INSERT INTO")
    if is_insert_ignore and "ON CONFLICT" not in translated:
        translated = f"{translated} ON CONFLICT DO NOTHING"
    return translated


def _auto_mirror_sync_enabled() -> bool:
    if using_postgres():
        return False
    return True


def connect(path: Path | None = None):
    ensure_storage()
    if using_postgres():
        if psycopg is None:
            raise RuntimeError("PostgreSQL mode requires psycopg. Run pip install -r requirements.txt.")
        url = _url_for_path(path)
        if not url:
            raise RuntimeError("DATABASE_URL is required when DATABASE_BACKEND=postgres")
        schema = _schema_for_path(path)
        conn = psycopg.connect(url, row_factory=dict_row)
        conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
        conn.execute(f'SET search_path TO "{schema}", public')
        return conn

    conn = sqlite3.connect(path or settings.database_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def connect_mirror():
    conn = connect(settings.mirror_database_path)
    if using_postgres():
        conn.execute("SET default_transaction_read_only = on")
    else:
        conn.execute("PRAGMA query_only = ON")
    return conn


def connect_audit():
    return connect(settings.audit_database_path)


def rows(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with connect() as conn:
        return [dict(item) for item in conn.execute(_translate_sql(sql), tuple(params)).fetchall()]


def row(sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
    with connect() as conn:
        result = conn.execute(_translate_sql(sql), tuple(params)).fetchone()
        return dict(result) if result else None


def execute(sql: str, params: Iterable[Any] = ()) -> int:
    with connect() as conn:
        cur = conn.execute(_translate_sql(sql), tuple(params))
        conn.commit()
        lastrowid = int(getattr(cur, "lastrowid", 0) or 0)
    if _auto_mirror_sync_enabled():
        sync_mirror()
    return lastrowid


def execute_many(statements: list[tuple[str, Iterable[Any]]]) -> None:
    with connect() as conn:
        for sql, params in statements:
            conn.execute(_translate_sql(sql), tuple(params))
        conn.commit()
    if _auto_mirror_sync_enabled():
        sync_mirror()


def audit_rows(sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
    with connect_audit() as conn:
        return [dict(item) for item in conn.execute(_translate_sql(sql), tuple(params)).fetchall()]


def audit_execute(sql: str, params: Iterable[Any] = ()) -> int:
    with connect_audit() as conn:
        cur = conn.execute(_translate_sql(sql), tuple(params))
        conn.commit()
        return int(getattr(cur, "lastrowid", 0) or 0)


def db_path() -> Path:
    ensure_storage()
    return settings.database_path


def mirror_db_path() -> Path:
    ensure_storage()
    return settings.mirror_database_path


def audit_db_path() -> Path:
    ensure_storage()
    return settings.audit_database_path


def table_names(path: Path | None = None) -> list[str]:
    with connect(path) as conn:
        if using_postgres():
            result = conn.execute(
                "SELECT table_name AS name FROM information_schema.tables "
                "WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'"
            ).fetchall()
            found = {item["name"] for item in result}
            ordered = [table for table in OPERATIONAL_TABLE_ORDER if table in found]
            ordered += sorted(found - set(ordered))
            return ordered
        result = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid"
        ).fetchall()
    return [item["name"] for item in result]


def table_checksum(path: Path, table: str) -> str:
    with connect(path) as conn:
        records = [dict(item) for item in conn.execute(f'SELECT * FROM "{table}" ORDER BY 1').fetchall()]
    return sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def sync_mirror() -> None:
    """Copy DB-1 into DB-2. DB-2 is only writable inside this backend worker function."""
    if not using_postgres() and not settings.database_path.exists():
        return
    ensure_storage()
    source_tables = table_names(settings.database_path)
    batch_id = datetime.now(timezone.utc).strftime("mirror_%Y%m%d_%H%M%S_%f")
    mirrored_at = datetime.now(timezone.utc).isoformat()
    with connect(settings.database_path) as primary, connect(settings.mirror_database_path) as mirror:
        if using_postgres():
            mirror.execute("SET default_transaction_read_only = off")
            if source_tables:
                mirror.execute(
                    "TRUNCATE "
                    + ", ".join(f'"{table}"' for table in source_tables)
                    + " RESTART IDENTITY CASCADE"
                )
        else:
            mirror.execute("PRAGMA foreign_keys = OFF")
            mirror.execute("PRAGMA query_only = OFF")
            for table in reversed(source_tables):
                mirror.execute(f'DELETE FROM "{table}"')

        table_stats: dict[str, tuple[str, int]] = {}
        for table in source_tables:
            records = primary.execute(f'SELECT * FROM "{table}"').fetchall()
            table_records = [dict(record) for record in records]
            table_stats[table] = (
                sha256(json.dumps(table_records, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest(),
                len(table_records),
            )
            if not records:
                continue
            columns = [
                description[0] if isinstance(description, tuple) else description.name
                for description in primary.execute(f'SELECT * FROM "{table}" LIMIT 0').description
            ]
            placeholders = ", ".join(["?"] * len(columns))
            column_sql = ", ".join(f'"{column}"' for column in columns)
            insert_sql = _translate_sql(f'INSERT INTO "{table}" ({column_sql}) VALUES ({placeholders})')
            for record in records:
                mirror.execute(insert_sql, tuple(record[column] for column in columns))

        mirror.execute(
            _translate_sql(
                "INSERT INTO mirror_sync_batches(batch_id, source_updated_at, mirrored_at, backup_status) "
                "VALUES (?, ?, ?, ?)"
            ),
            (batch_id, mirrored_at, mirrored_at, "synced"),
        )
        mirror.execute("DELETE FROM mirror_table_checksums")
        for table in source_tables:
            checksum, row_count = table_stats[table]
            mirror.execute(
                _translate_sql(
                    "INSERT INTO mirror_table_checksums(table_name, checksum, row_count, mirrored_at) "
                    "VALUES (?, ?, ?, ?)"
                ),
                (
                    table,
                    checksum,
                    row_count,
                    mirrored_at,
                ),
            )
        if not using_postgres():
            mirror.execute("PRAGMA foreign_keys = ON")
        mirror.commit()
