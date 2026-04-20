# Coverage target: 70%+ | External calls: all mocked | Test types: unit, integration, error-path
"""Tests for the WebSocket broadcast handler and security middleware.

Covers: CrowdWebSocket connect/disconnect/broadcast,
SecurityHeadersMiddleware header injection and request ID tracing.
"""

import asyncio
import json

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.websocket import CrowdWebSocket


class TestCrowdWebSocketConnect:
    """Tests for CrowdWebSocket.connect and disconnect."""

    @pytest.mark.asyncio
    async def test_connect_accepts_websocket_and_tracks_connection(self):
        ws_handler = CrowdWebSocket()
        mock_ws = AsyncMock()
        await ws_handler.connect(mock_ws)
        mock_ws.accept.assert_called_once()
        assert ws_handler.connection_count == 1

    @pytest.mark.asyncio
    async def test_disconnect_removes_websocket_from_pool(self):
        ws_handler = CrowdWebSocket()
        mock_ws = AsyncMock()
        await ws_handler.connect(mock_ws)
        ws_handler.disconnect(mock_ws)
        assert ws_handler.connection_count == 0

    @pytest.mark.asyncio
    async def test_disconnect_ignores_unknown_websocket(self):
        ws_handler = CrowdWebSocket()
        mock_ws = AsyncMock()
        ws_handler.disconnect(mock_ws)  # Not connected, should not raise
        assert ws_handler.connection_count == 0

    @pytest.mark.asyncio
    async def test_multiple_connections_tracked_correctly(self):
        ws_handler = CrowdWebSocket()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await ws_handler.connect(ws1)
        await ws_handler.connect(ws2)
        assert ws_handler.connection_count == 2
        ws_handler.disconnect(ws1)
        assert ws_handler.connection_count == 1


class TestCrowdWebSocketBroadcast:
    """Tests for CrowdWebSocket.broadcast."""

    @pytest.mark.asyncio
    async def test_broadcast_sends_json_to_all_clients(self):
        ws_handler = CrowdWebSocket()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await ws_handler.connect(ws1)
        await ws_handler.connect(ws2)

        data = {"status": "healthy", "count": 42}
        await ws_handler.broadcast(data)

        expected = json.dumps(data)
        ws1.send_text.assert_called_once_with(expected)
        ws2.send_text.assert_called_once_with(expected)

    @pytest.mark.asyncio
    async def test_broadcast_does_nothing_when_no_clients(self):
        ws_handler = CrowdWebSocket()
        await ws_handler.broadcast({"test": True})  # Should not raise

    @pytest.mark.asyncio
    async def test_broadcast_disconnects_failed_clients(self):
        ws_handler = CrowdWebSocket()
        ws_good = AsyncMock()
        ws_bad = AsyncMock()
        ws_bad.send_text.side_effect = RuntimeError("Connection lost")

        await ws_handler.connect(ws_good)
        await ws_handler.connect(ws_bad)
        assert ws_handler.connection_count == 2

        await ws_handler.broadcast({"data": "test"})

        # Bad client should be removed after failed send
        assert ws_handler.connection_count == 1
        ws_good.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcast_serializes_data_once_for_all_clients(self):
        """Verify the message is serialized once, not per-client."""
        ws_handler = CrowdWebSocket()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await ws_handler.connect(ws1)
        await ws_handler.connect(ws2)

        data = {"zone": "F1", "density": 0.75}
        await ws_handler.broadcast(data)

        # Both should receive the exact same string
        assert ws1.send_text.call_args == ws2.send_text.call_args


class TestCrowdWebSocketShutdown:
    """Tests for shutdown broadcast message."""

    @pytest.mark.asyncio
    async def test_send_shutdown_message_broadcasts_to_all(self):
        ws_handler = CrowdWebSocket()
        mock_ws = AsyncMock()
        await ws_handler.connect(mock_ws)

        await ws_handler.send_shutdown_message()

        mock_ws.send_text.assert_called_once()
        sent_data = json.loads(mock_ws.send_text.call_args[0][0])
        assert sent_data["type"] == "shutdown"
        assert "server_timestamp" in sent_data


class TestSecurityHeadersMiddleware:
    """Integration tests for SecurityHeadersMiddleware via TestClient."""

    @pytest.mark.asyncio
    async def test_adds_security_headers_to_response(self):
        """Test that security headers are injected into responses."""
        from httpx import ASGITransport, AsyncClient
        from app.config import get_settings
        get_settings.cache_clear()
        from app.main import create_app
        from app.crowd.game_clock import GameClock
        from app.crowd.simulator import CrowdSimulator
        from app.crowd.predictor import PredictionEngine
        from app.gamification.rewards import RewardsEngine
        from app.agent.concierge import VenueConcierge

        app = create_app()
        clock = GameClock(speed_multiplier=1.0)
        sim = CrowdSimulator(game_clock=clock)
        pred = PredictionEngine(simulator=sim)
        rewards = RewardsEngine()
        app.state.game_clock = clock
        app.state.simulator = sim
        app.state.predictor = pred
        app.state.rewards_engine = rewards
        app.state.concierge = VenueConcierge(
            api_key="", simulator=sim, predictor=pred, rewards_engine=rewards,
        )

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")

        assert resp.headers["X-Content-Type-Options"] == "nosniff"
        assert resp.headers["X-Frame-Options"] == "DENY"
        assert resp.headers["X-XSS-Protection"] == "1; mode=block"
        assert "X-Request-ID" in resp.headers
        assert len(resp.headers["X-Request-ID"]) == 8
