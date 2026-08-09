from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import settings
from hashlib import sha256

from app.db.database import audit_db_path, connect, db_path, mirror_db_path, table_names, using_postgres


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def _safe_redis_url() -> dict[str, Any]:
    upstash_configured = bool(settings.upstash_redis_rest_url and settings.upstash_redis_rest_token)
    redis_url_configured = bool(settings.redis_url)
    return {
        "configured": upstash_configured or redis_url_configured,
        "purpose": "sessions, cache, rate limits, OTP/temp state, and live-score fast state",
        "mode": "upstash_rest" if upstash_configured else "redis_url" if redis_url_configured else "memory_fallback",
    }


def _table_signature(conn, table: str) -> tuple[int, str]:
    records = [dict(row) for row in conn.execute(f'SELECT * FROM "{table}" ORDER BY 1').fetchall()]
    checksum = sha256(json.dumps(records, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    return len(records), checksum


def compare_primary_mirror() -> list[dict[str, Any]]:
    primary_tables = table_names(db_path())
    mirror_tables = set(table_names(mirror_db_path()))
    comparisons: list[dict[str, Any]] = []
    with connect(db_path()) as primary, connect(mirror_db_path()) as mirror:
        for table in primary_tables:
            exists_in_mirror = table in mirror_tables
            primary_count, primary_checksum = _table_signature(primary, table)
            mirror_count, mirror_checksum = _table_signature(mirror, table) if exists_in_mirror else (0, "")
            comparisons.append({
                "table": table,
                "existsInMirror": exists_in_mirror,
                "primaryRows": primary_count,
                "mirrorRows": mirror_count,
                "checksumMatch": exists_in_mirror and primary_checksum == mirror_checksum,
                "rowCountMatch": exists_in_mirror and primary_count == mirror_count,
            })
    return comparisons


def database_status() -> dict[str, Any]:
    comparisons = compare_primary_mirror()
    primary_location = settings.postgres_primary_schema if using_postgres() else str(db_path())
    mirror_location = settings.postgres_mirror_schema if using_postgres() else str(mirror_db_path())
    audit_location = settings.postgres_audit_schema if using_postgres() else str(audit_db_path())
    return {
        "primary": {
            "role": "DB-1 Primary Operational DB",
            "location": primary_location,
            "editableByApplication": True,
            "exists": True if using_postgres() else db_path().exists(),
        },
        "mirror": {
            "role": "DB-2 Read-Only Mirror/Backup DB",
            "location": mirror_location,
            "editableByApplicationApis": False,
            "writableOnlyByReplicationWorker": True,
            "exists": True if using_postgres() else mirror_db_path().exists(),
        },
        "audit": {
            "role": "DB-3 Audit/Event Log DB",
            "location": audit_location,
            "appendOnlyIntent": True,
            "exists": True if using_postgres() else audit_db_path().exists(),
        },
        "redis": _safe_redis_url(),
        "mirrorHealthy": all(item["checksumMatch"] and item["rowCountMatch"] for item in comparisons),
        "tables": comparisons,
    }


def _export_database_json(path: Path, database_role: str, output_path: Path) -> None:
    payload: dict[str, Any] = {
        "databaseRole": database_role,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePath": str(path),
        "sensitiveDataPolicy": {
            "passwords": "stored as one-way hashes only",
            "paymentCards": "not stored by local backend",
            "tokensAndPersonalFields": "encrypt at rest in production PostgreSQL",
        },
        "tables": {},
    }
    with connect(path) as conn:
        for table in table_names(path):
            payload["tables"][table] = [dict(row) for row in conn.execute(f'SELECT * FROM "{table}"').fetchall()]
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_json_backups() -> dict[str, Any]:
    settings.backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = _utc_stamp()
    db1_output = settings.backup_dir / f"db1_backup_{stamp}.json"
    db2_output = settings.backup_dir / f"db2_mirror_{stamp}.json"
    _export_database_json(db_path(), "DB-1 Primary Operational DB", db1_output)
    _export_database_json(mirror_db_path(), "DB-2 Read-Only Mirror/Backup DB", db2_output)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": {
            "db1": str(db1_output),
            "db2": str(db2_output),
        },
    }
