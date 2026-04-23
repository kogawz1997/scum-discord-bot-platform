import React from "react";

export function MetricPair({ label, value, tone = "cyan" }) {
  const textColor = tone === "critical" ? "text-red-300" : tone === "warning" ? "text-amber-300" : tone === "healthy" ? "text-emerald-300" : "text-cyan-300";
  return (
    <div className="flex items-baseline gap-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">{label}</div>
      <div className={`owner-kpi-value text-xl font-black ${textColor}`}>{value}</div>
    </div>
  );
}
