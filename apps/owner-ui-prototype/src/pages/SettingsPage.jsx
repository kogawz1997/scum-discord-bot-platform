import React from "react";
import { Settings, AlertTriangle } from "lucide-react";
import { PageLayout } from "../components/layout/page-layout";
import { GlassCard } from "../components/ui/glass-card";
import { ToneBadge } from "../components/ui/tone-badge";
import { MetricPair } from "../components/ui/metric-pair";
import { Field } from "../components/ui/field";
import { Button } from "../components/ui/button";
import { extractItems } from "../lib/owner-adapters";

export function SettingsPage({ data, source, live, recordId, onRun, errors }) {
  const raw = data?.raw || {};
  const settings = raw.controlPanelSettings?.data || raw.controlPanelSettings || {};
  const runtime = raw.runtimeSupervisor?.data || raw.runtimeSupervisor || {};
  const apiKeys = extractItems(raw.apiKeys);
  const webhooks = extractItems(raw.webhooks);
  const marketplace = extractItems(raw.marketplace);
  const restartPlans = extractItems(raw.restartPlans);

  return (
    <PageLayout title="Settings & Environment" subtitle="Platform configuration และ runtime controls" icon={Settings}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Platform Settings */}
          <GlassCard title="Platform Settings" right={<ToneBadge tone="healthy">Read-only live</ToneBadge>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Surface" value={settings.surface || settings.mode || "owner"} />
              <Field label="Environment" value={settings.environment || settings.nodeEnv || "unknown"} />
            </div>
            <div className="mt-4">
              <Field label="Owner API Endpoint" value={settings.ownerBaseUrl || settings.publicEndpoint || "/owner/api"} />
            </div>
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-200/80">
              <AlertTriangle className="mb-2 h-4 w-4" />
              Direct ENV editing ยังไม่เปิดใช้ใน prototype นี้ — backend route มีอยู่แต่ต้องมี validation form, audit preview และ confirmation ก่อน
            </div>
          </GlassCard>

          {/* Integrations */}
          <GlassCard title="Integrations">
            <div className="space-y-3">
              <MetricPair label="API Keys" value={apiKeys.length} />
              <MetricPair label="Webhooks" value={webhooks.length} />
              <MetricPair label="Marketplace Offers" value={marketplace.length} />
            </div>
          </GlassCard>
        </div>

        {/* Runtime Supervisor */}
        <GlassCard title="Runtime Supervisor">
          <div className="space-y-3">
            <MetricPair label="Supervisor" value={runtime.status || runtime.state || "unknown"}
              tone={runtime.status === "healthy" ? "healthy" : "stable"} />
            <MetricPair label="Services" value={extractItems(runtime.services).length || runtime.serviceCount || "n/a"} />
            <MetricPair label="Restart Plans" value={restartPlans.length} />
          </div>
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3 text-sm text-red-100/80">
            Restart จะเปิด confirmation form และจะเรียก backend เฉพาะเมื่อ operator ยืนยันด้วย service list และ typed confirmation เท่านั้น
          </div>
          <Button
            data-owner-managed="true"
            className="mt-4 h-11 w-full rounded-xl bg-red-600 hover:bg-red-500"
            onClick={() => onRun("restartOwnerRuntime")}>
            Restart Runtime
          </Button>
        </GlassCard>
      </div>
    </PageLayout>
  );
}
