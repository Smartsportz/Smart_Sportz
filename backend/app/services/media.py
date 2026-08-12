from __future__ import annotations

from typing import Any


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
    return value


def normalize_media_record(
    item: dict[str, Any],
    namespace: str = "media",
    fields: set[str] | None = None,
    table: str | None = None,
    key_field: str = "slug",
) -> dict[str, Any]:
    _ = namespace, fields, table, key_field
    return dict(item)


def normalize_media_records(
    items: list[dict[str, Any]],
    namespace: str = "media",
    fields: set[str] | None = None,
    table: str | None = None,
    key_field: str = "slug",
) -> list[dict[str, Any]]:
    _ = namespace, fields, table, key_field
    return [dict(item) for item in items]
