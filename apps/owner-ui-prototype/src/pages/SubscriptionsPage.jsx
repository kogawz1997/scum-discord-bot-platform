import React, { useState, useMemo } from "react";
import { Wallet, Plus, Search } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { formatBackendTime } from "../lib/ui-helpers";

export function SubscriptionsPage({ data, source, live, recordId, onRun, errors }) {
  const invoices = data?.invoices || [];
  const raw = data?.raw || {};
  const subscriptions = (raw.subscriptions?.items || raw.subscriptions?.rows || raw.subscriptions || []);
  const subs = Array.isArray(subscriptions) ? subscriptions : [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return subs;
    const q = search.toLowerCase();
    return subs.filter((s) =>
      (s.tenantId || s.tenant || "").toLowerCase().includes(q) ||
      (s.status || "").toLowerCase().includes(q) ||
      (s.packageId || s.package || "").toLowerCase().includes(q)
    );
  }, [subs, search]);

  const active = subs.filter((s) => s.status === "active").length;
  const trial = subs.filter((s) => s.status === "trial").length;
  const expired = subs.filter((s) => s.status === "expired" || s.status === "cancelled").length;

  const statusTone = (status) => {
    if (status === "active") return "healthy";
    if (status === "trial") return "stable";
    if (status === "expired" || status === "cancelled") return "critical";
    return "pending";
  };

  const actions = (
    <Button primary onClick={() => onRun("createSubscription")}>
      <Plus className="mr-2 h-4 w-4" /> New Subscription
    </Button>
  );

  return (
    <PageLayout title="Subscriptions & Billing" subtitle="Platform treasury" icon={Wallet} rightActions={actions}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active" value={active} sub="Active subscriptions" spark="w-[80%] bg-emerald-400" compact />
        <StatCard label="Trial" value={trial} sub="Trial period" spark="w-[40%] bg-cyan-400" compact />
        <StatCard label="Expired / Cancelled" value={expired} sub="Needs attention" spark={`w-[${expired ? "50" : "5"}%] bg-red-400`} compact />
      </div>

      <GlassCard>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search by tenant, package หรือ status..."
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {filtered.length ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[640px] grid-cols-[1fr_160px_140px_140px_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Tenant</div><div>Package</div><div>Start Date</div><div>Renewal</div><div>Status</div>
            </div>
            {filtered.slice(0, 20).map((sub, idx) => (
              <div key={sub.id || idx}
                className="grid min-w-[640px] grid-cols-[1fr_160px_140px_140px_120px] items-center border-t border-white/5 px-4 py-3 text-sm hover:bg-white/[0.02] cursor-pointer"
                onClick={() => onRun("gotoSubscriptionDetail", { recordId: sub.id })}>
                <div className="font-semibold text-white">{sub.tenantId || sub.tenant || "Unknown"}</div>
                <div className="text-zinc-400">{sub.packageId || sub.package || "—"}</div>
                <div className="text-zinc-400">{formatBackendTime(sub.startedAt || sub.createdAt)}</div>
                <div className="text-zinc-400">{formatBackendTime(sub.renewsAt || sub.expiresAt)}</div>
                <ToneBadge tone={statusTone(sub.status)}>{sub.status || "unknown"}</ToneBadge>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState
            title={search ? "ไม่พบ subscription ที่ตรงกัน" : "ยังไม่มี subscriptions"}
            body={search ? "ลองปรับ search query" : "Subscriptions จะปรากฏที่นี่เมื่อลูกค้า subscribe"} />
        )}
      </GlassCard>
    </PageLayout>
  );
}
