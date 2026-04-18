"""Tests for Pydantic domain models.

Covers:
- ZoneDensity.compute_level thresholds
- GameState.score_margin property
- Model validation constraints
- Enum values
"""

import pytest
from pydantic import ValidationError

from app.crowd.models import (
    ChatRequest,
    CrowdSnapshot,
    DensityLevel,
    DensityTrend,
    GamePhase,
    GameState,
    RewardOffer,
    SurgePrediction,
    UserRewards,
    VenueZone,
    ZoneDensity,
    ZoneType,
)


# ── DensityLevel Computation ─────────────────────────────────────

class TestDensityLevel:
    def test_clear_at_0(self):
        assert ZoneDensity.compute_level(0.0) == DensityLevel.CLEAR

    def test_clear_at_39(self):
        assert ZoneDensity.compute_level(0.39) == DensityLevel.CLEAR

    def test_moderate_at_40(self):
        assert ZoneDensity.compute_level(0.4) == DensityLevel.MODERATE

    def test_moderate_at_69(self):
        assert ZoneDensity.compute_level(0.69) == DensityLevel.MODERATE

    def test_busy_at_70(self):
        assert ZoneDensity.compute_level(0.7) == DensityLevel.BUSY

    def test_busy_at_84(self):
        assert ZoneDensity.compute_level(0.84) == DensityLevel.BUSY

    def test_packed_at_85(self):
        assert ZoneDensity.compute_level(0.85) == DensityLevel.PACKED

    def test_packed_at_100(self):
        assert ZoneDensity.compute_level(1.0) == DensityLevel.PACKED


# ── GameState ─────────────────────────────────────────────────────

class TestGameState:
    def test_score_margin_equal(self):
        gs = GameState(home_score=2, away_score=2)
        assert gs.score_margin == 0

    def test_score_margin_home_leads(self):
        gs = GameState(home_score=3, away_score=1)
        assert gs.score_margin == 2

    def test_score_margin_away_leads(self):
        gs = GameState(home_score=0, away_score=4)
        assert gs.score_margin == 4


# ── Validation Constraints ────────────────────────────────────────

class TestValidation:
    def test_chat_message_too_long(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="x" * 1001, session_id="s1")

    def test_chat_empty_message(self):
        with pytest.raises(ValidationError):
            ChatRequest(message="", session_id="s1")

    def test_zone_density_percentage_bounds(self):
        with pytest.raises(ValidationError):
            ZoneDensity(
                zone_id="A", zone_name="Test", zone_type=ZoneType.SEATING,
                current_count=100, capacity=100, percentage=1.5,
            )

    def test_surge_prediction_confidence_bounds(self):
        with pytest.raises(ValidationError):
            SurgePrediction(
                zone_id="A", zone_name="Test",
                predicted_percentage=0.5, minutes_until=5,
                confidence=1.5,  # Invalid
            )

    def test_reward_offer_valid(self):
        offer = RewardOffer(
            id="test", zone_id="F1", zone_name="Food",
            description="Test offer", discount_percent=20,
            points=100, duration_minutes=10,
        )
        assert offer.is_active is True


# ── Enum Coverage ─────────────────────────────────────────────────

class TestEnums:
    def test_zone_types(self):
        assert len(ZoneType) == 5

    def test_game_phases(self):
        assert len(GamePhase) == 5

    def test_density_trends(self):
        assert len(DensityTrend) == 3

    def test_density_levels(self):
        assert len(DensityLevel) == 4
