from __future__ import annotations

from app.db.database import execute

LEGACY_MEDIA_PATTERNS = (
    "/api/v1/storage/files/%",
    "/storage/files/%",
    "/api/v1/media/files/%",
    "/media/files/%",
)

IMAGE_COLUMN_DEFAULTS = (
    ("tournaments", "image", "/assets/cricket-stadium.png"),
    ("tournaments", "poster", "/assets/poster.jpeg"),
    ("teams", "image", "/assets/cricket-stadium.png"),
    ("live_matches", "image", "/assets/cricket-stadium.png"),
    ("registrations", "team_logo", "/assets/logo.png"),
    ("registrations", "selected_jersey_image", ""),
    ("tournament_jerseys", "image", "/assets/cricket-stadium.png"),
    ("home_discovery_cards", "image", "/assets/cricket-stadium.png"),
    ("home_discovery_cards", "sponsor_image", "/assets/logo.png"),
    ("organizer_cards", "image", "/assets/logo.png"),
    ("sponsor_logos", "image", "/assets/logo.png"),
    ("news_posts", "image", "/assets/cricket-stadium.png"),
    ("gallery_albums", "cover", "/assets/cricket-stadium.png"),
    ("announcements", "image", "/assets/poster.jpeg"),
    ("live_highlights", "image", "/assets/cricket-stadium.png"),
)


def replace_legacy_media_urls() -> None:
    for table, column, replacement in IMAGE_COLUMN_DEFAULTS:
        for pattern in LEGACY_MEDIA_PATTERNS:
            try:
                execute(f"UPDATE {table} SET {column} = ? WHERE {column} LIKE ?", (replacement, pattern))
            except Exception:
                continue
