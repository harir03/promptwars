"""Tests for the PredictionEngine.

Covers:
- No predictions during normal play
- Halftime food surge predictions
- Halftime restroom surge predictions
- Early exit predictions with lopsided scores
- Mass exit predictions near full time
- Prediction sorting by confidence
"""

import pytest

from app.crowd.game_clock import GameClock
from app.crowd.models import GamePhase, ZoneType
from app.crowd.predictor import PredictionEngine
from app.crowd.simulator import CrowdSimulator


@pytest.fixture
def clock() -> GameClock:
    return GameClock(speed_multiplier=1.0)


@pytest.fixture
def sim(clock: GameClock) -> CrowdSimulator:
    return CrowdSimulator(game_clock=clock)


@pytest.fixture
def predictor(sim: CrowdSimulator) -> PredictionEngine:
    return PredictionEngine(simulator=sim)


# ── No Predictions in Normal Play ─────────────────────────────────

class TestNoPredictions:
    def test_no_predictions_at_kickoff(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(0)
        preds = predictor.get_predictions()
        assert len(preds) == 0

    def test_no_predictions_early_first_half(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(20)
        preds = predictor.get_predictions()
        assert len(preds) == 0


# ── Halftime Surge Predictions ────────────────────────────────────

class TestHalftimeSurge:
    def test_food_surge_at_minute_43(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(43)
        preds = predictor.get_predictions()
        assert len(preds) > 0
        # Should predict food court surges
        food_preds = [p for p in preds if "Food" in p.zone_name]
        assert len(food_preds) > 0

    def test_food_surge_confidence_high(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(43)
        preds = predictor.get_predictions()
        for p in preds:
            assert p.confidence > 0.8

    def test_restroom_surge_at_halftime(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(46)
        preds = predictor.get_predictions()
        restroom_preds = [p for p in preds if "Restroom" in p.zone_name]
        assert len(restroom_preds) > 0


# ── Early Exit Predictions ────────────────────────────────────────

class TestEarlyExit:
    def test_early_exit_with_3_goal_margin(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(80)
        clock.home_score = 4
        clock.away_score = 1
        preds = predictor.get_predictions()
        gate_preds = [p for p in preds if "Gate" in p.zone_name]
        assert len(gate_preds) > 0

    def test_no_early_exit_close_game(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(80)
        clock.home_score = 1
        clock.away_score = 1
        preds = predictor.get_predictions()
        # With tied score, no early exit predictions (only mass exit if >85)
        gate_preds = [p for p in preds if "Gate" in p.zone_name]
        assert len(gate_preds) == 0


# ── Mass Exit Predictions ─────────────────────────────────────────

class TestMassExit:
    def test_mass_exit_at_minute_87(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(87)
        preds = predictor.get_predictions()
        gate_preds = [p for p in preds if "Gate" in p.zone_name]
        assert len(gate_preds) > 0

    def test_mass_exit_recommendations_present(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(87)
        preds = predictor.get_predictions()
        for p in preds:
            assert p.recommendation != ""


# ── Sorting ───────────────────────────────────────────────────────

class TestPredictionSorting:
    def test_predictions_sorted_by_confidence(self, predictor: PredictionEngine, clock: GameClock):
        clock.jump_to_minute(43)
        preds = predictor.get_predictions()
        if len(preds) > 1:
            for i in range(len(preds) - 1):
                assert preds[i].confidence >= preds[i + 1].confidence
