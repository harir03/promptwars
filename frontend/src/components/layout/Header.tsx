import { Power, ChevronRight, Activity } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

export function Header() {
    const location = useLocation();
    
    const getPageName = () => {
        switch (location.pathname) {
            case '/': return 'Attendee';
            case '/admin': return 'Dashboard';
            case '/analytics': return 'Analytics';
            case '/wristband': return 'Wristband';
            default: return 'Dashboard';
        }
    };

    return (
        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-slate-800 font-bold text-sm whitespace-nowrap">VenuePulse</span>
                <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
                <span className="text-slate-500 font-medium text-sm whitespace-nowrap">{getPageName()}</span>
            </div>

            <div className="flex items-center gap-2">
                <NotificationCenter />
                
                {/* Live Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-100" role="status" aria-label="Connection status: Live">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse-dot" aria-hidden="true" />
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                        Live
                    </span>
                </div>

                <div className="w-px h-6 bg-slate-200 mx-1" aria-hidden="true"></div>

                <button
                    onClick={() => {}}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                    aria-label="Power options"
                >
                    <Power className="w-5 h-5" aria-hidden="true" />
                </button>
            </div>
        </header>
    );
}
