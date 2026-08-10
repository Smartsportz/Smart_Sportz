from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket

from app.services.metrics import websocket_connected, websocket_disconnected


class EventHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[channel].add(websocket)
        websocket_connected(channel)
        await websocket.send_json({"event": "connected", "channel": channel})

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._connections[channel].discard(websocket)
        websocket_disconnected(channel)

    async def broadcast(self, channel: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for socket in list(self._connections.get(channel, set())):
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(channel, socket)


event_hub = EventHub()
