import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  MessageSquare,
  BarChart2,
  Watch,
  Zap,
  ChevronRight,
  Power,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const sidebarItems = [
  { path: "/", label: "Attendee", icon: MessageSquare },
  { path: "/admin", label: "Dashboard", icon: BarChart2 },
  { path: "/wristband", label: "Wristband", icon: Watch },
];

/**
 * Layout matching the dashboard template — light mode.
 * Sidebar + header pattern from the template's Sidebar.tsx / Header.tsx.
 */
export function Layout() {
  const location = useLocation();

  // Determine current page name for breadcrumb
  const currentPage = sidebarItems.find((i) => i.path === location.pathname)?.label ?? "Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-maf-bg">
      {/* ===== SIDEBAR (matches template Sidebar.tsx) ===== */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col h-screen overflow-hidden shrink-0 hidden md:flex">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 gap-3 shrink-0 bg-white border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-teal-500" strokeWidth={2.5} />
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">
            Venue<span className="text-teal-500">Pulse</span>
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-2">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all mb-1 group",
                    isActive
                      ? "bg-teal-400 text-white shadow-md shadow-teal-400/20"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  )}
                  aria-label={`Navigate to ${item.label}`}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 shrink-0",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="mt-auto pt-8 border-t border-slate-200 px-3">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              VenuePulse v1.0
            </p>
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse-dot" />
              <span className="text-[11px] font-bold text-teal-500 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
        </nav>
      </aside>

      {/* ===== MAIN AREA ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header (matches template Header.tsx) */}
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-slate-800 font-bold text-sm whitespace-nowrap">VenuePulse</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="text-slate-500 font-medium text-sm whitespace-nowrap">{currentPage}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-100">
              <Activity className="w-3 h-3 text-teal-500" />
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                Live
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
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

      {/* ===== MOBILE BOTTOM NAV (hidden on desktop) ===== */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-slate-200 bg-white flex items-center justify-around px-4 z-50"
        role="navigation"
        aria-label="Main navigation"
      >
        {sidebarItems.map((item) => {
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
