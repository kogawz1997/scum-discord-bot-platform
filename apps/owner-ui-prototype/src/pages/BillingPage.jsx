import React, { useState, useMemo } from "react";
import { CreditCard, Download, Search } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { StatCard } from "../components/ui/stat-card";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { formatBackendTime, formatCurrency } from "../lib/ui-helpers";

export function BillingPage({ data, source, live, recordId, onRun, errors }) {
  const invoices = data?.invoices || [];
  const raw = data?.raw || {};
  const billingOverview = raw.billingOverview?.data || raw.billingOverview || {};
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return invoices;
    const q = search.toLowerCase();
    return invoices.filter((inv) =>
      (inv.tenant || "").toLowerCase().includes(q) ||
      (inv.invoice || "").toLowerCase().includes(q) ||
      (inv.status || "").toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const totalRevenue = useMemo(() =>
    invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0), [invoices]);
  const pending = invoices.filter((inv) => inv.status === "pending" || inv.status === "open").length;
  const overdue = invoices.filter((inv) => inv.status === "overdue" || inv.status === "failed").length;

  const statusTone = (status) => {
    if (status === "paid") return "paid";
    if (status === "pending" || status === "open") return "pending";
    if (status === "overdue" || status === "failed") return "critical";
    return "neutral";
  };

  const actions = (
    <Button variant="outline" onClick={() => onRun("exportBillingLedger")}>
      <Download className="mr-2 h-4 w-4" /> Export Ledger
    </Button>
  );

  return (
    <PageLayout title="Billing & Subscriptions" subtitle="Commercial oversight และ revenue tracking" icon={CreditCard} rightActions={actions}>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Revenue (Paid)" value={formatCurrency(totalRevenue)} icon={CreditCard}
          spark="w-[80%] bg-emerald-400" />
        <StatCard label="Pending Invoices" value={pending}
          sub="Awaiting payment" spark="w-[40%] bg-amber-400" compact />
        <StatCard label="Overdue / Failed" value={overdue}
          sub="Needs attention" spark={`w-[${overdue > 0 ? "55" : "5"}%] bg-red-400`} compact />
      </div>

      <GlassCard>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search tenant, invoice ID หรือ status..."
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        {filtered.length ? (
          <div className="overflow-auto rounded-xl border border-white/5">
            <div className="grid min-w-[700px] grid-cols-[200px_1fr_140px_120px_120px] bg-white/[0.04] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              <div>Invoice ID</div><div>Tenant</div><div>Date</div><div>Amount</div><div>Status</div>
            </div>
            {filtered.slice(0, 20).map((inv, idx) => (
              <div key={inv.invoice || idx}
                className="grid min-w-[700px] grid-cols-[200px_1fr_140px_120px_120px] items-center border-t border-white/5 px-4 py-3 text-sm hover:bg-white/[0.02] cursor-pointer"
                onClick={() => onRun("gotoInvoiceDetail", { recordId: inv.invoice })}>
                <div className="font-mono text-cyan-200">{inv.invoice || "—"}</div>
                <div className="text-white">{inv.tenant || "Unknown"}</div>
                <div className="text-zinc-400">{formatBackendTime(inv.date)}</div>
                <div className="font-semibold text-white">{formatCurrency(inv.amount)}</div>
                <ToneBadge tone={statusTone(inv.status)}>{inv.status || "unknown"}</ToneBadge>
              </div>
            ))}
          </div>
        ) : (
          <DataEmptyState
            title={search ? "ไม่พบ invoice ที่ตรงกัน" : "ยังไม่มี invoice"}
            body={search ? "ลองปรับ search query ใหม่" : "Invoice จะปรากฏที่นี่เมื่อมีการทำธุรกรรม"} />
        )}
      </GlassCard>
    </PageLayout>
  );
}
