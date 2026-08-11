from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException

from app.db.database import execute, row, rows

SUPPORTED_CONTENT_TYPES = {"gallery", "news"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_content_type(content_type: str) -> str:
    value = content_type.strip().lower()
    if value not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(status_code=404, detail="Content type not found")
    return value


def ensure_content_exists(content_type: str, content_id: str) -> None:
    if content_type == "gallery":
        slug = content_id.removeprefix("album:")
        exists = row("SELECT slug FROM gallery_albums WHERE slug = ? AND published = 1", (slug,))
    else:
        exists = row("SELECT slug FROM news_posts WHERE slug = ? AND status = 'published'", (content_id,))
    if not exists:
        raise HTTPException(status_code=404, detail="Content not found")


def like_count(content_type: str, content_id: str) -> int:
    result = row(
        "SELECT COUNT(*) AS count FROM content_likes WHERE content_type = ? AND content_id = ?",
        (content_type, content_id),
    )
    return int((result or {}).get("count") or 0)


def liked_by_user(content_type: str, content_id: str, user_id: str | None) -> bool:
    if not user_id:
        return False
    return bool(row(
        "SELECT id FROM content_likes WHERE user_id = ? AND content_type = ? AND content_id = ?",
        (user_id, content_type, content_id),
    ))


def like_state(content_type: str, content_id: str, user_id: str | None = None) -> dict:
    return {
        "content_type": content_type,
        "content_id": content_id,
        "like_count": like_count(content_type, content_id),
        "liked_by_me": liked_by_user(content_type, content_id, user_id),
    }


def like_states(content_type: str, content_ids: list[str], user_id: str | None = None) -> dict[str, dict]:
    if not content_ids:
        return {}
    placeholders = ",".join(["?"] * len(content_ids))
    count_rows = rows(
        f"""
        SELECT content_id, COUNT(*) AS count
        FROM content_likes
        WHERE content_type = ? AND content_id IN ({placeholders})
        GROUP BY content_id
        """,
        (content_type, *content_ids),
    )
    counts = {item["content_id"]: int(item["count"] or 0) for item in count_rows}
    liked_ids: set[str] = set()
    if user_id:
        liked_rows = rows(
            f"""
            SELECT content_id
            FROM content_likes
            WHERE user_id = ? AND content_type = ? AND content_id IN ({placeholders})
            """,
            (user_id, content_type, *content_ids),
        )
        liked_ids = {item["content_id"] for item in liked_rows}
    return {
        content_id: {
            "content_type": content_type,
            "content_id": content_id,
            "like_count": counts.get(content_id, 0),
            "liked_by_me": content_id in liked_ids,
        }
        for content_id in content_ids
    }


def like_content(content_type: str, content_id: str, user_id: str) -> dict:
    content_type = normalize_content_type(content_type)
    ensure_content_exists(content_type, content_id)
    execute(
        """
        INSERT INTO content_likes(id, user_id, content_type, content_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, content_type, content_id) DO NOTHING
        """,
        (f"like_{uuid4().hex[:16]}", user_id, content_type, content_id, now_iso()),
    )
    return like_state(content_type, content_id, user_id)


def unlike_content(content_type: str, content_id: str, user_id: str) -> dict:
    content_type = normalize_content_type(content_type)
    ensure_content_exists(content_type, content_id)
    execute(
        "DELETE FROM content_likes WHERE user_id = ? AND content_type = ? AND content_id = ?",
        (user_id, content_type, content_id),
    )
    return like_state(content_type, content_id, user_id)
