import { describe, expect, it } from "vitest";
import {
  adaptBillingInvoices,
  adaptOverviewData,
  adaptPackages,
  adaptRuntimeFleet,
  adaptTenantRows,
  extractItems,
  REAL_OWNER_API_MAP,
} from "./owner-adapters.js";

describe("owner-adapters", () => {
  it("extracts arrays from common API response envelopes", () => {
    expect(extractItems([{ id: "a" }])).toEqual([{ id: "a" }]);
    expect(extractItems({ items: [{ id: "b" }] })).toEqual([{ id: "b" }]);
    expect(extractItems({ tenants: [{ id: "c" }] })).toEqual([{ id: "c" }]);
    expect(extractItems(null)).toEqual([]);
  });

  it("maps tenant, subscription, billing, and runtime records into table rows", () => {
    const rows = adaptTenantRows({
      tenants: [{ id: "tenant_1", slug: "bangkok-survival", name: "Bangkok Survival", status: "active", locale: "th" }],
      subscriptions: [{ id: "sub_1", tenantId: "tenant_1", packageName: "Pro", status: "active" }],
      invoices: [{ id: "inv_1", tenantId: "tenant_1", status: "unpaid", amount: 2490, currency: "THB" }],
      agents: [
        { tenantId: "tenant_1", runtimeKind: "delivery-agent", status: "online", version: "1.8.2" },
        { tenantId: "tenant_1", runtimeKind: "server-bot", status: "offline", version: "1.8.0" },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "BS",
      name: "Bangkok Survival",
      id: "tenant_1",
      status: "active",
      tier: "Pro",
      agents: 1,
      bots: 1,
      health: "critical",
      revenue: "THB 2,490",
    });
  });

  it("maps billing invoices into the prototype invoice row shape", () => {
    const invoices = adaptBillingInvoices([
      { id: "inv_1", tenantName: "Bangkok Survival", status: "paid", amount: 2490, currency: "THB", createdAt: "2026-04-22T00:00:00.000Z" },
    ]);

    expect(invoices[0]).toMatchObject({
      invoice: "inv_1",
      tenant: "Bangkok Survival",
      status: "paid",
      amount: "THB 2,490",
    });
  });

  it("maps runtime records and keeps Delivery Agent separate from Server Bot", () => {
    const fleet = adaptRuntimeFleet([
      { id: "da_1", tenantName: "Bangkok Survival", runtimeKind: "delivery-agent", status: "online", version: "1.8.2" },
      { id: "sb_1", tenantName: "Bangkok Survival", runtimeKind: "server-bot", status: "offline", version: "1.8.0" },
    ]);

    expect(fleet.deliveryAgents).toHaveLength(1);
    expect(fleet.serverBots).toHaveLength(1);
    expect(fleet.summary).toMatchObject({ deliveryAgentsOnline: 1, serverBotsOffline: 1 });
  });

  it("maps package records into package cards", () => {
    const packages = adaptPackages([
      { id: "pkg_pro", name: "Pro", status: "active", features: ["restartControl", "configEditor"], tenantCount: 12 },
    ]);

    expect(packages[0]).toMatchObject({
      name: "Pro",
      sku: "pkg_pro",
      tenants: 12,
      health: "active",
    });
    expect(packages[0].tags).toEqual(["restartControl", "configEditor"]);
  });

  it("builds overview stats from real backend slices", () => {
    const overview = adaptOverviewData({
      tenants: [{ id: "tenant_1" }, { id: "tenant_2" }],
      invoices: [{ status: "unpaid", amount: 1000, currency: "THB" }],
      paymentAttempts: [{ status: "failed" }],
      agents: [
        { runtimeKind: "delivery-agent", status: "online" },
        { runtimeKind: "server-bot", status: "offline" },
      ],
      securityEvents: [{ severity: "high" }],
      deliveryLifecycle: { summary: { failed24h: 2, deadLetter: 1 } },
    });

    expect(overview.stats.revenueVelocity).toBe("THB 1,000");
    expect(overview.stats.incidentsNew).toBeGreaterThanOrEqual(4);
    expect(overview.stats.deliveryAgents).toMatchObject({ total: 1, online: 1 });
    expect(overview.stats.serverBots).toMatchObject({ total: 1, active: 0, stale: 1 });
    expect(overview.tacticalStream.length).toBeGreaterThan(0);
  });

  it("documents the real Owner API paths used by the redesign", () => {
    expect(REAL_OWNER_API_MAP.tenants.list).toBe("/owner/api/platform/tenants?limit=50");
    expect(REAL_OWNER_API_MAP.billing.invoices).toBe("/owner/api/platform/billing/invoices?limit=50");
    expect(REAL_OWNER_API_MAP.fleet.agents).toBe("/owner/api/platform/agents?limit=50");
  });
});
