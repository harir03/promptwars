import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ScrollText, Zap, Trophy, Gift, Clock, ChevronDown, Trash2 } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { GameState, SurgePrediction } from "@/types";

export type EventKind = "phase_change" | "goal" | "reward" | "prediction" | "speed" | "system";

export interface EventEntry {
  id: string;
  kind: EventKind;
  message: string;
  detail?: string;
  timestamp: number;
  gameMinute: number;
}

const EVENT_ICONS: Record<EventKind, any> = {
  phase_change: Clock,
  goal: Trophy,
  reward: Gift,
  prediction: Zap,
  speed: Zap,
  system: ScrollText,
};

const EVENT_COLORS: Record<EventKind, string> = {
  phase_change: "bg-blue-50 text-blue-500 border-blue-200",
  goal: "bg-violet-50 text-violet-500 border-violet-200",
  reward: "bg-teal-50 text-teal-500 border-teal-200",
  prediction: "bg-amber-50 text-amber-500 border-amber-200",
  speed: "bg-orange-50 text-orange-500 border-orange-200",
  system: "bg-slate-50 text-slate-500 border-slate-200",
};

/**
 * AdminEventLog — Timestamped feed of game events.
 * Tracks phase changes, goals, rewards, predictions, and speed changes.
 * Can be used standalone (uses its own WebSocket) or with explicit props.
 */
export function AdminEventLog({ gameState: propGameState, predictions: propPredictions }: {
  gameState?: GameState | null;
  predictions?: SurgePrediction[];
} = {}) {
  const ws = useWebSocket();
  const gameState = propGameState ?? ws.snapshot?.game_state ?? null;
  const predictions = propPredictions ?? ws.snapshot?.predictions ?? [];

  const [events, setEvents] = useState<EventEntry[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const prevPhaseRef = useRef<string>("");
  const prevScoreRef = useRef<string>("0-0");
  const prevSpeedRef = useRef<number>(1);
  const prevPredCountRef = useRef<number>(0);

  const addEvent = useCallback((evt: Omit<EventEntry, "id" | "timestamp">) => {
    setEvents(prev => [{
      ...evt,
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      timestamp: Date.now(),
    }, ...prev].slice(0, 100));
  }, []);

  // Track phase changes
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase !== prevPhaseRef.current && prevPhaseRef.current !== "") {
      const phaseLabels: Record<string, string> = {
        pre_match: "Pre-Match", first_half: "1st Half",
        halftime: "Halftime", second_half: "2nd Half",
        post_match: "Post-Match / Full Time",
      };
      addEvent({
        kind: "phase_change",
        message: `Phase → ${phaseLabels[phase] ?? phase}`,
        detail: `Game minute: ${gameState.minute}'`,
        gameMinute: gameState.minute,
      });
    }
    prevPhaseRef.current = phase;
  }, [gameState?.phase]);

  // Track goals
  useEffect(() => {
    if (!gameState) return;
    const score = `${gameState.home_score}-${gameState.away_score}`;
    if (score !== prevScoreRef.current && prevScoreRef.current !== "0-0") {
      const [prevH, prevA] = prevScoreRef.current.split("-").map(Number);
      const isHome = gameState.home_score > prevH;
      addEvent({
        kind: "goal",
        message: `⚽ ${isHome ? "HOME" : "AWAY"} GOAL!`,
        detail: `Score: ${score} (${gameState.minute}')`,
        gameMinute: gameState.minute,
      });
    }
    prevScoreRef.current = score;
  }, [gameState?.home_score, gameState?.away_score]);

  // Track speed changes
  useEffect(() => {
    if (!gameState) return;
    if (gameState.speed_multiplier !== prevSpeedRef.current && prevSpeedRef.current !== 1) {
      addEvent({
        kind: "speed",
        message: `Speed → ${gameState.speed_multiplier}x`,
        gameMinute: gameState.minute,
      });
    }
    prevSpeedRef.current = gameState.speed_multiplier;
  }, [gameState?.speed_multiplier]);

  // Track new predictions
  useEffect(() => {
    if (predictions.length > prevPredCountRef.current && prevPredCountRef.current > 0) {
      const newest = predictions[0];
      addEvent({
        kind: "prediction",
        message: `Surge predicted: ${newest.zone_name}`,
        detail: `${Math.round(newest.confidence * 100)}% confidence — ${newest.recommendation}`,
        gameMinute: gameState?.minute ?? 0,
      });
    }
    prevPredCountRef.current = predictions.length;
  }, [predictions.length]);

  const filtered = filter === "all" ? events : events.filter(e => e.kind === filter);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="sl-card bg-white overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-blue-500" /> Event Log
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-black text-slate-500">
            {events.length}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setEvents([]); }}
              className="text-slate-400 hover:text-red-500 transition-colors"
              aria-label="Clear events"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-slate-400 transition-transform",
            expanded && "rotate-180"
          )} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Filter Bar */}
            <div className="px-5 py-2 flex gap-1.5 border-t border-slate-100 overflow-x-auto">
              {(["all", "phase_change", "goal", "reward", "prediction", "speed"] as const).map(kind => (
                <button
                  key={kind}
                  onClick={() => setFilter(kind)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                    filter === kind
                      ? "bg-teal-400 text-white"
                      : "bg-slate-50 text-slate-400 hover:text-slate-600"
                  )}
                >
                  {kind === "all" ? "All" : kind.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Event List */}
            <div className="max-h-[400px] overflow-y-auto border-t border-slate-100">
              {filtered.length === 0 ? (
                <div className="py-8 text-center">
                  <ScrollText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No events recorded yet</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Events will appear as the match progresses</p>
                </div>
              ) : (
                filtered.map(event => {
                  const Icon = EVENT_ICONS[event.kind];
                  const colorClass = EVENT_COLORS[event.kind];
                  return (
                    <div key={event.id} className="px-5 py-2.5 border-b border-slate-50 flex items-start gap-3 hover:bg-slate-50/30 transition-colors">
                      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 border", colorClass)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800">{event.message}</p>
                        {event.detail && (
                          <p className="text-[10px] text-slate-500 truncate">{event.detail}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold text-slate-400">{event.gameMinute}'</p>
                        <p className="text-[9px] text-slate-300">{formatTime(event.timestamp)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
