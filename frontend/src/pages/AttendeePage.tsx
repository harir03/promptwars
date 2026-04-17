import { useWebSocket } from "@/hooks/useWebSocket";
import { AIChat } from "@/components/chat/AIChat";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { cn, DENSITY_MAP, formatPct } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/**
 * Attendee page — The main user experience.
 * Combines AI chat, zone status, and predictions.
 * Supports ?demo=true for frictionless demo mode (P30).
 */
export function AttendeePage() {
  const { snapshot, connected, staleness } = useWebSocket();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  const [activeTab, setActiveTab] = useState<"chat" | "zones">("chat");

  const seatSection = isDemo ? "C" : "C"; // Would come from user input in production

  // Get food/restroom zones for quick display
  const foodZones = snapshot?.zones.filter((z) => z.zone_type === "food") ?? [];
  const predictions = snapshot?.predictions?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Connection status bar (P22) */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-vp-warning/15 border-b border-vp-warning/30 px-4 py-2 flex items-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 text-vp-warning" />
            <span className="text-xs font-semibold text-vp-warning">Reconnecting...</span>
          </motion.div>
        )}
        {connected && staleness > 10 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-vp-warning/10 border-b border-vp-warning/20 px-4 py-1.5 flex items-center gap-2"
          >
            <AlertTriangle className="w-3 h-3 text-vp-warning" />
            <span className="text-[10px] font-semibold text-vp-warning">
              Data {staleness}s stale — waiting for update
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Clock */}
      <div className="px-3 pt-3">
        <GameClockDisplay gameState={snapshot?.game_state ?? null} />
      </div>

      {/* Prediction Banner */}
      <AnimatePresence>
        {predictions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pt-2"
          >
            <div className="glass-card px-3 py-2.5 flex items-center gap-2 border border-vp-warning/20 bg-vp-warning/5">
              <AlertTriangle className="w-4 h-4 text-vp-warning shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-vp-warning uppercase tracking-wide">
                  Surge Alert
                </span>
                <p className="text-xs text-vp-text-secondary truncate">
                  {predictions[0].recommendation}
                </p>
              </div>
              <span className="text-[10px] font-bold text-vp-warning shrink-0">
                {Math.round(predictions[0].confidence * 100)}% conf
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Switcher */}
      <div className="px-3 pt-3 pb-1 flex gap-1">
        {(["chat", "zones"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
              activeTab === tab
                ? "bg-vp-accent/15 text-vp-accent border border-vp-accent/30"
                : "text-vp-text-muted hover:text-vp-text-secondary"
            )}
          >
            {tab === "chat" ? "🤖 AI Concierge" : "📊 Zone Status"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "chat" ? (
          <AIChat seatSection={seatSection} />
        ) : (
          <div className="h-full overflow-y-auto px-3 py-2 space-y-4">
            {/* Food Courts */}
            <div>
              <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
                🍔 Food Courts
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {foodZones.map((z) => <ZoneCard key={z.zone_id} zone={z} />)}
              </div>
            </div>

            {/* Restrooms */}
            <div>
              <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
                🚻 Restrooms
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(snapshot?.zones.filter((z) => z.zone_type === "restroom") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>

            {/* Gates */}
            <div>
              <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
                🚪 Exit Gates
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(snapshot?.zones.filter((z) => z.zone_type === "gate") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>

            {/* Seating */}
            <div>
              <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider mb-2">
                🪑 Seating Sections
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(snapshot?.zones.filter((z) => z.zone_type === "seating") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
