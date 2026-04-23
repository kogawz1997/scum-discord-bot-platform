import React, { useState, useMemo } from "react";
import { Package, Plus, Search } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { Field } from "../components/ui/field";
import { DataEmptyState } from "../components/ui/data-empty-state";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export function PackagesPage({ data, source, live, recordId, onRun, errors }) {
  const packages = data?.packages || [];
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return packages;
    const q = search.toLowerCase();
    return packages.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q));
  }, [packages, search]);

  const actions = (
    <Button primary onClick={() => onRun("createPackage")}>
      <Plus className="mr-2 h-4 w-4" /> New Package
    </Button>
  );

  return (
    <PageLayout title="Package Management" subtitle={`${packages.length} packages`} icon={Package} rightActions={actions}>
      <GlassCard>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search by name หรือ SKU..."
            value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </GlassCard>

      {filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pkg, idx) => (
            <GlassCard
              key={pkg.sku || idx}
              title={pkg.name || pkg.sku || "Package"}
              description={pkg.sku}
              right={<ToneBadge tone={pkg.tenants?.length ? "active" : "neutral"}>
                {pkg.tenants?.length || 0} tenants
              </ToneBadge>}
              className="cursor-pointer hover:border-cyan-400/30"
              onClick={() => onRun("gotoPackageDetail", { recordId: pkg.sku || pkg.id })}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price" value={pkg.price ? `$${pkg.price}` : "—"} />
                <Field label="Tier" value={pkg.tier || pkg.type || "—"} />
              </div>
              {pkg.tags?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pkg.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">{tag}</span>
                  ))}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      ) : (
        <DataEmptyState
          title={search ? "ไม่พบ package ที่ตรงกัน" : "ยังไม่มี package"}
          body={search ? "ลองปรับ search query" : "สร้าง package แรกเพื่อเริ่มต้น"} />
      )}
    </PageLayout>
  );
}
