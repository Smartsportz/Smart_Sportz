from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.api.deps import require_roles
from app.core.responses import ok
from app.db.database import execute, row, rows
from app.schemas import LiveScoreUpdate
from app.services.audit import log
from app.services.events import event_hub

router = APIRouter(prefix="/live", tags=["live"])


def _json_field(match: dict, key: str, default):
    value = match.get(key)
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _match_payload(match: dict, include_timeline: bool = False) -> dict:
    payload = dict(match)
    payload["awayScore"] = payload.pop("away_score", "")
    payload["youtubeUrl"] = payload.pop("youtube_url", "")
    payload["matchClock"] = payload.pop("match_clock", "")
    payload["currentPlayers"] = _json_field(payload, "current_players_json", [])
    payload["substitutes"] = _json_field(payload, "substitutes_json", [])
    payload["playerScores"] = _json_field(payload, "player_scores_json", [])
    payload["teamStats"] = _json_field(payload, "team_stats_json", {})
    payload.pop("current_players_json", None)
    payload.pop("substitutes_json", None)
    payload.pop("player_scores_json", None)
    payload.pop("team_stats_json", None)
    if include_timeline:
        payload["timeline"] = rows("SELECT time, type, text, score, created_at FROM timeline_events WHERE match_id = ? ORDER BY id DESC", (match["id"],))
    return payload


@router.get("")
def list_live_matches():
    items = rows("SELECT * FROM live_matches ORDER BY CASE WHEN status LIKE '%Live%' THEN 0 ELSE 1 END, id")
    return ok([_match_payload(item) for item in items], "Live matches loaded")


@router.get("/{match_id}")
def get_live_match(match_id: str):
    match = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return ok(_match_payload(match, include_timeline=True), "Live match loaded")


async def broadcast(match_id: str, payload: dict) -> None:
    await event_hub.broadcast(f"live:match:{match_id}", payload)
    await event_hub.broadcast("live:list", {"event": "live:list:update", "data": [_match_payload(item) for item in rows("SELECT * FROM live_matches ORDER BY CASE WHEN status LIKE '%Live%' THEN 0 ELSE 1 END, id")]})


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
    updated_payload = _match_payload(updated, include_timeline=True)
    await broadcast(match_id, {"event": "score:update", "data": updated_payload})
    return ok(updated_payload, "Score updated")


@router.websocket("/ws/{match_id}")
async def live_socket(websocket: WebSocket, match_id: str):
    channel = f"live:match:{match_id}"
    await event_hub.connect(channel, websocket)
    match = row("SELECT * FROM live_matches WHERE id = ?", (match_id,))
    if match:
        match["timeline"] = rows("SELECT time, type, text, score, created_at FROM timeline_events WHERE match_id = ? ORDER BY id DESC", (match_id,))
        await websocket.send_json({"event": "score:snapshot", "data": match})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_hub.disconnect(channel, websocket)


@router.websocket("/ws")
async def live_list_socket(websocket: WebSocket):
    channel = "live:list"
    await event_hub.connect(channel, websocket)
    await websocket.send_json({"event": "live:list:snapshot", "data": [_match_payload(item) for item in rows("SELECT * FROM live_matches ORDER BY CASE WHEN status LIKE '%Live%' THEN 0 ELSE 1 END, id")]})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_hub.disconnect(channel, websocket)
