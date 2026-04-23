import React from "react";

export function PageLayout({ title, subtitle, icon: Icon, rightActions, children }) {
  return (
    <div className="owner-page-content w-full">
      <div className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {Icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white">{title}</h1>
              {subtitle && <p className="mt-0.5 text-[13px] text-zinc-500">{subtitle}</p>}
            </div>
          </div>
          {rightActions && <div className="flex flex-wrap gap-2">{rightActions}</div>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
