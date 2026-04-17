import { useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { cn, formatPct } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Lock, Unlock, AlertTriangle, Zap, SkipForward,
  Users, TrendingUp, Gift
} from "lucide-react";

/**
 * Admin Dashboard — Passkey-gated (P15).
 * Speed slider (P31), zone overview, redistribution controls.
 */
export function AdminPage() {
  const { snapshot, connected } = useWebSocket();
  const [authenticated, setAuthenticated] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [passError, setPassError] = useState(false);
  const [storedKey, setStoredKey] = useState("");

  // Passkey gate (P15)
  const authenticate = () => {
    if (passkey.trim()) {
      setStoredKey(passkey.trim());
      setAuthenticated(true);
      setPassError(false);
    } else {
      setPassError(true);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-7.5rem)]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-card p-8 w-full max-w-xs flex flex-col items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-vp-accent/15 flex items-center justify-center">
            <Lock className="w-7 h-7 text-vp-accent" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-extrabold text-white">Admin Access</h2>
            <p className="text-xs text-vp-text-muted mt-1">Enter the admin passkey to continue</p>
          </div>
          <input
            type="password"
            value={passkey}
            onChange={(e) => { setPasskey(e.target.value); setPassError(false); }}
            onKeyDown={(e) => e.key === "Enter" && authenticate()}
            placeholder="Enter passkey"
            className={cn(
              "w-full px-4 py-2.5 rounded-lg bg-vp-dark border text-sm text-white placeholder:text-vp-text-muted outline-none focus:border-vp-accent transition-colors",
              passError ? "border-vp-danger" : "border-vp-border"
            )}
            id="admin-passkey-input"
            aria-label="Admin passkey"
          />
          {passError && <p className="text-xs text-vp-danger">Please enter a passkey</p>}
          <button
            onClick={authenticate}
            className="w-full py-2.5 rounded-lg bg-vp-accent text-white text-sm font-bold hover:bg-vp-accent-light transition-colors"
            id="admin-login-btn"
          >
            <Unlock className="w-4 h-4 inline mr-2" />
            Access Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  // --- Authenticated Admin Dashboard ---
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
    <div className="p-3 md:p-4 space-y-3 max-w-4xl mx-auto">
      {/* Game Clock */}
      <GameClockDisplay gameState={snapshot?.game_state ?? null} />

      {/* Speed Controls (P31) */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Simulation Speed
          </h3>
          <span className="text-sm font-extrabold text-vp-accent">
            {snapshot?.game_state?.speed_multiplier ?? 1}x
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 3, 6, 9, 12, 15].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                snapshot?.game_state?.speed_multiplier === s
                  ? "bg-vp-accent text-white shadow-glow"
                  : "bg-vp-dark text-vp-text-muted border border-vp-border hover:border-vp-accent/40"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <h4 className="text-[10px] font-bold text-vp-text-muted uppercase w-full flex items-center gap-1">
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
              className="px-2.5 py-1.5 rounded-lg bg-vp-dark border border-vp-border text-[10px] font-bold text-vp-text-secondary hover:border-vp-accent/40 hover:text-vp-accent transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-card p-3 text-center">
          <Users className="w-4 h-4 text-vp-accent mx-auto mb-1" />
          <span className="text-lg font-black text-white">{totalAttendance.toLocaleString()}</span>
          <p className="text-[10px] text-vp-text-muted">In Venue</p>
        </div>
        <div className="glass-card p-3 text-center">
          <AlertTriangle className="w-4 h-4 text-vp-warning mx-auto mb-1" />
          <span className="text-lg font-black text-white">{packedZones.length}</span>
          <p className="text-[10px] text-vp-text-muted">Hot Spots</p>
        </div>
        <div className="glass-card p-3 text-center">
          <TrendingUp className="w-4 h-4 text-vp-blue mx-auto mb-1" />
          <span className="text-lg font-black text-white">{predictions.length}</span>
          <p className="text-[10px] text-vp-text-muted">Predictions</p>
        </div>
      </div>

      {/* Goal Controls */}
      <div className="glass-card p-3">
        <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">⚽ Goal Events</h3>
        <div className="flex gap-2">
          <button onClick={() => scoreGoal(true)} className="flex-1 py-2 rounded-lg bg-vp-accent/15 border border-vp-accent/30 text-xs font-bold text-vp-accent hover:bg-vp-accent/25 transition-colors">
            Home Goal
          </button>
          <button onClick={() => scoreGoal(false)} className="flex-1 py-2 rounded-lg bg-vp-blue/15 border border-vp-blue/30 text-xs font-bold text-vp-blue hover:bg-vp-blue/25 transition-colors">
            Away Goal
          </button>
        </div>
      </div>

      {/* Predictions */}
      {predictions.length > 0 && (
        <div className="glass-card p-3">
          <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
            ⚡ Active Predictions
          </h3>
          <div className="space-y-2">
            {predictions.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-vp-dark/50 border border-vp-border">
                <AlertTriangle className="w-3.5 h-3.5 text-vp-warning shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-white">{p.zone_name}</span>
                  <p className="text-[10px] text-vp-text-muted truncate">{p.recommendation}</p>
                </div>
                <span className="text-[10px] font-bold text-vp-warning">{Math.round(p.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reward Trigger */}
      <div className="glass-card p-3">
        <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Redistribution Rewards (P29)
        </h3>
        <p className="text-[10px] text-vp-text-muted mb-2">
          Trigger a 20% discount + 150 points at an empty food court to shift crowds
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {zones.filter((z) => z.zone_type === "food").map((z) => (
            <button
              key={z.zone_id}
              onClick={() => triggerReward(z.zone_id)}
              className={cn(
                "py-2 rounded-lg text-[11px] font-bold border transition-all",
                z.level === "clear" || z.level === "moderate"
                  ? "border-vp-accent/30 text-vp-accent bg-vp-accent/5 hover:bg-vp-accent/15"
                  : "border-vp-border text-vp-text-muted cursor-not-allowed opacity-50"
              )}
              disabled={z.level === "packed" || z.level === "busy"}
            >
              🎁 {z.zone_name} ({formatPct(z.percentage)})
            </button>
          ))}
        </div>
      </div>

      {/* All Zones Grid */}
      <div>
        <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
          📊 All Zones
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {zones.map((z) => <ZoneCard key={z.zone_id} zone={z} />)}
        </div>
      </div>
    </div>
  );
}
