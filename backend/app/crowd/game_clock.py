"""Game clock with speed multiplier and phase transitions.

Tracks match minute, phase, score, and key events.
Supports speed adjustment for demo mode (P31).
"""

from __future__ import annotations

import time

from app.crowd.models import GamePhase, GameState


class GameClock:
    """Manages the game timeline with configurable speed.

    The clock starts at minute -10 (pre-match) and advances
    based on wall-clock time multiplied by speed_multiplier.
    Supports pause/resume and phase jump for demo mode.
    """

    def __init__(self, speed_multiplier: float = 1.0) -> None:
        self._speed = speed_multiplier
        self._start_minute: float = -10.0
        self._base_time: float = time.time()
        self._paused: bool = False
        self._pause_minute: float = -10.0

        # Score tracking
        self.home_score: int = 0
        self.away_score: int = 0

        # Goal event
        self._goal_time: float | None = None
        self._goal_freeze_duration: float = 120.0  # 2 minutes freeze after goal

    @property
    def minute(self) -> float:
        """Current game minute as a float."""
        if self._paused:
            return self._pause_minute
        elapsed_seconds = time.time() - self._base_time
        elapsed_game_minutes = (elapsed_seconds * self._speed) / 60.0
        return self._start_minute + elapsed_game_minutes

    @property
    def minute_int(self) -> int:
        """Current game minute as an integer."""
        return int(self.minute)

    @property
    def phase(self) -> GamePhase:
        """Determine current game phase from the minute."""
        m = self.minute
        if m < 0:
            return GamePhase.PRE_MATCH
        elif m < 45:
            return GamePhase.FIRST_HALF
        elif m < 60:
            return GamePhase.HALFTIME
        elif m < 90:
            return GamePhase.SECOND_HALF
        else:
            return GamePhase.POST_MATCH

    @property
    def is_goal_freeze(self) -> bool:
        """Check if crowd movement should freeze due to a recent goal."""
        if self._goal_time is None:
            return False
        elapsed = time.time() - self._goal_time
        return elapsed < (self._goal_freeze_duration / self._speed)

    def get_state(self) -> GameState:
        """Return the current game state as a Pydantic model."""
        return GameState(
            minute=self.minute_int,
            phase=self.phase,
            home_score=self.home_score,
            away_score=self.away_score,
            speed_multiplier=self._speed,
            is_paused=self._paused,
        )

    def set_speed(self, multiplier: float) -> None:
        """Change the speed multiplier without resetting the clock.

        Args:
            multiplier: New speed multiplier (e.g., 9.0 for 9x speed).
        """
        if multiplier <= 0:
            return
        current = self.minute
        self._start_minute = current
        self._base_time = time.time()
        self._speed = multiplier

    def pause(self) -> None:
        """Pause the clock."""
        if not self._paused:
            self._pause_minute = self.minute
            self._paused = True

    def resume(self) -> None:
        """Resume the clock from where it was paused."""
        if self._paused:
            self._start_minute = self._pause_minute
            self._base_time = time.time()
            self._paused = False

    def jump_to_minute(self, target_minute: float) -> None:
        """Jump to a specific game minute (for demo mode P31).

        Args:
            target_minute: The minute to jump to (e.g., 45 for halftime).
        """
        self._start_minute = target_minute
        self._base_time = time.time()
        if self._paused:
            self._pause_minute = target_minute

    def score_goal(self, is_home: bool = True) -> None:
        """Record a goal and trigger crowd freeze.

        Args:
            is_home: True if home team scored, False for away.
        """
        if is_home:
            self.home_score += 1
        else:
            self.away_score += 1
        self._goal_time = time.time()

    def reset(self) -> None:
        """Reset the clock to initial state."""
        self._start_minute = -10.0
        self._base_time = time.time()
        self._paused = False
        self._pause_minute = -10.0
        self.home_score = 0
        self.away_score = 0
        self._goal_time = None
