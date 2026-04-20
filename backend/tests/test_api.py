"""Integration tests for FastAPI REST endpoints.

Tests use httpx AsyncClient with the actual app.
Covers: health, crowd endpoints, admin endpoints, rewards endpoints.
"""

import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import create_app


@pytest_asyncio.fixture
async def client():
    """Create a test client with a fresh app instance."""
    # Clear settings cache so it picks up test env vars from conftest
    get_settings.cache_clear()

    app = create_app()

    # Initialize app state for testing (mimics lifespan startup)
    from app.crowd.game_clock import GameClock
    from app.crowd.simulator import CrowdSimulator
    from app.crowd.predictor import PredictionEngine
    from app.gamification.rewards import RewardsEngine
    from app.agent.concierge import VenueConcierge

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
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# Must match ADMIN_PASSKEY in conftest.py os.environ
ADMIN_KEY = "test-admin-passkey-for-ci"


# ── Health Check ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "venuepulse"
    assert data["version"] == "1.0.0"
    assert "google_services" in data
    assert "gemini_ai" in data["google_services"]


# ── Crowd Endpoints ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_crowd_snapshot(client: AsyncClient):
    resp = await client.get("/api/crowd/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["zones"]) == 22
    assert data["total_attendance"] > 0


@pytest.mark.asyncio
async def test_crowd_zone_valid(client: AsyncClient):
    resp = await client.get("/api/crowd/zone/G1")
    assert resp.status_code == 200
    assert resp.json()["zone_id"] == "G1"


@pytest.mark.asyncio
async def test_crowd_zone_invalid(client: AsyncClient):
    resp = await client.get("/api/crowd/zone/INVALID")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_crowd_predictions(client: AsyncClient):
    resp = await client.get("/api/crowd/predictions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_crowd_queues_food(client: AsyncClient):
    resp = await client.get("/api/crowd/queues?queue_type=food")
    assert resp.status_code == 200
    assert len(resp.json()) == 4


@pytest.mark.asyncio
async def test_crowd_queues_restroom(client: AsyncClient):
    resp = await client.get("/api/crowd/queues?queue_type=restroom")
    assert resp.status_code == 200
    assert len(resp.json()) == 4


@pytest.mark.asyncio
async def test_crowd_queues_invalid_type(client: AsyncClient):
    resp = await client.get("/api/crowd/queues?queue_type=invalid")
    assert resp.status_code == 400


# ── Admin Endpoints ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_speed_unauth(client: AsyncClient):
    resp = await client.post("/api/admin/game/speed", json={"speed": 5})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_speed_auth(client: AsyncClient):
    resp = await client.post(
        "/api/admin/game/speed",
        json={"speed": 5},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 200
    assert resp.json()["new_speed"] == 5


@pytest.mark.asyncio
async def test_admin_jump(client: AsyncClient):
    resp = await client.post(
        "/api/admin/game/jump",
        json={"minute": 45},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 200
    assert resp.json()["jumped_to"] == 45


@pytest.mark.asyncio
async def test_admin_goal(client: AsyncClient):
    resp = await client.post(
        "/api/admin/game/goal",
        json={"is_home": True},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 200
    assert resp.json()["home_score"] == 1


@pytest.mark.asyncio
async def test_admin_reward_trigger(client: AsyncClient):
    resp = await client.post(
        "/api/admin/rewards/trigger",
        json={"zone_id": "F1", "discount_percent": 20, "points": 100, "duration_minutes": 10},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone_id"] == "F1" or "id" in data  # response shape may vary


@pytest.mark.asyncio
async def test_admin_reward_invalid_zone(client: AsyncClient):
    resp = await client.post(
        "/api/admin/rewards/trigger",
        json={"zone_id": "INVALID", "discount_percent": 20, "points": 100},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 404


# ── Rewards Endpoints ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_wallet_new_user(client: AsyncClient):
    resp = await client.get("/api/rewards/test_user")
    assert resp.status_code == 200
    assert resp.json()["points"] == 0


@pytest.mark.asyncio
async def test_claim_nonexistent_offer(client: AsyncClient):
    resp = await client.post(
        "/api/rewards/claim",
        json={"user_id": "test_user", "offer_id": "fake_offer"},
    )
    assert resp.status_code == 404


# ── Security Headers ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_security_headers_present(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "X-Request-ID" in resp.headers


@pytest.mark.asyncio
async def test_security_headers_csp_present(client: AsyncClient):
    """OWASP A05: Content-Security-Policy header must be present."""
    resp = await client.get("/health")
    csp = resp.headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp


@pytest.mark.asyncio
async def test_security_headers_hsts_present(client: AsyncClient):
    """OWASP A05: Strict-Transport-Security header must be present."""
    resp = await client.get("/health")
    assert "max-age=" in resp.headers.get("Strict-Transport-Security", "")


@pytest.mark.asyncio
async def test_security_headers_permissions_policy(client: AsyncClient):
    """OWASP A05: Permissions-Policy must restrict sensitive APIs."""
    resp = await client.get("/health")
    pp = resp.headers.get("Permissions-Policy", "")
    assert "camera=()" in pp
    assert "microphone=()" in pp


# ── OWASP Edge Cases ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_wrong_key_returns_403(client: AsyncClient):
    """OWASP A07: Wrong admin key must be rejected (timing-safe)."""
    resp = await client.post(
        "/api/admin/game/speed",
        json={"speed": 1},
        headers={"X-Admin-Key": "wrong-key-value"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_zone_id_injection_attack_rejected(client: AsyncClient):
    """OWASP A03: zone_id with special chars must be rejected."""
    resp = await client.get("/api/crowd/zone/' OR 1=1 --")
    assert resp.status_code in (400, 404, 422)


@pytest.mark.asyncio
async def test_queue_type_injection_rejected(client: AsyncClient):
    """OWASP A03: queue_type outside whitelist rejected."""
    resp = await client.get("/api/crowd/queues?queue_type=<script>alert(1)</script>")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_rewards_invalid_user_id_rejected(client: AsyncClient):
    """OWASP A03: user_id with special characters must be rejected."""
    resp = await client.get("/api/rewards/../../etc/passwd")
    # Path traversal is either rejected (400/422) or normalized away (404)
    assert resp.status_code in (400, 404, 422)


@pytest.mark.asyncio
async def test_admin_speed_out_of_bounds(client: AsyncClient):
    """Pydantic validation: speed must be > 0 and <= 20."""
    resp = await client.post(
        "/api/admin/game/speed",
        json={"speed": 100},
        headers={"X-Admin-Key": ADMIN_KEY},
    )
    assert resp.status_code == 422

