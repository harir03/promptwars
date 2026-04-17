/** TypeScript types matching backend Pydantic models. */

export type ZoneType = "seating" | "food" | "restroom" | "gate" | "parking";
export type GamePhase = "pre_match" | "first_half" | "halftime" | "second_half" | "post_match";
export type DensityLevel = "clear" | "moderate" | "busy" | "packed";
export type DensityTrend = "rising" | "falling" | "stable";

export interface GameState {
  minute: number;
  phase: GamePhase;
  home_score: number;
  away_score: number;
  speed_multiplier: number;
  is_paused: boolean;
}

export interface ZoneDensity {
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType;
  current_count: number;
  capacity: number;
  percentage: number;
  trend: DensityTrend;
  wait_minutes: number;
  level: DensityLevel;
}

export interface SurgePrediction {
  zone_id: string;
  zone_name: string;
  predicted_percentage: number;
  minutes_until: number;
  confidence: number;
  recommendation: string;
}

export interface CrowdSnapshot {
  timestamp: string;
  server_timestamp: number;
  game_state: GameState;
  zones: ZoneDensity[];
  total_attendance: number;
  predictions: SurgePrediction[];
}

export interface ChatResponse {
  response: string;
  suggestions: string[];
  is_fallback: boolean;
}

export interface RewardOffer {
  id: string;
  zone_id: string;
  zone_name: string;
  description: string;
  discount_percent: number;
  points: number;
  duration_minutes: number;
  remaining_minutes: number;
  is_active: boolean;
}
