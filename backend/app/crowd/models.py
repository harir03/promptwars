"""Domain models for the crowd intelligence system.

All data structures are Pydantic models with strict validation.
These models are shared between the simulator, API, and WebSocket layers.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# --- Enums ---

class ZoneType(str, Enum):
    """Types of zones in the venue."""
    SEATING = "seating"
    FOOD = "food"
    RESTROOM = "restroom"
    GATE = "gate"
    PARKING = "parking"


class GamePhase(str, Enum):
    """Phases of a match."""
    PRE_MATCH = "pre_match"
    FIRST_HALF = "first_half"
    HALFTIME = "halftime"
    SECOND_HALF = "second_half"
    POST_MATCH = "post_match"


class DensityTrend(str, Enum):
    """Direction of crowd density change."""
    RISING = "rising"
    FALLING = "falling"
    STABLE = "stable"


class DensityLevel(str, Enum):
    """Human-readable density levels with accessibility labels."""
    CLEAR = "clear"          # 0-40%   — Green  ✅
    MODERATE = "moderate"    # 40-70%  — Yellow ⚠️
    BUSY = "busy"            # 70-85%  — Orange 🔶
    PACKED = "packed"        # 85-100% — Red    🚫


class QueueType(str, Enum):
    """Types of queues available at the venue."""
    FOOD = "food"
    RESTROOM = "restroom"


# --- Zone Models ---

class VenueZone(BaseModel):
    """A single zone in the venue layout."""
    id: str = Field(..., description="Unique zone identifier (e.g., 'F1', 'A', 'G3')")
    name: str = Field(..., description="Human-readable name")
    zone_type: ZoneType
    capacity: int = Field(..., gt=0, description="Maximum comfortable occupancy")
    coordinates: tuple[float, float] = Field(..., description="Lat/lng for heatmap placement")
    adjacent_zones: list[str] = Field(default_factory=list, description="IDs of neighboring zones")
    service_rate: float = Field(
        default=0.0,
        ge=0,
        description="People served per minute (food/restroom only)"
    )


class ZoneDensity(BaseModel):
    """Current density state for a single zone."""
    zone_id: str
    zone_name: str
    zone_type: ZoneType
    current_count: int = Field(..., ge=0)
    capacity: int = Field(..., gt=0)
    percentage: float = Field(..., ge=0.0, le=1.0, description="Density as 0.0-1.0")
    trend: DensityTrend = DensityTrend.STABLE
    wait_minutes: float = Field(default=0.0, ge=0.0, description="Estimated queue wait time")
    level: DensityLevel = DensityLevel.CLEAR

    @staticmethod
    def compute_level(percentage: float) -> DensityLevel:
        """Determine density level from percentage."""
        if percentage < 0.4:
            return DensityLevel.CLEAR
        elif percentage < 0.7:
            return DensityLevel.MODERATE
        elif percentage < 0.85:
            return DensityLevel.BUSY
        else:
            return DensityLevel.PACKED


# --- Snapshot Models ---

class GameState(BaseModel):
    """Current state of the match."""
    minute: int = Field(default=0, ge=-60, description="Current game minute (-60 = 1hr before)")
    phase: GamePhase = GamePhase.PRE_MATCH
    home_score: int = Field(default=0, ge=0)
    away_score: int = Field(default=0, ge=0)
    speed_multiplier: float = Field(default=1.0, gt=0)
    is_paused: bool = False

    @property
    def score_margin(self) -> int:
        """Absolute score difference."""
        return abs(self.home_score - self.away_score)


class CrowdSnapshot(BaseModel):
    """Complete crowd state broadcast via WebSocket every tick."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    server_timestamp: float = Field(
        default=0.0,
        description="Server epoch time for client sync (P5)"
    )
    game_state: GameState
    zones: list[ZoneDensity] = Field(default_factory=list)
    total_attendance: int = Field(default=0, ge=0)
    predictions: list[SurgePrediction] = Field(default_factory=list)


# --- Prediction Models ---

class SurgePrediction(BaseModel):
    """A surge forecast for a specific zone or gate."""
    zone_id: str
    zone_name: str
    predicted_percentage: float = Field(..., ge=0.0, le=1.0)
    minutes_until: int = Field(..., ge=0, description="Minutes until predicted surge")
    confidence: float = Field(..., ge=0.0, le=1.0)
    recommendation: str = Field(default="", description="What to do about it")


# --- Agent Models ---

class ChatRequest(BaseModel):
    """Incoming chat message to the AI concierge."""
    message: str = Field(..., min_length=1, max_length=1000)
    session_id: str = Field(..., min_length=1, max_length=100)
    seat_section: str = Field(default="C", max_length=10)


class ChatResponse(BaseModel):
    """AI concierge response."""
    response: str
    suggestions: list[str] = Field(default_factory=list)
    is_fallback: bool = Field(default=False, description="True if Gemini was unavailable")


# --- Rewards Models ---

class RewardOffer(BaseModel):
    """An active reward offer for crowd redistribution."""
    id: str
    zone_id: str
    zone_name: str
    description: str
    discount_percent: int = Field(default=0, ge=0, le=100)
    points: int = Field(default=0, ge=0)
    duration_minutes: int = Field(default=10, gt=0)
    remaining_minutes: float = Field(default=10.0, ge=0)
    is_active: bool = True


class UserRewards(BaseModel):
    """A user's reward wallet."""
    user_id: str
    points: int = Field(default=0, ge=0)
    claimed_offers: list[str] = Field(default_factory=list)


# --- Notification Models ---

class NotificationRegister(BaseModel):
    """Register an FCM token for push notifications."""
    token: str = Field(..., min_length=10, max_length=500)
    user_id: str = Field(default="anonymous", max_length=100)


class AdminRewardTrigger(BaseModel):
    """Admin trigger for a redistribution reward."""
    zone_id: str = Field(..., min_length=1)
    discount_percent: int = Field(default=20, ge=0, le=100)
    points: int = Field(default=100, ge=0)
    duration_minutes: int = Field(default=10, gt=0, le=60)


# Forward reference update for CrowdSnapshot
CrowdSnapshot.model_rebuild()
