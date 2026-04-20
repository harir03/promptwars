# Coverage target: 70%+ | External calls: all mocked | Test types: unit, integration, error-path
# Run: pytest tests/ --cov=app --cov-report=term-missing --ignore=tests/test_simulator.py
"""Comprehensive tests for the CrowdSimulator.

Covers: initialization, tick simulation, density clamping, trend detection,
queue wait times, zone density lookup, find_shortest_queue, reward boosts.
"""

import pytest

from app.crowd.game_clock import GameClock
from app.crowd.models import (
    DensityLevel,
    DensityTrend,
    GamePhase,
    ZoneType,
)
from app.crowd.simulator import CrowdSimulator


@pytest.fixture
def simulator() -> CrowdSimulator:
    """Create a fresh simulator for each test."""
    clock = GameClock(speed_multiplier=1.0)
    return CrowdSimulator(game_clock=clock)


class TestSimulatorInitialization:
    """Tests for CrowdSimulator.__init__ and _seed_initial_crowd."""

    def test_initialization_creates_22_zones(self, simulator: CrowdSimulator):
        assert len(simulator.zones) == 22

    def test_initialization_populates_zone_map_with_all_zone_ids(self, simulator: CrowdSimulator):
        for zone in simulator.zones:
            assert zone.id in simulator.zone_map

    def test_initial_crowd_seeded_at_gates(self, simulator: CrowdSimulator):
        gate_ids = [z.id for z in simulator.zones if z.zone_type == ZoneType.GATE]
        total_at_gates = sum(simulator.population[gid] for gid in gate_ids)
        assert total_at_gates == pytest.approx(55000.0, abs=1.0)

    def test_non_gate_zones_start_empty(self, simulator: CrowdSimulator):
        non_gate = [z for z in simulator.zones if z.zone_type != ZoneType.GATE]
        for zone in non_gate:
            assert simulator.population[zone.id] == 0.0

    def test_queue_length_initialized_for_food_and_restroom_zones(self, simulator: CrowdSimulator):
        service_zones = [
            z for z in simulator.zones
            if z.zone_type in (ZoneType.FOOD, ZoneType.RESTROOM)
        ]
        for zone in service_zones:
            assert zone.id in simulator.queue_length


class TestSimulatorTick:
    """Tests for CrowdSimulator.tick() simulation advancement."""

    def test_tick_returns_crowd_snapshot_with_22_zones(self, simulator: CrowdSimulator):
        snapshot = simulator.tick()
        assert len(snapshot.zones) == 22
        assert snapshot.total_attendance > 0

    def test_tick_moves_people_from_gates_to_seating_during_prematch(self, simulator: CrowdSimulator):
        """During pre-match, gates outflow to seating — population should shift."""
        initial_gate_pop = sum(
            simulator.population[z.id] for z in simulator.zones
            if z.zone_type == ZoneType.GATE
        )
        # Run several ticks to allow movement
        for _ in range(10):
            simulator.tick()

        new_gate_pop = sum(
            simulator.population[z.id] for z in simulator.zones
            if z.zone_type == ZoneType.GATE
        )
        seating_pop = sum(
            simulator.population[z.id] for z in simulator.zones
            if z.zone_type == ZoneType.SEATING
        )
        assert new_gate_pop < initial_gate_pop
        assert seating_pop > 0

    def test_tick_does_not_crash_at_goal_freeze(self, simulator: CrowdSimulator):
        """When a goal freeze is active, tick should return snapshot without movement."""
        simulator.clock.score_goal(is_home=True)
        snapshot = simulator.tick()
        assert snapshot is not None
        assert snapshot.game_state.home_score == 1

    def test_tick_density_always_clamped_between_0_and_1(self, simulator: CrowdSimulator):
        for _ in range(20):
            snapshot = simulator.tick()
        for zone_density in snapshot.zones:
            assert 0.0 <= zone_density.percentage <= 1.0

    def test_tick_snapshot_has_server_timestamp(self, simulator: CrowdSimulator):
        snapshot = simulator.tick()
        assert snapshot.server_timestamp > 0


class TestDensityCalculation:
    """Tests for _get_density, _get_trend, and compute_level."""

    def test_get_density_returns_zero_for_empty_zone(self, simulator: CrowdSimulator):
        zone = simulator.zones[0]
        simulator.population[zone.id] = 0.0
        assert simulator._get_density(zone) == 0.0

    def test_get_density_clamps_at_1_for_over_capacity(self, simulator: CrowdSimulator):
        zone = simulator.zones[0]
        simulator.population[zone.id] = zone.capacity * 2.0
        assert simulator._get_density(zone) == 1.0

    def test_get_trend_returns_rising_for_increasing_density(self, simulator: CrowdSimulator):
        zone = simulator.zones[0]
        simulator._prev_density[zone.id] = 0.3
        assert simulator._get_trend(zone.id, 0.5) == DensityTrend.RISING

    def test_get_trend_returns_falling_for_decreasing_density(self, simulator: CrowdSimulator):
        zone = simulator.zones[0]
        simulator._prev_density[zone.id] = 0.7
        assert simulator._get_trend(zone.id, 0.4) == DensityTrend.FALLING

    def test_get_trend_returns_stable_for_small_change(self, simulator: CrowdSimulator):
        zone = simulator.zones[0]
        simulator._prev_density[zone.id] = 0.5
        assert simulator._get_trend(zone.id, 0.51) == DensityTrend.STABLE


class TestGetZoneDensity:
    """Tests for CrowdSimulator.get_zone_density single-zone lookup."""

    def test_get_zone_density_returns_data_for_valid_zone(self, simulator: CrowdSimulator):
        result = simulator.get_zone_density("G1")
        assert result is not None
        assert result.zone_id == "G1"

    def test_get_zone_density_returns_none_for_invalid_zone(self, simulator: CrowdSimulator):
        assert simulator.get_zone_density("NONEXISTENT") is None

    def test_get_zone_density_returns_none_for_empty_string(self, simulator: CrowdSimulator):
        assert simulator.get_zone_density("") is None


class TestFindShortestQueue:
    """Tests for CrowdSimulator.find_shortest_queue."""

    def test_find_shortest_queue_returns_4_food_zones(self, simulator: CrowdSimulator):
        results = simulator.find_shortest_queue(ZoneType.FOOD)
        assert len(results) == 4

    def test_find_shortest_queue_results_sorted_by_wait_time(self, simulator: CrowdSimulator):
        results = simulator.find_shortest_queue(ZoneType.FOOD)
        wait_times = [zd.wait_minutes for zd in results]
        assert wait_times == sorted(wait_times)

    def test_find_shortest_queue_returns_4_restroom_zones(self, simulator: CrowdSimulator):
        results = simulator.find_shortest_queue(ZoneType.RESTROOM)
        assert len(results) == 4


class TestRewardBoosts:
    """Tests for reward-triggered redistribution boosts."""

    def test_apply_reward_boost_stores_boost_factor(self, simulator: CrowdSimulator):
        simulator.apply_reward_boost("G1", boost_factor=0.5)
        assert simulator._reward_boosts["G1"] == 0.5

    def test_apply_reward_boost_ignores_invalid_zone(self, simulator: CrowdSimulator):
        simulator.apply_reward_boost("INVALID", boost_factor=0.5)
        assert "INVALID" not in simulator._reward_boosts

    def test_clear_reward_boost_removes_boost(self, simulator: CrowdSimulator):
        simulator.apply_reward_boost("G1", boost_factor=0.5)
        simulator.clear_reward_boost("G1")
        assert "G1" not in simulator._reward_boosts

    def test_clear_reward_boost_no_error_for_missing_zone(self, simulator: CrowdSimulator):
        simulator.clear_reward_boost("NONEXISTENT")  # Should not raise
