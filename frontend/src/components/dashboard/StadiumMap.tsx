import { useMemo } from "react";
import type { ZoneDensity } from "@/types";
import { cn, DENSITY_MAP, formatPct } from "@/lib/utils";
import { motion } from "framer-motion";

interface StadiumMapProps {
  zones: ZoneDensity[];
  onZoneClick?: (zoneId: string) => void;
}

/**
 * SVG-based stadium heatmap for DY Patil — oval layout.
 * Each zone is a colored section that updates in real-time.
 * Colors shift from green → yellow → orange → red with density.
 */

const DENSITY_COLORS: Record<string, string> = {
  clear: "#22c55e",
  moderate: "#eab308",
  busy: "#f97316",
  packed: "#ef4444",
};

const DENSITY_BG_LIGHT: Record<string, string> = {
  clear: "#dcfce7",
  moderate: "#fef9c3",
  busy: "#ffedd5",
  packed: "#fee2e2",
};

// Stadium layout: zones positioned around an oval
// Center of the stadium at (400, 300), oval radii (320, 220)
const ZONE_POSITIONS: Record<string, { x: number; y: number; w: number; h: number; label: string; type: string }> = {
  // Seating — around the oval
  A: { x: 165, y: 80, w: 110, h: 50, label: "Section A", type: "seating" },
  B: { x: 310, y: 40, w: 110, h: 50, label: "Section B", type: "seating" },
  C: { x: 460, y: 40, w: 110, h: 50, label: "Section C", type: "seating" },
  D: { x: 605, y: 80, w: 110, h: 50, label: "Section D", type: "seating" },
  E: { x: 660, y: 200, w: 55, h: 100, label: "E", type: "seating" },
  F: { x: 660, y: 320, w: 55, h: 100, label: "F", type: "seating" },
  G: { x: 605, y: 460, w: 110, h: 50, label: "Section G", type: "seating" },
  H: { x: 165, y: 460, w: 110, h: 50, label: "Section H", type: "seating" },

  // Food Courts — corners
  F1: { x: 80, y: 130, w: 70, h: 40, label: "🍔 F1", type: "food" },
  F2: { x: 730, y: 130, w: 70, h: 40, label: "🍔 F2", type: "food" },
  F3: { x: 730, y: 430, w: 70, h: 40, label: "🍔 F3", type: "food" },
  F4: { x: 80, y: 430, w: 70, h: 40, label: "🍔 F4", type: "food" },

  // Restrooms — mid-sides
  R1: { x: 80, y: 230, w: 65, h: 36, label: "🚻 R1", type: "restroom" },
  R2: { x: 80, y: 330, w: 65, h: 36, label: "🚻 R2", type: "restroom" },
  R3: { x: 735, y: 230, w: 65, h: 36, label: "🚻 R3", type: "restroom" },
  R4: { x: 735, y: 330, w: 65, h: 36, label: "🚻 R4", type: "restroom" },

  // Gates — perimeter
  G1: { x: 310, y: 520, w: 60, h: 34, label: "Gate 1", type: "gate" },
  G2: { x: 390, y: 520, w: 60, h: 34, label: "Gate 2", type: "gate" },
  G3: { x: 470, y: 520, w: 60, h: 34, label: "Gate 3", type: "gate" },
  G4: { x: 160, y: 290, w: 55, h: 34, label: "G4", type: "gate" },
  G5: { x: 665, y: 445, w: 55, h: 34, label: "G5", type: "gate" },
  G6: { x: 550, y: 520, w: 60, h: 34, label: "Gate 6", type: "gate" },
};

export function StadiumMap({ zones, onZoneClick }: StadiumMapProps) {
  const zoneMap = useMemo(() => {
    const map: Record<string, ZoneDensity> = {};
    zones.forEach((z) => { map[z.zone_id] = z; });
    return map;
  }, [zones]);

  return (
    <div className="sl-card p-5 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-900 font-bold text-sm tracking-tight">🏟️ Venue Heatmap — DY Patil Stadium</h3>
        <div className="flex items-center gap-3">
          {(["clear", "moderate", "busy", "packed"] as const).map((level) => (
            <div key={level} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DENSITY_COLORS[level] }} />
              <span className="text-[9px] font-bold text-slate-400 uppercase">{level}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 880 580" className="w-full h-auto min-w-[600px]">
          {/* Stadium Oval Outline */}
          <ellipse cx="430" cy="290" rx="330" ry="230" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
          {/* Pitch */}
          <ellipse cx="430" cy="290" rx="180" ry="120" fill="#ecfdf5" stroke="#86efac" strokeWidth="1.5" strokeDasharray="6 3" />
          <text x="430" y="295" textAnchor="middle" className="text-[14px] font-bold" fill="#86efac">⚽ PITCH</text>

          {/* Zone Rectangles */}
          {Object.entries(ZONE_POSITIONS).map(([id, pos]) => {
            const zone = zoneMap[id];
            const level = zone?.level ?? "clear";
            const pct = zone?.percentage ?? 0;
            const color = DENSITY_COLORS[level];
            const bgColor = DENSITY_BG_LIGHT[level];
            const isSeating = pos.type === "seating";

            return (
              <g
                key={id}
                onClick={() => onZoneClick?.(id)}
                className="cursor-pointer"
                role="button"
                aria-label={`${pos.label}: ${level}, ${formatPct(pct)}`}
              >
                {/* Background */}
                <motion.rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.w}
                  height={pos.h}
                  rx={6}
                  fill={bgColor}
                  stroke={color}
                  strokeWidth={1.5}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Fill bar (density level) */}
                <motion.rect
                  x={pos.x}
                  y={pos.y + pos.h * (1 - pct)}
                  width={pos.w}
                  height={pos.h * pct}
                  rx={0}
                  fill={color}
                  opacity={0.25}
                  clipPath={`inset(0 0 0 0 round 0 0 6px 6px)`}
                  animate={{ height: pos.h * pct, y: pos.y + pos.h * (1 - pct) }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />

                {/* Label */}
                <text
                  x={pos.x + pos.w / 2}
                  y={pos.y + pos.h / 2 - 4}
                  textAnchor="middle"
                  className={isSeating ? "text-[10px] font-bold" : "text-[9px] font-bold"}
                  fill={color}
                >
                  {pos.label}
                </text>

                {/* Percentage */}
                <text
                  x={pos.x + pos.w / 2}
                  y={pos.y + pos.h / 2 + 10}
                  textAnchor="middle"
                  className="text-[11px] font-black"
                  fill="#1e293b"
                >
                  {formatPct(pct)}
                </text>

                {/* Wait time badge for food/restroom */}
                {zone && zone.wait_minutes > 0 && (pos.type === "food" || pos.type === "restroom") && (
                  <g>
                    <rect x={pos.x + pos.w - 22} y={pos.y - 6} width={24} height={14} rx={7} fill={color} />
                    <text x={pos.x + pos.w - 10} y={pos.y + 4} textAnchor="middle" className="text-[7px] font-black" fill="white">
                      {zone.wait_minutes.toFixed(0)}m
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
