/**
 * Dummy/demo data fixtures for offline mode.
 *
 * Provides realistic stadium crowd data so the UI renders
 * populated content when the backend WebSocket is unavailable.
 * Separated from hook logic to respect single-responsibility.
 */
import type { CrowdSnapshot, ZoneDensity, SurgePrediction, GameState } from "@/types";

/** Demo zone data: 14 zones across seating, food, restroom, gate types. */
export const DEMO_ZONES: ZoneDensity[] = [
  { zone_id: "A", zone_name: "Section A", zone_type: "seating", current_count: 4200, capacity: 5000, percentage: 0.84, trend: "rising", wait_minutes: 0, level: "busy" },
  { zone_id: "B", zone_name: "Section B", zone_type: "seating", current_count: 3100, capacity: 5000, percentage: 0.62, trend: "stable", wait_minutes: 0, level: "moderate" },
  { zone_id: "C", zone_name: "Section C", zone_type: "seating", current_count: 2400, capacity: 5000, percentage: 0.48, trend: "falling", wait_minutes: 0, level: "moderate" },
  { zone_id: "D", zone_name: "Section D", zone_type: "seating", current_count: 4800, capacity: 5000, percentage: 0.96, trend: "rising", wait_minutes: 0, level: "packed" },
  { zone_id: "F1", zone_name: "Food Court North", zone_type: "food", current_count: 180, capacity: 250, percentage: 0.72, trend: "rising", wait_minutes: 8, level: "busy" },
  { zone_id: "F2", zone_name: "Food Court South", zone_type: "food", current_count: 95, capacity: 250, percentage: 0.38, trend: "falling", wait_minutes: 3, level: "clear" },
  { zone_id: "F3", zone_name: "Food Court East", zone_type: "food", current_count: 140, capacity: 200, percentage: 0.70, trend: "stable", wait_minutes: 6, level: "busy" },
  { zone_id: "R1", zone_name: "Restroom North", zone_type: "restroom", current_count: 35, capacity: 60, percentage: 0.58, trend: "rising", wait_minutes: 4, level: "moderate" },
  { zone_id: "R2", zone_name: "Restroom South", zone_type: "restroom", current_count: 12, capacity: 60, percentage: 0.20, trend: "stable", wait_minutes: 0, level: "clear" },
  { zone_id: "R3", zone_name: "Restroom East", zone_type: "restroom", current_count: 50, capacity: 60, percentage: 0.83, trend: "rising", wait_minutes: 7, level: "busy" },
  { zone_id: "G1", zone_name: "Gate 1 (Main)", zone_type: "gate", current_count: 120, capacity: 400, percentage: 0.30, trend: "stable", wait_minutes: 2, level: "clear" },
  { zone_id: "G2", zone_name: "Gate 2 (East)", zone_type: "gate", current_count: 85, capacity: 400, percentage: 0.21, trend: "falling", wait_minutes: 1, level: "clear" },
  { zone_id: "G3", zone_name: "Gate 3 (West)", zone_type: "gate", current_count: 310, capacity: 400, percentage: 0.78, trend: "rising", wait_minutes: 5, level: "busy" },
  { zone_id: "G4", zone_name: "Gate 4 (VIP)", zone_type: "gate", current_count: 45, capacity: 200, percentage: 0.23, trend: "stable", wait_minutes: 0, level: "clear" },
];

/** Demo surge predictions with actionable recommendations. */
export const DEMO_PREDICTIONS: SurgePrediction[] = [
  { zone_id: "D", zone_name: "Section D", predicted_percentage: 0.98, minutes_until: 5, confidence: 0.87, recommendation: "Redirect foot traffic to Section B. Section D nearing full capacity." },
  { zone_id: "G3", zone_name: "Gate 3 (West)", predicted_percentage: 0.92, minutes_until: 12, confidence: 0.74, recommendation: "Suggest attendees use Gate 2 (East) for faster exit." },
  { zone_id: "F1", zone_name: "Food Court North", predicted_percentage: 0.88, minutes_until: 8, confidence: 0.69, recommendation: "Food Court South has shorter queues. Redirect via signage." },
];

/** Demo game state: second half, 67th minute, home leading 2-1. */
export const DEMO_GAME_STATE: GameState = {
  minute: 67,
  phase: "second_half",
  home_score: 2,
  away_score: 1,
  speed_multiplier: 1,
  is_paused: false,
};

/** Constructs a complete demo snapshot for offline rendering. */
export function buildDemoSnapshot(): CrowdSnapshot {
  return {
    timestamp: new Date().toISOString(),
    server_timestamp: Date.now() / 1000,
    game_state: DEMO_GAME_STATE,
    zones: DEMO_ZONES,
    total_attendance: 15572,
    predictions: DEMO_PREDICTIONS,
  };
}
