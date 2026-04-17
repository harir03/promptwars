import type { GameState } from "@/types";
import { cn } from "@/lib/utils";
import { Timer, Pause, Play } from "lucide-react";

interface GameClockProps {
  gameState: GameState | null;
}

const PHASE_LABELS: Record<string, string> = {
  pre_match: "Pre-Match",
  first_half: "1st Half",
  halftime: "Halftime",
  second_half: "2nd Half",
  post_match: "Full Time",
};

const PHASE_COLORS: Record<string, string> = {
  pre_match: "text-vp-blue",
  first_half: "text-vp-accent",
  halftime: "text-vp-warning",
  second_half: "text-vp-accent",
  post_match: "text-vp-text-muted",
};

export function GameClockDisplay({ gameState }: GameClockProps) {
  if (!gameState) return null;

  const phaseLabel = PHASE_LABELS[gameState.phase] ?? gameState.phase;
  const phaseColor = PHASE_COLORS[gameState.phase] ?? "text-white";

  return (
    <div className="glass-card px-4 py-3 flex items-center justify-between" role="status" aria-label="Game clock">
      <div className="flex items-center gap-3">
        <Timer className="w-4 h-4 text-vp-accent" />
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white tabular-nums">
            {gameState.minute < 0 ? `T${gameState.minute}` : `${gameState.minute}'`}
          </span>
          <span className={cn("text-xs font-bold uppercase tracking-wider", phaseColor)}>
            {phaseLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Score */}
        <div className="flex items-center gap-2 px-3 py-1 bg-vp-dark rounded-lg">
          <span className="text-sm font-black text-white">{gameState.home_score}</span>
          <span className="text-xs text-vp-text-muted">-</span>
          <span className="text-sm font-black text-white">{gameState.away_score}</span>
        </div>

        {/* Speed */}
        <div className="text-[10px] font-bold text-vp-text-muted">
          {gameState.speed_multiplier}x
        </div>
      </div>
    </div>
  );
}
