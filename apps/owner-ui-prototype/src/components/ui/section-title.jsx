import React from "react";

export function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-lg font-bold leading-tight text-white">{title}</div>
        {subtitle ? <div className="mt-1 text-[13px] text-zinc-500">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}
