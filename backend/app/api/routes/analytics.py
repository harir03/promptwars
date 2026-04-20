"""Analytics API routes with Google Cloud integration.

GET  /api/analytics/snapshot — Current crowd analytics summary
POST /api/analytics/export  — Export analytics to Cloud Storage / Firestore
GET  /api/analytics/history  — Retrieve stored analytics from Firestore

Google Services: Firestore for analytics persistence, Cloud Logging for audit.
"""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


class AnalyticsSnapshot(BaseModel):
    """Current analytics data point."""

    timestamp: float = Field(default_factory=time.time)
    total_attendance: int = 0
    zone_count: int = 0
    active_predictions: int = 0
    avg_density: float = 0.0
    peak_zone: str = ""
    peak_density: float = 0.0
    active_offers: int = 0


class AnalyticsExportResponse(BaseModel):
    """Response from analytics export."""

    exported: bool
    storage: str  # "firestore" or "local"
    doc_id: str = ""


@router.get("/snapshot", response_model=AnalyticsSnapshot)
async def get_analytics_snapshot(request: Request) -> AnalyticsSnapshot:
    """Get current crowd analytics summary.

    Aggregates real-time crowd data into a single analytics snapshot.

    Args:
        request: FastAPI request with app state.

    Returns:
        AnalyticsSnapshot with current metrics.
    """
    try:
        simulator = request.app.state.simulator
        predictor = request.app.state.predictor
        rewards = request.app.state.rewards_engine

        snapshot = simulator._build_snapshot()
        zones = snapshot.zones

        # Compute analytics
        densities = [z.density for z in zones]
        peak_zone_data = max(zones, key=lambda z: z.density) if zones else None

        return AnalyticsSnapshot(
            timestamp=time.time(),
            total_attendance=snapshot.total_attendance,
            zone_count=len(zones),
            active_predictions=len(predictor.get_predictions()),
            avg_density=sum(densities) / len(densities) if densities else 0.0,
            peak_zone=peak_zone_data.zone_id if peak_zone_data else "",
            peak_density=peak_zone_data.density if peak_zone_data else 0.0,
            active_offers=len(rewards.get_active_offers()),
        )
    except Exception:
        logger.exception("Error computing analytics snapshot")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/export", response_model=AnalyticsExportResponse)
async def export_analytics(request: Request) -> AnalyticsExportResponse:
    """Export current analytics snapshot to Firestore.

    Persists the current crowd state to Google Cloud Firestore
    for historical analytics and trend analysis.

    Google Services: Uses Firestore for persistent storage.

    Args:
        request: FastAPI request with app state.

    Returns:
        AnalyticsExportResponse with export status.
    """
    try:
        simulator = request.app.state.simulator
        snapshot = simulator._build_snapshot()

        # Build export data
        doc_id = f"export_{int(time.time())}"
        export_data = {
            "timestamp": time.time(),
            "total_attendance": snapshot.total_attendance,
            "zone_count": len(snapshot.zones),
            "zones": [
                {
                    "zone_id": z.zone_id,
                    "zone_name": z.zone_name,
                    "density": z.density,
                    "crowd_count": z.crowd_count,
                }
                for z in snapshot.zones
            ],
        }

        # Try Firestore first, fall back to local logging
        from app.services.google_cloud import firestore_save_document

        saved = await firestore_save_document("analytics_exports", doc_id, export_data)

        if saved:
            logger.info("Analytics exported to Firestore: %s", doc_id)
            return AnalyticsExportResponse(
                exported=True, storage="firestore", doc_id=doc_id,
            )
        else:
            # Firestore unavailable — log locally
            logger.info("Analytics export (local): %s zones, %d attendees",
                        len(snapshot.zones), snapshot.total_attendance)
            return AnalyticsExportResponse(
                exported=True, storage="local", doc_id=doc_id,
            )

    except Exception:
        logger.exception("Error exporting analytics")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/history")
async def get_analytics_history(request: Request, limit: int = 10) -> dict:
    """Retrieve stored analytics snapshots from Firestore.

    Google Services: Reads from Firestore collection.

    Args:
        request: FastAPI request with app state.
        limit: Maximum number of records to return (1-100).

    Returns:
        Dict with list of historical analytics snapshots.
    """
    # Validate limit
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")

    from app.services.google_cloud import get_firestore_client

    client = get_firestore_client()
    if client is None:
        return {"snapshots": [], "source": "unavailable"}

    try:
        collection = client.collection("analytics_exports")
        query = collection.order_by(
            "timestamp", direction="DESCENDING"
        ).limit(limit)
        docs = query.stream()

        snapshots = []
        async for doc in docs:
            snapshots.append(doc.to_dict())

        return {"snapshots": snapshots, "source": "firestore"}
    except Exception:
        logger.exception("Error reading analytics history from Firestore")
        return {"snapshots": [], "source": "error"}
