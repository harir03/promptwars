/**
 * Admin dashboard page — live VenuePulse crowd management.
 *
 * Three tabs: LIVE OVERVIEW (KPIs, charts, surge alerts),
 * ZONE GRID (categorized zone cards), and EVENT LOG.
 * Data flows from the useWebSocket hook (real or demo).
 */
import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn, formatPct, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Users, Activity, TrendingUp, Timer, AlertTriangle,
  HelpCircle, ChevronDown, Layers, BarChart3, Zap,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/StatCard";
import { DonutChartCard } from "@/components/dashboard/DonutChartCard";
import { ProgressBarCard } from "@/components/dashboard/ProgressBarCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { AdminEventLog } from "@/components/dashboard/AdminEventLog";

import type { ZoneDensity, SurgePrediction, DensityLevel } from "@/types";

/* ─── Constants ─── */

const TAB_OPTIONS = ["LIVE OVERVIEW", "ZONE GRID", "EVENT LOG"] as const;
type TabName = (typeof TAB_OPTIONS)[number];

const TIME_RANGE_OPTIONS = ["Real-time", "Last 5 min", "Last 15 min", "Full Match"] as const;

/** Maps density level to a Tailwind color class with glow. */
const DENSITY_COLOR_MAP: Record<DensityLevel, string> = {
  packed: "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
  busy: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]",
  moderate: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]",
  clear: "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.4)]",
};

/* ─── Pure data helpers ─── */

/** Counts zones matching a given density level. */
function countByLevel(zones: ZoneDensity[], level: DensityLevel): number {
  return zones.filter((zone) => zone.level === level).length;
}

/** Computes average wait time across zones that have non-zero waits. */
function computeAverageWait(zones: ZoneDensity[]): number {
  const waitingZones = zones.filter((zone) => zone.wait_minutes > 0);
  if (waitingZones.length === 0) return 0;
  const totalWait = waitingZones.reduce((sum, zone) => sum + zone.wait_minutes, 0);
  return totalWait / waitingZones.length;
}

/** Builds donut chart data from zone density levels. */
function buildZoneHealthData(zones: ZoneDensity[]) {
  return [
    { name: "Clear", value: countByLevel(zones, "clear"), color: "#2dd4bf" },
    { name: "Moderate", value: countByLevel(zones, "moderate"), color: "#f59e0b" },
    { name: "Busy", value: countByLevel(zones, "busy"), color: "#f97316" },
    { name: "Packed", value: countByLevel(zones, "packed"), color: "#ef4444" },
  ].filter((entry) => entry.value > 0);
}

/** Builds donut chart data from zone types. */
function buildZoneTypeData(zones: ZoneDensity[]) {
  return [
    { name: "Seating", value: zones.filter((z) => z.zone_type === "seating").length, color: "#2dd4bf" },
    { name: "Food", value: zones.filter((z) => z.zone_type === "food").length, color: "#fb923c" },
    { name: "Restroom", value: zones.filter((z) => z.zone_type === "restroom").length, color: "#818cf8" },
    { name: "Gate", value: zones.filter((z) => z.zone_type === "gate").length, color: "#f472b6" },
  ].filter((entry) => entry.value > 0);
}

/** Returns top N zones by occupancy, formatted for ProgressBarCard. */
function buildHottestZones(zones: ZoneDensity[], count: number = 5) {
  return [...zones]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, count)
    .map((zone) => ({
      label: zone.zone_name,
      value: formatPct(zone.percentage),
      percent: Math.round(zone.percentage * 100),
      color: DENSITY_COLOR_MAP[zone.level],
    }));
}

/** Finds the zone with the highest occupancy percentage. */
function findPeakZone(zones: ZoneDensity[]): ZoneDensity | null {
  if (zones.length === 0) return null;
  return zones.reduce((max, zone) => (zone.percentage > max.percentage ? zone : max), zones[0]);
}

/** Filters zones by a given zone type. */
function filterByType(zones: ZoneDensity[], zoneType: string): ZoneDensity[] {
  return zones.filter((zone) => zone.zone_type === zoneType);
}

/* ─── Sub-components (each ≤20 lines JSX) ─── */

/** Tab bar with pill-style active indicator. */
function TabBar({ activeTab, onTabChange }: { activeTab: TabName; onTabChange: (tab: TabName) => void }) {
  return (
    <div role="tablist" aria-label="Dashboard views" className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-100">
      {TAB_OPTIONS.map((tab, index) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`tabpanel-${tab.replace(/\s+/g, '-').toLowerCase()}`}
          id={`tab-${tab.replace(/\s+/g, '-').toLowerCase()}`}
          onClick={() => onTabChange(tab)}
          className={cn(
            "px-4 py-2 rounded-md text-[11px] font-black transition-all flex items-center gap-1.5",
            activeTab === tab
              ? "bg-teal-500 text-white shadow-md shadow-teal-100"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          )}
        >
          {tab}
          {index === 2 && <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}

/** Connection status badge + time range selector. */
function HeaderControls({ isConnected, selectedTime, onTimeChange }: {
  isConnected: boolean;
  selectedTime: string;
  onTimeChange: (time: string) => void;
}) {
  const [isTimeOpen, setIsTimeOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <ConnectionBadge isConnected={isConnected} />
      <div className="relative">
        <button
          onClick={() => setIsTimeOpen(!isTimeOpen)}
          onBlur={() => setTimeout(() => setIsTimeOpen(false), 200)}
          aria-haspopup="listbox"
          aria-expanded={isTimeOpen}
          aria-label={`Time range: ${selectedTime}`}
          className="flex items-center gap-6 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
        >
          {selectedTime}
          <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform", isTimeOpen && "rotate-180")} aria-hidden="true" />
        </button>
        {isTimeOpen && (
          <TimeDropdown onSelect={(time) => { onTimeChange(time); setIsTimeOpen(false); }} />
        )}
      </div>
    </div>
  );
}

/** Green/amber badge showing WebSocket connection state. */
function ConnectionBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isConnected ? "WebSocket connected" : "WebSocket reconnecting"}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
        isConnected ? "bg-teal-50 border-teal-100 text-teal-600" : "bg-amber-50 border-amber-200 text-amber-600"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-teal-500 animate-pulse-dot" : "bg-amber-500")} aria-hidden="true" />
      {isConnected ? "Connected" : "Reconnecting"}
    </div>
  );
}

/** Dropdown menu for time range selection. */
function TimeDropdown({ onSelect }: { onSelect: (time: string) => void }) {
  return (
    <ul role="listbox" aria-label="Select time range" className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 p-1 z-50 animate-in fade-in slide-in-from-top-2">
      {TIME_RANGE_OPTIONS.map((time) => (
        <li key={time} role="option" aria-selected={false}>
          <button
            onClick={() => onSelect(time)}
            className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-teal-600 rounded-md transition-colors"
          >
            {time}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Surge prediction alert banner. */
function SurgeAlertBanner({ predictions }: { predictions: SurgePrediction[] }) {
  if (predictions.length === 0) return null;
  return (
    <section aria-label="Surge predictions" role="alert" aria-live="polite" className="sl-card p-4 bg-amber-50 border-amber-200">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" aria-hidden="true" />
        <h2 className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Active Surge Predictions</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {predictions.slice(0, 6).map((prediction, index) => (
          <div key={index} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 border border-amber-100">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{prediction.zone_name}</p>
              <p className="text-[10px] text-slate-500 truncate">{prediction.recommendation}</p>
            </div>
            <div className="text-right ml-2 shrink-0">
              <span className="text-xs font-black text-amber-600">{Math.round(prediction.confidence * 100)}%</span>
              <p className="text-[9px] text-slate-400">{prediction.minutes_until}m</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Highlight card for the most occupied zone + gate quick status. */
function PeakZoneCard({ peakZone, gateZones }: { peakZone: ZoneDensity; gateZones: ZoneDensity[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="sl-card p-5 bg-white flex flex-col justify-center gap-4 group hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
          <TrendingUp className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Hottest Zone Right Now</span>
          <p className="text-sm font-bold text-slate-900">{peakZone.zone_name}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-slate-900">{formatPct(peakZone.percentage)}</span>
          <p className="text-[10px] text-slate-400">{peakZone.current_count.toLocaleString()} people</p>
        </div>
      </div>
      <GateStatusRow gateZones={gateZones} />
    </motion.div>
  );
}

/** Compact row showing exit gate occupancy levels. */
function GateStatusRow({ gateZones }: { gateZones: ZoneDensity[] }) {
  const sortedGates = [...gateZones].sort((a, b) => a.percentage - b.percentage);
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exit Gates</p>
      <div className="flex gap-2">
        {sortedGates.map((gate) => {
          const density = DENSITY_MAP[gate.level];
          return (
            <div key={gate.zone_id} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-center", density.bg)}>
              <p className="text-[10px] font-bold text-slate-700">{gate.zone_name}</p>
              <p className={cn("text-xs font-black", density.css)}>{formatPct(gate.percentage)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Categorized zone card grid — DRY: reuses a single renderer for all zone types. */
function ZoneGridSection({ zones, zoneType, label, icon: Icon }: {
  zones: ZoneDensity[];
  zoneType: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const filteredZones = filterByType(zones, zoneType);
  if (filteredZones.length === 0) return null;
  return (
    <div>
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredZones.map((zone) => <ZoneCard key={zone.zone_id} zone={zone} />)}
      </div>
    </div>
  );
}

/* ─── Zone grid config to avoid repetition ─── */
const ZONE_GRID_SECTIONS = [
  { zoneType: "seating", label: "Seating Sections", icon: Layers },
  { zoneType: "food", label: "Food Courts", icon: Zap },
  { zoneType: "restroom", label: "Restrooms", icon: Activity },
  { zoneType: "gate", label: "Exit Gates", icon: BarChart3 },
] as const;

/* ─── Main page component ─── */

/** Admin dashboard page with live crowd monitoring. */
export function AdminPage() {
  const { snapshot, connected } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabName>("LIVE OVERVIEW");
  const [selectedTime, setSelectedTime] = useState("Real-time");

  const zones = snapshot?.zones ?? [];
  const predictions = snapshot?.predictions ?? [];
  const peakZone = findPeakZone(zones);

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto bg-slate-50/30 min-h-screen">
      {/* Top Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <HeaderControls isConnected={connected} selectedTime={selectedTime} onTimeChange={setSelectedTime} />
      </div>

      {activeTab === "LIVE OVERVIEW" && (
        <div role="tabpanel" id="tabpanel-live-overview" aria-labelledby="tab-live-overview">
          <LiveOverviewTab zones={zones} predictions={predictions} peakZone={peakZone} snapshot={snapshot} />
        </div>
      )}
      {activeTab === "ZONE GRID" && (
        <div role="tabpanel" id="tabpanel-zone-grid" aria-labelledby="tab-zone-grid">
          <ZoneGridTab zones={zones} snapshot={snapshot} />
        </div>
      )}
      {activeTab === "EVENT LOG" && (
        <div role="tabpanel" id="tabpanel-event-log" aria-labelledby="tab-event-log" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <AdminEventLog />
        </div>
      )}
    </div>
  );
}

/** Live overview tab content — KPIs, charts, surge alerts, peak zone. */
function LiveOverviewTab({ zones, predictions, peakZone, snapshot }: {
  zones: ZoneDensity[];
  predictions: SurgePrediction[];
  peakZone: ZoneDensity | null;
  snapshot: ReturnType<typeof useWebSocket>["snapshot"];
}) {
  const averageWaitMinutes = computeAverageWait(zones);
  const packedCount = countByLevel(zones, "packed");
  const busyCount = countByLevel(zones, "busy");
  const risingCount = zones.filter((zone) => zone.trend === "rising").length;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <GameClockDisplay gameState={snapshot?.game_state ?? null} />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Attendance" value={(snapshot?.total_attendance ?? 0).toLocaleString()} icon={Users} variant="teal" />
        <StatCard label="Packed Zones" value={packedCount} icon={TrendingUp} variant="red" />
        <StatCard label="Busy Zones" value={busyCount} icon={BarChart3} variant="orange" />
        <StatCard label="Rising" value={risingCount} icon={TrendingUp} variant="orange" />
        <StatCard label="Avg Wait" value={`${averageWaitMinutes.toFixed(1)}m`} icon={Timer} variant="gray" />
        <StatCard label="Surge Alerts" value={predictions.length} icon={Activity} variant="orange" />
      </div>
      <SurgeAlertBanner predictions={predictions} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChartCard title="Zone Health Distribution" data={buildZoneHealthData(zones)} />
        <DonutChartCard title="Zone Type Breakdown" data={buildZoneTypeData(zones)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProgressBarCard title="Hottest Zones" data={buildHottestZones(zones)} />
        {peakZone && <PeakZoneCard peakZone={peakZone} gateZones={filterByType(zones, "gate")} />}
      </div>
    </div>
  );
}

/** Zone grid tab content — categorized zone cards. */
function ZoneGridTab({ zones, snapshot }: {
  zones: ZoneDensity[];
  snapshot: ReturnType<typeof useWebSocket>["snapshot"];
}) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <GameClockDisplay gameState={snapshot?.game_state ?? null} />
      {ZONE_GRID_SECTIONS.map((section) => (
        <ZoneGridSection key={section.zoneType} zones={zones} {...section} />
      ))}
    </div>
  );
}
