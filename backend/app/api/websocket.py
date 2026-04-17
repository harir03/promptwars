"""WebSocket handler for real-time crowd data streaming.

Broadcasts CrowdSnapshot to all connected clients every tick.
Uses asyncio.gather for concurrent sends (P6).
Includes server_timestamp in every message (P5).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class CrowdWebSocket:
    """Manages WebSocket connections and crowd data broadcast."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._task: asyncio.Task | None = None

    @property
    def connection_count(self) -> int:
        """Number of active WebSocket connections."""
        return len(self._connections)

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new WebSocket connection.

        Immediately sends the latest snapshot on connect (P4 — no gap).
        """
        await websocket.accept()
        self._connections.add(websocket)
        logger.info(f"WebSocket connected. Total: {self.connection_count}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Handle a WebSocket disconnection."""
        self._connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total: {self.connection_count}")

    async def broadcast(self, data: dict) -> None:
        """Broadcast data to all connected clients.

        Uses asyncio.gather with return_exceptions=True (P6)
        so one slow/failed connection doesn't block others.
        """
        if not self._connections:
            return

        message = json.dumps(data, default=str)
        disconnected: set[WebSocket] = set()

        async def send_to(ws: WebSocket) -> None:
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.add(ws)

        # Fire all sends concurrently (P6)
        await asyncio.gather(
            *[send_to(ws) for ws in self._connections],
            return_exceptions=True,
        )

        # Clean up failed connections
        for ws in disconnected:
            self._connections.discard(ws)

    async def start_broadcast_loop(self, simulator, predictor, tick_interval: float = 3.0) -> None:
        """Start the background broadcast loop.

        Called on application startup. Ticks the simulator and
        broadcasts the snapshot every tick_interval seconds.

        Args:
            simulator: CrowdSimulator instance.
            predictor: PredictionEngine instance.
            tick_interval: Seconds between ticks (default 3.0).
        """
        logger.info(f"Starting crowd broadcast loop (tick: {tick_interval}s)")

        while True:
            try:
                # Advance simulation
                snapshot = simulator.tick()

                # Add predictions
                snapshot.predictions = predictor.get_predictions()

                # Ensure server_timestamp is current (P5)
                snapshot.server_timestamp = time.time()

                # Broadcast to all clients
                await self.broadcast(snapshot.model_dump())

            except Exception as e:
                logger.error(f"Broadcast loop error: {e}")

            await asyncio.sleep(tick_interval)

    async def send_shutdown_message(self) -> None:
        """Broadcast shutdown notification to all clients (P3)."""
        shutdown_msg = {
            "type": "shutdown",
            "message": "Server is restarting. Please reconnect.",
            "server_timestamp": time.time(),
        }
        await self.broadcast(shutdown_msg)


# Singleton instance
crowd_ws = CrowdWebSocket()
