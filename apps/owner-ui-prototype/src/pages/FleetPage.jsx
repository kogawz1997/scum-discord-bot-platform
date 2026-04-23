import React from "react";
import { Server, Bot, Cpu, Gauge, Plus } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";

export function FleetPage({ data, source, live, recordId, onRun, errors }) {
  const fleet = data?.fleet || {};
  const summary = fleet.summary || {};
  const deliveryAgents = fleet.deliveryAgents || [];
  const serverBots = fleet.serverBots || [];

  const actions = (
    <>
      <Button variant="outline" onClick={() => onRun("provisionDeliveryAgent")}>
        <Plus className="mr-2 h-4 w-4" /> Delivery Agent
      </Button>
      <Button primary onClick={() => onRun("provisionServerBot")}>
        <Plus className="mr-2 h-4 w-4" /> Server Bot
      </Button>
    </>
  );

  return (
    <PageLayout title="Fleet Operations" subtitle="จัดการ Delivery Agents และ Server Bots" icon={Server} rightActions={actions}>
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Active Delivery Agents" value={String(summary.deliveryAgentsOnline ?? 0)}
          sub={`${summary.deliveryAgentsOffline ?? 0} offline`} icon={Server} spark="w-[86%] bg-cyan-400" compact />
        <StatCard label="Active Server Bots" value={String(summary.serverBotsOnline ?? 0)}
          sub={`${summary.serverBotsOffline ?? 0} offline`} icon={Bot} spark="w-[72%] bg-amber-300" compact />
        <StatCard label="Version Drift" value={String(summary.outdated ?? 0)}
          sub="Outdated runtimes" icon={Cpu} spark="w-[18%] bg-red-400" compact />
        <StatCard label="Provisioning" value="Live" sub="Backend adapter connected" icon={Gauge}
          spark="w-[94%] bg-cyan-400" compact />
      </div>

      {/* Delivery Agents */}
      <GlassCard title="Delivery Agent Fleet" description="Machine binding & delivery capabilities"
        right={<ToneBadge tone={deliveryAgents.length ? "active" : "locked"}>{deliveryAgents.length} agents</ToneBadge>}>
        {deliveryAgents.length ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[620px] grid-cols-[1fr_120px_140px_1fr] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Agent / Machine</div><div>Status</div><div>Version</div><div>Tenant</div>
            </div>
            {deliveryAgents.map((agent, idx) => (
              <div key={agent.id || idx}
                className="grid min-w-[620px] grid-cols-[1fr_120px_140px_1fr] items-center border-t border-white/5 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-white">{agent.id || "Delivery Agent"}</div>
                  <div className="text-xs text-zinc-500">{agent.machineName || agent.tenantName || "Bound machine pending"}</div>
                </div>
                <ToneBadge tone={agent.status === "online" || agent.status === "active" ? "active" : "critical"}>
                  {agent.status || "unknown"}
                </ToneBadge>
                <div className={agent.latestVersion && agent.version !== agent.latestVersion ? "text-red-300" : "text-zinc-300"}>
                  {agent.version || "unknown"}
                  {agent.latestVersion && agent.version !== agent.latestVersion && (
                    <span className="ml-1 text-xs text-zinc-500">→ {agent.latestVersion}</span>
                  )}
                </div>
                <div className="text-zinc-400">{agent.tenantName || agent.tenantId || "Unassigned"}</div>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState title="No Delivery Agent data" body="Backend returned no runtime rows สำหรับ delivery agents" />
        )}
      </GlassCard>

      {/* Server Bots */}
      <GlassCard title="Server Bot Fleet" description="Log sync & config management"
        right={<ToneBadge tone={serverBots.length ? "healthy" : "locked"}>{serverBots.length} bots</ToneBadge>}>
        {serverBots.length ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[620px] grid-cols-[1fr_180px_120px_1fr] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Bot / Cluster</div><div>Last Heartbeat</div><div>Status</div><div>Tenant</div>
            </div>
            {serverBots.map((bot, idx) => (
              <div key={bot.id || idx}
                className="grid min-w-[620px] grid-cols-[1fr_180px_120px_1fr] items-center border-t border-white/5 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold text-white">{bot.id || "Server Bot"}</div>
                  <div className="text-xs text-zinc-500">{bot.machineName || "Bound machine pending"}</div>
                </div>
                <div className="font-mono text-xs text-zinc-400">
                  {bot.lastHeartbeatAt ? new Date(bot.lastHeartbeatAt).toLocaleString() : "Unknown"}
                </div>
                <ToneBadge tone={bot.status === "online" || bot.status === "active" ? "healthy" : "warning"}>
                  {bot.status || "unknown"}
                </ToneBadge>
                <div className="text-zinc-400">{bot.tenantName || bot.tenantId || "Unassigned"}</div>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState title="No Server Bot data" body="Backend returned no runtime rows สำหรับ server bots" />
        )}
      </GlassCard>
    </PageLayout>
  );
}
