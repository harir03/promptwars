"""Tests for analytics API routes.

Tests cover: snapshot endpoint, admin-protected export,
admin-protected history, and input validation.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.agent.concierge import VenueConcierge
from app.crowd.game_clock import GameClock
from app.crowd.predictor import PredictionEngine
from app.crowd.simulator import CrowdSimulator
from app.gamification.rewards import RewardsEngine
from app.main import app

BASE = "http://test"

# Must match ADMIN_PASSKEY in conftest.py os.environ
ADMIN_KEY = "test-admin-passkey-for-ci"


@pytest.fixture
async def client():
    """Create async test client with fully initialized app state."""
    clock = GameClock()
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
    async with AsyncClient(transport=transport, base_url=BASE) as ac:
        yield ac


class TestAnalyticsSnapshot:
    """Tests for GET /api/analytics/snapshot."""

    @pytest.mark.asyncio
    async def test_snapshot_returns_200(self, client: AsyncClient):
        """Snapshot endpoint returns analytics data."""
        resp = await client.get("/api/analytics/snapshot")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_attendance" in data
        assert "zone_count" in data
        assert "avg_density" in data
        assert "peak_zone" in data
        assert "active_predictions" in data
        assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_snapshot_zone_count_is_positive(self, client: AsyncClient):
        """Snapshot should report at least one zone."""
        resp = await client.get("/api/analytics/snapshot")
        data = resp.json()
        assert data["zone_count"] > 0

    @pytest.mark.asyncio
    async def test_snapshot_density_in_range(self, client: AsyncClient):
        """Average density should be between 0 and 1."""
        resp = await client.get("/api/analytics/snapshot")
        data = resp.json()
        assert 0.0 <= data["avg_density"] <= 1.0


class TestAnalyticsExport:
    """Tests for POST /api/analytics/export (admin-only)."""

    @pytest.mark.asyncio
    async def test_export_requires_admin_key(self, client: AsyncClient):
        """Export endpoint rejects requests without admin key."""
        resp = await client.post("/api/analytics/export")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_export_rejects_wrong_key(self, client: AsyncClient):
        """Export endpoint rejects invalid admin key."""
        resp = await client.post(
            "/api/analytics/export",
            headers={"X-Admin-Key": "wrong_key"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_export_succeeds_with_admin_key(self, client: AsyncClient):
        """Export endpoint succeeds with valid admin key."""
        resp = await client.post(
            "/api/analytics/export",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["exported"] is True
        assert data["storage"] in ("firestore", "local")
        assert data["doc_id"].startswith("export_")


class TestAnalyticsHistory:
    """Tests for GET /api/analytics/history (admin-only)."""

    @pytest.mark.asyncio
    async def test_history_requires_admin_key(self, client: AsyncClient):
        """History endpoint rejects requests without admin key."""
        resp = await client.get("/api/analytics/history")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_history_rejects_wrong_key(self, client: AsyncClient):
        """History endpoint rejects invalid admin key."""
        resp = await client.get(
            "/api/analytics/history",
            headers={"X-Admin-Key": "wrong_key"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_history_succeeds_with_admin_key(self, client: AsyncClient):
        """History endpoint returns data with valid admin key."""
        resp = await client.get(
            "/api/analytics/history",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "snapshots" in data
        assert "source" in data

    @pytest.mark.asyncio
    async def test_history_validates_limit_too_low(self, client: AsyncClient):
        """History rejects limit=0."""
        resp = await client.get(
            "/api/analytics/history?limit=0",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_history_validates_limit_too_high(self, client: AsyncClient):
        """History rejects limit=200."""
        resp = await client.get(
            "/api/analytics/history?limit=200",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_history_accepts_valid_limit(self, client: AsyncClient):
        """History accepts limit within 1-100 range."""
        resp = await client.get(
            "/api/analytics/history?limit=5",
            headers={"X-Admin-Key": ADMIN_KEY},
        )
        assert resp.status_code == 200
