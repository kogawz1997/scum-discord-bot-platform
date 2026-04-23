import React from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";
import { formatBackendTime } from "../lib/ui-helpers";

export function RecoveryPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const backupList = extractItems(raw.backupList);
  const recoveryStatus = raw.recoveryStatus?.data || raw.recoveryStatus || {};
  const restartPlans = extractItems(raw.restartPlans);

  const lastBackup = backupList[0];

  return (
    <PageLayout title="Maintenance & Recovery" subtitle="Backup history และ restore controls" icon={RotateCcw}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Backup Points" value={backupList.length} sub="Available restore points" compact
          spark={`w-[${Math.min(backupList.length * 10, 100)}%] bg-cyan-400`} />
        <StatCard label="Last Backup" value={lastBackup ? formatBackendTime(lastBackup.at || lastBackup.createdAt) : "—"}
          sub="Most recent checkpoint" compact />
        <StatCard label="Restart Plans" value={restartPlans.length} sub="Scheduled maintenance scripts" compact
          spark="w-[30%] bg-amber-400" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Backup List */}
        <GlassCard title="Backup History"
          right={<ToneBadge tone={backupList.length ? "stable" : "locked"}>{backupList.length} points</ToneBadge>}>
          {backupList.length ? (
            <div className="space-y-2">
              {backupList.slice(0, 10).map((backup, idx) => (
                <div key={backup.id || idx}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">{backup.file || backup.name || backup.id || `Backup #${idx + 1}`}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatBackendTime(backup.at || backup.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToneBadge tone={backup.status === "complete" ? "healthy" : "stable"}>{backup.status || "available"}</ToneBadge>
                    <Button variant="outline" className="h-8 text-xs"
                      onClick={() => onRun("confirmRestore", { backup: backup.file || backup.id, confirmBackup: backup.file || backup.id })}>
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <DataEmptyState title="No backup points" body="Backend returned no backup records" />
          )}
        </GlassCard>

        {/* Recovery Controls */}
        <div className="space-y-4">
          <GlassCard title="Recovery Status">
            <div className="space-y-2 text-sm">
              {Object.entries(recoveryStatus).slice(0, 5).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-zinc-400">{key}</span>
                  <span className="font-medium text-white">{String(value)}</span>
                </div>
              ))}
              {!Object.keys(recoveryStatus).length && (
                <div className="text-zinc-500">Recovery status endpoint ยังไม่ได้ส่งข้อมูล</div>
              )}
            </div>
          </GlassCard>

          <GlassCard title="Restore Control" className="border-red-500/20">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200/80 mb-4">
              <AlertTriangle className="mb-1 h-4 w-4" />
              Restore ต้องมี backup file name และ typed confirmation ก่อนดำเนินการ
            </div>
            <Button
              className="w-full rounded-xl bg-amber-600 hover:bg-amber-500"
              onClick={() => onRun("createRestorePoint")}>
              Create Restore Point
            </Button>
          </GlassCard>
        </div>
      </div>
    </PageLayout>
  );
}
