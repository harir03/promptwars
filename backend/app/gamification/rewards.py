"""Rewards engine for crowd redistribution gamification.

Manages point awards, discount offers, and redistribution tracking.
In-memory for hackathon — production would use Firestore.
"""

from __future__ import annotations

import logging
import time
import uuid

from app.crowd.models import RewardOffer, UserRewards

logger = logging.getLogger(__name__)


class RewardsEngine:
    """Manages the gamification layer for crowd redistribution."""

    def __init__(self) -> None:
        # Active offers (offer_id → RewardOffer)
        self._offers: dict[str, RewardOffer] = {}

        # User wallets (user_id → UserRewards)
        self._wallets: dict[str, UserRewards] = {}

        # Offer creation timestamps for expiry tracking
        self._offer_created: dict[str, float] = {}

    def create_offer(
        self,
        zone_id: str,
        zone_name: str,
        discount_percent: int = 20,
        points: int = 100,
        duration_minutes: int = 10,
    ) -> RewardOffer:
        """Create a new redistribution reward offer.

        Args:
            zone_id: Target zone for the offer (uncrowded zone).
            zone_name: Human-readable zone name.
            discount_percent: Discount percentage (0-100).
            points: Bonus points for compliance.
            duration_minutes: How long the offer lasts.

        Returns:
            The created RewardOffer.
        """
        offer_id = f"offer_{uuid.uuid4().hex[:8]}"

        offer = RewardOffer(
            id=offer_id,
            zone_id=zone_id,
            zone_name=zone_name,
            description=f"Visit {zone_name} for reduced crowds",
            discount_percent=discount_percent,
            points=points,
            duration_minutes=duration_minutes,
            remaining_minutes=float(duration_minutes),
            is_active=True,
        )

        self._offers[offer_id] = offer
        self._offer_created[offer_id] = time.time()

        logger.info(
            "Reward offer created: %s — %d%% off + %d pts at %s for %d min",
            offer_id, discount_percent, points, zone_name, duration_minutes,
        )

        return offer

    def get_active_offers(self) -> list[RewardOffer]:
        """Get all currently active offers, updating remaining time."""
        now = time.time()
        active = []

        for offer_id, offer in list(self._offers.items()):
            created = self._offer_created.get(offer_id, now)
            elapsed_min = (now - created) / 60.0
            remaining = offer.duration_minutes - elapsed_min

            if remaining <= 0:
                # Offer expired
                self._offers[offer_id].is_active = False
                continue

            self._offers[offer_id].remaining_minutes = round(remaining, 1)
            active.append(self._offers[offer_id])

        return active

    def award_points(self, user_id: str, points: int, action: str = "") -> UserRewards:
        """Award points to a user.

        Args:
            user_id: The user's identifier.
            points: Number of points to award.
            action: Description of what earned the points.

        Returns:
            Updated UserRewards.
        """
        wallet = self._wallets.setdefault(
            user_id,
            UserRewards(user_id=user_id, points=0),
        )
        wallet.points += points

        logger.info(
            "Awarded %d pts to %s for '%s'. Balance: %d",
            points, user_id, action, wallet.points,
        )

        return wallet

    def get_wallet(self, user_id: str) -> UserRewards:
        """Get a user's reward wallet."""
        return self._wallets.get(
            user_id,
            UserRewards(user_id=user_id, points=0),
        )

    def claim_offer(self, user_id: str, offer_id: str) -> UserRewards | None:
        """Claim a reward offer and credit points.

        Args:
            user_id: The user claiming the offer.
            offer_id: The offer to claim.

        Returns:
            Updated UserRewards, or None if offer not found/expired.
        """
        offer = self._offers.get(offer_id)
        if not offer or not offer.is_active:
            return None

        wallet = self.get_wallet(user_id)

        # Check if already claimed
        if offer_id in wallet.claimed_offers:
            return wallet

        # Award points and record claim
        wallet = self.award_points(user_id, offer.points, f"claimed {offer.zone_name} offer")
        wallet.claimed_offers.append(offer_id)

        return wallet

    async def persist_wallet_async(self, user_id: str) -> bool:
        """Persist a user's wallet to Firestore.

        Called from async contexts (API handlers) to persist wallet
        state to Google Cloud Firestore for durability.

        Args:
            user_id: The user whose wallet to persist.

        Returns:
            True if persisted successfully, False otherwise.
        """
        wallet = self.get_wallet(user_id)
        try:
            from app.services.google_cloud import firestore_save_document

            return await firestore_save_document(
                "wallets",
                user_id,
                {
                    "user_id": wallet.user_id,
                    "points": wallet.points,
                    "claimed_offers": wallet.claimed_offers,
                },
            )
        except Exception:
            # Firestore persistence is best-effort — in-memory is primary
            return False

