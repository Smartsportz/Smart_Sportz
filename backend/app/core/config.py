from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]


def _load_local_env() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#") or "=" not in cleaned:
            continue
        key, value = cleaned.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_local_env()


def _default_database_backend() -> str:
    url = os.getenv("DATABASE_URL", os.getenv("SUPABASE_DIRECT_DATABASE_URL", "")).lower()
    if url.startswith(("postgres://", "postgresql://")):
        return "postgres"
    return "sqlite"


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Smart Sportz Backend")
    app_env: str = os.getenv("APP_ENV", "development")
    secret_key: str = os.getenv("APP_SECRET_KEY", "change-this-local-secret")
    database_path: Path = BASE_DIR / os.getenv("DATABASE_PATH", "storage/smart_sportz.db")
    mirror_database_path: Path = BASE_DIR / os.getenv("MIRROR_DATABASE_PATH", "storage/smart_sportz_mirror.db")
    audit_database_path: Path = BASE_DIR / os.getenv("AUDIT_DATABASE_PATH", "storage/smart_sportz_audit.db")
    database_backend: str = os.getenv("DATABASE_BACKEND", _default_database_backend()).lower()
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    supabase_direct_database_url: str = os.getenv("SUPABASE_DIRECT_DATABASE_URL", "")
    database_url: str = os.getenv("DATABASE_URL", os.getenv("SUPABASE_DIRECT_DATABASE_URL", ""))
    mirror_database_url: str = os.getenv("MIRROR_DATABASE_URL", os.getenv("DATABASE_URL", os.getenv("SUPABASE_DIRECT_DATABASE_URL", "")))
    audit_database_url: str = os.getenv("AUDIT_DATABASE_URL", os.getenv("DATABASE_URL", os.getenv("SUPABASE_DIRECT_DATABASE_URL", "")))
    postgres_primary_schema: str = os.getenv("POSTGRES_PRIMARY_SCHEMA", "primary_app")
    postgres_mirror_schema: str = os.getenv("POSTGRES_MIRROR_SCHEMA", "mirror_backup")
    postgres_audit_schema: str = os.getenv("POSTGRES_AUDIT_SCHEMA", "audit_event")
    postgres_pool_min_size: int = int(os.getenv("POSTGRES_POOL_MIN_SIZE", "0"))
    postgres_pool_max_size: int = int(os.getenv("POSTGRES_POOL_MAX_SIZE", "1"))
    postgres_pool_timeout_seconds: float = float(os.getenv("POSTGRES_POOL_TIMEOUT_SECONDS", "5"))
    read_from_mirror: bool = os.getenv("READ_FROM_MIRROR", "false").lower() in {"1", "true", "yes", "on"}
    auto_mirror_sync: bool = os.getenv("AUTO_MIRROR_SYNC", "false").lower() in {"1", "true", "yes", "on"}
    backup_dir: Path = BASE_DIR / os.getenv("BACKUP_DIR", "storage/backups")
    redis_url: str = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
    upstash_redis_rest_url: str = os.getenv("UPSTASH_REDIS_REST_URL", "")
    upstash_redis_rest_token: str = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    init_db_on_startup: bool = os.getenv("INIT_DB_ON_STARTUP", "true").lower() in {"1", "true", "yes", "on"}
    public_cache_ttl_seconds: int = int(os.getenv("PUBLIC_CACHE_TTL_SECONDS", "45"))
    dashboard_cache_ttl_seconds: int = int(os.getenv("DASHBOARD_CACHE_TTL_SECONDS", "20"))
    upload_dir: Path = BASE_DIR / os.getenv("UPLOAD_DIR", "storage/uploads")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173",
        ).split(",")
        if origin.strip()
    )
    twilio_account_sid: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_api_key_sid: str = os.getenv("TWILIO_API_KEY_SID", "")
    twilio_api_key_secret: str = os.getenv("TWILIO_API_KEY_SECRET", "")
    twilio_auth_token: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_verify_service_sid: str = os.getenv("TWILIO_VERIFY_SERVICE_SID", "")
    twilio_from_number: str = os.getenv("TWILIO_FROM_NUMBER", "")
    twilio_messaging_service_sid: str = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "")
    twilio_default_to: str = os.getenv("TWILIO_DEFAULT_TO", "+916374409006")
    otp_delivery_mode: str = os.getenv("OTP_DELIVERY_MODE", "local").lower()
    notification_delivery_mode: str = os.getenv("NOTIFICATION_DELIVERY_MODE", "whatsapp").lower()
    whatsapp_delivery_enabled: bool = os.getenv("WHATSAPP_DELIVERY_ENABLED", "false").lower() in {"1", "true", "yes", "on"}
    whatsapp_provider: str = os.getenv("WHATSAPP_PROVIDER", "disabled").lower()
    whatsapp_default_to: str = os.getenv("WHATSAPP_DEFAULT_TO", os.getenv("TWILIO_DEFAULT_TO", "+916374409006"))
    email_provider: str = os.getenv("EMAIL_PROVIDER", "brevo" if os.getenv("BREVO_API_KEY") else "resend").lower()
    brevo_api_key: str = os.getenv("BREVO_API_KEY", "")
    brevo_sender_email: str = os.getenv("BREVO_SENDER_EMAIL", "smartsportz.in@gmail.com")
    brevo_sender_name: str = os.getenv("BREVO_SENDER_NAME", "Smart Sportz")
    brevo_force_test_recipient: bool = os.getenv("BREVO_FORCE_TEST_RECIPIENT", "false").lower() == "true"
    brevo_test_to_email: str = os.getenv("BREVO_TEST_TO_EMAIL", "smartsportz.in@gmail.com")
    resend_api_key: str = os.getenv("RESEND_API_KEY", "")
    resend_from_email: str = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    resend_force_test_recipient: bool = os.getenv("RESEND_FORCE_TEST_RECIPIENT", "false").lower() == "true"
    resend_account_email: str = os.getenv("RESEND_ACCOUNT_EMAIL", "smartsportz.in@gmail.com")
    resend_test_to_email: str = os.getenv("RESEND_TEST_TO_EMAIL", os.getenv("RESEND_ACCOUNT_EMAIL", "smartsportz.in@gmail.com"))
    privileged_otp_email: str = os.getenv("PRIVILEGED_OTP_EMAIL", "smartsportz.in@gmail.com")
    google_client_id: str = os.getenv("GOOGLE_CLIENT_ID", "1052442707513-ht85fnn4ag34pvna47vv6cnorv4bto7c.apps.googleusercontent.com")
    google_client_secret: str = os.getenv("GOOGLE_CLIENT_SECRET", "")


settings = Settings()
