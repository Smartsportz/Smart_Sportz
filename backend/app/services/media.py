from __future__ import annotations

import re
from typing import Any

API_STORAGE_URL_RE = re.compile(r"^(?P<prefix>(?:https?://[^/]+)?/api/v1)/storage/files/(?P<filename>[^?#]+)(?P<suffix>[?#].*)?$", re.IGNORECASE)


def materialize_data_url(value: Any, namespace: str = "media") -> Any:
    """Keep media values exactly as stored in the database.

    Older code converted base64 image values into /api/v1/storage/files URLs and
    wrote those URLs back to the table. The project now stores image values
    directly so Supabase remains the source of truth for admin edits.
    """
    _ = namespace
    return value


def normalize_media_value(value: Any, namespace: str = "media") -> Any:
    _ = namespace
    if isinstance(value, str):
        match = API_STORAGE_URL_RE.match(value.strip())
        if match:
            return f"{match.group('prefix')}/media/files/{match.group('filename')}{match.group('suffix') or ''}"
    return value


def normalize_media_record(
    item: dict[str, Any],
    namespace: str = "media",
    fields: set[str] | None = None,
    table: str | None = None,
    key_field: str = "slug",
) -> dict[str, Any]:
    _ = table, key_field
    active_fields = fields or set()
    normalized = dict(item)
    for field in active_fields:
        if field in normalized:
            normalized[field] = normalize_media_value(normalized[field], f"{namespace}-{field}")
    return normalized


def normalize_media_records(
    items: list[dict[str, Any]],
    namespace: str = "media",
    fields: set[str] | None = None,
    table: str | None = None,
    key_field: str = "slug",
) -> list[dict[str, Any]]:
    return [normalize_media_record(item, namespace, fields, table, key_field) for item in items]
