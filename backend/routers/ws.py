"""
NetWatch Backend — WebSocket router for live alert streaming.

Dashboard clients connect here to receive real-time alert notifications
and periodic traffic statistics updates.
"""

import asyncio
import json
import time
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from database import get_db
from metrics import WS_CONNECTIONS

logger = logging.getLogger("netwatch.ws")

router = APIRouter()

# Active WebSocket connections
_connections: Set[WebSocket] = set()


async def broadcast_alert(alert: dict) -> None:
    """Push an alert to all connected dashboard clients."""
    message = json.dumps({"type": "alert", "data": alert})
    stale: list[WebSocket] = []
    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            stale.append(ws)
    for ws in stale:
        _connections.discard(ws)


async def _stats_loop(ws: WebSocket) -> None:
    """Send traffic stats to a client every 5 seconds."""
    while True:
        await asyncio.sleep(5)
        try:
            now = time.time()
            one_min_ago = now - 60
            db = await get_db()
            try:
                row = await db.execute(
                    "SELECT COALESCE(SUM(total_flows), 0) FROM flow_stats WHERE timestamp >= ?",
                    (one_min_ago,),
                )
                flows_last_minute = (await row.fetchone())[0]

                row = await db.execute(
                    "SELECT COUNT(*) FROM alerts WHERE timestamp >= ?",
                    (one_min_ago,),
                )
                alerts_last_minute = (await row.fetchone())[0]
            finally:
                await db.close()

            message = json.dumps({
                "type": "stats_update",
                "data": {
                    "flows_last_minute": flows_last_minute,
                    "alerts_last_minute": alerts_last_minute,
                },
            })
            await ws.send_text(message)
        except Exception:
            break


@router.websocket("/ws/alerts")
async def websocket_alerts(ws: WebSocket) -> None:
    """WebSocket endpoint for live alert streaming."""
    await ws.accept()
    _connections.add(ws)
    WS_CONNECTIONS.inc()
    logger.info("Dashboard client connected (%d total)", len(_connections))

    stats_task = asyncio.create_task(_stats_loop(ws))

    try:
        while True:
            # Keep connection alive; client can send pings
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        stats_task.cancel()
        _connections.discard(ws)
        WS_CONNECTIONS.dec()
        logger.info("Dashboard client disconnected (%d remaining)", len(_connections))
