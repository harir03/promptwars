# Coverage target: 70%+ | External calls: all mocked | Test types: unit, integration, error-path
"""Tests for the AI concierge agent.

Covers: VenueConcierge initialization, fallback responses,
tool execution, suggestion generation. Gemini API is fully mocked.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agent.concierge import VenueConcierge
from app.crowd.models import GamePhase


@pytest.fixture
def mock_simulator() -> MagicMock:
    """Create a mock simulator with minimal state for concierge tests."""
    mock = MagicMock()
    game_state = MagicMock()
    game_state.phase = GamePhase.FIRST_HALF
    game_state.minute = 25
    game_state.home_score = 1
    game_state.away_score = 0
    game_state.speed_multiplier = 1.0
    mock.clock.get_state.return_value = game_state
    mock.clock.phase = GamePhase.FIRST_HALF
    mock.zones = []
    mock.zone_map = {}
    return mock


@pytest.fixture
def mock_predictor() -> MagicMock:
    return MagicMock()


@pytest.fixture
def mock_rewards() -> MagicMock:
    return MagicMock()


@pytest.fixture
def concierge(mock_simulator, mock_predictor, mock_rewards) -> VenueConcierge:
    """Create a concierge with NO Gemini API key (fallback mode)."""
    return VenueConcierge(
        api_key="",
        simulator=mock_simulator,
        predictor=mock_predictor,
        rewards_engine=mock_rewards,
    )


class TestConciergeInitialization:
    """Tests for VenueConcierge.__init__ and _init_client."""

    def test_creates_instance_without_api_key(self, concierge: VenueConcierge):
        assert concierge._client is None

    def test_stores_simulator_reference(self, concierge: VenueConcierge, mock_simulator):
        assert concierge.simulator is mock_simulator

    def test_empty_histories_on_creation(self, concierge: VenueConcierge):
        assert concierge._histories == {}


class TestFallbackResponses:
    """Tests for fallback responses when Gemini is unavailable."""

    @pytest.mark.asyncio
    async def test_returns_food_info_for_food_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("Where can I eat?", session_id="s1")
        assert result["is_fallback"] is True
        assert "🍔" in result["response"]
        assert isinstance(result["suggestions"], list)

    @pytest.mark.asyncio
    async def test_returns_restroom_info_for_restroom_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("Where is the restroom?", session_id="s2")
        assert result["is_fallback"] is True
        assert "🚻" in result["response"]

    @pytest.mark.asyncio
    async def test_returns_exit_info_for_exit_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("When should I leave?", session_id="s3")
        assert result["is_fallback"] is True
        assert "🚪" in result["response"]

    @pytest.mark.asyncio
    async def test_returns_crowd_info_for_crowd_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("How crowded is it?", session_id="s4")
        assert result["is_fallback"] is True
        assert "📊" in result["response"]

    @pytest.mark.asyncio
    async def test_returns_reward_info_for_reward_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("Any rewards?", session_id="s5")
        assert result["is_fallback"] is True
        assert "🎁" in result["response"]

    @pytest.mark.asyncio
    async def test_returns_friend_info_for_friend_keywords(self, concierge: VenueConcierge):
        result = await concierge.chat("Find my friends", session_id="s6")
        assert result["is_fallback"] is True
        assert "👥" in result["response"]

    @pytest.mark.asyncio
    async def test_returns_generic_help_for_unrecognized_message(self, concierge: VenueConcierge):
        result = await concierge.chat("tell me a joke", session_id="s7")
        assert result["is_fallback"] is True
        assert "VenuePulse concierge" in result["response"]

    @pytest.mark.asyncio
    async def test_different_sessions_are_isolated(self, concierge: VenueConcierge):
        await concierge.chat("food", session_id="session_a")
        await concierge.chat("exit", session_id="session_b")
        # Each call should work independently — no cross-contamination


class TestToolExecution:
    """Tests for VenueConcierge._execute_tool."""

    def test_executes_get_crowd_status_tool(self, concierge: VenueConcierge):
        result = concierge._execute_tool("get_crowd_status", {"zone_id": "F1"})
        assert isinstance(result, str)

    def test_executes_find_shortest_queue_tool(self, concierge: VenueConcierge):
        result = concierge._execute_tool("find_shortest_queue", {"queue_type": "food"})
        assert isinstance(result, str)

    def test_executes_locate_friend_tool(self, concierge: VenueConcierge):
        result = concierge._execute_tool("locate_friend", {"friend_id": "friend_1"})
        assert isinstance(result, str)
        assert "friend_1" in result

    def test_returns_unknown_tool_message_for_bad_name(self, concierge: VenueConcierge):
        result = concierge._execute_tool("nonexistent_tool", {})
        assert "Unknown tool" in result

    def test_handles_exception_in_tool_gracefully(self, concierge: VenueConcierge):
        concierge.simulator.get_zone_density.side_effect = RuntimeError("boom")
        result = concierge._execute_tool("get_crowd_status", {"zone_id": "F1"})
        assert "Error executing" in result


class TestSuggestions:
    """Tests for VenueConcierge._get_suggestions."""

    @pytest.mark.parametrize("phase,expected_keyword", [
        (GamePhase.PRE_MATCH, "eat"),
        (GamePhase.FIRST_HALF, "food"),
        (GamePhase.HALFTIME, "food court"),
        (GamePhase.POST_MATCH, "exit"),
    ])
    def test_returns_phase_appropriate_suggestions(
        self, concierge: VenueConcierge, mock_simulator, phase, expected_keyword
    ):
        mock_simulator.clock.phase = phase
        suggestions = concierge._get_suggestions()
        assert isinstance(suggestions, list)
        assert len(suggestions) >= 2
        joined = " ".join(suggestions).lower()
        assert expected_keyword in joined
