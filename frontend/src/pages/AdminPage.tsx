import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { StadiumMap } from "@/components/dashboard/StadiumMap";
import { CrowdChart } from "@/components/dashboard/CrowdChart";
import { AdminEventLog } from "@/components/dashboard/AdminEventLog";
import { cn, formatPct } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Lock, Unlock, AlertTriangle, Zap, SkipForward,
  Users, TrendingUp, Gift, Info
} from "lucide-react";

/* ===== StatCard — ported directly from template ===== */
function StatCard({ label, value, icon: Icon, variant = "teal" }: {
  label: string; value: string | number; icon: any; variant?: "teal" | "orange" | "red";
}) {
  return (
    <div className="sl-card p-3 flex flex-col gap-2 relative transition-all hover:shadow-md h-[112px] bg-white group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 min-w-0 relative">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap transition-colors group-hover:text-slate-600">
            {label}
          </span>
        </div>
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center transition-all group-hover:scale-110",
          variant === "orange" ? "bg-orange-50" : variant === "red" ? "bg-red-50" : "bg-teal-50"
        )}>
          <Icon className={cn(
            "w-3.5 h-3.5",
            variant === "orange" ? "text-orange-400" : variant === "red" ? "text-red-400" : "text-teal-400"
          )} strokeWidth={3} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</span>
      </div>
    </div>
  );
}

/**
 * Admin Dashboard — light mode w/ Stadium heatmap, crowd chart,
 * speed controls, StatCards, prediction panel, reward triggers.
 */
export function AdminPage() {
  const { snapshot, connected } = useWebSocket();
  const [authenticated, setAuthenticated] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [passError, setPassError] = useState(false);
  const [storedKey, setStoredKey] = useState("");

  // Crowd history for chart
  const [crowdHistory, setCrowdHistory] = useState<{ minute: number; total: number; packed: number }[]>([]);
  const lastMinuteRef = useRef<number>(-999);

  // Track crowd data over time
  useEffect(() => {
    if (!snapshot) return;
    const minute = snapshot.game_state?.minute ?? 0;
    if (minute !== lastMinuteRef.current) {
      lastMinuteRef.current = minute;
      const packedCount = snapshot.zones.filter((z) => z.level === "packed" || z.level === "busy").length;
      setCrowdHistory((prev) => {
        const newEntry = { minute, total: snapshot.total_attendance, packed: packedCount };
        const updated = [...prev, newEntry];
        return updated.slice(-60); // Keep last 60 data points
      });
    }
  }, [snapshot]);

  const authenticate = () => {
    if (passkey.trim()) {
      setStoredKey(passkey.trim());
      setAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  /* ===== Passkey Gate ===== */
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="sl-card p-8 w-full max-w-xs flex flex-col items-center gap-5 bg-white"
        >
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center">
            <Lock className="w-7 h-7 text-teal-500" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-slate-900">Admin Access</h2>
            <p className="text-xs text-slate-400 mt-1">Enter the admin passkey to continue</p>
          </div>
          <input
            type="password"
            value={passkey}
            onChange={(e) => { setPasskey(e.target.value); setPassError(false); }}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            placeholder="Enter passkey"
            className={cn(
              "w-full px-4 py-2.5 rounded-lg bg-slate-50 border text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-400 transition-colors",
              passError ? "border-red-300" : "border-slate-200"
            )}
            id="admin-passkey-input"
            aria-label="Admin passkey"
          />
          {passError && <p className="text-xs text-red-500">Please enter a passkey</p>}
          <button
            onClick={authenticate}
            className="w-full py-2.5 rounded-lg bg-teal-400 text-white text-sm font-bold hover:bg-teal-500 transition-colors shadow-md shadow-teal-400/20"
            id="admin-login-btn"
          >
            <Unlock className="w-4 h-4 inline mr-2" />
            Access Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  /* ===== Authenticated Dashboard ===== */
  const apiCall = async (path: string, body: object) => {
    try {
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": storedKey },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("Admin API error:", e);
    }
  };

  const setSpeed = (speed: number) => apiCall("/api/admin/game/speed", { speed });
  const jumpTo = (minute: number) => apiCall("/api/admin/game/jump", { minute });
  const scoreGoal = (isHome: boolean) => apiCall("/api/admin/game/goal", { is_home: isHome });
  const triggerReward = (zoneId: string) => apiCall("/api/admin/rewards/trigger", {
    zone_id: zoneId, discount_percent: 20, points: 150, duration_minutes: 10,
  });

  const totalAttendance = snapshot?.total_attendance ?? 0;
  const zones = snapshot?.zones ?? [];
  const predictions = snapshot?.predictions ?? [];
  const packedZones = zones.filter((z) => z.level === "packed" || z.level === "busy");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto pb-20 md:pb-6">
      {/* Game Clock */}
      <GameClockDisplay gameState={snapshot?.game_state ?? null} />

      {/* Row 1: KPI StatCards — matching template grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="In Venue" value={totalAttendance.toLocaleString()} icon={Users} variant="teal" />
        <StatCard label="Hot Spots" value={packedZones.length} icon={AlertTriangle} variant="orange" />
        <StatCard label="Predictions" value={predictions.length} icon={TrendingUp} variant="teal" />
        <StatCard label="Zones" value={zones.length} icon={Info} variant="teal" />
        <StatCard label="Food Zones" value={zones.filter((z) => z.zone_type === "food").length} icon={Info} variant="orange" />
        <StatCard label="Gates" value={zones.filter((z) => z.zone_type === "gate").length} icon={Info} variant="teal" />
      </div>

      {/* Row 2: Stadium Heatmap + Crowd Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <StadiumMap zones={zones} />
        </div>
        <div className="lg:col-span-4">
          <CrowdChart history={crowdHistory} />
        </div>
      </div>

      {/* Row 3: Speed Controls + Goal Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 sl-card p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-bold text-sm tracking-tight flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-teal-500" /> Simulation Speed
            </h3>
            <span className="text-sm font-extrabold text-teal-500">
              {snapshot?.game_state?.speed_multiplier ?? 1}x
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 6, 9, 12, 15].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  snapshot?.game_state?.speed_multiplier === s
                    ? "bg-teal-400 text-white shadow-md shadow-teal-400/20"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-teal-300 hover:text-teal-600"
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest w-full flex items-center gap-1 mb-1">
              <SkipForward className="w-3 h-3" /> Jump to Phase
            </h4>
            {[
              { label: "Pre-match", min: -5 },
              { label: "1st Half", min: 10 },
              { label: "Halftime", min: 45 },
              { label: "2nd Half", min: 70 },
              { label: "90th min", min: 88 },
              { label: "Full Time", min: 92 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => jumpTo(p.min)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 sl-card p-5 bg-white flex flex-col gap-4">
          <h3 className="text-slate-900 font-bold text-sm tracking-tight">⚽ Goal Events</h3>
          <button onClick={() => scoreGoal(true)} className="flex-1 py-3 rounded-lg bg-teal-50 border border-teal-200 text-sm font-bold text-teal-600 hover:bg-teal-100 transition-colors">
            Home Goal
          </button>
          <button onClick={() => scoreGoal(false)} className="flex-1 py-3 rounded-lg bg-blue-50 border border-blue-200 text-sm font-bold text-blue-600 hover:bg-blue-100 transition-colors">
            Away Goal
          </button>
        </div>
      </div>

      {/* Row 4: Predictions + Reward Trigger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="sl-card p-5 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-bold text-sm tracking-tight">⚡ Active Predictions</h3>
            <span className="text-[10px] text-teal-500 font-black uppercase tracking-widest">Live</span>
          </div>
          {predictions.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No active surge predictions</p>
          ) : (
            <div className="space-y-2">
              {predictions.map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800">{p.zone_name}</span>
                    <p className="text-[10px] text-slate-500 truncate">{p.recommendation}</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-600">{Math.round(p.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sl-card p-5 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-900 font-bold text-sm tracking-tight flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-orange-400" /> Redistribution Rewards
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Trigger 20% discount + 150 pts at empty food courts</p>
          <div className="grid grid-cols-2 gap-2">
            {zones.filter((z) => z.zone_type === "food").map((z) => (
              <button
                key={z.zone_id}
                onClick={() => triggerReward(z.zone_id)}
                className={cn(
                  "py-2.5 rounded-lg text-[11px] font-bold border transition-all",
                  z.level === "clear" || z.level === "moderate"
                    ? "border-teal-200 text-teal-600 bg-teal-50 hover:bg-teal-100"
                    : "border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed opacity-60"
                )}
                disabled={z.level === "packed" || z.level === "busy"}
              >
                🎁 {z.zone_name} ({formatPct(z.percentage)})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Event Log */}
      <AdminEventLog
        gameState={snapshot?.game_state ?? null}
        predictions={predictions}
      />

      {/* Row 6: All Zones Grid */}
      <div className="sl-card p-5 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900 font-bold text-sm tracking-tight">📊 All Zones</h3>
          <span className="text-[10px] text-teal-500 font-black uppercase tracking-widest">
            {zones.length} Zones
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {zones.map((z) => <ZoneCard key={z.zone_id} zone={z} />)}
        </div>
      </div>
    </div>
  );
}
