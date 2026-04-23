import React from "react";
import { Shield, Download } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";
import { formatBackendTime, pickRecordTitle } from "../lib/ui-helpers";

export function SecurityPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const securityEvents = extractItems(raw.securityEvents);
  const sessions = extractItems(raw.sessions);
  const users = extractItems(raw.users);
  const auditRows = extractItems(raw.auditQuery);
  const roleMatrix = raw.roleMatrix?.summary || raw.roleMatrix || {};

  const actions = (
    <Button variant="outline" onClick={() => onRun("exportAudit")}>
      <Download className="mr-2 h-4 w-4" /> Export Audit
    </Button>
  );

  return (
    <PageLayout title="Audit & Security" subtitle="Security events, sessions และ audit log" icon={Shield} rightActions={actions}>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Security Events */}
        <GlassCard title="Security Events"
          right={<ToneBadge tone={securityEvents.length ? "critical" : "healthy"}>{securityEvents.length} events</ToneBadge>}>
          {securityEvents.length ? (
            <div className="space-y-3">
              {securityEvents.slice(0, 6).map((event, idx) => (
                <div key={event.id || idx}
                  className={`rounded-xl border p-3 ${String(event.severity || "").includes("critical") || String(event.severity || "").includes("high") ? "border-red-500/20 bg-red-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.04]"}`}>
                  <div className="font-semibold text-white">{pickRecordTitle(event, "Security event")}</div>
                  <div className="mt-1 text-xs text-zinc-400">{event.detail || event.reason || event.message || "Security signal from backend"}</div>
                  {event.actor && <div className="mt-2 text-[11px] text-zinc-500">Actor: {event.actor}</div>}
                </div>
              ))}
            </div>
          ) : (
            <DataEmptyState title="No security events" body="Security-events endpoint returned no active rows" />
          )}
        </GlassCard>

        <div className="space-y-4">
          {/* Audit Log */}
          <GlassCard title="Audit Log"
            right={<ToneBadge tone={auditRows.length ? "stable" : "locked"}>{auditRows.length} rows</ToneBadge>}>
            {auditRows.length ? (
              <div className="overflow-auto rounded-xl border border-white/5">
                <div className="grid min-w-[640px] grid-cols-[150px_160px_180px_1fr_100px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  <div>Timestamp</div><div>Actor</div><div>Action</div><div>Target</div><div>IP</div>
                </div>
                {auditRows.slice(0, 10).map((row, idx) => (
                  <div key={row.id || idx}
                    className="grid min-w-[640px] grid-cols-[150px_160px_180px_1fr_100px] items-center border-t border-white/5 px-4 py-3 text-sm">
                    <div className="text-zinc-400">{formatBackendTime(row.at || row.createdAt)}</div>
                    <div className="font-semibold text-white">{row.actor || row.user || "system"}</div>
                    <div>
                      <ToneBadge tone={String(row.action || "").includes("AUTH") ? "critical" : "locked"}>
                        {row.action || row.type || "event"}
                      </ToneBadge>
                    </div>
                    <div className="truncate text-cyan-200">{row.target || row.path || "platform"}</div>
                    <div className="text-zinc-500">{row.ip || "n/a"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <DataEmptyState title="No audit rows" body="Audit endpoint returned no rows สำหรับ default query" />
            )}
          </GlassCard>

          {/* Stats */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Role Matrix", value: roleMatrix.roles || roleMatrix.roleCount || "Live", tone: "stable" },
              { label: "Admin Users", value: users.length, tone: "warning" },
              { label: "Active Sessions", value: sessions.length, tone: "stable" },
            ].map(({ label, value, tone }) => (
              <div key={label} className="owner-card rounded-xl border p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
                <div className={`owner-kpi-value mt-2 text-xl font-black ${tone === "warning" ? "text-amber-300" : tone === "critical" ? "text-red-300" : "text-cyan-300"}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
