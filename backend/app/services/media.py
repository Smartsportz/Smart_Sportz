from __future__ import annotations

import base64
import binascii
import re
from hashlib import sha256
from typing import Any

from app.core.config import settings

DATA_URL_RE = re.compile(r"^data:(?P<mime>[-\w.]+/[-\w.+]+);base64,(?P<data>.+)$", re.DOTALL)

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
}

MEDIA_FIELDS = {
    "image",
    "cover",
    "poster",
    "sponsor_image",
    "team_logo",
    "selected_jersey_image",
    "tournament_image",
    "rules_pdf",
}


def materialize_data_url(value: Any, namespace: str = "media") -> Any:
    if not isinstance(value, str) or not value.startswith("data:"):
        return value
    match = DATA_URL_RE.match(value)
    if not match:
        return value
    mime = match.group("mime").lower()
    extension = EXTENSIONS.get(mime, ".bin")
    try:
        content = base64.b64decode(match.group("data"), validate=True)
    except (binascii.Error, ValueError):
        return value
    digest = sha256(content).hexdigest()[:24]
    safe_namespace = re.sub(r"[^a-z0-9_-]+", "-", namespace.lower()).strip("-") or "media"
    filename = f"{safe_namespace}-{digest}{extension}"
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    target = settings.upload_dir / filename
    if not target.exists():
        target.write_bytes(content)
    return f"/api/v1/storage/files/{filename}"


def normalize_media_record(item: dict[str, Any], namespace: str = "media", fields: set[str] | None = None) -> dict[str, Any]:
    active_fields = fields or MEDIA_FIELDS
    normalized = dict(item)
    for field in active_fields:
        if field in normalized:
            normalized[field] = materialize_data_url(normalized[field], f"{namespace}-{field}")
    return normalized


def normalize_media_records(items: list[dict[str, Any]], namespace: str = "media", fields: set[str] | None = None) -> list[dict[str, Any]]:
    return [normalize_media_record(item, namespace, fields) for item in items]

