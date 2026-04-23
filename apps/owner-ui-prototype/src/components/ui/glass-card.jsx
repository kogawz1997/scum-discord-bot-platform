import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";

export function GlassCard({ title, description, right, children, className = "", onClick }) {
  const interactiveClass = onClick
    ? "cursor-pointer hover:border-cyan-400/25 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.1)] transition-all duration-150"
    : "transition-colors duration-150";
  return (
    <Card className={`overflow-hidden ${interactiveClass} ${className}`} onClick={onClick}>
      {(title || right || description) && (
        <CardHeader className="owner-card-header flex flex-row items-start justify-between gap-3 border-b border-white/5 p-4 pb-3.5">
          <div className="min-w-0">
            {title ? <CardTitle className="text-[14px] font-bold leading-snug text-white">{title}</CardTitle> : null}
            {description ? <CardDescription className="mt-1 text-[12px] leading-5 text-zinc-500">{description}</CardDescription> : null}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </CardHeader>
      )}
      <CardContent className="overflow-x-auto p-4">{children}</CardContent>
    </Card>
  );
}
