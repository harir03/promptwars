import React from "react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, Tooltip,
  AreaChart, Area
} from "recharts";
import { History } from "lucide-react";

const CustomTooltip = ({ active, payload, label, color = "#2dd4bf", title = "Value" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-50 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] min-w-[140px]">
        <p className="text-[12px] text-slate-400 font-medium mb-2">{label || "—"}</p>
        <div className="flex items-center gap-2">
          <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[14px] font-medium text-slate-500">{title}</span>
          <span className="text-[14px] font-medium text-slate-700 ml-auto pl-4">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

interface DensityBarChartProps {
  data: { minute: number; total: number }[];
}

/**
 * QPSChart-style bar chart from template — shows crowd density over time.
 * Uses the same visual language: slim bars, teal color, dot strip at bottom.
 */
export function DensityBarChart({ data }: DensityBarChartProps) {
  const chartData = data.length > 0 ? data : Array.from({ length: 24 }, (_, i) => ({ minute: i, total: Math.floor(Math.random() * 50) + 20 }));
  const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].total : 0;

  return (
    <div className="sl-card p-6 bg-white flex flex-col h-[260px] relative overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h4 className="text-slate-900 font-bold text-base">Crowd Density</h4>
          <div className="flex items-center px-2 py-1 bg-slate-50 border border-slate-100 rounded-md gap-2">
            <span className="text-[11px] font-black text-slate-900">{latestValue.toLocaleString()}</span>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer group">
          <History className="w-5 h-5 text-teal-500 group-hover:rotate-[-45deg] transition-transform" />
        </div>
      </div>

      <div className="flex-1 w-full relative outline-none flex flex-col min-w-0">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="99%" height="100%" minWidth={0}>
            <BarChart data={chartData}>
              <XAxis dataKey="minute" hide />
              <Bar dataKey="total" fill="#2dd4bf" radius={[1, 1, 0, 0]} barSize={4} />
              <Tooltip
                cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                content={<CustomTooltip color="#2dd4bf" title="People" />}
                wrapperStyle={{ outline: "none" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full flex gap-[3px] mt-2 overflow-hidden px-1">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="w-2 h-[3px] bg-teal-500 rounded-full shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatusAreaChartProps {
  data: { minute: number; value: number }[];
  title: string;
  color?: string;
  gradientId?: string;
}

/**
 * Area chart matching template's RequestsStatusChart / BlockingStatusChart.
 */
export function StatusAreaChart({ data, title, color = "#14b8a6", gradientId = "colorArea" }: StatusAreaChartProps) {
  const chartData = data.length > 0 ? data : Array.from({ length: 24 }, () => ({ minute: 0, value: 0 }));

  return (
    <div className="sl-card p-4 bg-white flex flex-col h-[232px]">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-slate-800 font-black text-[12px] uppercase tracking-tight">{title}</h4>
      </div>
      <div className="flex-1 w-full outline-none min-w-0">
        <ResponsiveContainer width="99%" height="100%" minWidth={0}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.1} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="minute" hide />
            <Tooltip
              content={<CustomTooltip color={color} title={title} />}
              wrapperStyle={{ outline: "none" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
