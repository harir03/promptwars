"""Notification API routes.

POST /api/notifications/register — Register FCM token
POST /api/notifications/test — Send test notification
GET  /api/rewards/{user_id} — Get user's points wallet
POST /api/rewards/claim — Claim a reward offer
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.crowd.models import NotificationRegister, UserRewards
from app.notifications import fcm

router = APIRouter(tags=["Notifications & Rewards"])


@router.post("/api/notifications/register")
async def register_token(body: NotificationRegister) -> dict:
    """Register an FCM push notification token."""
    fcm.register_token(body.user_id, body.token)
    return {"success": True, "user_id": body.user_id}


@router.post("/api/notifications/test")
async def test_notification(request: Request, user_id: str = "anonymous") -> dict:
    """Send a test push notification (for demo/wristband page).

    Sends a 'food ready' notification with vibration flag.
    """
    success = await fcm.send_notification(
        user_id=user_id,
        title="🍔 Your order is ready!",
        body="Pick up at Food Court East, Counter 3",
        data={"type": "food_ready", "vibrate": "true", "zone_id": "F2"},
    )
    return {"success": success, "simulated": not fcm._firebase_initialized}


@router.get("/api/rewards/{user_id}", response_model=UserRewards)
async def get_rewards(request: Request, user_id: str) -> UserRewards:
    """Get a user's reward wallet (points and claimed offers)."""
    rewards = request.app.state.rewards_engine
    return rewards.get_wallet(user_id)


class ClaimRequest(BaseModel):
    """Claim a reward offer."""
    user_id: str = Field(..., min_length=1)
    offer_id: str = Field(..., min_length=1)


@router.post("/api/rewards/claim", response_model=UserRewards)
async def claim_reward(request: Request, body: ClaimRequest) -> UserRewards:
    """Claim a reward offer and earn points."""
    rewards = request.app.state.rewards_engine
    result = rewards.claim_offer(body.user_id, body.offer_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Offer '{body.offer_id}' not found or expired",
        )

    return result
