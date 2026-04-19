"use client";

import { NavLink, useLocation } from "react-router-dom";
import {
    BarChart2,
    Globe,
    ShieldAlert,
    ShieldCheck,
    Zap,
    Lock,
    Search,
    Settings,
    HelpCircle,
    FileText,
    Home,
    MessageCircle,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
    { name: "Attendee Agent", icon: MessageCircle, href: "/" },
    { name: "Live Dashboard", icon: BarChart2, href: "/admin" },
    { name: "Analytics", icon: Globe, href: "/analytics" },
    { name: "Wristband", icon: ShieldCheck, href: "/wristband" },
];

const footerItems = [
    { name: "Homepage", icon: Home, href: "/" },
    { name: "Get Support", icon: HelpCircle, href: "#" },
    { name: "Documentation", icon: FileText, href: "#" },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-screen overflow-hidden shrink-0 hidden md:flex">
            <div className="h-20 flex items-center px-8 gap-4 flex-shrink-0 bg-white border-b border-slate-100">
                <div className="w-10 h-10 flex items-center justify-center">
                    <img src="/eaglelogoBlack.svg" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-slate-800 font-black text-xl tracking-tight">VenuePulse</span>
            </div>

            <nav className="flex-1 overflow-y-auto py-6">
                <div className="px-4 mb-2 space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-4 px-6 py-4 rounded-xl text-base font-bold transition-all group",
                                    isActive
                                        ? "bg-teal-500 text-white shadow-lg shadow-teal-500/30 translate-x-1"
                                        : "text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm hover:translate-x-1"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-6 h-6 shrink-0 transition-colors",
                                    isActive ? "text-white" : "text-slate-400 group-hover:text-teal-500"
                                )} />
                                <span className="flex-1 tracking-tight">{item.name}</span>
                            </NavLink>
                        );
                    })}
                </div>

                <div className="mt-auto pt-8 border-t border-slate-200 px-3">
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Version 9.3.2</p>
                    {footerItems.map((item) => (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className="flex items-center gap-4 px-6 py-3 text-sm font-medium text-slate-500 hover:text-slate-900 transition-all hover:translate-x-1"
                        >
                            <item.icon className="w-5 h-5 text-slate-400" />
                            {item.name}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
