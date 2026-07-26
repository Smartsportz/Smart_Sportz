from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Smart Sportz Backend")
    app_env: str = os.getenv("APP_ENV", "development")
    secret_key: str = os.getenv("APP_SECRET_KEY", "change-this-local-secret")
    database_path: Path = BASE_DIR / os.getenv("DATABASE_PATH", "storage/smart_sportz.db")
    mirror_database_path: Path = BASE_DIR / os.getenv("MIRROR_DATABASE_PATH", "storage/smart_sportz_mirror.db")
    audit_database_path: Path = BASE_DIR / os.getenv("AUDIT_DATABASE_PATH", "storage/smart_sportz_audit.db")
    database_backend: str = os.getenv("DATABASE_BACKEND", "sqlite").lower()
    database_url: str = os.getenv("DATABASE_URL", "")
    mirror_database_url: str = os.getenv("MIRROR_DATABASE_URL", os.getenv("DATABASE_URL", ""))
    audit_database_url: str = os.getenv("AUDIT_DATABASE_URL", os.getenv("DATABASE_URL", ""))
    postgres_primary_schema: str = os.getenv("POSTGRES_PRIMARY_SCHEMA", "primary_app")
    postgres_mirror_schema: str = os.getenv("POSTGRES_MIRROR_SCHEMA", "mirror_backup")
    postgres_audit_schema: str = os.getenv("POSTGRES_AUDIT_SCHEMA", "audit_event")
    backup_dir: Path = BASE_DIR / os.getenv("BACKUP_DIR", "storage/backups")
    redis_url: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    upload_dir: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "storage/uploads")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    )


settings = Settings()
