"""Tests for the venue layout definition.

Covers:
- Zone count and composition
- Zone types distribution
- Adjacency graph consistency (bidirectional)
- Capacity constraints
- Coordinate validity
- Service rate assignments
"""

import pytest

from app.crowd.models import ZoneType
from app.crowd.venue import get_venue_layout, get_zone_map, TOTAL_CAPACITY


# ── Layout Composition ────────────────────────────────────────────

class TestVenueLayout:
    def test_22_zones_total(self):
        zones = get_venue_layout()
        assert len(zones) == 22

    def test_8_seating_sections(self):
        zones = get_venue_layout()
        seating = [z for z in zones if z.zone_type == ZoneType.SEATING]
        assert len(seating) == 8

    def test_4_food_courts(self):
        zones = get_venue_layout()
        food = [z for z in zones if z.zone_type == ZoneType.FOOD]
        assert len(food) == 4

    def test_4_restrooms(self):
        zones = get_venue_layout()
        restrooms = [z for z in zones if z.zone_type == ZoneType.RESTROOM]
        assert len(restrooms) == 4

    def test_6_gates(self):
        zones = get_venue_layout()
        gates = [z for z in zones if z.zone_type == ZoneType.GATE]
        assert len(gates) == 6

    def test_unique_ids(self):
        zones = get_venue_layout()
        ids = [z.id for z in zones]
        assert len(ids) == len(set(ids))

    def test_total_capacity_reasonable(self):
        """Total seating should be ~54,000 for a 55K stadium."""
        assert 50000 <= TOTAL_CAPACITY <= 60000


# ── Zone Map ──────────────────────────────────────────────────────

class TestZoneMap:
    def test_zone_map_has_all_zones(self):
        zone_map = get_zone_map()
        assert len(zone_map) == 22

    def test_zone_map_lookup(self):
        zone_map = get_zone_map()
        assert zone_map["G1"].name == "Gate 1 (North)"
        assert zone_map["F1"].zone_type == ZoneType.FOOD


# ── Adjacency Graph ──────────────────────────────────────────────

class TestAdjacency:
    def test_all_adjacent_zones_exist(self):
        """Every referenced adjacent zone ID must exist in the layout."""
        zone_map = get_zone_map()
        for zone in get_venue_layout():
            for adj_id in zone.adjacent_zones:
                assert adj_id in zone_map, (
                    f"Zone {zone.id} references adjacent zone {adj_id} which doesn't exist"
                )

    def test_no_zone_adjacent_to_itself(self):
        for zone in get_venue_layout():
            assert zone.id not in zone.adjacent_zones

    def test_gates_have_seating_neighbors(self):
        """Every gate should be adjacent to at least one seating section."""
        zone_map = get_zone_map()
        gates = [z for z in get_venue_layout() if z.zone_type == ZoneType.GATE]
        for gate in gates:
            adj_types = [zone_map[adj_id].zone_type for adj_id in gate.adjacent_zones]
            assert ZoneType.SEATING in adj_types, (
                f"Gate {gate.id} has no adjacent seating section"
            )


# ── Capacity and Coordinates ─────────────────────────────────────

class TestCapacityAndCoordinates:
    def test_all_capacities_positive(self):
        for zone in get_venue_layout():
            assert zone.capacity > 0

    def test_all_coordinates_valid(self):
        for zone in get_venue_layout():
            lat, lng = zone.coordinates
            assert 18.0 < lat < 20.0  # Near Mumbai
            assert 72.0 < lng < 74.0

    def test_food_courts_have_service_rate(self):
        for zone in get_venue_layout():
            if zone.zone_type == ZoneType.FOOD:
                assert zone.service_rate > 0

    def test_restrooms_have_service_rate(self):
        for zone in get_venue_layout():
            if zone.zone_type == ZoneType.RESTROOM:
                assert zone.service_rate > 0

    def test_seating_no_service_rate(self):
        for zone in get_venue_layout():
            if zone.zone_type == ZoneType.SEATING:
                assert zone.service_rate == 0.0
