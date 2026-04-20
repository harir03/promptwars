"""Crowd data API routes.

GET /api/crowd/snapshot — Full crowd state
GET /api/crowd/zone/{zone_id} — Single zone
GET /api/crowd/predictions — Active surge predictions
GET /api/crowd/queues — All queue wait times

Security:
- OWASP A03: Query parameters validated against allowed set.
- OWASP A05: Error responses never leak internal state or valid IDs.
"""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, HTTPException, Request

from app.crowd.models import CrowdSnapshot, SurgePrediction, ZoneDensity, ZoneType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crowd", tags=["Crowd"])

# OWASP A03: whitelist of allowed queue_type values
ALLOWED_QUEUE_TYPES = {"food", "restroom"}

# OWASP A03: zone_id validation — alphanumeric, 1-20 chars
ZONE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,20}$")


def _validate_zone_id(zone_id: str) -> str:
    """Validate and normalize zone_id input.

    Args:
        zone_id: Raw zone ID from URL path parameter.

    Returns:
        Uppercased, validated zone ID.

    Raises:
        HTTPException: 400 if zone_id format is invalid.
    """
    if not ZONE_ID_PATTERN.match(zone_id):
        raise HTTPException(
            status_code=400, detail="Invalid zone ID format"
        )
    return zone_id.upper()


@router.get("/snapshot", response_model=CrowdSnapshot)
async def get_snapshot(request: Request) -> CrowdSnapshot:
    """Get the current crowd density snapshot for all zones.

    Args:
        request: FastAPI request with app state.

    Returns:
        Full crowd snapshot with all zones and predictions.
    """
    try:
        simulator = request.app.state.simulator
        predictor = request.app.state.predictor
        snapshot = simulator._build_snapshot()
        snapshot.predictions = predictor.get_predictions()
        return snapshot
    except Exception:
        logger.exception("Error building crowd snapshot")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/zone/{zone_id}", response_model=ZoneDensity)
async def get_zone(request: Request, zone_id: str) -> ZoneDensity:
    """Get current density for a single zone.

    Args:
        request: FastAPI request with app state.
        zone_id: Zone identifier from URL path.

    Returns:
        Density data for the requested zone.

    Raises:
        HTTPException: 400 if invalid format, 404 if zone not found.
    """
    # OWASP A03: validate zone_id format before use
    validated_id = _validate_zone_id(zone_id)

    simulator = request.app.state.simulator
    zone_density = simulator.get_zone_density(validated_id)

    if not zone_density:
        # OWASP A05: don't leak valid zone IDs in the error response
        raise HTTPException(
            status_code=404, detail="Zone not found"
        )

    return zone_density


@router.get("/predictions", response_model=list[SurgePrediction])
async def get_predictions(request: Request) -> list[SurgePrediction]:
    """Get active surge predictions.

    Args:
        request: FastAPI request with app state.

    Returns:
        List of currently active surge predictions.
    """
    try:
        predictor = request.app.state.predictor
        return predictor.get_predictions()
    except Exception:
        logger.exception("Error fetching predictions")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/queues", response_model=list[ZoneDensity])
async def get_queues(
    request: Request, queue_type: str = "food"
) -> list[ZoneDensity]:
    """Get queue wait times for food courts or restrooms.

    Args:
        request: FastAPI request with app state.
        queue_type: Must be 'food' or 'restroom'. Validated against whitelist.

    Returns:
        List of zone densities sorted by wait time.

    Raises:
        HTTPException: 400 if queue_type is not in the allowed set.
    """
    # OWASP A03: validate query parameter against whitelist
    normalized_type = queue_type.strip().lower()
    if normalized_type not in ALLOWED_QUEUE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="queue_type must be 'food' or 'restroom'",
        )

    zone_type_map = {"food": ZoneType.FOOD, "restroom": ZoneType.RESTROOM}
    zone_type = zone_type_map[normalized_type]

    try:
        simulator = request.app.state.simulator
        return simulator.find_shortest_queue(zone_type)
    except Exception:
        logger.exception("Error fetching queues")
        raise HTTPException(status_code=500, detail="Internal server error")
