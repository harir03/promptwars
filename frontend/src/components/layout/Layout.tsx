import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  MessageSquare,
  LayoutDashboard,
  Watch,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", label: "Attendee", icon: MessageSquare },
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/wristband", label: "Wristband", icon: Watch },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-vp-dark flex flex-col">
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-vp-border bg-vp-dark/90 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-vp-accent/15 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-vp-accent" />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-white">
            Venue<span className="text-vp-accent">Pulse</span>
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-vp-accent/10 border border-vp-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-vp-accent animate-pulse-dot" />
            <span className="text-[10px] font-bold text-vp-accent uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom Nav (mobile-first) */}
      <nav className="h-16 border-t border-vp-border bg-vp-dark/95 backdrop-blur-md flex items-center justify-around px-4 sticky bottom-0 z-50"
        role="navigation"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px]"
              aria-label={`Navigate to ${item.label}`}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive
                    ? "bg-vp-accent text-white shadow-lg shadow-vp-accent/25"
                    : "text-vp-text-muted hover:text-vp-text-secondary hover:bg-vp-card"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold transition-colors",
                  isActive ? "text-vp-accent" : "text-vp-text-muted"
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
