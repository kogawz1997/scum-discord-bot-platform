import React, { useMemo } from "react";
import { Users, ArrowLeft, Server, Zap, CreditCard, FileText } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { Field } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { formatBackendTime, formatCurrency } from "../lib/ui-helpers";

function statusTone(status) {
  if (status === "active") return "healthy";
  if (status === "trial") return "stable";
  if (status === "paid") return "paid";
  if (status === "expired" || status === "cancelled") return "critical";
  return "pending";
}

export function TenantDossierPage({ data, source, live, recordId, onRun, errors }) {
  const tenants = data?.tenants || [];
  const raw = data?.raw || {};

  const tenant = useMemo(() => {
    if (!recordId) return tenants[0] || null;
    return tenants.find((t) => t.id === recordId || t.tenantId === recordId || t.slug === recordId) || tenants[0] || null;
  }, [tenants, recordId]);

  const allSubs = useMemo(() => {
    const subs = raw.subscriptions?.items || raw.subscriptions?.rows || raw.subscriptions || data?.subscriptions || [];
    return Array.isArray(subs) ? subs : [];
  }, [raw, data]);

  const allInvoices = useMemo(() => {
    const inv = raw.invoices?.items || raw.invoices?.rows || raw.invoices || data?.invoices || [];
    return Array.isArray(inv) ? inv : [];
  }, [raw, data]);

  const allAgents = useMemo(() => {
    const ags = raw.agents?.items || raw.agents?.rows || raw.agents || data?.agents || [];
    return Array.isArray(ags) ? ags : [];
  }, [raw, data]);

  const tenantId = tenant?.id || tenant?.tenantId || recordId || "";

  const subs = useMemo(() => allSubs.filter((s) => s.tenantId === tenantId || s.tenant === tenantId), [allSubs, tenantId]);
  const invoices = useMemo(() => allInvoices.filter((i) => i.tenantId === tenantId || i.tenant === tenantId), [allInvoices, tenantId]);
  const agents = useMemo(() => allAgents.filter((a) => a.tenantId === tenantId || a.tenant === tenantId), [allAgents, tenantId]);

  const activeSub = subs.find((s) => s.status === "active");
  const paidInvoices = invoices.filter((i) => i.status === "paid").length;
  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const actions = (
    <Button variant="outline" onClick={() => onRun("gotoTenants")}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
    </Button>
  );

  if (!tenant) {
    return (
      <PageLayout title="Tenant Dossier" icon={Users} rightActions={actions}>
        <DataEmptyState
          title="No tenant selected"
          body="Select a tenant from the Tenants page to view their dossier."
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={tenant.name || tenant.displayName || "Tenant"}
      subtitle={tenant.code || tenant.slug || tenant.id}
      icon={Users}
      rightActions={actions}
    >
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Status" value={tenant.status || "unknown"} sub="Tenant state" icon={Users} compact />
        <StatCard label="Subscriptions" value={subs.length || allSubs.length} sub="Active plans" icon={Zap} compact />
        <StatCard label="Invoices" value={paidInvoices || allInvoices.length} sub="Paid invoices" icon={FileText} compact />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} sub="Lifetime paid" icon={CreditCard} compact />
      </div>

      {/* Profile + Runtime */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard title="Tenant Profile" right={<ToneBadge tone={statusTone(tenant.status)}>{tenant.status || "unknown"}</ToneBadge>}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tenant ID" value={tenant.id || tenant.tenantId || "—"} />
            <Field label="Name" value={tenant.name || tenant.displayName || "—"} />
            <Field label="Code / Slug" value={tenant.code || tenant.slug || "—"} />
            <Field label="Tier" value={tenant.tier || tenant.type || "standard"} />
            <Field label="Created" value={formatBackendTime(tenant.createdAt || tenant.created_at)} />
            <Field label="Updated" value={formatBackendTime(tenant.updatedAt || tenant.updated_at)} />
          </div>
        </GlassCard>

        <GlassCard title="Runtime Units" description="Delivery agents and server bots" right={<ToneBadge tone={agents.length > 0 || allAgents.length > 0 ? "healthy" : "warning"}>{agents.length || allAgents.length} agents</ToneBadge>}>
          {(agents.length > 0 ? agents : allAgents).slice(0, 5).length > 0 ? (
            <div className="space-y-2">
              {(agents.length > 0 ? agents : allAgents).slice(0, 5).map((agent, idx) => (
                <div key={agent.id || idx} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-white">{agent.id || agent.agentId || `Agent ${idx + 1}`}</div>
                    <div className="text-xs text-zinc-500">{agent.type || agent.role || "runtime"}</div>
                  </div>
                  <ToneBadge tone={agent.status === "connected" || agent.status === "active" ? "healthy" : agent.status === "idle" ? "stable" : "warning"}>
                    {agent.status || "unknown"}
                  </ToneBadge>
                </div>
              ))}
            </div>
          ) : (
            <DataEmptyState title="No agents" body="No runtime agents assigned to this tenant." />
          )}
        </GlassCard>
      </div>

      {/* Subscription */}
      <GlassCard title="Subscriptions" description="Active plans and billing cycle" right={<ToneBadge tone={activeSub ? "healthy" : "warning"}>{activeSub ? "Active" : "No active plan"}</ToneBadge>}>
        {(subs.length > 0 ? subs : allSubs).slice(0, 10).length > 0 ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[500px] grid-cols-[1fr_160px_140px_140px_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Tenant</div><div>Package</div><div>Started</div><div>Renews</div><div>Status</div>
            </div>
            {(subs.length > 0 ? subs : allSubs).slice(0, 10).map((sub, idx) => (
              <div key={sub.id || idx} className="grid min-w-[500px] grid-cols-[1fr_160px_140px_140px_120px] items-center border-t border-white/5 px-4 py-3 text-sm hover:bg-white/[0.02]">
                <div className="font-semibold text-white">{sub.tenantId || sub.tenant || tenantId || "—"}</div>
                <div className="text-zinc-400">{sub.packageId || sub.package || "—"}</div>
                <div className="text-zinc-400">{formatBackendTime(sub.startedAt || sub.createdAt)}</div>
                <div className="text-zinc-400">{formatBackendTime(sub.renewsAt || sub.expiresAt)}</div>
                <ToneBadge tone={statusTone(sub.status)}>{sub.status || "unknown"}</ToneBadge>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState title="No subscriptions" body="This tenant has no subscription records." />
        )}
      </GlassCard>

      {/* Invoices */}
      <GlassCard title="Invoice History" description="Recent billing records" right={<ToneBadge tone="neutral">{(invoices.length || allInvoices.length)} invoices</ToneBadge>}>
        {(invoices.length > 0 ? invoices : allInvoices).slice(0, 10).length > 0 ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[500px] grid-cols-[1fr_120px_120px_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Invoice ID</div><div>Amount</div><div>Date</div><div>Status</div>
            </div>
            {(invoices.length > 0 ? invoices : allInvoices).slice(0, 10).map((inv, idx) => (
              <div key={inv.id || inv.invoiceId || idx} className="grid min-w-[500px] grid-cols-[1fr_120px_120px_120px] items-center border-t border-white/5 px-4 py-3 text-sm hover:bg-white/[0.02] cursor-pointer"
                onClick={() => onRun("gotoInvoiceDetail", { recordId: inv.id || inv.invoiceId })}>
                <div className="font-mono text-sm text-cyan-200">{inv.id || inv.invoiceId || `INV-${idx + 1}`}</div>
                <div className="font-semibold text-white">{formatCurrency(inv.amount, inv.currency)}</div>
                <div className="text-zinc-400">{formatBackendTime(inv.createdAt || inv.date)}</div>
                <ToneBadge tone={inv.status === "paid" ? "paid" : inv.status === "pending" ? "pending" : "warning"}>{inv.status || "unknown"}</ToneBadge>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState title="No invoices" body="No billing records for this tenant." />
        )}
      </GlassCard>

      {/* Server info if available */}
      {(tenant.servers?.length > 0 || raw.registry) && (
        <GlassCard title="Server Registry" description="Registered SCUM servers" right={<Server className="h-4 w-4 text-zinc-500" />}>
          <div className="grid gap-3 md:grid-cols-2">
            {(tenant.servers || []).slice(0, 4).map((srv, idx) => (
              <div key={srv.id || idx} className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="font-semibold text-white">{srv.name || srv.id || `Server ${idx + 1}`}</div>
                <div className="mt-1 text-xs text-zinc-500">{srv.ip || srv.host || "No IP"}</div>
                <div className="mt-2"><ToneBadge tone={srv.status === "online" ? "healthy" : "warning"}>{srv.status || "unknown"}</ToneBadge></div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </PageLayout>
  );
}
