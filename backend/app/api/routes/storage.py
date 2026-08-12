from __future__ import annotations

import mimetypes
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.api.deps import current_user
from app.core.config import settings
from app.core.responses import ok
from app.db.database import execute, row
from app.services.audit import log

router = APIRouter(prefix="/storage", tags=["storage"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".pdf"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
}
CACHE_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}
HASHED_STORAGE_NAME = re.compile(r"(?P<digest>[a-f0-9]{24})(?P<suffix>\.[a-z0-9]+)$", re.IGNORECASE)


def resolve_stored_file(filename: str) -> Path:
    upload_root = settings.upload_dir.resolve()
    target = (settings.upload_dir / filename).resolve()
    if upload_root not in target.parents and target != upload_root:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if target.exists() and target.is_file():
        return target

    match = HASHED_STORAGE_NAME.search(filename)
    if match:
        digest = match.group("digest")
        suffix = match.group("suffix")
        for candidate in sorted(settings.upload_dir.glob(f"*{digest}{suffix}")):
            resolved = candidate.resolve()
            if upload_root in resolved.parents and resolved.is_file():
                return resolved

    raise HTTPException(status_code=404, detail="File not found")


def _media_row(filename: str) -> dict | None:
    try:
        return row("SELECT filename, content_type, content FROM media_files WHERE filename = ?", (filename,))
    except Exception:
        return None


def _store_media_file(filename: str, original_name: str, content_type: str, content: bytes) -> None:
    execute(
        """
        INSERT INTO media_files(filename, original_name, content_type, size, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
          original_name = excluded.original_name,
          content_type = excluded.content_type,
          size = excluded.size,
          content = excluded.content,
          created_at = excluded.created_at
        """,
        (
            filename,
            original_name,
            content_type,
            len(content),
            content,
            datetime.now(timezone.utc).isoformat(),
        ),
    )


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    stored_name = f"{uuid4().hex}{suffix}"
    target = settings.upload_dir / stored_name
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large")
    if not content:
        raise HTTPException(status_code=400, detail="File is empty")
    target.write_bytes(content)
    media_type = file.content_type or mimetypes.guess_type(stored_name)[0] or "application/octet-stream"
    _store_media_file(stored_name, file.filename or stored_name, media_type, content)
    log(user["email"], "file_uploaded", "file", stored_name, f"Uploaded {file.filename}")
    return ok({"filename": stored_name, "originalName": file.filename, "size": len(content), "url": f"/api/v1/storage/files/{stored_name}"}, "File uploaded")


@router.get("/files/{filename}")
def get_file(filename: str):
    try:
        target = resolve_stored_file(filename)
        media_type = "application/pdf" if target.suffix.lower() == ".pdf" else mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if not _media_row(filename):
            try:
                _store_media_file(filename, filename, media_type, target.read_bytes())
            except Exception:
                pass
        if target.suffix.lower() == ".pdf":
            return FileResponse(target, media_type="application/pdf", filename=filename, content_disposition_type="attachment", headers=CACHE_HEADERS)
        return FileResponse(target, media_type=media_type, headers=CACHE_HEADERS)
    except HTTPException as exc:
        if exc.status_code != 404:
            raise
    stored = _media_row(filename)
    if not stored:
        raise HTTPException(status_code=404, detail="File not found")
    content = stored.get("content") or b""
    if isinstance(content, memoryview):
        content = content.tobytes()
    media_type = stored.get("content_type") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    headers = dict(CACHE_HEADERS)
    if media_type == "application/pdf":
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return Response(bytes(content), media_type=media_type, headers=headers)
