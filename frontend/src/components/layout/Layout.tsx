import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { pushToast } from "@/components/notifications/NotificationCenter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import {
  MessageSquare,
  BarChart2,
  BarChart3,
  Watch,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { path: "/", label: "Attendee", icon: MessageSquare },
  { path: "/admin", label: "Dashboard", icon: BarChart2 },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/wristband", label: "Wristband", icon: Watch },
];

export function Layout() {
  const { snapshot } = useWebSocket();
  const prevPredCountRef = useRef(0);
  const location = useLocation();

  // Auto-push notifications when new predictions appear
  useEffect(() => {
    if (!snapshot) return;
    const preds = snapshot.predictions ?? [];
    if (preds.length > prevPredCountRef.current && prevPredCountRef.current > 0) {
      const newest = preds[0];
      pushToast({
        type: "surge",
        title: `⚡ Surge Alert: ${newest.zone_name}`,
        message: newest.recommendation,
      });
    }
    prevPredCountRef.current = preds.length;
  }, [snapshot?.predictions?.length]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <a href="#main-content" className="skip-link">Skip to content</a>
      
      {/* Sidebar matches template exactly */}
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header matches template exactly */}
        <Header />

        <main id="main-content" className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile nav fallback for phones */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-slate-200 bg-white flex items-center justify-around px-4 z-50"
      >
        {mobileItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px]"
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-teal-400 text-white shadow-md shadow-teal-400/20"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold transition-colors",
                  isActive ? "text-teal-500" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
