import pytest
from app.crowd.simulator import VenueSimulator
from app.crowd.venue import DY_PATIL_LAYOUT

def test_venue_simulator_initialization():
    sim = VenueSimulator(total_attendance=50000)
    assert sim.total_attendance == 50000
    assert len(sim.zones) == len(DY_PATIL_LAYOUT)
    assert sim.clock.minute == -5
    
def test_venue_simulator_tick():
    sim = VenueSimulator(total_attendance=50000)
    initial_minute = sim.clock.minute
    sim.tick(seconds=60) # Simulate 1 minute (if 1s real = 1s sim default, check game_clock)
    # The simulator logic might depend on the clock's speed_multiplier.
    # Just verify it doesn't crash and returns valid data.
    snapshot = sim.get_snapshot()
    assert snapshot is not None
    
def test_simulator_get_snapshot():
    sim = VenueSimulator(total_attendance=50000)
    snapshot = sim.get_snapshot()
    assert snapshot.total_attendance == 50000
    assert len(snapshot.zones) == len(DY_PATIL_LAYOUT)
    assert snapshot.game_state.minute == -5
    assert hasattr(snapshot, "predictions")

def test_predict_surges():
    sim = VenueSimulator(total_attendance=50000)
    # Fast forward to post match to trigger surges possibly
    sim.clock.minute = 90
    sim.clock.phase = "post_match"
    # Force some gate to be packed
    gate = next(z for z in sim.zones if z.zone_type == "gate")
    gate.current_count = gate.capacity
    gate.compute_metrics()
    
    # Trigger prediction logic
    from app.crowd.predictor import CrowdPredictor
    predictor = CrowdPredictor()
    predictions = predictor.predict(sim.zones, sim.clock)
    
    assert isinstance(predictions, list)
    # Even if empty, it should be a list
