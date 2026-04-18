"""Tests for the RewardsEngine.

Covers:
- Offer creation and uniqueness
- Active offer listing and expiry
- Point awarding
- Wallet management
- Offer claiming (happy path + edge cases)
"""

import time

import pytest

from app.gamification.rewards import RewardsEngine


@pytest.fixture
def engine() -> RewardsEngine:
    return RewardsEngine()


# ── Offer Creation ────────────────────────────────────────────────

class TestOfferCreation:
    def test_create_offer_returns_offer(self, engine: RewardsEngine):
        offer = engine.create_offer(
            zone_id="F1", zone_name="Food Court North",
            discount_percent=20, points=100, duration_minutes=10,
        )
        assert offer.id.startswith("offer_")
        assert offer.zone_id == "F1"
        assert offer.discount_percent == 20
        assert offer.points == 100
        assert offer.is_active is True

    def test_offer_ids_unique(self, engine: RewardsEngine):
        o1 = engine.create_offer("F1", "Food Court North")
        o2 = engine.create_offer("F2", "Food Court East")
        assert o1.id != o2.id

    def test_offer_description_auto_generated(self, engine: RewardsEngine):
        offer = engine.create_offer("F1", "Food Court North")
        assert "Food Court North" in offer.description


# ── Active Offers ─────────────────────────────────────────────────

class TestActiveOffers:
    def test_get_active_offers(self, engine: RewardsEngine):
        engine.create_offer("F1", "Food Court North", duration_minutes=10)
        active = engine.get_active_offers()
        assert len(active) == 1

    def test_no_active_offers_initially(self, engine: RewardsEngine):
        assert len(engine.get_active_offers()) == 0

    def test_remaining_minutes_updates(self, engine: RewardsEngine):
        engine.create_offer("F1", "Food Court North", duration_minutes=10)
        active = engine.get_active_offers()
        assert active[0].remaining_minutes > 0
        assert active[0].remaining_minutes <= 10.0


# ── Points System ─────────────────────────────────────────────────

class TestPoints:
    def test_award_points_new_user(self, engine: RewardsEngine):
        wallet = engine.award_points("user1", 100, "test action")
        assert wallet.points == 100
        assert wallet.user_id == "user1"

    def test_award_points_accumulates(self, engine: RewardsEngine):
        engine.award_points("user1", 100)
        wallet = engine.award_points("user1", 50)
        assert wallet.points == 150

    def test_get_wallet_new_user(self, engine: RewardsEngine):
        wallet = engine.get_wallet("nonexistent")
        assert wallet.user_id == "nonexistent"
        assert wallet.points == 0

    def test_get_wallet_existing_user(self, engine: RewardsEngine):
        engine.award_points("user1", 200)
        wallet = engine.get_wallet("user1")
        assert wallet.points == 200


# ── Claiming Offers ───────────────────────────────────────────────

class TestClaimOffer:
    def test_claim_valid_offer(self, engine: RewardsEngine):
        offer = engine.create_offer("F1", "Food Court North", points=150)
        wallet = engine.claim_offer("user1", offer.id)
        assert wallet is not None
        assert wallet.points == 150
        assert offer.id in wallet.claimed_offers

    def test_claim_nonexistent_offer(self, engine: RewardsEngine):
        result = engine.claim_offer("user1", "fake_offer")
        assert result is None

    def test_double_claim_idempotent(self, engine: RewardsEngine):
        offer = engine.create_offer("F1", "Food Court North", points=150)
        engine.claim_offer("user1", offer.id)
        wallet = engine.claim_offer("user1", offer.id)
        # Points should not double
        assert wallet.points == 150

    def test_claim_expired_offer(self, engine: RewardsEngine):
        offer = engine.create_offer("F1", "Food Court North", duration_minutes=10)
        # Force expiry by backdating creation time
        engine._offer_created[offer.id] = time.time() - 700  # 11+ minutes ago
        # Trigger expiry check
        engine.get_active_offers()
        result = engine.claim_offer("user1", offer.id)
        assert result is None
