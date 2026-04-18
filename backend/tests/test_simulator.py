"""Comprehensive tests for the CrowdSimulator.

Tests cover:
- Initialization and zone seeding
- Tick mechanics and crowd movement
- Density clamping (0.0-1.0)
- Phase-based transitions
- Goal freeze behavior
- Reward boost application
- Snapshot building
- Queue wait times
- Zone density lookup
- Shortest queue finding
"""

import pytest

from app.crowd.game_clock import GameClock
from app.crowd.simulator import CrowdSimulator
from app.crowd.models import GamePhase, ZoneType, DensityLevel, DensityTrend


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def clock() -> GameClock:
    """A fresh game clock at default speed."""
    return GameClock(speed_multiplier=1.0)


@pytest.fixture
def fast_clock() -> GameClock:
    """A game clock at 9x speed for fast-forward tests."""
    return GameClock(speed_multiplier=9.0)


@pytest.fixture
def sim(clock: GameClock) -> CrowdSimulator:
    """A fresh simulator with default clock."""
    return CrowdSimulator(game_clock=clock)


@pytest.fixture
def fast_sim(fast_clock: GameClock) -> CrowdSimulator:
    """A simulator at 9x speed."""
    return CrowdSimulator(game_clock=fast_clock)


# ── Initialization Tests ─────────────────────────────────────────

class TestSimulatorInit:
    def test_creates_22_zones(self, sim: CrowdSimulator):
        assert len(sim.zones) == 22

    def test_zone_map_matches_zones(self, sim: CrowdSimulator):
        assert len(sim.zone_map) == 22
        for zone in sim.zones:
            assert zone.id in sim.zone_map

    def test_initial_crowd_at_gates(self, sim: CrowdSimulator):
        """55,000 people should be seeded across 6 gates."""
        gate_pop = sum(
            sim.population[z.id] for z in sim.zones
            if z.zone_type == ZoneType.GATE
        )
        assert gate_pop == pytest.approx(55000.0, rel=0.01)

    def test_non_gate_zones_empty(self, sim: CrowdSimulator):
        """Non-gate zones should start at 0 population."""
        for zone in sim.zones:
            if zone.zone_type != ZoneType.GATE:
                assert sim.population[zone.id] == 0.0

    def test_departed_starts_zero(self, sim: CrowdSimulator):
        assert sim.departed == 0.0

    def test_queue_tracking_initialized(self, sim: CrowdSimulator):
        food_restroom_ids = [
            z.id for z in sim.zones
            if z.zone_type in (ZoneType.FOOD, ZoneType.RESTROOM)
        ]
        assert len(sim.queue_length) == len(food_restroom_ids)
        for zone_id in food_restroom_ids:
            assert zone_id in sim.queue_length


# ── Tick Mechanics ────────────────────────────────────────────────

class TestTick:
    def test_tick_returns_snapshot(self, sim: CrowdSimulator):
        snapshot = sim.tick()
        assert snapshot is not None
        assert hasattr(snapshot, "zones")
        assert hasattr(snapshot, "game_state")
        assert hasattr(snapshot, "total_attendance")

    def test_tick_snapshot_has_22_zones(self, sim: CrowdSimulator):
        snapshot = sim.tick()
        assert len(snapshot.zones) == 22

    def test_tick_preserves_total_population_in_prematch(self, sim: CrowdSimulator):
        """During pre-match, no one should leave the system."""
        initial_pop = sum(sim.population.values())
        sim.tick()
        post_pop = sum(sim.population.values())
        # Allow small floating point drift
        assert post_pop == pytest.approx(initial_pop, rel=0.01)

    def test_multiple_ticks_dont_crash(self, sim: CrowdSimulator):
        for _ in range(50):
            snapshot = sim.tick()
        assert snapshot is not None

    def test_density_always_clamped(self, sim: CrowdSimulator):
        """Run many ticks and verify density stays in [0, 1]."""
        for _ in range(20):
            snapshot = sim.tick()
        for zd in snapshot.zones:
            assert 0.0 <= zd.percentage <= 1.0


# ── Goal Freeze ───────────────────────────────────────────────────

class TestGoalFreeze:
    def test_goal_freeze_stops_movement(self, sim: CrowdSimulator):
        """When a goal is scored, crowd movement should freeze."""
        sim.clock.jump_to_minute(30)  # First half
        sim.clock.score_goal(is_home=True)

        pop_before = dict(sim.population)
        sim.tick()
        pop_after = dict(sim.population)

        # Population should be identical (frozen)
        for zone_id in pop_before:
            assert pop_before[zone_id] == pop_after[zone_id]


# ── Density Helpers ───────────────────────────────────────────────

class TestDensityHelpers:
    def test_get_density_empty_zone(self, sim: CrowdSimulator):
        """Empty zone should have density 0."""
        seating = next(z for z in sim.zones if z.zone_type == ZoneType.SEATING)
        density = sim._get_density(seating)
        assert density == 0.0

    def test_get_density_full_zone(self, sim: CrowdSimulator):
        """Zone at double capacity should clamp to 1.0."""
        zone = sim.zones[0]
        sim.population[zone.id] = zone.capacity * 2.0
        density = sim._get_density(zone)
        assert density == 1.0

    def test_trend_rising(self, sim: CrowdSimulator):
        zone = sim.zones[0]
        sim._prev_density[zone.id] = 0.3
        trend = sim._get_trend(zone.id, 0.5)
        assert trend == DensityTrend.RISING

    def test_trend_falling(self, sim: CrowdSimulator):
        zone = sim.zones[0]
        sim._prev_density[zone.id] = 0.7
        trend = sim._get_trend(zone.id, 0.4)
        assert trend == DensityTrend.FALLING

    def test_trend_stable(self, sim: CrowdSimulator):
        zone = sim.zones[0]
        sim._prev_density[zone.id] = 0.5
        trend = sim._get_trend(zone.id, 0.51)
        assert trend == DensityTrend.STABLE


# ── Wait Times ────────────────────────────────────────────────────

class TestWaitTimes:
    def test_wait_time_seating_is_zero(self, sim: CrowdSimulator):
        """Seating zones don't have wait times."""
        seating = next(z for z in sim.zones if z.zone_type == ZoneType.SEATING)
        assert sim._get_wait_time(seating) == 0.0

    def test_wait_time_food_empty_is_zero(self, sim: CrowdSimulator):
        food = next(z for z in sim.zones if z.zone_type == ZoneType.FOOD)
        sim.queue_length[food.id] = 0.0
        assert sim._get_wait_time(food) == 0.0

    def test_wait_time_food_with_queue(self, sim: CrowdSimulator):
        food = next(z for z in sim.zones if z.zone_type == ZoneType.FOOD)
        sim.queue_length[food.id] = 150.0  # 150 people waiting
        wait = sim._get_wait_time(food)
        # With service_rate 15/min: 150/15 = 10 min
        assert wait == pytest.approx(10.0, rel=0.01)


# ── Reward Boost ──────────────────────────────────────────────────

class TestRewardBoost:
    def test_apply_reward_boost(self, sim: CrowdSimulator):
        zone = sim.zones[0]
        sim.apply_reward_boost(zone.id, boost_factor=0.5)
        assert sim._reward_boosts[zone.id] == 0.5

    def test_clear_reward_boost(self, sim: CrowdSimulator):
        zone = sim.zones[0]
        sim.apply_reward_boost(zone.id, boost_factor=0.5)
        sim.clear_reward_boost(zone.id)
        assert zone.id not in sim._reward_boosts

    def test_apply_boost_invalid_zone_ignored(self, sim: CrowdSimulator):
        sim.apply_reward_boost("INVALID_ZONE", boost_factor=0.5)
        assert "INVALID_ZONE" not in sim._reward_boosts


# ── Zone Density Lookup ───────────────────────────────────────────

class TestZoneDensityLookup:
    def test_get_zone_density_valid(self, sim: CrowdSimulator):
        zd = sim.get_zone_density("G1")
        assert zd is not None
        assert zd.zone_id == "G1"
        assert zd.zone_type == ZoneType.GATE

    def test_get_zone_density_invalid(self, sim: CrowdSimulator):
        zd = sim.get_zone_density("INVALID")
        assert zd is None

    def test_find_shortest_queue_food(self, sim: CrowdSimulator):
        result = sim.find_shortest_queue(ZoneType.FOOD)
        assert len(result) == 4  # 4 food courts
        # Should be sorted by wait_minutes
        for i in range(len(result) - 1):
            assert result[i].wait_minutes <= result[i + 1].wait_minutes


# ── Snapshot Building ─────────────────────────────────────────────

class TestBuildSnapshot:
    def test_snapshot_has_server_timestamp(self, sim: CrowdSimulator):
        snapshot = sim._build_snapshot()
        assert snapshot.server_timestamp > 0

    def test_snapshot_game_state_matches_clock(self, sim: CrowdSimulator):
        snapshot = sim._build_snapshot()
        assert snapshot.game_state.phase == sim.clock.phase
        assert snapshot.game_state.speed_multiplier == sim.clock._speed

    def test_snapshot_predictions_empty_by_default(self, sim: CrowdSimulator):
        snapshot = sim._build_snapshot()
        assert snapshot.predictions == []

    def test_snapshot_total_attendance(self, sim: CrowdSimulator):
        snapshot = sim._build_snapshot()
        # 55000 / 6 gates = 9166.67 per gate; int() truncation loses ~4
        assert 54990 <= snapshot.total_attendance <= 55000
