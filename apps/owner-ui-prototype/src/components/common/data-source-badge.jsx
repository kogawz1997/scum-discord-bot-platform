import React from "react";
import { ToneBadge } from "../ui/tone-badge";

export function DataSourceBadge({ source, live, errors = [], endpointStatus = [] }) {
  const okCount = endpointStatus.filter((entry) => entry.ok).length;
  const authRequired = source === "auth-required";

  const toneMap = {
    "auth-required": "warning",
    "backend-partial": "degraded",
    "offline": "critical",
    "mock": "neutral",
    "error": "critical",
    "backend": live ? "healthy" : "degraded",
  };

  const tone = toneMap[source] || "neutral";
  const labelMap = {
    "backend": live ? "Live Backend" : "Backend Offline",
    "auth-required": "Authentication Required",
    "backend-partial": "Partial Data",
    "offline": "Offline",
    "mock": "Mock Data",
    "error": "Error Loading",
  };

  const label = labelMap[source] || source;

  return (
    <div className={`owner-status-panel mb-5 rounded-xl border p-4 ${live ? "border-emerald-500/20" : authRequired ? "border-amber-500/20" : "border-red-500/20"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <ToneBadge tone={tone}>{source}</ToneBadge>
            <div className="text-sm font-semibold text-white">{label}</div>
          </div>
          {live && okCount > 0 && (
            <div className="mt-2 text-sm text-zinc-400">
              Loaded {okCount} real endpoint{okCount === 1 ? "" : "s"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
