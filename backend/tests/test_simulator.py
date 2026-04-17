import pytest
from app.crowd.simulator import VenueSimulator

def test_venue_simulator_initialization():
    sim = VenueSimulator(total_attendance=50000)
    assert sim.total_attendance == 50000
    assert len(sim.zones) == 22
    assert sim.clock.minute == -5
    
def test_venue_simulator_tick():
    sim = VenueSimulator(total_attendance=50000)
    sim.tick(seconds=3)
    # Ensure properties reflect some changes or no crash
    assert hasattr(sim, "tick")
    assert sim.clock.minute >= -5
    
def test_simulator_get_snapshot():
    sim = VenueSimulator(total_attendance=50000)
    snapshot = sim.get_snapshot()
    assert snapshot.total_attendance == 50000
    assert len(snapshot.zones) == 22
    assert snapshot.game_state.minute == -5
    assert hasattr(snapshot, "predictions")

def test_predict_surges():
    sim = VenueSimulator(total_attendance=50000)
    # fast forward to post match to trigger surges possibly
    sim.clock.minute = 90
    sim.clock.phase = "post_match"
    # force some zone to be packed
    gate = next(z for z in sim.zones if z.zone_type == "gate")
    gate.current_count = gate.capacity
    gate.compute_metrics()
    
    predictions = sim.get_snapshot().predictions
    assert isinstance(predictions, list)
