from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.events import event_hub
from app.services.realtime import WEBSOCKET_CHANNEL, forward_redis_messages

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.websocket("/ws")
async def realtime_socket(websocket: WebSocket):
    await event_hub.connect(WEBSOCKET_CHANNEL, websocket)
    redis_task = asyncio.create_task(forward_redis_messages(websocket))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        redis_task.cancel()
        try:
            await redis_task
        except asyncio.CancelledError:
            pass
        event_hub.disconnect(WEBSOCKET_CHANNEL, websocket)
