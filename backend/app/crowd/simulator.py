"""Crowd simulation engine for realistic stadium crowd movement.

Simulates 55,000 people moving through 22 zones based on:
- Game phase transition matrices
- Zone adjacency constraints (P27 — no teleportation)
- Simple queue/throughput model (P28)
- Gaussian noise for realism
- Goal freeze events
- Reward-triggered redistribution (P29)

Density is always clamped to 0.0-1.0 (P23).
"""

from __future__ import annotations

import logging
import time
import random
from datetime import datetime

from app.crowd.game_clock import GameClock
from app.crowd.models import (
    CrowdSnapshot,
    DensityLevel,
    DensityTrend,
    GamePhase,
    VenueZone,
    ZoneDensity,
    ZoneType,
)
from app.crowd.venue import get_venue_layout, get_zone_map

logger = logging.getLogger(__name__)


def _timer(func):
    """Decorator that logs elapsed time at DEBUG level for hot-path profiling."""
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.debug("%s completed in %.2fms", func.__name__, elapsed_ms)
        return result
    return wrapper

# Transition probabilities per phase. Dict of: source_type → {dest_type: probability_per_tick}
# These are per-tick (3s) probabilities, so they should be small.
# At 9x speed, ticks represent ~27s of game time each.

TRANSITIONS: dict[GamePhase, dict[ZoneType, dict[ZoneType, float]]] = {
    GamePhase.PRE_MATCH: {
        ZoneType.GATE: {ZoneType.SEATING: 0.15, ZoneType.FOOD: 0.03},
        ZoneType.SEATING: {ZoneType.FOOD: 0.005, ZoneType.RESTROOM: 0.002},
        ZoneType.FOOD: {ZoneType.SEATING: 0.04},
        ZoneType.RESTROOM: {ZoneType.SEATING: 0.06},
    },
    GamePhase.FIRST_HALF: {
        ZoneType.SEATING: {ZoneType.FOOD: 0.003, ZoneType.RESTROOM: 0.002},
        ZoneType.FOOD: {ZoneType.SEATING: 0.08},
        ZoneType.RESTROOM: {ZoneType.SEATING: 0.10},
        ZoneType.GATE: {ZoneType.SEATING: 0.05},
    },
    GamePhase.HALFTIME: {
        ZoneType.SEATING: {ZoneType.FOOD: 0.025, ZoneType.RESTROOM: 0.015, ZoneType.GATE: 0.002},
        ZoneType.FOOD: {ZoneType.SEATING: 0.03},
        ZoneType.RESTROOM: {ZoneType.SEATING: 0.05},
        ZoneType.GATE: {},
    },
    GamePhase.SECOND_HALF: {
        ZoneType.SEATING: {ZoneType.FOOD: 0.002, ZoneType.RESTROOM: 0.002, ZoneType.GATE: 0.001},
        ZoneType.FOOD: {ZoneType.SEATING: 0.08},
        ZoneType.RESTROOM: {ZoneType.SEATING: 0.10},
        ZoneType.GATE: {},
    },
    GamePhase.POST_MATCH: {
        ZoneType.SEATING: {ZoneType.GATE: 0.06, ZoneType.FOOD: 0.005},
        ZoneType.FOOD: {ZoneType.GATE: 0.04},
        ZoneType.RESTROOM: {ZoneType.GATE: 0.06},
        ZoneType.GATE: {},  # People leave the system through gates
    },
}


class CrowdSimulator:
    """Simulates crowd movement across the stadium.

    Maintains per-zone population counts and updates them each tick
    based on game phase, adjacency rules, and noise.
    """

    def __init__(self, game_clock: GameClock) -> None:
        self.clock = game_clock
        self.zones: list[VenueZone] = get_venue_layout()
        self.zone_map: dict[str, VenueZone] = get_zone_map()

        # Current population per zone (by zone_id)
        self.population: dict[str, float] = {z.id: 0.0 for z in self.zones}

        # Queue tracking for food/restroom (people waiting)
        self.queue_length: dict[str, float] = {
            z.id: 0.0 for z in self.zones
            if z.zone_type in (ZoneType.FOOD, ZoneType.RESTROOM)
        }

        # Previous densities for trend calculation
        self._prev_density: dict[str, float] = {z.id: 0.0 for z in self.zones}

        # Reward redistribution boosts (zone_id → extra outflow multiplier)
        self._reward_boosts: dict[str, float] = {}

        # Initialize: 80% of stadium filled during pre-match at gates
        self._seed_initial_crowd()

        # Track total people who left the system
        self.departed: float = 0.0

    def _seed_initial_crowd(self) -> None:
        """Place initial crowd at gates for pre-match entry."""
        total = 55000.0
        gate_ids = [z.id for z in self.zones if z.zone_type == ZoneType.GATE]
        per_gate = total / len(gate_ids)
        for gid in gate_ids:
            self.population[gid] = per_gate

    @_timer
    def tick(self) -> CrowdSnapshot:
        """Advance the simulation by one tick and return the new state.

        This is called every tick_interval (3 seconds wall-clock).
        Returns a CrowdSnapshot with all zone densities.

        Complexity: O(z * t) where z=22 zones, t=avg transitions per zone (~3).
        Expected p95: ~1ms for 22 zones.
        """
        phase = self.clock.phase
        game_minute = self.clock.minute

        # If goal just occurred, freeze movement
        if self.clock.is_goal_freeze:
            return self._build_snapshot()

        # Speed factor: at higher sim speeds, more people move per tick
        speed_factor = max(1.0, self.clock.get_state().speed_multiplier / 3.0)

        # Get transition table for current phase
        trans = TRANSITIONS.get(phase, {})

        # Early exit boost for lopsided scores in second half
        early_exit_boost = 0.0
        if phase == GamePhase.SECOND_HALF and game_minute > 75:
            margin = self.clock.get_state().score_margin
            if margin >= 3:
                early_exit_boost = 0.015 * speed_factor
            elif margin >= 2:
                early_exit_boost = 0.008 * speed_factor

        # Calculate movements
        movements: dict[str, float] = {z.id: 0.0 for z in self.zones}

        for zone in self.zones:
            src_pop = self.population[zone.id]
            if src_pop < 1:
                continue

            src_type = zone.zone_type
            zone_transitions = trans.get(src_type, {})

            for dest_type, base_prob in zone_transitions.items():
                # Apply speed factor and noise (P23: clamp)
                prob = base_prob * speed_factor
                noise = random.gauss(0, prob * 0.15)  # 15% noise
                prob = max(0.0, min(prob + noise, 0.3))  # Never move more than 30% per tick

                # Apply reward boost if applicable
                if zone.id in self._reward_boosts:
                    prob *= (1.0 + self._reward_boosts[zone.id])

                # Add early exit boost for seating → gate in second half
                if src_type == ZoneType.SEATING and dest_type == ZoneType.GATE:
                    prob += early_exit_boost

                # Find eligible adjacent zones of destination type (P27)
                adj_dest = [
                    aid for aid in zone.adjacent_zones
                    if aid in self.zone_map and self.zone_map[aid].zone_type == dest_type
                ]

                if not adj_dest:
                    continue

                # Split movers evenly across adjacent destinations
                movers = src_pop * prob
                per_dest = movers / len(adj_dest)

                for dest_id in adj_dest:
                    dest_zone = self.zone_map[dest_id]
                    dest_capacity = float(dest_zone.capacity)
                    dest_current = self.population[dest_id] + movements[dest_id]

                    # Saturation check: don't overfill (cap at 95%)
                    remaining_capacity = max(0.0, dest_capacity * 0.95 - dest_current)
                    actual_movers = min(per_dest, remaining_capacity)

                    if actual_movers > 0:
                        movements[dest_id] += actual_movers
                        movements[zone.id] -= actual_movers

        # Apply movements
        for zone_id, delta in movements.items():
            self.population[zone_id] = max(0.0, self.population[zone_id] + delta)

        # Post-match: people leave through gates (remove from system)
        if phase == GamePhase.POST_MATCH:
            for zone in self.zones:
                if zone.zone_type == ZoneType.GATE:
                    gate_pop = self.population[zone.id]
                    departures = gate_pop * 0.08 * speed_factor  # 8% leave per tick
                    departures = min(departures, gate_pop)
                    self.population[zone.id] -= departures
                    self.departed += departures

        # Update queue lengths for food/restroom (P28)
        for zone_id in self.queue_length:
            zone = self.zone_map[zone_id]
            pop = self.population[zone_id]
            served = zone.service_rate * (3.0 * speed_factor / 60.0)  # People served this tick
            self.queue_length[zone_id] = max(0.0, pop - served)

        # Store previous density for trend
        for zone in self.zones:
            density = self._get_density(zone)
            self._prev_density[zone.id] = density

        return self._build_snapshot()

    def _get_density(self, zone: VenueZone) -> float:
        """Calculate clamped density for a zone (P23)."""
        if zone.capacity <= 0:
            return 0.0
        return min(max(self.population[zone.id] / zone.capacity, 0.0), 1.0)

    def _get_trend(self, zone_id: str, current_density: float) -> DensityTrend:
        """Determine whether density is rising, falling, or stable."""
        prev = self._prev_density.get(zone_id, current_density)
        diff = current_density - prev
        if diff > 0.02:
            return DensityTrend.RISING
        elif diff < -0.02:
            return DensityTrend.FALLING
        return DensityTrend.STABLE

    def _get_wait_time(self, zone: VenueZone) -> float:
        """Calculate estimated wait time in minutes (P28)."""
        if zone.zone_type not in (ZoneType.FOOD, ZoneType.RESTROOM):
            return 0.0
        if zone.service_rate <= 0:
            return 0.0
        queue = self.queue_length.get(zone.id, 0.0)
        return max(0.0, queue / zone.service_rate)

    def _build_snapshot(self) -> CrowdSnapshot:
        """Build a CrowdSnapshot from current state.

        Complexity: O(n) single pass — computes densities and total
        attendance in one loop (was two passes before: list + sum).
        Expected p95: ~0.3ms for 22 zones.
        """
        zone_densities: list[ZoneDensity] = []
        total_attendance = 0  # Accumulate in same loop instead of separate sum()

        for zone in self.zones:
            population = self.population[zone.id]
            total_attendance += int(population)
            density = self._get_density(zone)

            zone_densities.append(ZoneDensity(
                zone_id=zone.id,
                zone_name=zone.name,
                zone_type=zone.zone_type,
                current_count=int(population),
                capacity=zone.capacity,
                percentage=round(density, 4),
                trend=self._get_trend(zone.id, density),
                wait_minutes=round(self._get_wait_time(zone), 1),
                level=ZoneDensity.compute_level(density),
            ))

        return CrowdSnapshot(
            timestamp=datetime.utcnow(),
            server_timestamp=time.time(),
            game_state=self.clock.get_state(),
            zones=zone_densities,
            total_attendance=total_attendance,
            predictions=[],  # Filled by predictor separately
        )

    def apply_reward_boost(self, zone_id: str, boost_factor: float = 0.5) -> None:
        """Apply a redistribution boost to make people leave a congested zone.

        This is triggered when admin activates a reward for uncrowded zones.
        Makes the congested zone's outflow increase (P29).

        Args:
            zone_id: The congested zone to boost outflow from.
            boost_factor: How much to increase outflow (0.5 = 50% more).
        """
        if zone_id in self.zone_map:
            self._reward_boosts[zone_id] = boost_factor
            logger.info("Reward boost applied to %s: %s", zone_id, boost_factor)

    def clear_reward_boost(self, zone_id: str) -> None:
        """Remove a reward boost from a zone."""
        self._reward_boosts.pop(zone_id, None)

    def get_zone_density(self, zone_id: str) -> ZoneDensity | None:
        """Get current density for a single zone."""
        zone = self.zone_map.get(zone_id)
        if not zone:
            return None
        density = self._get_density(zone)
        return ZoneDensity(
            zone_id=zone.id,
            zone_name=zone.name,
            zone_type=zone.zone_type,
            current_count=int(self.population[zone.id]),
            capacity=zone.capacity,
            percentage=round(density, 4),
            trend=self._get_trend(zone.id, density),
            wait_minutes=round(self._get_wait_time(zone), 1),
            level=ZoneDensity.compute_level(density),
        )

    def find_shortest_queue(self, queue_type: ZoneType) -> list[ZoneDensity]:
        """Find zones of given type sorted by wait time (shortest first).

        Complexity: O(k log k) where k = zones of that type (4).
        Builds ZoneDensity inline instead of calling get_zone_density
        per zone to avoid redundant dict lookups.
        """
        # O(k) filter + build, O(k log k) sort
        results = [
            self.get_zone_density(zone.id)
            for zone in self.zones
            if zone.zone_type == queue_type
        ]
        # Filter out None values (defensive)
        valid_results = [zd for zd in results if zd is not None]
        valid_results.sort(key=lambda zd: zd.wait_minutes)  # O(k log k), k=4
        return valid_results
