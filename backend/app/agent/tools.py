"""Tool functions for the AI concierge agent.

Each tool queries the crowd simulator and returns structured data
that the Gemini agent can use to construct conversational responses.

Parameters use Python enums for strict validation (P8).
"""

from __future__ import annotations

from app.crowd.models import QueueType, ZoneType


def get_crowd_status(simulator, zone_id: str | None = None) -> str:
    """Get current crowd density for a specific zone or all zones.

    Args:
        simulator: The CrowdSimulator instance.
        zone_id: Optional specific zone ID. If None, returns summary.

    Returns:
        Formatted string with crowd status.
    """
    if zone_id:
        zd = simulator.get_zone_density(zone_id)
        if not zd:
            return f"Zone '{zone_id}' not found. Valid zones: {', '.join(simulator.zone_map.keys())}"
        return (
            f"{zd.zone_name}: {zd.percentage:.0%} capacity "
            f"({zd.current_count}/{zd.capacity}), "
            f"status: {zd.level.value}, trend: {zd.trend.value}"
            + (f", wait: {zd.wait_minutes:.0f} min" if zd.wait_minutes > 0 else "")
        )

    # Summary of all zones grouped by type
    snapshot = simulator._build_snapshot()
    lines = []
    for zone_type in [ZoneType.SEATING, ZoneType.FOOD, ZoneType.RESTROOM, ZoneType.GATE]:
        zones = [z for z in snapshot.zones if z.zone_type == zone_type]
        if zones:
            lines.append(f"\n{zone_type.value.upper()} ZONES:")
            for z in zones:
                line = f"  {z.zone_name}: {z.percentage:.0%} ({z.level.value})"
                if z.wait_minutes > 0:
                    line += f" — wait: {z.wait_minutes:.0f} min"
                lines.append(line)

    return "\n".join(lines)


def find_shortest_queue(simulator, queue_type: str) -> str:
    """Find the shortest queue for food or restroom.

    Args:
        simulator: The CrowdSimulator instance.
        queue_type: Must be 'food' or 'restroom'.

    Returns:
        Formatted string with queue rankings.
    """
    # Validate enum (P8)
    try:
        qt = QueueType(queue_type.lower())
    except ValueError:
        valid = ", ".join([q.value for q in QueueType])
        return f"Invalid queue type '{queue_type}'. Valid types: {valid}"

    zone_type = ZoneType.FOOD if qt == QueueType.FOOD else ZoneType.RESTROOM
    results = simulator.find_shortest_queue(zone_type)

    if not results:
        return f"No {qt.value} zones found."

    lines = [f"Shortest {qt.value} queues (best first):"]
    for i, zd in enumerate(results, 1):
        lines.append(
            f"  {i}. {zd.zone_name}: {zd.wait_minutes:.0f} min wait "
            f"({zd.percentage:.0%} full)"
        )

    return "\n".join(lines)


def predict_exit(simulator, predictor, gate_id: str | None = None) -> str:
    """Get exit predictions and recommendations.

    Args:
        simulator: The CrowdSimulator instance.
        predictor: The PredictionEngine instance.
        gate_id: Optional specific gate. If None, returns all gate predictions.

    Returns:
        Formatted string with exit recommendations.
    """
    predictions = predictor.get_predictions()
    gate_preds = [
        p for p in predictions
        if simulator.zone_map.get(p.zone_id, None)
        and simulator.zone_map[p.zone_id].zone_type == ZoneType.GATE
    ]

    if gate_id:
        gate_preds = [p for p in gate_preds if p.zone_id == gate_id]

    if not gate_preds:
        # Fallback: show current gate densities
        lines = ["No surge predictions active. Current gate status:"]
        for zone in simulator.zones:
            if zone.zone_type == ZoneType.GATE:
                zd = simulator.get_zone_density(zone.id)
                if zd:
                    lines.append(f"  {zd.zone_name}: {zd.percentage:.0%} ({zd.level.value})")
        return "\n".join(lines)

    lines = ["Exit predictions:"]
    for p in gate_preds:
        lines.append(
            f"  {p.zone_name}: predicted {p.predicted_percentage:.0%} in {p.minutes_until} min "
            f"(confidence: {p.confidence:.0%})\n"
            f"    → {p.recommendation}"
        )

    return "\n".join(lines)


def get_reward_offers(rewards_engine) -> str:
    """Get currently active reward offers.

    Args:
        rewards_engine: The RewardsEngine instance.

    Returns:
        Formatted string with active offers.
    """
    offers = rewards_engine.get_active_offers()

    if not offers:
        return "No active reward offers right now."

    lines = ["Active reward offers:"]
    for offer in offers:
        desc = f"  🎁 {offer.description}"
        if offer.discount_percent > 0:
            desc += f" ({offer.discount_percent}% off)"
        if offer.points > 0:
            desc += f" (+{offer.points} pts)"
        desc += f" — {offer.remaining_minutes:.0f} min left"
        lines.append(desc)

    return "\n".join(lines)


def locate_friend(friend_id: str = "friend_1") -> str:
    """Simulate locating a friend in the venue.

    In a real system, this would query the wristband/GPS layer.
    For the demo, returns simulated data.

    Args:
        friend_id: Identifier for the friend.

    Returns:
        Formatted string with friend's location.
    """
    # Simulated friend locations
    friends = {
        "friend_1": ("Section E", "Row 12, Seat 8"),
        "friend_2": ("Food Court South", "In queue"),
        "friend_3": ("Gate 4", "Heading to parking"),
    }

    if friend_id in friends:
        section, detail = friends[friend_id]
        return f"Friend '{friend_id}' is at {section} ({detail}). Walking time from Section C: ~4 minutes."

    return f"Friend '{friend_id}' not found in the system. They may not have linked their wristband yet."


# Tool schemas for Gemini function calling
TOOL_SCHEMAS = [
    {
        "name": "get_crowd_status",
        "description": "Get real-time crowd density for a specific zone or all zones in the stadium. Returns percentage capacity, trend, and wait times.",
        "parameters": {
            "type": "object",
            "properties": {
                "zone_id": {
                    "type": "string",
                    "description": "Optional zone ID (e.g., 'F1', 'A', 'G3'). Omit to get all zones.",
                }
            },
        },
    },
    {
        "name": "find_shortest_queue",
        "description": "Find the shortest queue for food or restroom across the stadium. Returns all options ranked by wait time.",
        "parameters": {
            "type": "object",
            "properties": {
                "queue_type": {
                    "type": "string",
                    "enum": ["food", "restroom"],
                    "description": "Type of queue to search for: 'food' or 'restroom'.",
                }
            },
            "required": ["queue_type"],
        },
    },
    {
        "name": "predict_exit",
        "description": "Get exit predictions showing which gates will be congested and when. Returns recommendations for the best time and gate to leave.",
        "parameters": {
            "type": "object",
            "properties": {
                "gate_id": {
                    "type": "string",
                    "description": "Optional specific gate ID (e.g., 'G1'). Omit to get all gate predictions.",
                }
            },
        },
    },
    {
        "name": "get_reward_offers",
        "description": "Get currently active reward offers and discounts. These are incentives for visiting less crowded areas.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "locate_friend",
        "description": "Find the location of a friend or group member in the stadium using their wristband.",
        "parameters": {
            "type": "object",
            "properties": {
                "friend_id": {
                    "type": "string",
                    "description": "The friend's ID or name (e.g., 'friend_1').",
                }
            },
        },
    },
]
