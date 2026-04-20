import { useState, useMemo, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { StatCard } from "@/components/dashboard/StatCard";
import { DonutChartCard } from "@/components/dashboard/DonutChartCard";
import { ProgressBarCard } from "@/components/dashboard/ProgressBarCard";
import { DensityBarChart, StatusAreaChart } from "@/components/dashboard/TemplateCharts";
import { cn, formatPct, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Timer,
  Activity, Download, Layers, HelpCircle, ChevronDown,
  Minus, ArrowUpRight, ArrowDownRight, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { ZoneDensity } from "@/types";
import { ZoneComparison } from "@/components/dashboard/ZoneComparison";

/* ===== Custom Tooltip ===== */
const PremiumTooltip = ({ active, payload, label, color = "#2dd4bf", title = "Value" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-50 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] min-w-[140px]">
        <p className="text-[12px] text-slate-400 font-medium mb-2">{label || "—"}</p>
        <div className="flex items-center gap-2">
          <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[14px] font-medium text-slate-500">{title}</span>
          <span className="text-[14px] font-medium text-slate-700 ml-auto pl-4">
            {typeof payload[0].value === "number" ? payload[0].value.toLocaleString() : payload[0].value}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

/* ===== Zone Type Breakdown Bar Chart ===== */
function ZoneTypeBreakdown({ zones }: { zones: ZoneDensity[] }) {
  const data = useMemo(() => {
    const groups: Record<string, { total: number; count: number }> = {};
    zones.forEach(z => {
      if (!groups[z.zone_type]) groups[z.zone_type] = { total: 0, count: 0 };
      groups[z.zone_type].total += z.current_count;
      groups[z.zone_type].count++;
    });
    return Object.entries(groups).map(([type, g]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      people: g.total,
    }));
  }, [zones]);

  const colors: Record<string, string> = { Seating: "#2dd4bf", Food: "#fb923c", Restroom: "#818cf8", Gate: "#f472b6" };

  return (
    <div className="sl-card p-5 bg-white h-[320px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-900 font-bold text-sm tracking-tight flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-teal-500" /> People by Zone Type
        </h3>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<PremiumTooltip color="#2dd4bf" title="People" />} wrapperStyle={{ outline: "none" }} />
            <Bar dataKey="people" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={colors[entry.type] || "#94a3b8"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ===== Density Table — template style ===== */
function DensityTable({ zones }: { zones: ZoneDensity[] }) {
  const sorted = useMemo(() =>
    [...zones].sort((a, b) => b.percentage - a.percentage),
  [zones]);

  const trendIcon = (trend: string) => {
    if (trend === "rising") return <TrendingUp className="w-3 h-3 text-rose-500" aria-hidden="true" />;
    if (trend === "falling") return <TrendingDown className="w-3 h-3 text-emerald-500" aria-hidden="true" />;
    return <Minus className="w-3 h-3 text-slate-400" aria-hidden="true" />;
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
              <th scope="col" className="text-left py-2 font-bold">#</th>
              <th scope="col" className="text-left py-2 font-bold">Zone</th>
              <th scope="col" className="text-left py-2 font-bold">Type</th>
              <th scope="col" className="text-right py-2 font-bold">People</th>
              <th scope="col" className="text-right py-2 font-bold">Density</th>
              <th scope="col" className="text-center py-2 font-bold">Trend</th>
              <th scope="col" className="text-right py-2 font-bold">Wait</th>
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
                      <div
                        className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={Math.round(z.percentage * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${z.zone_name} density: ${Math.round(z.percentage * 100)}%`}
                      >                        <div
                          className={cn("h-full rounded-full transition-all",
                            z.level === "clear" ? "bg-teal-400" :
                            z.level === "moderate" ? "bg-amber-400" :
                            z.level === "busy" ? "bg-orange-400" : "bg-red-400"
                          )}
                          style={{ width: `${Math.round(z.percentage * 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 w-8 text-right">{formatPct(z.percentage)}</span>
                    </div>
                  </td>
                  <td className="py-2 text-center" aria-label={`Trend: ${z.trend}`}>{trendIcon(z.trend)}</td>
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

/* ===== Main Analytics Page ===== */

export function AnalyticsPage() {
  const { snapshot, connected } = useWebSocket();
  const [crowdHistory, setCrowdHistory] = useState<{ minute: number; total: number; packed: number }[]>([]);
  const [activeTab, setActiveTab] = useState("OVERVIEW");

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

  // Donut chart data
  const zoneHealthData = [
    { name: "Clear", value: zones.filter(z => z.level === "clear").length, color: "#2dd4bf" },
    { name: "Moderate", value: zones.filter(z => z.level === "moderate").length, color: "#f59e0b" },
    { name: "Busy", value: busyZones.length, color: "#f97316" },
    { name: "Packed", value: packedZones.length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  const zoneTypeData = [
    { name: "Seating", value: zones.filter(z => z.zone_type === "seating").length, color: "#2dd4bf" },
    { name: "Food", value: zones.filter(z => z.zone_type === "food").length, color: "#fb923c" },
    { name: "Restroom", value: zones.filter(z => z.zone_type === "restroom").length, color: "#818cf8" },
    { name: "Gate", value: zones.filter(z => z.zone_type === "gate").length, color: "#f472b6" },
  ].filter(d => d.value > 0);

  // Progress bar data
  const topZones = [...zones].sort((a, b) => b.percentage - a.percentage).slice(0, 5).map(z => ({
    label: z.zone_name,
    value: formatPct(z.percentage),
    percent: Math.round(z.percentage * 100),
    color: z.level === "packed" ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
           z.level === "busy" ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" :
           z.level === "moderate" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" :
           "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.4)]",
  }));

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

  const peakZone = zones.length > 0
    ? zones.reduce((max, z) => z.percentage > max.percentage ? z : max, zones[0])
    : null;

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto bg-slate-50/30 min-h-screen pb-20 md:pb-6">

      {/* === Top Header Controls (template-style) === */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div role="tablist" aria-label="Analytics views" className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-100">
          {["OVERVIEW", "ZONE BREAKDOWN", "DATA TABLE"].map((tab, i) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              aria-label={`Switch to ${tab} tab`}
              className={cn(
                "px-4 py-2 rounded-md text-[11px] font-black transition-all flex items-center gap-1.5",
                activeTab === tab
                  ? "bg-teal-500 text-white shadow-md shadow-teal-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}>
              {tab}
              {i === 2 && <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            aria-label="Export data as CSV"
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-teal-500" /> Export CSV
          </button>
        </div>
      </div>

      {/* === Tab Content === */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* KPI Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label="Attendance" value={totalPeople.toLocaleString()} icon={Users} variant="teal" />
                <StatCard label="Packed" value={packedZones.length} icon={TrendingUp} variant="red" />
                <StatCard label="Busy" value={busyZones.length} icon={BarChart3} variant="orange" />
                <StatCard label="Rising" value={risingZones.length} icon={TrendingUp} variant="orange" />
                <StatCard label="Avg Wait" value={`${avgWait.toFixed(1)}m`} icon={Timer} variant="gray" />
                <StatCard label="Alerts" value={predictions.length} icon={Activity} variant="orange" />
              </div>
            </div>
            <div className="lg:col-span-3">
              <DensityBarChart data={crowdHistory.map(h => ({ minute: h.minute, total: h.total }))} />
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9">
              {/* Attendance Area Chart */}
              <div className="sl-card p-5 bg-white h-[320px] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-900 font-bold text-sm tracking-tight flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500" /> Attendance Over Time
                  </h3>
                  <span className="text-[10px] font-black text-teal-500 uppercase tracking-widest">{crowdHistory.length} ticks</span>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={crowdHistory}>
                      <defs>
                        <linearGradient id="analyticsTealGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<PremiumTooltip color="#2dd4bf" title="People" />} wrapperStyle={{ outline: "none" }} />
                      <Area type="monotone" dataKey="total" stroke="#2dd4bf" strokeWidth={2.5} fill="url(#analyticsTealGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col gap-4">
              <StatusAreaChart data={crowdHistory.map(h => ({ minute: h.minute, value: h.total }))} title="Total Count" color="#14b8a6" gradientId="analyticsStatus1" />
              <StatusAreaChart data={crowdHistory.map(h => ({ minute: h.minute, value: h.packed }))} title="Hot Zones" color="#f43f5e" gradientId="analyticsStatus2" />
            </div>
          </div>

          {/* Donut Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DonutChartCard title="Zone Health Distribution" data={zoneHealthData} />
            <DonutChartCard title="Zone Type Breakdown" data={zoneTypeData} />
          </div>

          {/* Peak Zone Highlight */}
          {peakZone && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="sl-card p-4 bg-white flex items-center gap-4 group hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
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
        </div>
      )}

      {activeTab === "ZONE BREAKDOWN" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* ProgressBars + Bar Chart */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProgressBarCard title="Hottest Zones" data={topZones} />
            <ZoneTypeBreakdown zones={zones} />
          </div>

          {/* Zone Comparison */}
          {zones.length >= 2 && <ZoneComparison zones={zones} />}
        </div>
      )}

      {activeTab === "DATA TABLE" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <DensityTable zones={zones} />
        </div>
      )}
    </div>
  );
}
