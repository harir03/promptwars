"""Notification API routes.

POST /api/notifications/register — Register FCM token
POST /api/notifications/test — Send test notification
GET  /api/rewards/{user_id} — Get user's points wallet
POST /api/rewards/claim — Claim a reward offer

Security:
- OWASP A03: All inputs validated via Pydantic models.
- OWASP A05: Internal state never exposed in responses.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.crowd.models import NotificationRegister, UserRewards
from app.notifications import fcm

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Notifications & Rewards"])

# OWASP A03: user_id validation — alphanumeric + underscores, 1-64 chars
USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")


def _validate_user_id(user_id: str) -> str:
    """Validate user_id format.

    Args:
        user_id: Raw user ID from request.

    Returns:
        Validated user ID.

    Raises:
        HTTPException: 400 if format is invalid.
    """
    if not USER_ID_PATTERN.match(user_id):
        raise HTTPException(
            status_code=400, detail="Invalid user ID format"
        )
    return user_id


@router.post("/api/notifications/register")
async def register_token(body: NotificationRegister) -> dict:
    """Register an FCM push notification token.

    Args:
        body: Registration request with user_id and FCM token.

    Returns:
        Success status.
    """
    try:
        fcm.register_token(body.user_id, body.token)
        return {"success": True}
    except Exception:
        logger.exception("Error registering FCM token")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/api/notifications/test")
async def test_notification(
    request: Request, user_id: str = "anonymous"
) -> dict:
    """Send a test push notification (for demo/wristband page).

    Args:
        request: FastAPI request.
        user_id: Target user ID for the notification.

    Returns:
        Success status (does not expose internal Firebase state).
    """
    # OWASP A03: validate user_id query parameter
    validated_id = _validate_user_id(user_id)

    try:
        success = await fcm.send_notification(
            user_id=validated_id,
            title="🍔 Your order is ready!",
            body="Pick up at Food Court East, Counter 3",
            data={"type": "food_ready", "vibrate": "true", "zone_id": "F2"},
        )
        # OWASP A05: don't expose internal _firebase_initialized state
        return {"success": success}
    except Exception:
        logger.exception("Error sending test notification")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/rewards/{user_id}", response_model=UserRewards)
async def get_rewards(request: Request, user_id: str) -> UserRewards:
    """Get a user's reward wallet (points and claimed offers).

    Args:
        request: FastAPI request with app state.
        user_id: Target user identifier.

    Returns:
        User's reward wallet with points balance.
    """
    validated_id = _validate_user_id(user_id)

    try:
        rewards = request.app.state.rewards_engine
        return rewards.get_wallet(validated_id)
    except Exception:
        logger.exception("Error fetching rewards wallet")
        raise HTTPException(status_code=500, detail="Internal server error")


class ClaimRequest(BaseModel):
    """Request to claim a reward offer.

    Attributes:
        user_id: The claiming user's identifier.
        offer_id: The reward offer to claim.
    """

    user_id: str = Field(..., min_length=1, max_length=64)
    offer_id: str = Field(..., min_length=1, max_length=64)


@router.post("/api/rewards/claim", response_model=UserRewards)
async def claim_reward(request: Request, body: ClaimRequest) -> UserRewards:
    """Claim a reward offer and earn points.

    Args:
        request: FastAPI request with app state.
        body: Claim request with user_id and offer_id.

    Returns:
        Updated user reward wallet.

    Raises:
        HTTPException: 404 if offer not found, 500 on internal error.
    """
    try:
        rewards = request.app.state.rewards_engine
        result = rewards.claim_offer(body.user_id, body.offer_id)

        if result is None:
            # OWASP A05: don't leak offer_id in error detail
            raise HTTPException(
                status_code=404, detail="Offer not found or expired"
            )

        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error claiming reward")
        raise HTTPException(status_code=500, detail="Internal server error")
