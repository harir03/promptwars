"""Admin API routes (protected by passkey).

POST /api/admin/rewards/trigger — Create redistribution offer
POST /api/admin/game/speed — Change simulation speed
POST /api/admin/game/jump — Jump to a specific game minute
POST /api/admin/game/goal — Simulate a goal event
"""

from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.crowd.models import AdminRewardTrigger, RewardOffer

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _verify_passkey(x_admin_key: str | None) -> None:
    """Verify admin passkey from header (P15)."""
    settings = get_settings()
    if not x_admin_key or x_admin_key != settings.admin_passkey:
        raise HTTPException(status_code=403, detail="Invalid admin passkey")


# --- Reward Controls ---

@router.post("/rewards/trigger", response_model=RewardOffer)
async def trigger_reward(
    request: Request,
    body: AdminRewardTrigger,
    x_admin_key: str | None = Header(default=None),
) -> RewardOffer:
    """Create a redistribution reward to shift crowd from congested zones.

    This is the admin's key tool for crowd management.
    Creates a discount/points offer at an uncrowded zone and
    boosts outflow from nearby congested zones (P29).
    """
    _verify_passkey(x_admin_key)

    simulator = request.app.state.simulator
    rewards = request.app.state.rewards_engine
    zone_map = simulator.zone_map

    zone = zone_map.get(body.zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{body.zone_id}' not found")

    # Create the offer
    offer = rewards.create_offer(
        zone_id=body.zone_id,
        zone_name=zone.name,
        discount_percent=body.discount_percent,
        points=body.points,
        duration_minutes=body.duration_minutes,
    )

    # Apply redistribution boost: increase outflow from ADJACENT congested zones
    for adj_id in zone.adjacent_zones:
        adj_zone = zone_map.get(adj_id)
        if adj_zone:
            density = simulator._get_density(adj_zone)
            if density > 0.6:  # Only boost outflow from busy zones
                simulator.apply_reward_boost(adj_id, boost_factor=0.5)

    return offer


# --- Game Controls ---

class SpeedRequest(BaseModel):
    """Request to change simulation speed."""
    speed: float = Field(..., gt=0, le=20, description="Speed multiplier (1-20)")


class JumpRequest(BaseModel):
    """Request to jump to a specific game minute."""
    minute: int = Field(..., ge=-60, le=120, description="Target game minute")


class GoalRequest(BaseModel):
    """Request to simulate a goal event."""
    is_home: bool = Field(default=True, description="True if home team scored")


@router.post("/game/speed")
async def set_speed(
    request: Request,
    body: SpeedRequest,
    x_admin_key: str | None = Header(default=None),
) -> dict:
    """Change the simulation speed (P31)."""
    _verify_passkey(x_admin_key)

    clock = request.app.state.game_clock
    clock.set_speed(body.speed)

    return {"success": True, "new_speed": body.speed}


@router.post("/game/jump")
async def jump_to_minute(
    request: Request,
    body: JumpRequest,
    x_admin_key: str | None = Header(default=None),
) -> dict:
    """Jump to a specific game minute for demo purposes (P31)."""
    _verify_passkey(x_admin_key)

    clock = request.app.state.game_clock
    clock.jump_to_minute(float(body.minute))

    return {"success": True, "jumped_to": body.minute, "phase": clock.phase.value}


@router.post("/game/goal")
async def simulate_goal(
    request: Request,
    body: GoalRequest,
    x_admin_key: str | None = Header(default=None),
) -> dict:
    """Simulate a goal event (triggers crowd freeze)."""
    _verify_passkey(x_admin_key)

    clock = request.app.state.game_clock
    clock.score_goal(is_home=body.is_home)

    return {
        "success": True,
        "home_score": clock.home_score,
        "away_score": clock.away_score,
    }
