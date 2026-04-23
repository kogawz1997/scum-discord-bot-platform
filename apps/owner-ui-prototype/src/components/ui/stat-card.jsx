import React from "react";
import { motion } from "framer-motion";
import { GlassCard } from "./glass-card";

export function StatCard({ label, value, sub, icon: Icon, spark, rightMeta, compact = false, tone }) {
  const iconBg = tone === "warning" ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
    : tone === "critical" ? "border-red-400/20 bg-red-400/10 text-red-300"
    : tone === "healthy" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
    : "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300";

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
      <GlassCard className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
            <div className={`owner-kpi-value ${compact ? "mt-2 text-[26px]" : "mt-3 text-[32px]"} font-black text-white`}>{value}</div>
            {sub ? <div className="mt-1.5 text-[12px] leading-5 text-zinc-500">{sub}</div> : null}
          </div>
          {Icon ? (
            <div className={`rounded-xl border p-2.5 ${iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
        {rightMeta ? <div className="mt-4 text-sm font-medium text-zinc-300">{rightMeta}</div> : null}
        {spark ? (
          <div className="owner-sparkline mt-4">
            <div className={`owner-sparkline-fill ${spark}`} />
          </div>
        ) : null}
      </GlassCard>
    </motion.div>
  );
}
