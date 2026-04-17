"""DY Patil Stadium venue layout definition.

Defines all 22 zones with their types, capacities, coordinates,
adjacency graph, and service rates. Based on DY Patil Stadium,
Navi Mumbai (55,000 capacity).

Coordinates are centered at 19.0154°N, 73.0367°E.
"""

from __future__ import annotations

from app.crowd.models import VenueZone, ZoneType

# Stadium center coordinates
STADIUM_LAT = 19.0154
STADIUM_LNG = 73.0367

# Offset helper for placing zones around the stadium ring
def _offset(lat_off: float, lng_off: float) -> tuple[float, float]:
    """Create coordinates offset from stadium center."""
    return (STADIUM_LAT + lat_off, STADIUM_LNG + lng_off)


def get_venue_layout() -> list[VenueZone]:
    """Return the complete venue layout for DY Patil Stadium.

    Layout:
                    G1
                A        B
           G6   F1/R1       G2
                H        C
           G5   F4/R4   F2/R2   G3
                G        D
                    F        E
                        G4

    22 zones total: 8 seating + 4 food + 4 restroom + 6 gates
    """
    zones = [
        # === SEATING SECTIONS (8) — ~6,500 each ===
        VenueZone(
            id="A", name="Section A", zone_type=ZoneType.SEATING,
            capacity=6500, coordinates=_offset(0.003, -0.001),
            adjacent_zones=["B", "H", "G1", "G6", "F1"],
        ),
        VenueZone(
            id="B", name="Section B", zone_type=ZoneType.SEATING,
            capacity=6500, coordinates=_offset(0.003, 0.001),
            adjacent_zones=["A", "C", "G1", "G2", "F1"],
        ),
        VenueZone(
            id="C", name="Section C", zone_type=ZoneType.SEATING,
            capacity=7000, coordinates=_offset(0.001, 0.003),
            adjacent_zones=["B", "D", "G2", "G3", "F2", "R1"],
        ),
        VenueZone(
            id="D", name="Section D", zone_type=ZoneType.SEATING,
            capacity=7000, coordinates=_offset(-0.001, 0.003),
            adjacent_zones=["C", "E", "G3", "F2"],
        ),
        VenueZone(
            id="E", name="Section E", zone_type=ZoneType.SEATING,
            capacity=7000, coordinates=_offset(-0.003, 0.001),
            adjacent_zones=["D", "F", "G3", "G4", "F3"],
        ),
        VenueZone(
            id="F", name="Section F", zone_type=ZoneType.SEATING,
            capacity=7000, coordinates=_offset(-0.003, -0.001),
            adjacent_zones=["E", "G", "G4", "G5", "F3"],
        ),
        VenueZone(
            id="G", name="Section G", zone_type=ZoneType.SEATING,
            capacity=6500, coordinates=_offset(-0.001, -0.003),
            adjacent_zones=["F", "H", "G5", "F4", "R4"],
        ),
        VenueZone(
            id="H", name="Section H", zone_type=ZoneType.SEATING,
            capacity=6500, coordinates=_offset(0.001, -0.003),
            adjacent_zones=["G", "A", "G5", "G6", "F4"],
        ),

        # === FOOD COURTS (4) — ~300 serving capacity each ===
        VenueZone(
            id="F1", name="Food Court North", zone_type=ZoneType.FOOD,
            capacity=300, coordinates=_offset(0.002, 0.0),
            adjacent_zones=["A", "B", "R1"],
            service_rate=15.0,  # 15 people served per minute
        ),
        VenueZone(
            id="F2", name="Food Court East", zone_type=ZoneType.FOOD,
            capacity=300, coordinates=_offset(0.0, 0.002),
            adjacent_zones=["C", "D", "R2"],
            service_rate=15.0,
        ),
        VenueZone(
            id="F3", name="Food Court South", zone_type=ZoneType.FOOD,
            capacity=300, coordinates=_offset(-0.002, 0.0),
            adjacent_zones=["E", "F", "R3"],
            service_rate=15.0,
        ),
        VenueZone(
            id="F4", name="Food Court West", zone_type=ZoneType.FOOD,
            capacity=300, coordinates=_offset(0.0, -0.002),
            adjacent_zones=["G", "H", "R4"],
            service_rate=15.0,
        ),

        # === RESTROOMS (4) — ~150 capacity each ===
        VenueZone(
            id="R1", name="Restroom North", zone_type=ZoneType.RESTROOM,
            capacity=150, coordinates=_offset(0.0018, 0.0008),
            adjacent_zones=["F1", "B", "C"],
            service_rate=20.0,  # 20 people served per minute
        ),
        VenueZone(
            id="R2", name="Restroom East", zone_type=ZoneType.RESTROOM,
            capacity=150, coordinates=_offset(0.0008, 0.0018),
            adjacent_zones=["F2", "C", "D"],
            service_rate=20.0,
        ),
        VenueZone(
            id="R3", name="Restroom South", zone_type=ZoneType.RESTROOM,
            capacity=150, coordinates=_offset(-0.0018, 0.0008),
            adjacent_zones=["F3", "E", "F"],
            service_rate=20.0,
        ),
        VenueZone(
            id="R4", name="Restroom West", zone_type=ZoneType.RESTROOM,
            capacity=150, coordinates=_offset(-0.0008, -0.0018),
            adjacent_zones=["F4", "G", "H"],
            service_rate=20.0,
        ),

        # === GATES (6) — ~2,000 throughput/hr each ===
        VenueZone(
            id="G1", name="Gate 1 (North)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(0.004, 0.0),
            adjacent_zones=["A", "B"],
        ),
        VenueZone(
            id="G2", name="Gate 2 (Northeast)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(0.002, 0.004),
            adjacent_zones=["B", "C"],
        ),
        VenueZone(
            id="G3", name="Gate 3 (East)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(-0.002, 0.004),
            adjacent_zones=["D", "E"],
        ),
        VenueZone(
            id="G4", name="Gate 4 (South)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(-0.004, 0.0),
            adjacent_zones=["E", "F"],
        ),
        VenueZone(
            id="G5", name="Gate 5 (Southwest)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(-0.002, -0.004),
            adjacent_zones=["F", "G", "H"],
        ),
        VenueZone(
            id="G6", name="Gate 6 (West)", zone_type=ZoneType.GATE,
            capacity=2000, coordinates=_offset(0.002, -0.004),
            adjacent_zones=["H", "A"],
        ),
    ]

    return zones


def get_zone_map() -> dict[str, VenueZone]:
    """Return a dict of zone_id → VenueZone for quick lookup."""
    return {zone.id: zone for zone in get_venue_layout()}


# Total stadium capacity
TOTAL_CAPACITY = sum(z.capacity for z in get_venue_layout() if z.zone_type == ZoneType.SEATING)
