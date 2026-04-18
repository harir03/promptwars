import { useState, useMemo } from "react";
import { cn, formatPct, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, TrendingUp, TrendingDown, Minus,
  Users, Timer, ChevronDown
} from "lucide-react";
import type { ZoneDensity } from "@/types";

/**
 * ZoneComparison — Side-by-side comparison of two zones.
 * Allows attendees or admins to compare density, wait times, trends.
 */
export function ZoneComparison({ zones }: { zones: ZoneDensity[] }) {
  const [leftId, setLeftId] = useState<string>(zones[0]?.zone_id ?? "");
  const [rightId, setRightId] = useState<string>(zones[1]?.zone_id ?? "");

  const leftZone = useMemo(() => zones.find(z => z.zone_id === leftId), [zones, leftId]);
  const rightZone = useMemo(() => zones.find(z => z.zone_id === rightId), [zones, rightId]);

  const trendIcon = (trend: string) => {
    if (trend === "rising") return <TrendingUp className="w-3.5 h-3.5 text-rose-500" />;
    if (trend === "falling") return <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />;
    return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  };

  const ZoneSelector = ({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) => (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:border-teal-400 focus:outline-none transition-colors cursor-pointer"
        aria-label={label}
      >
        {zones.map(z => (
          <option key={z.zone_id} value={z.zone_id}>
            {z.zone_name} ({formatPct(z.percentage)})
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );

  const MetricRow = ({ label, left, right, highlight }: {
    label: string; left: string | number; right: string | number; highlight?: "lower" | "higher";
  }) => {
    const lVal = typeof left === "number" ? left : parseFloat(left) || 0;
    const rVal = typeof right === "number" ? right : parseFloat(right) || 0;
    const leftBetter = highlight === "lower" ? lVal < rVal : lVal > rVal;
    const rightBetter = highlight === "lower" ? rVal < lVal : rVal > lVal;

    return (
      <div className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
        <span className={cn(
          "flex-1 text-right text-xs font-bold",
          leftBetter ? "text-teal-600" : "text-slate-700"
        )}>
          {left}
        </span>
        <span className="w-20 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
          {label}
        </span>
        <span className={cn(
          "flex-1 text-left text-xs font-bold",
          rightBetter ? "text-teal-600" : "text-slate-700"
        )}>
          {right}
        </span>
      </div>
    );
  };

  if (zones.length < 2) return null;

  return (
    <div className="sl-card p-5 bg-white">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-1.5">
        <ArrowLeftRight className="w-4 h-4 text-violet-500" /> Zone Comparison
      </h3>

      {/* Zone Selectors */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-5">
        <ZoneSelector value={leftId} label="Select first zone to compare" onChange={setLeftId} />
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <ZoneSelector value={rightId} label="Select second zone to compare" onChange={setRightId} />
      </div>

      {leftZone && rightZone && (
        <motion.div
          key={`${leftId}-${rightId}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Density Bars */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-4">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <span className="text-2xl font-black text-slate-900">{formatPct(leftZone.percentage)}</span>
                {trendIcon(leftZone.trend)}
              </div>
              <div className="flex justify-end">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all float-right", DENSITY_MAP[leftZone.level].bg)}
                    style={{ width: `${Math.round(leftZone.percentage * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 uppercase">vs</span>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-2xl font-black text-slate-900">{formatPct(rightZone.percentage)}</span>
                {trendIcon(rightZone.trend)}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", DENSITY_MAP[rightZone.level].bg)}
                  style={{ width: `${Math.round(rightZone.percentage * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Metrics Comparison */}
          <div className="bg-slate-50/50 rounded-lg px-4 py-1">
            <MetricRow
              label="People"
              left={leftZone.current_count.toLocaleString()}
              right={rightZone.current_count.toLocaleString()}
              highlight="lower"
            />
            <MetricRow
              label="Capacity"
              left={leftZone.capacity.toLocaleString()}
              right={rightZone.capacity.toLocaleString()}
            />
            <MetricRow
              label="Wait"
              left={leftZone.wait_minutes > 0 ? `${leftZone.wait_minutes}m` : "—"}
              right={rightZone.wait_minutes > 0 ? `${rightZone.wait_minutes}m` : "—"}
              highlight="lower"
            />
            <MetricRow
              label="Status"
              left={DENSITY_MAP[leftZone.level].label}
              right={DENSITY_MAP[rightZone.level].label}
            />
            <MetricRow
              label="Type"
              left={leftZone.zone_type}
              right={rightZone.zone_type}
            />
          </div>

          {/* Recommendation */}
          {leftZone.percentage !== rightZone.percentage && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-teal-50 border border-teal-100">
              <p className="text-[11px] font-bold text-teal-700">
                💡 {leftZone.percentage < rightZone.percentage
                  ? `${leftZone.zone_name} is less crowded — consider heading there`
                  : `${rightZone.zone_name} is less crowded — consider heading there`
                }
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
