from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import LiveScoreUpdate
from app.services.audit import log

router = APIRouter(prefix="/live", tags=["live"])

connections: dict[str, set[WebSocket]] = {}


async def broadcast(match_id: str, payload: dict) -> None:
    dead: list[WebSocket] = []
    for socket in connections.get(match_id, set()):
        try:
            await socket.send_json(payload)
        except Exception:
            dead.append(socket)
    for socket in dead:
        connections.get(match_id, set()).discard(socket)


@router.post("/{match_id}/score")
async def update_score(match_id: str, payload: LiveScoreUpdate, user: dict = Depends(require_roles("super_admin", "management"))):
    match = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    away_score = payload.away_score if payload.away_score is not None else match["away_score"]
    execute(
        "UPDATE live_matches SET score = ?, away_score = ?, stage = ?, status = ? WHERE id = ?",
        (payload.score, away_score, payload.stage, payload.status, match_id),
    )
    execute(
        "INSERT INTO timeline_events(match_id, time, type, text, score, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (match_id, payload.time, payload.event_type, payload.commentary, payload.score, datetime.now(timezone.utc).isoformat()),
    )
    log(user["email"], "score_updated", "match", match_id, payload.commentary)
    updated = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
    updated["timeline"] = rows("SELECT time, type, text, score, created_at FROM timeline_events WHERE match_id = ? ORDER BY id DESC", (match_id,))
    await broadcast(match_id, {"event": "score:update", "data": updated})
    return ok(updated, "Score updated")


@router.websocket("/ws/{match_id}")
async def live_socket(websocket: WebSocket, match_id: str):
    await websocket.accept()
    connections.setdefault(match_id, set()).add(websocket)
    await websocket.send_json({"event": "connected", "matchId": match_id})
    match = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
    if match:
        match["timeline"] = rows("SELECT time, type, text, score, created_at FROM timeline_events WHERE match_id = ? ORDER BY id DESC", (match_id,))
        await websocket.send_json({"event": "score:snapshot", "data": match})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connections.get(match_id, set()).discard(websocket)
