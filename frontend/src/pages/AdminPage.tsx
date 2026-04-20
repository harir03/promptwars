import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { StatCard } from "@/components/dashboard/StatCard";
import { DonutChartCard } from "@/components/dashboard/DonutChartCard";
import { ProgressBarCard } from "@/components/dashboard/ProgressBarCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { AdminEventLog } from "@/components/dashboard/AdminEventLog";
import { cn, formatPct, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Users, Activity, TrendingUp, Timer, AlertTriangle,
  HelpCircle, ChevronDown, Layers, BarChart3, Zap
} from "lucide-react";

export function AdminPage() {
  const { snapshot, connected } = useWebSocket();
  const [activeTab, setActiveTab] = useState("LIVE OVERVIEW");
  const [timeOpen, setTimeOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState("Real-time");

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

  // Progress bar — top 5 hottest zones
  const topZones = [...zones].sort((a, b) => b.percentage - a.percentage).slice(0, 5).map(z => ({
    label: z.zone_name,
    value: formatPct(z.percentage),
    percent: Math.round(z.percentage * 100),
    color: z.level === "packed" ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
           z.level === "busy" ? "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]" :
           z.level === "moderate" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" :
           "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.4)]",
  }));

  const peakZone = zones.length > 0
    ? zones.reduce((max, z) => z.percentage > max.percentage ? z : max, zones[0])
    : null;

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto bg-slate-50/30 min-h-screen">

      {/* Top Header Controls — template style */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-100">
          {["LIVE OVERVIEW", "ZONE GRID", "EVENT LOG"].map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-md text-[11px] font-black transition-all flex items-center gap-1.5",
                activeTab === tab
                  ? "bg-teal-500 text-white shadow-md shadow-teal-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}>
              {tab}
              {i === 2 && <HelpCircle className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
            connected
              ? "bg-teal-50 border-teal-100 text-teal-600"
              : "bg-amber-50 border-amber-200 text-amber-600"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-teal-500 animate-pulse-dot" : "bg-amber-500")} />
            {connected ? "Connected" : "Reconnecting"}
          </div>

          <div className="relative">
            <button
              onClick={() => setTimeOpen(!timeOpen)}
              onBlur={() => setTimeout(() => setTimeOpen(false), 200)}
              className="flex items-center gap-6 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[11px] font-black text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              {selectedTime} <ChevronDown className={cn("w-4 h-4 text-slate-300 transition-transform", timeOpen && "rotate-180")} />
            </button>

            {timeOpen && (
              <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 p-1 z-50 animate-in fade-in slide-in-from-top-2">
                {["Real-time", "Last 5 min", "Last 15 min", "Full Match"].map((time) => (
                  <button
                    key={time}
                    onClick={() => { setSelectedTime(time); setTimeOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:text-teal-600 rounded-md transition-colors"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "LIVE OVERVIEW" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Game Clock */}
          <GameClockDisplay gameState={snapshot?.game_state ?? null} />

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Attendance" value={totalPeople.toLocaleString()} icon={Users} variant="teal" />
            <StatCard label="Packed Zones" value={packedZones.length} icon={TrendingUp} variant="red" />
            <StatCard label="Busy Zones" value={busyZones.length} icon={BarChart3} variant="orange" />
            <StatCard label="Rising" value={risingZones.length} icon={TrendingUp} variant="orange" />
            <StatCard label="Avg Wait" value={`${avgWait.toFixed(1)}m`} icon={Timer} variant="gray" />
            <StatCard label="Surge Alerts" value={predictions.length} icon={Activity} variant="orange" />
          </div>

          {/* Prediction Alerts */}
          {predictions.length > 0 && (
            <div className="sl-card p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Active Surge Predictions</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {predictions.slice(0, 6).map((pred, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2 border border-amber-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{pred.zone_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{pred.recommendation}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <span className="text-xs font-black text-amber-600">{Math.round(pred.confidence * 100)}%</span>
                      <p className="text-[9px] text-slate-400">{pred.minutes_until}m</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DonutChartCard title="Zone Health Distribution" data={zoneHealthData} />
            <DonutChartCard title="Zone Type Breakdown" data={zoneTypeData} />
          </div>

          {/* Progress Bars + Peak Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProgressBarCard title="Hottest Zones" data={topZones} />

            {/* Peak Zone Highlight */}
            {peakZone && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sl-card p-5 bg-white flex flex-col justify-center gap-4 group hover:shadow-md transition-all"
              >
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

                {/* Gate quick status */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exit Gates</p>
                  <div className="flex gap-2">
                    {zones.filter(z => z.zone_type === "gate").sort((a, b) => a.percentage - b.percentage).map(gate => {
                      const d = DENSITY_MAP[gate.level];
                      return (
                        <div key={gate.zone_id} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-center", d.bg)}>
                          <p className="text-[10px] font-bold text-slate-700">{gate.zone_name}</p>
                          <p className={cn("text-xs font-black", d.css)}>{formatPct(gate.percentage)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ZONE GRID" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Game Clock */}
          <GameClockDisplay gameState={snapshot?.game_state ?? null} />

          {/* Seating */}
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> Seating Sections
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zones.filter(z => z.zone_type === "seating").map(z => (
                <ZoneCard key={z.zone_id} zone={z} />
              ))}
            </div>
          </div>

          {/* Food Courts */}
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Food Courts
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zones.filter(z => z.zone_type === "food").map(z => (
                <ZoneCard key={z.zone_id} zone={z} />
              ))}
            </div>
          </div>

          {/* Restrooms */}
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Restrooms
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zones.filter(z => z.zone_type === "restroom").map(z => (
                <ZoneCard key={z.zone_id} zone={z} />
              ))}
            </div>
          </div>

          {/* Gates */}
          <div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" /> Exit Gates
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {zones.filter(z => z.zone_type === "gate").map(z => (
                <ZoneCard key={z.zone_id} zone={z} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "EVENT LOG" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <AdminEventLog />
        </div>
      )}
    </div>
  );
}
