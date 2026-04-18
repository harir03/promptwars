"""Tests for the GameClock module.

Covers:
- Phase transitions by minute
- Speed changes
- Pause/resume
- Jump-to-minute
- Goal scoring and freeze
- Reset
"""

import time

import pytest

from app.crowd.game_clock import GameClock
from app.crowd.models import GamePhase


@pytest.fixture
def clock() -> GameClock:
    return GameClock(speed_multiplier=1.0)


# ── Phase Transitions ────────────────────────────────────────────

class TestPhaseTransitions:
    def test_pre_match_at_negative_minutes(self, clock: GameClock):
        clock.jump_to_minute(-5.0)
        assert clock.phase == GamePhase.PRE_MATCH

    def test_first_half_at_minute_0(self, clock: GameClock):
        clock.jump_to_minute(0.0)
        assert clock.phase == GamePhase.FIRST_HALF

    def test_first_half_at_minute_44(self, clock: GameClock):
        clock.jump_to_minute(44.0)
        assert clock.phase == GamePhase.FIRST_HALF

    def test_halftime_at_minute_45(self, clock: GameClock):
        clock.jump_to_minute(45.0)
        assert clock.phase == GamePhase.HALFTIME

    def test_halftime_at_minute_59(self, clock: GameClock):
        clock.jump_to_minute(59.0)
        assert clock.phase == GamePhase.HALFTIME

    def test_second_half_at_minute_60(self, clock: GameClock):
        clock.jump_to_minute(60.0)
        assert clock.phase == GamePhase.SECOND_HALF

    def test_second_half_at_minute_89(self, clock: GameClock):
        clock.jump_to_minute(89.0)
        assert clock.phase == GamePhase.SECOND_HALF

    def test_post_match_at_minute_90(self, clock: GameClock):
        clock.jump_to_minute(90.0)
        assert clock.phase == GamePhase.POST_MATCH


# ── Speed Control ─────────────────────────────────────────────────

class TestSpeedControl:
    def test_set_speed(self, clock: GameClock):
        clock.set_speed(9.0)
        assert clock._speed == 9.0

    def test_set_speed_zero_ignored(self, clock: GameClock):
        clock.set_speed(0)
        assert clock._speed == 1.0  # Unchanged

    def test_set_speed_negative_ignored(self, clock: GameClock):
        clock.set_speed(-5)
        assert clock._speed == 1.0  # Unchanged

    def test_speed_preserves_current_minute(self, clock: GameClock):
        clock.jump_to_minute(30.0)
        clock.set_speed(9.0)
        assert clock.minute == pytest.approx(30.0, abs=0.5)


# ── Pause / Resume ───────────────────────────────────────────────

class TestPauseResume:
    def test_pause_stops_clock(self, clock: GameClock):
        clock.jump_to_minute(20.0)
        clock.pause()
        minute_at_pause = clock.minute
        time.sleep(0.05)
        assert clock.minute == minute_at_pause

    def test_resume_continues_clock(self, clock: GameClock):
        clock.jump_to_minute(20.0)
        clock.pause()
        clock.resume()
        assert not clock._paused

    def test_pause_sets_flag(self, clock: GameClock):
        clock.pause()
        assert clock._paused is True

    def test_double_pause_no_crash(self, clock: GameClock):
        clock.pause()
        clock.pause()  # Should be idempotent
        assert clock._paused is True

    def test_resume_without_pause_no_crash(self, clock: GameClock):
        clock.resume()  # Should be idempotent
        assert clock._paused is False


# ── Jump to Minute ────────────────────────────────────────────────

class TestJumpToMinute:
    def test_jump_forward(self, clock: GameClock):
        clock.jump_to_minute(45.0)
        assert clock.minute == pytest.approx(45.0, abs=0.5)

    def test_jump_backward(self, clock: GameClock):
        clock.jump_to_minute(80.0)
        clock.jump_to_minute(10.0)
        assert clock.minute == pytest.approx(10.0, abs=0.5)

    def test_jump_while_paused(self, clock: GameClock):
        clock.pause()
        clock.jump_to_minute(50.0)
        assert clock.minute == pytest.approx(50.0, abs=0.5)


# ── Goal Scoring ──────────────────────────────────────────────────

class TestGoalScoring:
    def test_home_goal_increments_score(self, clock: GameClock):
        clock.score_goal(is_home=True)
        assert clock.home_score == 1
        assert clock.away_score == 0

    def test_away_goal_increments_score(self, clock: GameClock):
        clock.score_goal(is_home=False)
        assert clock.home_score == 0
        assert clock.away_score == 1

    def test_multiple_goals(self, clock: GameClock):
        clock.score_goal(is_home=True)
        clock.score_goal(is_home=True)
        clock.score_goal(is_home=False)
        assert clock.home_score == 2
        assert clock.away_score == 1

    def test_goal_triggers_freeze(self, clock: GameClock):
        clock.score_goal(is_home=True)
        assert clock.is_goal_freeze is True

    def test_no_freeze_without_goal(self, clock: GameClock):
        assert clock.is_goal_freeze is False


# ── Game State ────────────────────────────────────────────────────

class TestGameState:
    def test_get_state_returns_model(self, clock: GameClock):
        state = clock.get_state()
        assert hasattr(state, "minute")
        assert hasattr(state, "phase")
        assert hasattr(state, "speed_multiplier")

    def test_score_margin(self, clock: GameClock):
        clock.home_score = 3
        clock.away_score = 1
        state = clock.get_state()
        assert state.score_margin == 2

    def test_state_reflects_pause(self, clock: GameClock):
        clock.pause()
        state = clock.get_state()
        assert state.is_paused is True


# ── Reset ─────────────────────────────────────────────────────────

class TestReset:
    def test_reset_clears_scores(self, clock: GameClock):
        clock.score_goal(is_home=True)
        clock.score_goal(is_home=False)
        clock.reset()
        assert clock.home_score == 0
        assert clock.away_score == 0

    def test_reset_clears_pause(self, clock: GameClock):
        clock.pause()
        clock.reset()
        assert clock._paused is False

    def test_reset_returns_to_pre_match(self, clock: GameClock):
        clock.jump_to_minute(90)
        clock.reset()
        assert clock.phase == GamePhase.PRE_MATCH
