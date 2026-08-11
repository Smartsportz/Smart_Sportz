from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import current_user
from app.core.config import settings
from app.core.responses import ok
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
    log(user["email"], "file_uploaded", "file", stored_name, f"Uploaded {file.filename}")
    return ok({"filename": stored_name, "originalName": file.filename, "size": len(content), "url": f"/api/v1/storage/files/{stored_name}"}, "File uploaded")


@router.get("/files/{filename}")
def get_file(filename: str):
    target = (settings.upload_dir / filename).resolve()
    upload_root = settings.upload_dir.resolve()
    if upload_root not in target.parents and target != upload_root:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if target.suffix.lower() == ".pdf":
        return FileResponse(target, media_type="application/pdf", filename=filename, content_disposition_type="attachment", headers=CACHE_HEADERS)
    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(target, media_type=media_type, headers=CACHE_HEADERS)
