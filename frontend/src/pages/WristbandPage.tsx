import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import { Watch, Vibrate, Bell, QrCode, Smartphone, Zap } from "lucide-react";

/**
 * Wristband Concept page — light mode matching template.
 * Phone-as-Wristband simulator with vibration + push demo.
 */
export function WristbandPage() {
  const { snapshot } = useWebSocket();
  const [vibrating, setVibrating] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  const userZone = snapshot?.zones.find((z) => z.zone_id === "C");
  const density = userZone ? DENSITY_MAP[userZone.level] : DENSITY_MAP.clear;

  const triggerVibration = () => {
    setVibrating(true);
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
    setTimeout(() => setVibrating(false), 1200);
  };

  const sendTestNotification = async () => {
    try {
      await fetch("/api/notifications/test", { method: "POST" });
      setNotificationSent(true);
      setTimeout(() => setNotificationSent(false), 3000);
    } catch { /* ignore */ }
  };

  const zoneColorMap: Record<string, string> = {
    clear: "from-green-50 to-green-100/50 border-green-300",
    moderate: "from-amber-50 to-amber-100/50 border-amber-300",
    busy: "from-orange-50 to-orange-100/50 border-orange-300",
    packed: "from-red-50 to-red-100/50 border-red-300",
  };

  const glowColor = userZone ? zoneColorMap[userZone.level] : zoneColorMap.clear;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-md mx-auto">
      {/* Title */}
      <div className="text-center space-y-2 py-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
          <Watch className="w-8 h-8 text-teal-500" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Smart Wristband</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Experience what a VenuePulse NFC wristband would feel like — your phone simulates the real hardware
        </p>
      </div>

      {/* Wristband Display Simulator */}
      <motion.div
        className={cn(
          "sl-card rounded-2xl border-2 p-6 bg-gradient-to-br transition-all duration-500",
          glowColor
        )}
        animate={vibrating ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Wristband Display
            </span>
          </div>
          <span className="text-xs font-bold text-teal-500">
            {snapshot?.game_state?.minute ?? 0}'
          </span>
        </div>

        {/* Zone Color Indicator */}
        <div className="text-center py-4">
          <span className="text-4xl" aria-hidden="true">{density.icon}</span>
          <p className={cn("text-lg font-extrabold mt-2", density.css)}>{density.label}</p>
          <p className="text-xs text-slate-500 mt-1">
            Your zone: {userZone?.zone_name ?? "Section C"}
          </p>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-white/60 rounded-lg p-2 text-center border border-white/80">
            <span className="text-lg font-black text-slate-800">
              {userZone?.current_count?.toLocaleString() ?? "—"}
            </span>
            <p className="text-[9px] text-slate-400 font-bold">People nearby</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2 text-center border border-white/80">
            <span className="text-lg font-black text-slate-800">
              {Math.round((userZone?.percentage ?? 0) * 100)}%
            </span>
            <p className="text-[9px] text-slate-400 font-bold">Density</p>
          </div>
        </div>
      </motion.div>

      {/* Feature Demos */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Hardware Features
        </h3>

        {/* Vibration Demo */}
        <motion.button
          onClick={triggerVibration}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full sl-card p-4 flex items-center gap-4 transition-all bg-white",
            vibrating && "border-teal-300 shadow-md"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            vibrating ? "bg-teal-100" : "bg-teal-50"
          )}>
            <Vibrate className={cn("w-5 h-5 text-teal-500", vibrating && "animate-spin")} />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-slate-800">Haptic Alert</span>
            <p className="text-[10px] text-slate-400">
              {vibrating ? "🟢 Vibrating now!" : "Tap to feel a surge alert vibration"}
            </p>
          </div>
        </motion.button>

        {/* Push Notification Demo */}
        <motion.button
          onClick={sendTestNotification}
          whileTap={{ scale: 0.97 }}
          className="w-full sl-card p-4 flex items-center gap-4 bg-white"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-slate-800">Food Ready Alert</span>
            <p className="text-[10px] text-slate-400">
              {notificationSent ? "🟢 Notification sent!" : "Simulate a food order ready notification"}
            </p>
          </div>
        </motion.button>

        {/* QR Code Demo */}
        <div className="sl-card p-4 flex items-center gap-4 bg-white">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-slate-800">NFC / QR Link</span>
            <p className="text-[10px] text-slate-400">
              Share your seat location with friends via NFC tap or QR scan
            </p>
          </div>
        </div>
      </div>

      {/* Concept Explanation */}
      <div className="sl-card p-5 space-y-3 bg-white">
        <h3 className="text-sm font-bold text-teal-500 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> How It Would Work
        </h3>
        <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
          <p>
            <strong className="text-slate-800">At Entry:</strong> Tap your wristband at the gate — instant check-in, seat assignment, and wallet activation.
          </p>
          <p>
            <strong className="text-slate-800">During Event:</strong> The LED strip on the wristband changes color based on your zone's density. Red = packed, green = clear.
          </p>
          <p>
            <strong className="text-slate-800">Food Orders:</strong> Order from your phone, pay via NFC at the counter. Wristband vibrates when your food is ready.
          </p>
          <p>
            <strong className="text-slate-800">Exit:</strong> Follow the wristband's color — it guides you to the least congested gate. Earn points for smart exits.
          </p>
        </div>
      </div>
    </div>
  );
}
