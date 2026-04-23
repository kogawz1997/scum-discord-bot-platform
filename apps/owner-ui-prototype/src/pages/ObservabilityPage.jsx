import React from "react";
import { Activity, Download, AlertTriangle } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { MetricPair } from "../components/ui/metric-pair";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";
import { formatBackendTime } from "../lib/ui-helpers";

export function ObservabilityPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const requestLogs = extractItems(raw.observabilityErrors);
  const deliveryRows = extractItems(raw.deliveryLifecycle);
  const metrics = raw.observabilityErrors?.metrics || raw.observability?.metrics || {};
  const deliverySummary = raw.deliveryLifecycle?.summary || {};

  const actions = (
    <Button variant="outline" onClick={() => onRun("exportObservability")}>
      <Download className="mr-2 h-4 w-4" /> Export
    </Button>
  );

  return (
    <PageLayout title="Observability" subtitle="Telemetry, logs และ delivery tracking" icon={Activity} rightActions={actions}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Error Requests" value={requestLogs.length} icon={AlertTriangle}
          sub="Backend error log rows"
          spark={requestLogs.length ? "w-[60%] bg-red-400" : "w-[10%] bg-emerald-400"} compact />
        <StatCard label="Failed Delivery Jobs" value={deliverySummary.failed24h ?? deliverySummary.failed ?? 0}
          sub="Last 24 hours" spark="w-[18%] bg-amber-400" compact />
        <StatCard label="Dead-Letter Queue" value={deliverySummary.deadLetter ?? 0}
          sub="Needs manual review" spark="w-[24%] bg-red-400" compact />
      </div>

      <GlassCard title="Backend Request Errors"
        right={<ToneBadge tone={requestLogs.length ? "warning" : "stable"}>{requestLogs.length} rows</ToneBadge>}>
        {requestLogs.length ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[640px] grid-cols-[160px_90px_110px_1fr] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              <div>Time</div><div>Status</div><div>Method</div><div>Path</div>
            </div>
            {requestLogs.slice(0, 12).map((row, index) => {
              const status = Number(row.statusCode || row.status || 0);
              return (
                <div key={row.id || index}
                  className={`grid min-w-[640px] grid-cols-[160px_90px_110px_1fr] items-center border-t border-white/5 px-4 py-3 text-sm ${status >= 500 ? "bg-red-500/[0.05]" : status >= 400 ? "bg-amber-500/[0.04]" : ""}`}>
                  <div className="font-mono text-zinc-500">{formatBackendTime(row.at || row.createdAt || row.time)}</div>
                  <div><ToneBadge tone={status >= 500 ? "critical" : status >= 400 ? "warning" : "healthy"}>{status || "OK"}</ToneBadge></div>
                  <div className="font-mono text-cyan-200">{row.method || "GET"}</div>
                  <div className="truncate text-zinc-300">{row.path || row.pathname || row.url || "unknown"}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <DataEmptyState title="No request errors" body="The observability endpoint returned no error rows." />
        )}
      </GlassCard>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard title="Delivery Lifecycle">
          <div className="space-y-3">
            <MetricPair label="Failed jobs" value={deliverySummary.failed24h || deliverySummary.failed || 0}
              tone={deliverySummary.failed24h ? "critical" : "healthy"} />
            <MetricPair label="Dead-letter" value={deliverySummary.deadLetter || 0}
              tone={deliverySummary.deadLetter ? "critical" : "healthy"} />
            <MetricPair label="Lifecycle rows" value={deliveryRows.length} />
          </div>
        </GlassCard>
        <GlassCard title="Telemetry Metrics">
          <div className="space-y-3">
            <MetricPair label="Total requests" value={metrics.total || metrics.count || requestLogs.length} />
            <MetricPair label="Error count" value={metrics.errors || metrics.errorCount || requestLogs.length}
              tone={requestLogs.length ? "warning" : "healthy"} />
            <MetricPair label="P95 latency" value={metrics.p95Ms ? `${metrics.p95Ms}ms` : "n/a"} />
          </div>
        </GlassCard>
      </div>
    </PageLayout>
  );
}
