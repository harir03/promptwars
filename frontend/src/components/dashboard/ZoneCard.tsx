import { cn, DENSITY_MAP, formatPct } from "@/lib/utils";
import type { ZoneDensity } from "@/types";
import { TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface ZoneCardProps {
  zone: ZoneDensity;
  compact?: boolean;
}

const trendIcons = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
};

/**
 * Zone density card — light mode, matching template's sl-card + StatCard pattern.
 * Uses color + icon + text label for colorblind safety (P13).
 */
export function ZoneCard({ zone, compact = false }: ZoneCardProps) {
  const display = DENSITY_MAP[zone.level];
  const TrendIcon = trendIcons[zone.trend];

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", display.bg)}
        role="status"
        aria-label={`${zone.zone_name}: ${display.label}, ${formatPct(zone.percentage)} capacity`}
      >
        <span className="text-sm" aria-hidden="true">{display.icon}</span>
        <span className="text-xs font-bold text-slate-800 truncate flex-1">{zone.zone_name}</span>
        <span className={cn("text-xs font-extrabold", display.css)}>{formatPct(zone.percentage)}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="sl-card p-3 flex flex-col gap-2 relative transition-all hover:shadow-md group bg-white"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-label={`${zone.zone_name}: ${display.label}, ${formatPct(zone.percentage)} capacity`}
    >
      {/* Header — matches template StatCard top row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight truncate transition-colors group-hover:text-slate-600">
          {zone.zone_name}
        </span>
        <div className={cn(
          "px-1.5 py-0.5 rounded-md flex items-center gap-1 border",
          display.bg
        )}>
          <span className="text-[10px]" aria-hidden="true">{display.icon}</span>
          <span className={cn("text-[10px] font-extrabold", display.css)}>{display.label}</span>
        </div>
      </div>

      {/* Value — matches template StatCard value */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">
          {formatPct(zone.percentage)}
        </span>
        <TrendIcon
          className={cn(
            "w-3.5 h-3.5",
            zone.trend === "rising" ? "text-red-400" :
            zone.trend === "falling" ? "text-green-500" : "text-slate-300"
          )}
          aria-label={`Trend: ${zone.trend}`}
        />
      </div>

      {/* Progress bar — light mode, WCAG 4.1.2 compliant */}
      <div
        className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(zone.percentage * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${zone.zone_name} occupancy: ${Math.round(zone.percentage * 100)}%`}
      >
        <motion.div
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            zone.level === "clear" ? "bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.4)]" :
            zone.level === "moderate" ? "bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.4)]" :
            zone.level === "busy" ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" :
            "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(zone.percentage * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {zone.wait_minutes > 0 && (
        <span className="text-[10px] font-semibold text-slate-400">
          ~{zone.wait_minutes.toFixed(0)} min wait
        </span>
      )}

      <span className="text-[10px] text-slate-400">
        {zone.current_count.toLocaleString()} / {zone.capacity.toLocaleString()}
      </span>
    </motion.div>
  );
}
