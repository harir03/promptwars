import type { GameState } from "@/types";
import { cn } from "@/lib/utils";
import { Timer } from "lucide-react";

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
  pre_match: "text-blue-500",
  first_half: "text-teal-500",
  halftime: "text-amber-500",
  second_half: "text-teal-500",
  post_match: "text-slate-400",
};

/** Game clock display — light mode, matching template card style. */
export function GameClockDisplay({ gameState }: GameClockProps) {
  if (!gameState) return null;

  const phaseLabel = PHASE_LABELS[gameState.phase] ?? gameState.phase;
  const phaseColor = PHASE_COLORS[gameState.phase] ?? "text-slate-600";

  return (
    <div className="sl-card px-4 py-3 flex items-center justify-between bg-white" role="status" aria-label="Game clock">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
          <Timer className="w-4 h-4 text-teal-500" strokeWidth={2.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
            {gameState.minute < 0 ? `T${gameState.minute}` : `${gameState.minute}'`}
          </span>
          <span className={cn("text-xs font-bold uppercase tracking-wider", phaseColor)}>
            {phaseLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Score */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
          <span className="text-sm font-black text-slate-900">{gameState.home_score}</span>
          <span className="text-xs text-slate-300">-</span>
          <span className="text-sm font-black text-slate-900">{gameState.away_score}</span>
        </div>

        {/* Speed */}
        <div className="px-2 py-1 bg-teal-50 rounded-md">
          <span className="text-[10px] font-bold text-teal-600">{gameState.speed_multiplier}x</span>
        </div>
      </div>
    </div>
  );
}
