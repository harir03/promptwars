import { useState, useMemo, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { cn, formatPct, DENSITY_MAP } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Timer,
  Utensils, DoorOpen, ArrowUpRight, ArrowDownRight,
  Minus, Activity, PieChart, Download, Layers
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart as RPieChart, Pie, Legend
} from "recharts";
import type { ZoneDensity, CrowdSnapshot } from "@/types";
import { ZoneComparison } from "@/components/dashboard/ZoneComparison";

/* ===== Utility Components ===== */

function MiniStat({ label, value, icon: Icon, trend, color = "teal" }: {
  label: string; value: string | number; icon: any; trend?: "up" | "down" | "flat"; color?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "text-teal-500 bg-teal-50",
    orange: "text-orange-500 bg-orange-50",
    red: "text-red-500 bg-red-50",
    blue: "text-blue-500 bg-blue-50",
    violet: "text-violet-500 bg-violet-50",
  };
  const [iconClass, bgClass] = (colorMap[color] ?? colorMap.teal).split(" ");

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="sl-card p-4 bg-white flex flex-col gap-2 group hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", bgClass)}>
          <Icon className={cn("w-3.5 h-3.5", iconClass)} strokeWidth={2.5} />
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</span>
        {trend && (
          <span className={cn(
            "text-[10px] font-bold flex items-center gap-0.5 mb-0.5",
            trend === "up" ? "text-rose-500" : trend === "down" ? "text-emerald-500" : "text-slate-400"
          )}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> :
             trend === "down" ? <ArrowDownRight className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ===== Zone Type Distribution Pie ===== */
function ZoneDistPie({ zones }: { zones: ZoneDensity[] }) {
  const data = useMemo(() => {
    const counts = { clear: 0, moderate: 0, busy: 0, packed: 0 };
    zones.forEach(z => { counts[z.level]++; });
    return [
      { name: "Clear", value: counts.clear, fill: "#2dd4bf" },
      { name: "Moderate", value: counts.moderate, fill: "#fb923c" },
      { name: "Busy", value: counts.busy, fill: "#f97316" },
      { name: "Packed", value: counts.packed, fill: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [zones]);

  return (
    <div className="sl-card p-5 bg-white">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
        <PieChart className="w-4 h-4 text-violet-500" /> Zone Health Distribution
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <RPieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
            paddingAngle={4} dataKey="value" stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Legend verticalAlign="bottom" height={30}
            formatter={(value: string) => <span className="text-[11px] text-slate-600 font-semibold">{value}</span>} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            formatter={(value: number, name: string) => [`${value} zones`, name]} />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Zone Type Breakdown Bar Chart ===== */
function ZoneTypeBreakdown({ zones }: { zones: ZoneDensity[] }) {
  const data = useMemo(() => {
    const groups: Record<string, { total: number; avg: number; max: number; count: number }> = {};
    zones.forEach(z => {
      if (!groups[z.zone_type]) groups[z.zone_type] = { total: 0, avg: 0, max: 0, count: 0 };
      const g = groups[z.zone_type];
      g.total += z.current_count;
      g.max = Math.max(g.max, z.percentage);
      g.count++;
    });
    return Object.entries(groups).map(([type, g]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      people: g.total,
      avgDensity: Math.round((g.total / g.count / zones[0]?.capacity || 0) * 100),
      peakDensity: Math.round(g.max * 100),
    }));
  }, [zones]);

  const colors: Record<string, string> = { Seating: "#2dd4bf", Food: "#fb923c", Restroom: "#818cf8", Gate: "#f472b6" };

  return (
    <div className="sl-card p-5 bg-white">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
        <BarChart3 className="w-4 h-4 text-teal-500" /> People by Zone Type
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            formatter={(value: number) => [value.toLocaleString(), "People"]} />
          <Bar dataKey="people" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colors[entry.type] || "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Density Heatmap Table ===== */
function DensityTable({ zones }: { zones: ZoneDensity[] }) {
  const sorted = useMemo(() =>
    [...zones].sort((a, b) => b.percentage - a.percentage),
  [zones]);

  const trendIcon = (trend: string) => {
    if (trend === "rising") return <TrendingUp className="w-3 h-3 text-rose-500" />;
    if (trend === "falling") return <TrendingDown className="w-3 h-3 text-emerald-500" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  return (
    <div className="sl-card p-5 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-500" /> Zone Density Rankings
        </h3>
        <span className="text-[10px] font-black text-teal-500 uppercase tracking-widest">Live</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left py-2 font-bold">#</th>
              <th className="text-left py-2 font-bold">Zone</th>
              <th className="text-left py-2 font-bold">Type</th>
              <th className="text-right py-2 font-bold">People</th>
              <th className="text-right py-2 font-bold">Density</th>
              <th className="text-center py-2 font-bold">Trend</th>
              <th className="text-right py-2 font-bold">Wait</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((z, i) => {
              const dm = DENSITY_MAP[z.level];
              return (
                <tr key={z.zone_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-2 text-slate-400 font-bold">{i + 1}</td>
                  <td className="py-2 font-bold text-slate-800">{z.zone_name}</td>
                  <td className="py-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                      z.zone_type === "gate" ? "bg-pink-50 text-pink-500" :
                      z.zone_type === "food" ? "bg-orange-50 text-orange-500" :
                      z.zone_type === "restroom" ? "bg-violet-50 text-violet-500" :
                      "bg-teal-50 text-teal-500"
                    )}>
                      {z.zone_type}
                    </span>
                  </td>
                  <td className="py-2 text-right font-bold text-slate-700">{z.current_count.toLocaleString()}</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", dm.bg)}
                          style={{ width: `${Math.round(z.percentage * 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 w-8 text-right">{formatPct(z.percentage)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-center">{trendIcon(z.trend)}</td>
                  <td className="py-2 text-right text-slate-500">
                    {z.wait_minutes > 0 ? `${z.wait_minutes}m` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Flow Rate Chart ===== */
function FlowRateChart({ history }: { history: { minute: number; total: number }[] }) {
  return (
    <div className="sl-card p-5 bg-white">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
        <Activity className="w-4 h-4 text-emerald-500" /> Attendance Over Time
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={history}>
          <defs>
            <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
            label={{ value: "Game Minute", position: "insideBottom", offset: -5, fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            formatter={(value: number) => [value.toLocaleString(), "People"]} />
          <Area type="monotone" dataKey="total" stroke="#2dd4bf" strokeWidth={2}
            fill="url(#attendanceGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ===== Main Analytics Page ===== */

export function AnalyticsPage() {
  const { snapshot, connected } = useWebSocket();
  const [crowdHistory, setCrowdHistory] = useState<{ minute: number; total: number; packed: number }[]>([]);

  // Track crowd data over time
  const lastMinRef = { current: -999 };
  if (snapshot) {
    const minute = snapshot.game_state?.minute ?? 0;
    if (minute !== lastMinRef.current) {
      lastMinRef.current = minute;
      const packedCount = (snapshot.zones ?? []).filter(z => z.level === "packed" || z.level === "busy").length;
      const newEntry = { minute, total: snapshot.total_attendance, packed: packedCount };
      if (crowdHistory.length === 0 || crowdHistory[crowdHistory.length - 1].minute !== minute) {
        setCrowdHistory(prev => [...prev, newEntry].slice(-80));
      }
    }
  }

  const zones = snapshot?.zones ?? [];
  const totalPeople = snapshot?.total_attendance ?? 0;
  const predictions = snapshot?.predictions ?? [];
  const packedZones = zones.filter(z => z.level === "packed");
  const busyZones = zones.filter(z => z.level === "busy");
  const risingZones = zones.filter(z => z.trend === "rising");
  const avgWait = zones.filter(z => z.wait_minutes > 0).reduce((sum, z) => sum + z.wait_minutes, 0) /
    (zones.filter(z => z.wait_minutes > 0).length || 1);

  // Peak zone
  const peakZone = zones.length > 0
    ? zones.reduce((max, z) => z.percentage > max.percentage ? z : max, zones[0])
    : null;

  // Export CSV
  const exportCSV = useCallback(() => {
    if (!snapshot) return;
    const headers = "zone_id,zone_name,zone_type,current_count,capacity,percentage,trend,wait_minutes,level\n";
    const rows = zones.map(z =>
      `${z.zone_id},${z.zone_name},${z.zone_type},${z.current_count},${z.capacity},${z.percentage},${z.trend},${z.wait_minutes},${z.level}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `venuepulse_snapshot_min${snapshot.game_state?.minute ?? 0}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshot, zones]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">📊 Live Analytics</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time crowd intelligence and venue metrics</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs font-bold text-teal-600 hover:bg-teal-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Game Clock */}
      <GameClockDisplay gameState={snapshot?.game_state ?? null} />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MiniStat label="Total Attendance" value={totalPeople.toLocaleString()} icon={Users} color="teal" />
        <MiniStat label="Packed Zones" value={packedZones.length} icon={TrendingUp} color="red"
          trend={packedZones.length > 3 ? "up" : packedZones.length > 0 ? "flat" : "down"} />
        <MiniStat label="Busy Zones" value={busyZones.length} icon={BarChart3} color="orange" />
        <MiniStat label="Rising Zones" value={risingZones.length} icon={TrendingUp} color="violet"
          trend={risingZones.length > 4 ? "up" : "flat"} />
        <MiniStat label="Avg Wait Time" value={`${avgWait.toFixed(1)}m`} icon={Timer} color="blue" />
        <MiniStat label="Surge Alerts" value={predictions.length} icon={Activity} color="orange" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FlowRateChart history={crowdHistory} />
        <ZoneDistPie zones={zones} />
      </div>

      {/* Zone Type Breakdown */}
      <ZoneTypeBreakdown zones={zones} />

      {/* Peak Zone Highlight */}
      {peakZone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sl-card p-4 bg-white flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Hottest Zone Right Now</span>
            <p className="text-sm font-bold text-slate-900">{peakZone.zone_name}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-slate-900">{formatPct(peakZone.percentage)}</span>
            <p className="text-[10px] text-slate-400">{peakZone.current_count.toLocaleString()} people</p>
          </div>
        </motion.div>
      )}

      {/* Zone Comparison */}
      {zones.length >= 2 && <ZoneComparison zones={zones} />}

      {/* Full Density Table */}
      <DensityTable zones={zones} />
    </div>
  );
}
