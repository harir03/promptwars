import { cn, DENSITY_MAP, formatPct } from "@/lib/utils";
import type { ZoneDensity } from "@/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

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
 * Zone density indicator card with accessibility (P13).
 * Shows color + icon + text label for colorblind safety.
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
        <span className="text-xs font-bold text-white truncate flex-1">{zone.zone_name}</span>
        <span className={cn("text-xs font-extrabold", display.css)}>{formatPct(zone.percentage)}</span>
      </div>
    );
  }

  return (
    <motion.div
      className={cn("glass-card p-3 flex flex-col gap-2 border", display.bg)}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-label={`${zone.zone_name}: ${display.label}, ${formatPct(zone.percentage)} capacity`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-vp-text-secondary uppercase tracking-wide truncate">
          {zone.zone_name}
        </span>
        <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded", display.bg)}>
          <span className="text-xs" aria-hidden="true">{display.icon}</span>
          <span className={cn("text-[10px] font-extrabold", display.css)}>{display.label}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-black text-white tracking-tight">
          {formatPct(zone.percentage)}
        </span>
        <TrendIcon
          className={cn(
            "w-3.5 h-3.5",
            zone.trend === "rising" ? "text-red-400" :
            zone.trend === "falling" ? "text-green-400" : "text-vp-text-muted"
          )}
          aria-label={`Trend: ${zone.trend}`}
        />
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-vp-border rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            zone.level === "clear" ? "bg-green-500" :
            zone.level === "moderate" ? "bg-yellow-500" :
            zone.level === "busy" ? "bg-orange-500" : "bg-red-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(zone.percentage * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {zone.wait_minutes > 0 && (
        <span className="text-[10px] font-semibold text-vp-text-muted">
          ~{zone.wait_minutes.toFixed(0)} min wait
        </span>
      )}

      <span className="text-[10px] text-vp-text-muted">
        {zone.current_count.toLocaleString()} / {zone.capacity.toLocaleString()}
      </span>
    </motion.div>
  );
}
