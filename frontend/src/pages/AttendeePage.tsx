import { useWebSocket } from "@/hooks/useWebSocket";
import { AIChat } from "@/components/chat/AIChat";
import { ZoneCard } from "@/components/dashboard/ZoneCard";
import { GameClockDisplay } from "@/components/dashboard/GameClock";
import { ExitPlanner } from "@/components/attendee/ExitPlanner";
import { RewardsWallet } from "@/components/attendee/RewardsWallet";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, WifiOff, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

/**
 * Attendee page — template-style with premium tab navigation.
 *   AI Concierge | Zone Status | My Stuff (exit planner + rewards)
 */
export function AttendeePage() {
  const { snapshot, connected, staleness } = useWebSocket();
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  const [activeTab, setActiveTab] = useState<"chat" | "zones" | "me">("chat");

  const seatSection = isDemo ? "C" : "C";
  const predictions = snapshot?.predictions?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
      {/* Connection status bar */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-amber-600">Reconnecting to live data...</span>
          </motion.div>
        )}
        {connected && staleness > 10 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center gap-2"
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" aria-hidden="true" />
            <span className="text-[10px] font-semibold text-amber-600">
              Data {staleness}s stale — waiting for update
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Clock */}
      <div className="px-4 pt-4">
        <GameClockDisplay gameState={snapshot?.game_state ?? null} />
      </div>

      {/* Prediction Banner — template-style card */}
      <AnimatePresence>
        {predictions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pt-3"
          >
            <div className="sl-card px-3 py-2.5 flex items-center gap-2 bg-amber-50 border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Surge Alert</span>
                <p className="text-xs text-slate-600 truncate">{predictions[0].recommendation}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-600 shrink-0">
                {Math.round(predictions[0].confidence * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template-style Tab Switcher — pill tabs matching the dashboard template */}
      <div className="px-4 pt-3 pb-1">
        <div role="tablist" aria-label="Attendee views" className="flex bg-white rounded-lg p-0.5 shadow-sm border border-slate-100">
          {([
            { key: "chat" as const, label: "AI CONCIERGE" },
            { key: "zones" as const, label: "ZONE STATUS" },
            { key: "me" as const, label: "MY STUFF" },
          ]).map((tab, i) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 py-2 rounded-md text-[11px] font-black transition-all flex items-center justify-center gap-1.5",
                activeTab === tab.key
                  ? "bg-teal-500 text-white shadow-md shadow-teal-100"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              )}
            >
              {tab.label}
              {i === 2 && <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "chat" ? (
          <AIChat seatSection={seatSection} />
        ) : activeTab === "zones" ? (
          <div className="h-full overflow-y-auto px-4 py-3 space-y-4 pb-20 md:pb-4">
            {/* Food Courts */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                🍔 Food Courts
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(snapshot?.zones.filter((z) => z.zone_type === "food") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>

            {/* Restrooms */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                🚻 Restrooms
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(snapshot?.zones.filter((z) => z.zone_type === "restroom") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>

            {/* Gates */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                🚪 Exit Gates
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(snapshot?.zones.filter((z) => z.zone_type === "gate") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>

            {/* Seating */}
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                🪑 Seating Sections
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(snapshot?.zones.filter((z) => z.zone_type === "seating") ?? []).map((z) => (
                  <ZoneCard key={z.zone_id} zone={z} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* "My Stuff" tab — Exit Planner + Rewards */
          <div className="h-full overflow-y-auto px-4 py-3 space-y-4 pb-20 md:pb-4">
            <ExitPlanner
              zones={snapshot?.zones ?? []}
              predictions={snapshot?.predictions ?? []}
              gameMinute={snapshot?.game_state?.minute ?? 0}
            />
            <RewardsWallet />
          </div>
        )}
      </div>
    </div>
  );
}
