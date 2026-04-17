import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn, DENSITY_MAP } from "@/lib/utils";
import { motion } from "framer-motion";
import { Watch, Vibrate, Bell, QrCode, Smartphone, Zap } from "lucide-react";

/**
 * Wristband Concept page — Phone-as-Wristband simulator.
 * Demonstrates what a smart wristband would do using
 * the Web Vibration API, push notifications, and zone colors.
 */
export function WristbandPage() {
  const { snapshot } = useWebSocket();
  const [vibrating, setVibrating] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  // Get user's zone (simulated — Section C)
  const userZone = snapshot?.zones.find((z) => z.zone_id === "C");
  const density = userZone ? DENSITY_MAP[userZone.level] : DENSITY_MAP.clear;

  const triggerVibration = () => {
    setVibrating(true);
    // Web Vibration API
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
    } catch {
      // Ignore
    }
  };

  const zoneColorMap: Record<string, string> = {
    clear: "from-green-500/30 to-green-900/10 border-green-500/40",
    moderate: "from-yellow-500/30 to-yellow-900/10 border-yellow-500/40",
    busy: "from-orange-500/30 to-orange-900/10 border-orange-500/40",
    packed: "from-red-500/30 to-red-900/10 border-red-500/40",
  };

  const glowColor = userZone ? zoneColorMap[userZone.level] : zoneColorMap.clear;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {/* Title */}
      <div className="text-center space-y-2 py-4">
        <div className="w-16 h-16 rounded-2xl bg-vp-accent/15 flex items-center justify-center mx-auto">
          <Watch className="w-8 h-8 text-vp-accent" />
        </div>
        <h2 className="text-xl font-extrabold text-white">Smart Wristband</h2>
        <p className="text-xs text-vp-text-muted max-w-xs mx-auto">
          Experience what a VenuePulse NFC wristband would feel like — your phone simulates the real hardware features
        </p>
      </div>

      {/* Wristband Display Simulator */}
      <motion.div
        className={cn(
          "rounded-2xl border-2 p-6 bg-gradient-to-br transition-all duration-500",
          glowColor
        )}
        animate={vibrating ? { x: [-2, 2, -2, 2, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-white/70" />
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
              Wristband Display
            </span>
          </div>
          <span className="text-xs font-bold text-vp-accent">
            {snapshot?.game_state?.minute ?? 0}'
          </span>
        </div>

        {/* Zone Color Indicator */}
        <div className="text-center py-4">
          <span className="text-4xl" aria-hidden="true">{density.icon}</span>
          <p className={cn("text-lg font-extrabold mt-2", density.css)}>
            {density.label}
          </p>
          <p className="text-xs text-white/60 mt-1">
            Your zone: {userZone?.zone_name ?? "Section C"}
          </p>
        </div>

        {/* Quick Info */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <span className="text-lg font-black text-white">
              {userZone?.current_count?.toLocaleString() ?? "—"}
            </span>
            <p className="text-[9px] text-white/50 font-bold">People nearby</p>
          </div>
          <div className="bg-black/20 rounded-lg p-2 text-center">
            <span className="text-lg font-black text-white">
              {Math.round((userZone?.percentage ?? 0) * 100)}%
            </span>
            <p className="text-[9px] text-white/50 font-bold">Density</p>
          </div>
        </div>
      </motion.div>

      {/* Feature Demos */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-vp-text-muted uppercase tracking-wider px-1">
          Hardware Features
        </h3>

        {/* Vibration Demo */}
        <motion.button
          onClick={triggerVibration}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full glass-card p-4 flex items-center gap-4 transition-all",
            vibrating && "border-vp-accent/50"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            vibrating ? "bg-vp-accent/30" : "bg-vp-accent/10"
          )}>
            <Vibrate className={cn("w-5 h-5 text-vp-accent", vibrating && "animate-spin")} />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-white">Haptic Alert</span>
            <p className="text-[10px] text-vp-text-muted">
              {vibrating ? "🟢 Vibrating now!" : "Tap to feel a surge alert vibration"}
            </p>
          </div>
        </motion.button>

        {/* Push Notification Demo */}
        <motion.button
          onClick={sendTestNotification}
          whileTap={{ scale: 0.97 }}
          className="w-full glass-card p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-vp-blue/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-vp-blue" />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-white">Food Ready Alert</span>
            <p className="text-[10px] text-vp-text-muted">
              {notificationSent ? "🟢 Notification sent!" : "Simulate a food order ready notification"}
            </p>
          </div>
        </motion.button>

        {/* QR Code Demo */}
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left flex-1">
            <span className="text-sm font-bold text-white">NFC / QR Link</span>
            <p className="text-[10px] text-vp-text-muted">
              Share your seat location with friends via NFC tap or QR scan
            </p>
          </div>
        </div>
      </div>

      {/* Concept Description */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-bold text-vp-accent uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" /> How It Would Work
        </h3>
        <div className="space-y-2 text-xs text-vp-text-secondary leading-relaxed">
          <p>
            <strong className="text-white">At Entry:</strong> Tap your wristband at the gate — instant check-in, seat assignment, and wallet activation.
          </p>
          <p>
            <strong className="text-white">During Event:</strong> The LED strip on the wristband changes color based on your zone's density. Red = packed, green = clear.
          </p>
          <p>
            <strong className="text-white">Food Orders:</strong> Order from your phone, pay via NFC at the counter. Wristband vibrates when your food is ready.
          </p>
          <p>
            <strong className="text-white">Exit:</strong> Follow the wristband's color — it guides you to the least congested gate. Earn points for smart exits.
          </p>
        </div>
      </div>
    </div>
  );
}
