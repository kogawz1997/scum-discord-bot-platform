import React from "react";
import { LifeBuoy, Download } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";
import { formatBackendTime } from "../lib/ui-helpers";

export function SupportPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const deliveryRows = extractItems(raw.deliveryLifecycle);
  const requestLogs = extractItems(raw.observabilityErrors);
  const supportRows = deliveryRows.slice(0, 8);
  const dlqRows = requestLogs.slice(0, 6);

  const actions = (
    <Button variant="outline" onClick={() => onRun("exportSupport")}>
      <Download className="mr-2 h-4 w-4" /> Export Support Data
    </Button>
  );

  return (
    <PageLayout title="Support & Diagnostics" subtitle="Live evidence และ diagnostic tools" icon={LifeBuoy} rightActions={actions}>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Live Support Evidence */}
        <GlassCard title="Live Support Evidence"
          right={<ToneBadge tone={supportRows.length ? "warning" : "stable"}>{supportRows.length} rows</ToneBadge>}>
          {supportRows.length ? (
            <div className="space-y-3">
              {supportRows.map((row, idx) => {
                const isCritical = String(row.status || row.severity || "").includes("failed");
                return (
                  <div key={row.id || idx} className={`rounded-xl border p-4 ${isCritical ? "border-red-500/20 bg-red-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white">{row.id || row.jobId || `JOB-${idx + 1}`}</div>
                        <div className="mt-1 text-sm text-zinc-400">{row.error || row.status || row.reason || "Delivery lifecycle event"}</div>
                      </div>
                      <div className="text-right">
                        <ToneBadge tone={isCritical ? "critical" : "warning"}>{row.status || "open"}</ToneBadge>
                        <div className="mt-1 text-[11px] text-zinc-500">{row.tenantName || row.tenantId || "Unknown tenant"}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-[11px] text-zinc-500">
                      <span>Agent: {row.runtimeKey || row.agentId || row.source || "runtime"}</span>
                      {row.at && <span>· {formatBackendTime(row.at)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DataEmptyState title="No support queue data"
              body="Repo มี tenant-specific support-case reads แต่ยังไม่มี global create/list endpoint สำหรับ owner prototype" />
          )}
        </GlassCard>

        {/* Dead-Letter Queue */}
        <GlassCard title="Dead-Letter & Error Evidence">
          {dlqRows.length ? (
            <div className="space-y-2">
              {dlqRows.map((row, idx) => (
                <div key={row.id || idx} className="rounded-lg border border-white/5 bg-black/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-cyan-200">{row.method || "GET"} {row.path?.slice(0, 40) || "unknown"}</span>
                    <ToneBadge tone={Number(row.statusCode || row.status || 0) >= 500 ? "critical" : "warning"}>
                      {row.statusCode || row.status || "ERR"}
                    </ToneBadge>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{formatBackendTime(row.at || row.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <DataEmptyState title="ไม่มี dead-letter rows" body="Request error endpoint returned no rows" />
          )}
        </GlassCard>
      </div>
    </PageLayout>
  );
}
