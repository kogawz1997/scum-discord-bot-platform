import React from "react";
import { AlertTriangle, Bell, CheckCircle2 } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";
import { formatBackendTime, pickRecordTitle } from "../lib/ui-helpers";

export function IncidentsPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const notifications = extractItems(raw.notifications);
  const securityEvents = extractItems(raw.securityEvents);
  const requestLogs = extractItems(raw.observabilityErrors);
  const deliverySummary = raw.deliveryLifecycle?.summary || {};
  const failedJobs = Number(deliverySummary.failed24h || deliverySummary.failed || 0);

  const criticalCount = securityEvents.length + requestLogs.filter((r) => Number(r.statusCode || r.status || 0) >= 500).length + failedJobs;
  const warningCount = notifications.length + requestLogs.filter((r) => {
    const s = Number(r.statusCode || r.status || 0);
    return s >= 400 && s < 500;
  }).length;

  const incidentRows = [
    ...notifications.map((r) => ({ tone: r.severity || "warning", title: pickRecordTitle(r, "Notification"), meta: r.type || r.category || "notification", body: r.detail || r.message || r.description || "Owner notification" })),
    ...securityEvents.map((r) => ({ tone: r.severity || "critical", title: pickRecordTitle(r, "Security event"), meta: r.actor || r.ip || "security", body: r.detail || r.reason || r.message || "Security event" })),
    ...requestLogs.slice(0, 5).map((r) => ({
      tone: Number(r.statusCode || r.status || 0) >= 500 ? "critical" : "warning",
      title: `${r.method || "GET"} ${r.path || "request"}`,
      meta: `${r.statusCode || r.status || "ERR"} ${formatBackendTime(r.at || r.createdAt)}`,
      body: r.error || r.note || "Backend request needs attention",
    })),
  ];

  const actions = (
    <Button variant="outline" onClick={() => onRun("acknowledgeNotifications", {
      ids: notifications.map((n) => n.id).filter(Boolean),
    })}>
      <CheckCircle2 className="mr-2 h-4 w-4" /> Acknowledge All
    </Button>
  );

  return (
    <PageLayout title="Incidents & Alerts" subtitle="Notifications, security events และ request errors" icon={Bell} rightActions={actions}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Critical Active" value={criticalCount} sub="Security, failed jobs, 5xx requests" icon={AlertTriangle}
          spark="w-[48%] bg-red-400" compact />
        <StatCard label="Warnings Pending" value={warningCount} sub="Notifications + 4xx requests" icon={AlertTriangle}
          spark="w-[70%] bg-amber-400" compact />
        <StatCard label="Notifications" value={notifications.length} sub="Rows from notifications endpoint" icon={CheckCircle2}
          spark="w-[84%] bg-cyan-400" compact />
      </div>

      <GlassCard title="Live Incident Feed"
        right={<ToneBadge tone={incidentRows.length ? "warning" : "healthy"}>{incidentRows.length} live rows</ToneBadge>}>
        {incidentRows.length ? (
          <div className="space-y-3">
            {incidentRows.slice(0, 12).map((row, index) => (
              <div key={`${row.title}-${index}`}
                className={`rounded-xl border p-4 ${row.tone === "critical" ? "border-red-500/20 bg-red-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{row.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">{row.body}</div>
                  </div>
                  <ToneBadge tone={row.tone}>{row.meta}</ToneBadge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState title="No active incidents"
            body="Notifications, security events และ request error logs ว่างอยู่ในตอนนี้" />
        )}
      </GlassCard>
    </PageLayout>
  );
}
