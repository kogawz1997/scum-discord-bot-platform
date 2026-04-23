import React, { useState } from "react";
import { Users, ArrowLeft, Plus } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";

function LabeledInput({ label, id, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}

function SelectField({ label, id, value, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="owner-input flex h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/30 transition-colors"
      >
        {children}
      </select>
    </div>
  );
}

export function CreateTenantPage({ data, source, live, recordId, onRun, errors }) {
  const packages = data?.packages || [];

  const [form, setForm] = useState({
    name: "",
    slug: "",
    tier: "standard",
    packageId: packages[0]?.sku || packages[0]?.id || "",
    discordGuildId: "",
    discordOwnerId: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function handleChange(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function autoSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function handleNameChange(e) {
    const name = e.target.value;
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || autoSlug(name),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    if (!form.name.trim()) { setSubmitError("Tenant name is required."); return; }
    if (!form.slug.trim()) { setSubmitError("Slug is required."); return; }
    setSubmitting(true);
    try {
      await onRun("createTenant", {
        name: form.name.trim(),
        slug: form.slug.trim(),
        tier: form.tier,
        packageId: form.packageId || undefined,
        discordGuildId: form.discordGuildId.trim() || undefined,
        discordOwnerId: form.discordOwnerId.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
    } catch (err) {
      setSubmitError(err?.message || "Failed to create tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  const actions = (
    <Button variant="outline" onClick={() => onRun("gotoTenants")}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tenants
    </Button>
  );

  return (
    <PageLayout title="Create Tenant" subtitle="Onboard a new community" icon={Users} rightActions={actions}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <GlassCard title="Tenant Identity" description="Basic profile information for the new community.">
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput
              label="Display Name *"
              id="tenant-name"
              placeholder="e.g. SCUM TH Community"
              value={form.name}
              onChange={handleNameChange}
              required
            />
            <LabeledInput
              label="Slug / Code *"
              id="tenant-slug"
              placeholder="e.g. scum-th"
              value={form.slug}
              onChange={handleChange("slug")}
              required
            />
            <SelectField label="Tier" id="tenant-tier" value={form.tier} onChange={handleChange("tier")}>
              <option value="standard">Standard</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </SelectField>
            {packages.length > 0 && (
              <SelectField label="Initial Package" id="tenant-package" value={form.packageId} onChange={handleChange("packageId")}>
                <option value="">— No package —</option>
                {packages.map((pkg) => (
                  <option key={pkg.sku || pkg.id} value={pkg.sku || pkg.id}>
                    {pkg.name || pkg.sku || pkg.id}
                  </option>
                ))}
              </SelectField>
            )}
          </div>
        </GlassCard>

        <GlassCard title="Discord Integration" description="Optional Discord guild and owner IDs for bot provisioning.">
          <div className="grid gap-4 md:grid-cols-2">
            <LabeledInput
              label="Discord Guild ID"
              id="discord-guild"
              placeholder="e.g. 123456789012345678"
              value={form.discordGuildId}
              onChange={handleChange("discordGuildId")}
            />
            <LabeledInput
              label="Discord Owner ID"
              id="discord-owner"
              placeholder="e.g. 987654321098765432"
              value={form.discordOwnerId}
              onChange={handleChange("discordOwnerId")}
            />
          </div>
        </GlassCard>

        <GlassCard title="Notes" description="Optional internal notes about this tenant.">
          <div>
            <label htmlFor="tenant-notes" className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              Notes
            </label>
            <textarea
              id="tenant-notes"
              rows={3}
              value={form.notes}
              onChange={handleChange("notes")}
              placeholder="Internal notes about this tenant..."
              className="owner-input w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/30 transition-colors resize-none"
            />
          </div>
        </GlassCard>

        {/* Preview */}
        <GlassCard title="Preview" description="Review before creating.">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Name" value={form.name || "—"} />
            <Field label="Slug" value={form.slug || "—"} />
            <Field label="Tier" value={form.tier} />
            {form.packageId && <Field label="Package" value={form.packageId} />}
            {form.discordGuildId && <Field label="Guild ID" value={form.discordGuildId} />}
            {form.discordOwnerId && <Field label="Owner ID" value={form.discordOwnerId} />}
          </div>
        </GlassCard>

        {submitError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-300">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" primary disabled={submitting || !form.name.trim() || !form.slug.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {submitting ? "Creating..." : "Create Tenant"}
          </Button>
          <Button type="button" variant="outline" onClick={() => onRun("gotoTenants")}>
            Cancel
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
