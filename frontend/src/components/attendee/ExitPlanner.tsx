import type { SurgePrediction, ZoneDensity } from "@/types";
import { cn, DENSITY_MAP, formatPct } from "@/lib/utils";
import { LogOut, Clock, AlertTriangle, ArrowRight } from "lucide-react";

interface ExitPlannerProps {
  zones: ZoneDensity[];
  predictions: SurgePrediction[];
  gameMinute: number;
}

/**
 * Exit Planner — recommends the best gate and time to leave.
 * Core attendee feature for post-match crowd management.
 */
export function ExitPlanner({ zones, predictions, gameMinute }: ExitPlannerProps) {
  const gates = zones
    .filter((z) => z.zone_type === "gate")
    .sort((a, b) => a.percentage - b.percentage);

  const bestGate = gates[0];
  const worstGate = gates[gates.length - 1];

  // Check if there's a surge predicted for gates
  const gatePredictions = predictions.filter((p) =>
    zones.find((z) => z.zone_id === p.zone_id && z.zone_type === "gate")
  );

  // Smart recommendation
  const isPostMatch = gameMinute >= 90;
  const isNearEnd = gameMinute >= 80;

  let recommendation: string;
  if (isPostMatch) {
    recommendation = bestGate
      ? `Head to ${bestGate.zone_name} now — it's at ${formatPct(bestGate.percentage)} capacity. Avoid ${worstGate?.zone_name ?? "crowded gates"}.`
      : "Check gates for current status.";
  } else if (isNearEnd) {
    recommendation = "Consider leaving 5 minutes early to avoid the post-match rush. Check gate status below.";
  } else {
    recommendation = "No rush yet! Gate status will update as the match nears its end.";
  }

  return (
    <div className="sl-card p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
          <LogOut className="w-4 h-4 text-teal-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Exit Planner</h3>
          <p className="text-[10px] text-slate-400">Smart exit recommendations</p>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5 mb-3">
        <p className="text-xs text-teal-700 font-medium leading-relaxed">{recommendation}</p>
      </div>

      {/* Gate Rankings */}
      <div className="space-y-1.5">
        {gates.map((gate, i) => {
          const display = DENSITY_MAP[gate.level];
          const isBest = i === 0;
          return (
            <div
              key={gate.zone_id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                isBest ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-100"
              )}
            >
              {isBest && (
                <span className="text-[8px] font-black text-green-600 bg-green-100 px-1.5 py-0.5 rounded uppercase">
                  Best
                </span>
              )}
              <span className="text-xs font-bold text-slate-800 flex-1">{gate.zone_name}</span>
              <span className="text-[10px]" aria-hidden="true">{display.icon}</span>
              <span className={cn("text-xs font-extrabold", display.css)}>
                {formatPct(gate.percentage)}
              </span>
              {gate.wait_minutes > 0 && (
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <Clock className="w-3 h-3" /> {gate.wait_minutes.toFixed(0)}m
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Gate Prediction Alert */}
      {gatePredictions.length > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 uppercase">Upcoming Surge</span>
          </div>
          {gatePredictions.slice(0, 2).map((p, i) => (
            <p key={i} className="text-[10px] text-slate-600">
              {p.zone_name}: {formatPct(p.predicted_percentage)} in {p.minutes_until} min
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
