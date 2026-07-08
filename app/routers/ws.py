from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import queue_manager
from app.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/progress")
async def ws_progress(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        snapshot = {
            "type": "snapshot",
            "jobs": [job.model_dump(mode="json") for job in queue_manager.list_jobs()],
        }
        await websocket.send_json(snapshot)
        while True:
            # This endpoint is server-push only; just keep the connection alive
            # and drop any client messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
