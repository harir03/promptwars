"""Prediction engine for crowd surge forecasting.

Uses rule-based predictions to forecast crowd surges 10-20 minutes
ahead based on game state, score margin, and current densities.
Feeds into the AI agent and admin dashboard.
"""

from __future__ import annotations

import logging

from app.crowd.models import GamePhase, SurgePrediction, ZoneType

if __name__ != "__main__":
    from app.crowd.simulator import CrowdSimulator

logger = logging.getLogger(__name__)


class PredictionEngine:
    """Generates surge predictions based on game state and crowd data."""

    def __init__(self, simulator: CrowdSimulator) -> None:
        self.simulator = simulator

    def get_predictions(self) -> list[SurgePrediction]:
        """Generate all active predictions based on current state.

        Returns:
            List of SurgePrediction sorted by confidence (highest first).
        """
        predictions: list[SurgePrediction] = []
        game = self.simulator.clock.get_state()
        minute = game.minute

        # Rule 1: Pre-halftime food surge
        if 42 <= minute <= 45 and game.phase == GamePhase.FIRST_HALF:
            food_predictions = self._predict_halftime_surge()
            predictions.extend(food_predictions)

        # Rule 2: Halftime restroom surge
        if game.phase == GamePhase.HALFTIME and minute <= 50:
            restroom_preds = self._predict_restroom_surge()
            predictions.extend(restroom_preds)

        # Rule 3: Early exit for lopsided score
        if minute > 75 and game.phase == GamePhase.SECOND_HALF:
            if game.score_margin >= 2:
                exit_preds = self._predict_early_exit(game.score_margin)
                predictions.extend(exit_preds)

        # Rule 4: Full-time mass exit
        if minute > 85:
            mass_exit = self._predict_mass_exit(minute)
            predictions.extend(mass_exit)

        # Sort by confidence descending
        predictions.sort(key=lambda p: p.confidence, reverse=True)

        return predictions

    def _predict_halftime_surge(self) -> list[SurgePrediction]:
        """Predict food court surge at halftime."""
        preds = []
        food_zones = [
            zd for zd in self._get_current_densities()
            if self.simulator.zone_map[zd.zone_id].zone_type == ZoneType.FOOD
        ]
        for zd in food_zones:
            predicted_pct = min(1.0, zd.percentage + 0.35)
            preds.append(SurgePrediction(
                zone_id=zd.zone_id,
                zone_name=zd.zone_name,
                predicted_percentage=round(predicted_pct, 2),
                minutes_until=max(0, 45 - self.simulator.clock.minute_int),
                confidence=0.92,
                recommendation=f"{'Avoid' if predicted_pct > 0.7 else 'Visit'} {zd.zone_name}"
                    + f" — current wait: {zd.wait_minutes:.0f} min"
            ))
        return preds

    def _predict_restroom_surge(self) -> list[SurgePrediction]:
        """Predict restroom rush during halftime."""
        preds = []
        restroom_zones = [
            zd for zd in self._get_current_densities()
            if self.simulator.zone_map[zd.zone_id].zone_type == ZoneType.RESTROOM
        ]
        for zd in restroom_zones:
            predicted_pct = min(1.0, zd.percentage + 0.25)
            preds.append(SurgePrediction(
                zone_id=zd.zone_id,
                zone_name=zd.zone_name,
                predicted_percentage=round(predicted_pct, 2),
                minutes_until=2,
                confidence=0.85,
                recommendation=f"{'Long wait expected' if predicted_pct > 0.7 else 'Good time to go'}"
                    + f" at {zd.zone_name}",
            ))
        return preds

    def _predict_early_exit(self, score_margin: int) -> list[SurgePrediction]:
        """Predict early exits when score is lopsided."""
        preds = []
        gate_zones = [
            zd for zd in self._get_current_densities()
            if self.simulator.zone_map[zd.zone_id].zone_type == ZoneType.GATE
        ]
        confidence = 0.75 if score_margin == 2 else 0.88
        for zd in gate_zones:
            predicted_pct = min(1.0, zd.percentage + (0.25 * score_margin / 3))
            preds.append(SurgePrediction(
                zone_id=zd.zone_id,
                zone_name=zd.zone_name,
                predicted_percentage=round(predicted_pct, 2),
                minutes_until=max(1, 90 - self.simulator.clock.minute_int),
                confidence=confidence,
                recommendation=f"Early exits expected at {zd.zone_name}."
                    + f" Consider using a less congested gate.",
            ))
        return preds

    def _predict_mass_exit(self, minute: int) -> list[SurgePrediction]:
        """Predict mass exit at full-time."""
        preds = []
        gate_zones = [
            zd for zd in self._get_current_densities()
            if self.simulator.zone_map[zd.zone_id].zone_type == ZoneType.GATE
        ]
        minutes_left = max(1, 90 - minute)
        for zd in gate_zones:
            predicted_pct = min(1.0, zd.percentage + 0.40)
            preds.append(SurgePrediction(
                zone_id=zd.zone_id,
                zone_name=zd.zone_name,
                predicted_percentage=round(predicted_pct, 2),
                minutes_until=minutes_left,
                confidence=0.78,
                recommendation=f"Leave via {zd.zone_name} {'now' if minutes_left <= 3 else f'in {minutes_left} min'}"
                    + " to beat the rush.",
            ))
        return preds

    def _get_current_densities(self) -> list:
        """Get current zone densities from the simulator."""
        snapshot = self.simulator._build_snapshot()
        return snapshot.zones
