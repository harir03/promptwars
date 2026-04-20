"""VenuePulse — Main FastAPI Application.

Entry point for the VenuePulse AI venue management platform.
Initializes all subsystems and serves both API and static frontend.

Patches addressed:
- P1/P2: Single instance (Cloud Run config)
- P3: SIGTERM handler for graceful shutdown
- P5: Server timestamps in all WebSocket messages
- P6: Concurrent WebSocket broadcast
- P15: Admin passkey validation
- P17: CORS whitelist, security headers
- P19: Efficient startup
"""

from __future__ import annotations

import asyncio
import logging
import re
import signal
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.agent.concierge import VenueConcierge
from app.api.routes import admin, agent, crowd, notifications
from app.api.websocket import crowd_ws
from app.config import get_settings, validate_startup_secrets
from app.crowd.game_clock import GameClock
from app.crowd.predictor import PredictionEngine
from app.crowd.simulator import CrowdSimulator
from app.gamification.rewards import RewardsEngine
from app.middleware.security import SecurityHeadersMiddleware
from app.notifications.fcm import initialize_firebase

# OWASP A03: FCM token validation pattern
FCM_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9:_-]{20,300}$")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("venuepulse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager.

    Startup: Validate secrets, initialize all subsystems.
    Shutdown: Broadcast reconnect message (P3).
    """
    settings = get_settings()

    # OWASP A02: validate required secrets at startup
    validate_startup_secrets()

    logger.info("=" * 50)
    logger.info("VenuePulse starting up...")
    logger.info("Environment: %s", settings.environment)
    logger.info("=" * 50)

    # --- Initialize Game Clock (P31) ---
    game_clock = GameClock(speed_multiplier=settings.simulation_speed)
    app.state.game_clock = game_clock
    logger.info("Game clock initialized (speed: %sx)", settings.simulation_speed)

    # --- Initialize Crowd Simulator ---
    simulator = CrowdSimulator(game_clock=game_clock)
    app.state.simulator = simulator
    logger.info("Crowd simulator initialized (%d zones)", len(simulator.zones))

    # --- Initialize Prediction Engine ---
    predictor = PredictionEngine(simulator=simulator)
    app.state.predictor = predictor
    logger.info("Prediction engine initialized")

    # --- Initialize Rewards Engine ---
    rewards_engine = RewardsEngine()
    app.state.rewards_engine = rewards_engine
    logger.info("Rewards engine initialized")

    # --- Initialize AI Concierge ---
    concierge = VenueConcierge(
        api_key=settings.google_api_key,
        simulator=simulator,
        predictor=predictor,
        rewards_engine=rewards_engine,
    )
    app.state.concierge = concierge
    logger.info("AI concierge initialized")

    # --- Initialize Firebase ---
    if settings.firebase_credentials_path:
        initialize_firebase(settings.firebase_credentials_path)

    # --- Start WebSocket broadcast loop ---
    broadcast_task = asyncio.create_task(
        crowd_ws.start_broadcast_loop(
            simulator=simulator,
            predictor=predictor,
            tick_interval=settings.tick_interval_seconds,
        )
    )
    logger.info(
        "WebSocket broadcast loop started (tick: %ss)", settings.tick_interval_seconds
    )

    # --- Register SIGTERM handler (P3) ---
    def handle_sigterm(*_):
        logger.info("SIGTERM received — initiating graceful shutdown")
        asyncio.create_task(crowd_ws.send_shutdown_message())

    signal.signal(signal.SIGTERM, handle_sigterm)

    logger.info("=" * 50)
    logger.info("VenuePulse is READY")
    logger.info("=" * 50)

    yield

    # --- Shutdown ---
    logger.info("Shutting down VenuePulse...")
    broadcast_task.cancel()
    await crowd_ws.send_shutdown_message()
    logger.info("VenuePulse shut down complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="VenuePulse API",
        description="AI-native venue management platform for real-time crowd intelligence",
        version="1.0.0",
        lifespan=lifespan,
    )

    # --- CORS Middleware (P17) ---
    # OWASP CORS: explicit methods list, no wildcard in production
    # HTTPS enforcement is handled at the Cloud Run / reverse proxy layer
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Admin-Key", "X-Request-ID"],
    )

    # --- Security Headers Middleware ---
    app.add_middleware(SecurityHeadersMiddleware)

    # --- API Routes ---
    app.include_router(agent.router)
    app.include_router(crowd.router)
    app.include_router(admin.router)
    app.include_router(notifications.router)

    # --- Health Check (P1) ---
    @app.get("/health", tags=["Health"])
    async def health():
        """Health check endpoint for Cloud Run liveness probe."""
        return {
            "status": "healthy",
            "service": "venuepulse",
            "websocket_connections": crowd_ws.connection_count,
        }

    # --- WebSocket Endpoint (P4, P5) ---
    @app.websocket("/ws/crowd")
    async def websocket_crowd(websocket: WebSocket):
        """WebSocket endpoint for real-time crowd data.

        Clients connect here to receive CrowdSnapshot broadcasts.
        On connect, immediately sends the latest snapshot (P4).
        """
        await crowd_ws.connect(websocket)

        # Send initial snapshot immediately (P4 — no gap on reconnect)
        simulator = app.state.simulator
        predictor = app.state.predictor
        snapshot = simulator._build_snapshot()
        snapshot.predictions = predictor.get_predictions()
        snapshot.server_timestamp = time.time()
        await websocket.send_json(snapshot.model_dump(mode="json"))

        try:
            while True:
                # Keep connection alive, listen for any client messages
                data = await websocket.receive_text()
                # Client might send FCM re-registration on reconnect (P18)
                if data.startswith("fcm:"):
                    token = data[4:]
                    # OWASP A03: validate FCM token format before use
                    if FCM_TOKEN_PATTERN.match(token):
                        from app.notifications.fcm import register_token
                        register_token("ws_user", token)
                    else:
                        logger.warning("Invalid FCM token format received via WebSocket")
        except WebSocketDisconnect:
            crowd_ws.disconnect(websocket)
        except Exception:
            # OWASP A05: log error server-side, don't expose to client
            logger.exception("WebSocket error")
            crowd_ws.disconnect(websocket)

    # --- Serve Static Frontend (production) ---
    static_dir = Path(__file__).parent.parent / "frontend" / "dist"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
        logger.info("Serving static frontend from %s", static_dir)

    return app


# Create the app instance
app = create_app()
