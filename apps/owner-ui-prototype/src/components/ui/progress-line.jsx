import React from "react";

export function ProgressLine({ value, tone = "cyan" }) {
  const color = tone === "green" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : tone === "red" ? "bg-red-400" : "bg-cyan-400";
  return (
    <div className="h-2 rounded-full bg-white/5">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}
