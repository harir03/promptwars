import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Bell, AlertTriangle, Gift, Zap, Trophy,
  X, ChevronDown, ChevronUp
} from "lucide-react";

export type ToastType = "surge" | "reward" | "goal" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const TOAST_ICONS: Record<ToastType, any> = {
  surge: AlertTriangle,
  reward: Gift,
  goal: Trophy,
  info: Zap,
};

const TOAST_COLORS: Record<ToastType, string> = {
  surge: "border-amber-200 bg-amber-50",
  reward: "border-teal-200 bg-teal-50",
  goal: "border-violet-200 bg-violet-50",
  info: "border-blue-200 bg-blue-50",
};

const TOAST_ICON_COLORS: Record<ToastType, string> = {
  surge: "text-amber-500",
  reward: "text-teal-500",
  goal: "text-violet-500",
  info: "text-blue-500",
};

/**
 * Global notification center hook.
 * Components call addToast() to push notifications.
 */
let _globalAddToast: ((toast: Omit<Toast, "id" | "timestamp" | "read">) => void) | null = null;

export function pushToast(toast: Omit<Toast, "id" | "timestamp" | "read">) {
  _globalAddToast?.(toast);
}

export function NotificationCenter() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBanner, setShowBanner] = useState<Toast | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const addToast = useCallback((toast: Omit<Toast, "id" | "timestamp" | "read">) => {
    const newToast: Toast = {
      ...toast,
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      read: false,
    };
    setToasts(prev => [newToast, ...prev].slice(0, 50));
    setShowBanner(newToast);

    // Auto-dismiss banner after 5s
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setShowBanner(null), 5000);
  }, []);

  // Register global addToast
  useEffect(() => {
    _globalAddToast = addToast;
    return () => { _globalAddToast = null; };
  }, [addToast]);

  const unreadCount = toasts.filter(t => !t.read).length;

  const markAllRead = () => {
    setToasts(prev => prev.map(t => ({ ...t, read: true })));
  };

  const clearAll = () => {
    setToasts([]);
    setIsOpen(false);
  };

  const formatTime = (ts: number) => {
    const diff = Math.round((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <>
      {/* Floating Banner Toast */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={cn(
              "fixed top-4 right-4 z-[100] max-w-sm w-full rounded-xl border shadow-lg p-3 flex items-start gap-3 cursor-pointer",
              TOAST_COLORS[showBanner.type]
            )}
            onClick={() => { setShowBanner(null); setIsOpen(true); }}
          >
            {(() => {
              const Icon = TOAST_ICONS[showBanner.type];
              return <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", TOAST_ICON_COLORS[showBanner.type])} />;
            })()}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">{showBanner.title}</p>
              <p className="text-[11px] text-slate-600 truncate">{showBanner.message}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setShowBanner(null); }}
              className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Bell Button */}
      <button
        onClick={() => { setIsOpen(!isOpen); markAllRead(); }}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4.5 h-4.5 text-slate-500" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90]"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-[95] overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  {toasts.length > 0 && (
                    <button onClick={clearAll}
                      className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider">
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Toast List */}
              <div className="max-h-80 overflow-y-auto">
                {toasts.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No notifications yet</p>
                  </div>
                ) : (
                  toasts.map(toast => {
                    const Icon = TOAST_ICONS[toast.type];
                    return (
                      <div
                        key={toast.id}
                        className={cn(
                          "px-4 py-3 border-b border-slate-50 flex items-start gap-3 transition-colors",
                          !toast.read && "bg-slate-50/50"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          TOAST_COLORS[toast.type])}>
                          <Icon className={cn("w-3.5 h-3.5", TOAST_ICON_COLORS[toast.type])} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800">{toast.title}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{toast.message}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(toast.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
