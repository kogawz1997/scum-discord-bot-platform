import React, { useMemo } from "react";
import { LayoutDashboard, Users, Package, CreditCard, Zap } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { StatCard } from "../components/ui/stat-card";
import { SectionTitle } from "../components/ui/section-title";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Button } from "../components/ui/button";

export function OverviewPage({ data, source, live, recordId, onRun, errors }) {
  const overview = data?.overview || {};
  const tenants = data?.tenants || [];
  const packages_ = data?.packages || [];
  const invoices = data?.invoices || [];

  const tenantCount = tenants.length;
  const revenue = useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
      .toFixed(2);
  }, [invoices]);

  const actions = (
    <>
      <Button onClick={() => onRun("refresh")} variant="outline">
        Refresh
      </Button>
      <Button onClick={() => onRun("gotoTenants")} primary>
        Manage Tenants
      </Button>
    </>
  );

  return (
    <PageLayout title="Platform Overview" subtitle="Monitor your SCUM platform" icon={LayoutDashboard} rightActions={actions}>
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Tenants" value={tenantCount} icon={Users} />
        <StatCard label="Packages" value={packages_.length} icon={Package} />
        <StatCard label="Monthly Revenue" value={`$${revenue}`} icon={CreditCard} />
        <StatCard label="Platform Health" value={overview.health || "N/A"} icon={Zap} />
      </div>

      {/* Tactical Stream */}
      {overview.tacticalStream && overview.tacticalStream.length > 0 ? (
        <>
          <SectionTitle title="Recent Activity" subtitle="Latest events and changes" />
          <GlassCard>
            <div className="space-y-2">
              {overview.tacticalStream.slice(0, 8).map((event, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
                  <div className="text-sm text-zinc-300">{event.description || event.type}</div>
                  <div className="text-[11px] text-zinc-500">{event.timestamp}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      ) : (
        <DataEmptyState title="No recent activity" body="Events will appear here as your platform runs." />
      )}

      {/* Quick Links */}
      <SectionTitle title="Quick Actions" />
      <div className="grid gap-3 md:grid-cols-3">
        <GlassCard title="View Tenants">
          <p className="mb-4 text-sm text-zinc-400">Manage and monitor your community servers</p>
          <Button primary className="w-full" onClick={() => onRun("gotoTenants")}>
            Go to Tenants
          </Button>
        </GlassCard>
        <GlassCard title="View Fleet">
          <p className="mb-4 text-sm text-zinc-400">Monitor agents and server bots</p>
          <Button primary className="w-full" onClick={() => onRun("gotoFleet")}>
            Go to Fleet
          </Button>
        </GlassCard>
        <GlassCard title="View Incidents">
          <p className="mb-4 text-sm text-zinc-400">Check notifications and alerts</p>
          <Button primary className="w-full" onClick={() => onRun("gotoIncidents")}>
            Go to Incidents
          </Button>
        </GlassCard>
      </div>
    </PageLayout>
  );
}
