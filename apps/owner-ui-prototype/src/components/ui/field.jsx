import React from "react";

export function Field({ label, value, sub, className = "" }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-zinc-400">{sub}</div> : null}
    </div>
  );
}
