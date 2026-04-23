import React from "react";

const TONE_CLASSES = {
  healthy: "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-300",
  active: "border-sky-400/30 bg-sky-400/[0.12] text-sky-200",
  synced: "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-300",
  stable: "border-cyan-400/30 bg-cyan-400/[0.12] text-cyan-200",
  degraded: "border-amber-500/30 bg-amber-500/[0.12] text-amber-200",
  warning: "border-amber-500/30 bg-amber-500/[0.12] text-amber-200",
  stale: "border-amber-500/25 bg-amber-500/[0.08] text-amber-300",
  critical: "border-red-500/30 bg-red-500/[0.12] text-red-200",
  failed: "border-red-500/30 bg-red-500/[0.12] text-red-200",
  paid: "border-emerald-500/30 bg-emerald-500/[0.12] text-emerald-300",
  pending: "border-amber-500/25 bg-amber-500/[0.08] text-amber-200",
  locked: "border-zinc-500/20 bg-zinc-500/[0.08] text-zinc-300",
  neutral: "border-slate-500/20 bg-slate-500/[0.06] text-slate-300",
};

const TONE_DOTS = {
  healthy: "bg-emerald-400",
  active: "bg-sky-400",
  synced: "bg-emerald-400",
  stable: "bg-cyan-400",
  degraded: "bg-amber-400",
  warning: "bg-amber-400",
  stale: "bg-amber-400",
  critical: "bg-red-400",
  failed: "bg-red-400",
  paid: "bg-emerald-400",
  pending: "bg-amber-400",
  locked: "bg-zinc-500",
  neutral: "bg-slate-500",
};

export function ToneBadge({ tone = "neutral", children, className = "", dot = false }) {
  const baseClass = TONE_CLASSES[tone] || TONE_CLASSES.neutral;
  const dotClass = TONE_DOTS[tone] || TONE_DOTS.neutral;
  return (
    <span className={`owner-tone-badge border ${baseClass} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </span>
  );
}
