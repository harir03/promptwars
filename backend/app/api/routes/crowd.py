"""Crowd data API routes.

GET /api/crowd/snapshot — Full crowd state
GET /api/crowd/zone/{zone_id} — Single zone
GET /api/crowd/predictions — Active surge predictions
GET /api/crowd/queues — All queue wait times
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.crowd.models import CrowdSnapshot, ZoneDensity, SurgePrediction, ZoneType

router = APIRouter(prefix="/api/crowd", tags=["Crowd"])


@router.get("/snapshot", response_model=CrowdSnapshot)
async def get_snapshot(request: Request) -> CrowdSnapshot:
    """Get the current crowd density snapshot for all zones."""
    simulator = request.app.state.simulator
    predictor = request.app.state.predictor

    snapshot = simulator._build_snapshot()
    snapshot.predictions = predictor.get_predictions()

    return snapshot


@router.get("/zone/{zone_id}", response_model=ZoneDensity)
async def get_zone(request: Request, zone_id: str) -> ZoneDensity:
    """Get current density for a single zone."""
    simulator = request.app.state.simulator
    zd = simulator.get_zone_density(zone_id.upper())

    if not zd:
        valid_ids = ", ".join(simulator.zone_map.keys())
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found. Valid zones: {valid_ids}",
        )

    return zd


@router.get("/predictions", response_model=list[SurgePrediction])
async def get_predictions(request: Request) -> list[SurgePrediction]:
    """Get active surge predictions."""
    predictor = request.app.state.predictor
    return predictor.get_predictions()


@router.get("/queues", response_model=list[ZoneDensity])
async def get_queues(request: Request, queue_type: str = "food") -> list[ZoneDensity]:
    """Get queue wait times for food courts or restrooms.

    Args:
        queue_type: 'food' or 'restroom'.
    """
    simulator = request.app.state.simulator

    if queue_type.lower() == "food":
        zt = ZoneType.FOOD
    elif queue_type.lower() == "restroom":
        zt = ZoneType.RESTROOM
    else:
        raise HTTPException(
            status_code=400,
            detail="queue_type must be 'food' or 'restroom'",
        )

    return simulator.find_shortest_queue(zt)
