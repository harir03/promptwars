import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from "recharts";
import type { ZoneDensity } from "@/types";

interface CrowdChartProps {
  history: { minute: number; total: number; packed: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#4b5563] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl border-none">
        <p>{`Minute ${label}'`}</p>
        <p>{`Total: ${payload[0]?.value?.toLocaleString()}`}</p>
        <p>{`Hot Zones: ${payload[1]?.value ?? 0}`}</p>
      </div>
    );
  }
  return null;
};

/**
 * Crowd density time-series chart — matching template chart style.
 * Shows total attendance + hot zone count over game minutes.
 */
export function CrowdChart({ history }: CrowdChartProps) {
  return (
    <div className="sl-card p-5 bg-white h-[280px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-slate-900 font-bold text-sm tracking-tight">📈 Crowd Timeline</h4>
        <span className="text-[10px] text-teal-500 font-black uppercase tracking-widest">
          {history.length} ticks
        </span>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="minute"
              tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
              tickFormatter={(v) => `${v}'`}
              stroke="#e2e8f0"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
              stroke="#e2e8f0"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#14b8a6"
              strokeWidth={2}
              fill="url(#gradTeal)"
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="packed"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#gradOrange)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
