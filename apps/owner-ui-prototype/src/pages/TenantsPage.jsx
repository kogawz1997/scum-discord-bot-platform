import React, { useState, useMemo } from "react";
import { Users, Plus, Search } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Field } from "../components/ui/field";

export function TenantsPage({ data, source, live, recordId, onRun, errors }) {
  const tenants = data?.tenants || [];
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTenants = useMemo(() => {
    if (!searchQuery) return tenants;
    const q = searchQuery.toLowerCase();
    return tenants.filter((t) => t.name?.toLowerCase().includes(q) || t.code?.toLowerCase().includes(q) || t.id?.toLowerCase().includes(q));
  }, [tenants, searchQuery]);

  const actions = (
    <>
      <Button onClick={() => onRun("refresh")} variant="outline">
        Refresh
      </Button>
      <Button onClick={() => onRun("createTenant")} primary>
        <Plus className="mr-2 h-4 w-4" /> Create Tenant
      </Button>
    </>
  );

  return (
    <PageLayout title="Tenants" subtitle={`${tenants.length} communities`} icon={Users} rightActions={actions}>
      {/* Search */}
      <GlassCard>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search by name, code, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </GlassCard>

      {/* Tenants List */}
      {filteredTenants.length > 0 ? (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => (
            <GlassCard
              key={tenant.id}
              title={tenant.name}
              description={tenant.code}
              right={<ToneBadge tone={tenant.status === "active" ? "healthy" : "warning"}>{tenant.status}</ToneBadge>}
              className="cursor-pointer hover:border-cyan-400/30"
              onClick={() => onRun("gotoTenantDossier", { recordId: tenant.id })}
            >
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="ID" value={tenant.id} sub="Internal identifier" />
                <Field label="Tier" value={tenant.tier || "standard"} sub="Subscription level" />
                <Field label="Agents" value={tenant.agents?.length || 0} sub="Delivery agents" />
                <Field label="Bots" value={tenant.bots?.length || 0} sub="Server bots" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); onRun("gotoTenantDossier", { recordId: tenant.id }); }}>
                  View Details
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <DataEmptyState
          title={searchQuery ? "No matching tenants" : "No tenants created"}
          body={searchQuery ? "Try adjusting your search query." : "Create your first tenant to get started."}
        />
      )}
    </PageLayout>
  );
}
