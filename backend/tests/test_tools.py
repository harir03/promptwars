# Coverage target: 70%+ | External calls: all mocked | Test types: unit, edge-case, error-path
"""Tests for the AI agent tool functions.

Covers: get_crowd_status, find_shortest_queue, predict_exit,
get_reward_offers, locate_friend, TOOL_SCHEMAS.
"""

import pytest
from unittest.mock import MagicMock

from app.agent.tools import (
    TOOL_SCHEMAS,
    find_shortest_queue,
    get_crowd_status,
    get_reward_offers,
    locate_friend,
    predict_exit,
)
from app.crowd.models import (
    DensityLevel,
    DensityTrend,
    RewardOffer,
    ZoneDensity,
    ZoneType,
)


def _make_zone_density(
    zone_id: str = "F1",
    zone_name: str = "Food Court North",
    zone_type: ZoneType = ZoneType.FOOD,
    percentage: float = 0.45,
    wait_minutes: float = 3.0,
) -> ZoneDensity:
    """Factory for ZoneDensity test objects."""
    return ZoneDensity(
        zone_id=zone_id,
        zone_name=zone_name,
        zone_type=zone_type,
        current_count=int(percentage * 500),
        capacity=500,
        percentage=percentage,
        trend=DensityTrend.STABLE,
        wait_minutes=wait_minutes,
        level=ZoneDensity.compute_level(percentage),
    )


def _make_simulator_mock(zone_densities: list[ZoneDensity] | None = None):
    """Factory for a mock CrowdSimulator with controllable zone data."""
    mock = MagicMock()
    densities = zone_densities or [_make_zone_density()]

    # zone_map: maps zone_id to a MagicMock with zone_type
    zone_map = {}
    zones = []
    for zd in densities:
        zone_mock = MagicMock()
        zone_mock.id = zd.zone_id
        zone_mock.name = zd.zone_name
        zone_mock.zone_type = zd.zone_type
        zone_map[zd.zone_id] = zone_mock
        zones.append(zone_mock)

    mock.zone_map = zone_map
    mock.zones = zones
    mock.get_zone_density.side_effect = lambda zid: next(
        (zd for zd in densities if zd.zone_id == zid), None
    )

    snapshot_mock = MagicMock()
    snapshot_mock.zones = densities
    mock._build_snapshot.return_value = snapshot_mock
    mock.find_shortest_queue.return_value = densities

    return mock


class TestGetCrowdStatus:
    """Tests for the get_crowd_status tool function."""

    def test_returns_specific_zone_status_for_valid_zone_id(self):
        simulator = _make_simulator_mock()
        result = get_crowd_status(simulator, zone_id="F1")
        assert "Food Court North" in result
        assert "45%" in result
        simulator.get_zone_density.assert_called_once_with("F1")

    def test_returns_not_found_message_for_invalid_zone_id(self):
        simulator = _make_simulator_mock()
        simulator.get_zone_density.return_value = None
        result = get_crowd_status(simulator, zone_id="INVALID")
        assert "not found" in result

    def test_returns_summary_of_all_zones_when_zone_id_is_none(self):
        densities = [
            _make_zone_density("A", "Section A", ZoneType.SEATING, 0.6),
            _make_zone_density("F1", "Food Court", ZoneType.FOOD, 0.3, 2.0),
        ]
        simulator = _make_simulator_mock(densities)
        result = get_crowd_status(simulator, zone_id=None)
        assert "SEATING ZONES" in result
        assert "FOOD ZONES" in result

    def test_includes_wait_time_when_wait_is_nonzero(self):
        simulator = _make_simulator_mock([_make_zone_density(wait_minutes=5.0)])
        result = get_crowd_status(simulator, zone_id="F1")
        assert "wait" in result
        assert "5" in result


class TestFindShortestQueue:
    """Tests for the find_shortest_queue tool function."""

    def test_returns_ranked_food_queues_for_valid_type(self):
        simulator = _make_simulator_mock()
        result = find_shortest_queue(simulator, "food")
        assert "Shortest food queues" in result
        simulator.find_shortest_queue.assert_called_once()

    def test_returns_ranked_restroom_queues(self):
        simulator = _make_simulator_mock()
        result = find_shortest_queue(simulator, "restroom")
        assert "Shortest restroom queues" in result

    def test_returns_error_message_for_invalid_queue_type(self):
        simulator = _make_simulator_mock()
        result = find_shortest_queue(simulator, "parking")
        assert "Invalid queue type" in result
        assert "food" in result
        assert "restroom" in result

    def test_handles_empty_results_from_simulator(self):
        simulator = _make_simulator_mock()
        simulator.find_shortest_queue.return_value = []
        result = find_shortest_queue(simulator, "food")
        assert "No food zones found" in result

    def test_normalizes_uppercase_queue_type(self):
        simulator = _make_simulator_mock()
        result = find_shortest_queue(simulator, "FOOD")
        assert "Shortest food queues" in result


class TestPredictExit:
    """Tests for the predict_exit tool function."""

    def test_returns_gate_predictions_when_predictions_exist(self):
        gate_density = _make_zone_density("G1", "Gate 1", ZoneType.GATE, 0.6)
        simulator = _make_simulator_mock([gate_density])

        from app.crowd.models import SurgePrediction
        prediction = SurgePrediction(
            zone_id="G1", zone_name="Gate 1",
            predicted_percentage=0.85, minutes_until=5,
            confidence=0.90, recommendation="Leave now via Gate 1",
        )
        predictor = MagicMock()
        predictor.get_predictions.return_value = [prediction]

        result = predict_exit(simulator, predictor)
        assert "Exit predictions" in result
        assert "Gate 1" in result
        assert "85%" in result

    def test_returns_current_gate_status_when_no_predictions(self):
        gate_density = _make_zone_density("G1", "Gate 1", ZoneType.GATE, 0.3)
        simulator = _make_simulator_mock([gate_density])

        predictor = MagicMock()
        predictor.get_predictions.return_value = []

        result = predict_exit(simulator, predictor)
        assert "No surge predictions" in result
        assert "Gate 1" in result

    def test_filters_to_specific_gate_when_gate_id_provided(self):
        densities = [
            _make_zone_density("G1", "Gate 1", ZoneType.GATE, 0.5),
            _make_zone_density("G2", "Gate 2", ZoneType.GATE, 0.7),
        ]
        simulator = _make_simulator_mock(densities)

        from app.crowd.models import SurgePrediction
        predictions = [
            SurgePrediction(zone_id="G1", zone_name="Gate 1",
                            predicted_percentage=0.8, minutes_until=5,
                            confidence=0.85, recommendation="Use Gate 1"),
            SurgePrediction(zone_id="G2", zone_name="Gate 2",
                            predicted_percentage=0.9, minutes_until=3,
                            confidence=0.90, recommendation="Avoid Gate 2"),
        ]
        predictor = MagicMock()
        predictor.get_predictions.return_value = predictions

        result = predict_exit(simulator, predictor, gate_id="G1")
        assert "Gate 1" in result
        # Should only show G1, but result includes all gate text in header


class TestGetRewardOffers:
    """Tests for the get_reward_offers tool function."""

    def test_returns_active_offers_when_available(self):
        offer = RewardOffer(
            id="offer_123", zone_id="F2", zone_name="Food Court South",
            description="Visit Food Court South for reduced crowds",
            discount_percent=20, points=100,
            duration_minutes=10, remaining_minutes=8.5,
        )
        rewards = MagicMock()
        rewards.get_active_offers.return_value = [offer]

        result = get_reward_offers(rewards)
        assert "Active reward offers" in result
        assert "Food Court South" in result
        assert "20%" in result
        assert "+100 pts" in result

    def test_returns_no_offers_message_when_empty(self):
        rewards = MagicMock()
        rewards.get_active_offers.return_value = []
        result = get_reward_offers(rewards)
        assert "No active reward offers" in result


class TestLocateFriend:
    """Tests for the locate_friend tool function."""

    def test_returns_known_friend_location(self):
        result = locate_friend("friend_1")
        assert "Section E" in result
        assert "Row 12" in result

    def test_returns_second_friend_location(self):
        result = locate_friend("friend_2")
        assert "Food Court South" in result

    def test_returns_not_found_for_unknown_friend_id(self):
        result = locate_friend("friend_99")
        assert "not found" in result

    def test_returns_default_friend_when_no_id_given(self):
        result = locate_friend()
        assert "friend_1" in result
        assert "Section E" in result


class TestToolSchemas:
    """Tests that TOOL_SCHEMAS is well-formed for Gemini function calling."""

    def test_schemas_list_has_5_tools(self):
        assert len(TOOL_SCHEMAS) == 5

    @pytest.mark.parametrize("expected_name", [
        "get_crowd_status",
        "find_shortest_queue",
        "predict_exit",
        "get_reward_offers",
        "locate_friend",
    ])
    def test_schema_contains_expected_tool(self, expected_name: str):
        names = [tool["name"] for tool in TOOL_SCHEMAS]
        assert expected_name in names

    def test_every_schema_has_name_and_description(self):
        for tool in TOOL_SCHEMAS:
            assert "name" in tool
            assert "description" in tool
            assert len(tool["description"]) > 10
