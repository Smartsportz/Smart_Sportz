from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import current_user
from app.core.responses import ok
from app.services.likes import like_content, normalize_content_type, unlike_content
from app.services.realtime import publish_realtime

router = APIRouter(prefix="/likes", tags=["likes"])


@router.post("/{content_type}/{content_id:path}")
def like(content_type: str, content_id: str, user: dict = Depends(current_user)):
    content_type = normalize_content_type(content_type)
    state = like_content(content_type, content_id, user["id"])
    publish_realtime(
        "like:changed",
        entity=content_type,
        action="liked",
        payload=state,
        invalidates=["likes", content_type, "news" if content_type == "news" else "gallery"],
    )
    return ok(state, "Liked")


@router.delete("/{content_type}/{content_id:path}")
def unlike(content_type: str, content_id: str, user: dict = Depends(current_user)):
    content_type = normalize_content_type(content_type)
    state = unlike_content(content_type, content_id, user["id"])
    publish_realtime(
        "like:changed",
        entity=content_type,
        action="unliked",
        payload=state,
        invalidates=["likes", content_type, "news" if content_type == "news" else "gallery"],
    )
    return ok(state, "Unliked")
