from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import current_user
from app.core.config import settings
from app.core.responses import ok
from app.services.audit import log

router = APIRouter(prefix="/storage", tags=["storage"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower()
    stored_name = f"{uuid4().hex}{suffix}"
    target = settings.upload_dir / stored_name
    content = await file.read()
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
    return FileResponse(target)
