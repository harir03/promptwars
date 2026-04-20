"""Admin API routes (protected by passkey).

POST /api/admin/rewards/trigger — Create redistribution offer
POST /api/admin/game/speed — Change simulation speed
POST /api/admin/game/jump — Jump to a specific game minute
POST /api/admin/game/goal — Simulate a goal event

Security:
- OWASP A01: All endpoints require admin passkey via X-Admin-Key header.
- OWASP A07: Timing-safe comparison for passkey validation.
- OWASP A05: Errors return generic messages, never leak internals.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.config import get_settings
from app.crowd.models import AdminRewardTrigger, RewardOffer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def verify_admin_passkey(
    x_admin_key: str | None = Header(default=None),
) -> None:
    """Verify admin passkey from request header.

    Uses secrets.compare_digest for timing-safe comparison
    to prevent timing side-channel attacks.

    Args:
        x_admin_key: The admin key from the X-Admin-Key header.

    Raises:
        HTTPException: 403 if the passkey is missing or invalid.

    Security: OWASP A07 — timing-safe comparison prevents
    length/character leakage via response timing.
    """
    settings = get_settings()

    if not settings.admin_passkey:
        # OWASP A02: if no passkey configured, reject all admin requests
        raise HTTPException(status_code=403, detail="Admin access is not configured")

    if not x_admin_key:
        raise HTTPException(status_code=403, detail="Admin key required")

    # OWASP A07: constant-time comparison to prevent timing attacks
    is_valid = secrets.compare_digest(
        x_admin_key.encode("utf-8"),
        settings.admin_passkey.encode("utf-8"),
    )
    if not is_valid:
        logger.warning("Failed admin authentication attempt")
        raise HTTPException(status_code=403, detail="Invalid admin key")


# --- Pydantic Models ---

class SpeedRequest(BaseModel):
    """Request to change simulation speed."""

    speed: float = Field(
        ..., gt=0, le=20, description="Speed multiplier (1-20)"
    )


class JumpRequest(BaseModel):
    """Request to jump to a specific game minute."""

    minute: int = Field(
        ..., ge=-60, le=120, description="Target game minute"
    )


class GoalRequest(BaseModel):
    """Request to simulate a goal event."""

    is_home: bool = Field(
        default=True, description="True if home team scored"
    )


# --- Routes ---

CROWD_DENSITY_THRESHOLD = 0.6  # Only boost outflow from zones above this


@router.post("/rewards/trigger")
async def trigger_reward(
    request: Request,
    body: AdminRewardTrigger,
    _: None = Depends(verify_admin_passkey),
) -> dict:
    """Create a redistribution reward to shift crowd from congested zones.

    Args:
        request: FastAPI request with app state.
        body: Reward trigger parameters.

    Returns:
        The created reward offer details.

    Raises:
        HTTPException: 404 if zone not found, 403 if auth fails.
    """
    try:
        simulator = request.app.state.simulator
        rewards = request.app.state.rewards_engine
        zone_map = simulator.zone_map

        zone = zone_map.get(body.zone_id)
        if not zone:
            # OWASP A05: don't leak valid zone IDs in error
            raise HTTPException(
                status_code=404, detail="Zone not found"
            )

        offer = rewards.create_offer(
            zone_id=body.zone_id,
            zone_name=zone.name,
            discount_percent=body.discount_percent,
            points=body.points,
            duration_minutes=body.duration_minutes,
        )

        # Apply redistribution: increase outflow from adjacent congested zones
        for adjacent_id in zone.adjacent_zones:
            adjacent_zone = zone_map.get(adjacent_id)
            if not adjacent_zone:
                continue
            density = simulator._get_density(adjacent_zone)
            if density > CROWD_DENSITY_THRESHOLD:
                simulator.apply_reward_boost(adjacent_id, boost_factor=0.5)

        return offer.model_dump(mode="json")

    except HTTPException:
        raise
    except Exception:
        # OWASP A05: log full error server-side, return generic message
        logger.exception("Error in trigger_reward")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/game/speed")
async def set_speed(
    request: Request,
    body: SpeedRequest,
    _: None = Depends(verify_admin_passkey),
) -> dict:
    """Change the simulation speed.

    Args:
        request: FastAPI request with app state.
        body: Speed change parameters.

    Returns:
        Success status with new speed value.
    """
    try:
        clock = request.app.state.game_clock
        clock.set_speed(body.speed)
        return {"success": True, "new_speed": body.speed}
    except Exception:
        logger.exception("Error in set_speed")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/game/jump")
async def jump_to_minute(
    request: Request,
    body: JumpRequest,
    _: None = Depends(verify_admin_passkey),
) -> dict:
    """Jump to a specific game minute for demo purposes.

    Args:
        request: FastAPI request with app state.
        body: Jump parameters with target minute.

    Returns:
        Success status with jumped-to minute and phase.
    """
    try:
        clock = request.app.state.game_clock
        clock.jump_to_minute(float(body.minute))
        return {
            "success": True,
            "jumped_to": body.minute,
            "phase": clock.phase.value,
        }
    except Exception:
        logger.exception("Error in jump_to_minute")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/game/goal")
async def simulate_goal(
    request: Request,
    body: GoalRequest,
    _: None = Depends(verify_admin_passkey),
) -> dict:
    """Simulate a goal event (triggers crowd freeze).

    Args:
        request: FastAPI request with app state.
        body: Goal parameters (home or away).

    Returns:
        Success status with updated scores.
    """
    try:
        clock = request.app.state.game_clock
        clock.score_goal(is_home=body.is_home)
        return {
            "success": True,
            "home_score": clock.home_score,
            "away_score": clock.away_score,
        }
    except Exception:
        logger.exception("Error in simulate_goal")
        raise HTTPException(status_code=500, detail="Internal server error")
