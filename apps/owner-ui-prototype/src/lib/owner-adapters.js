export const REAL_OWNER_API_MAP = {
  auth: {
    me: "/owner/api/me",
    providers: "/owner/api/auth/providers",
    user: "/owner/api/auth/user",
    revokeSession: "/owner/api/auth/session/revoke",
    sessions: "/owner/api/auth/sessions",
    securityEvents: "/owner/api/auth/security-events?limit=20",
    securityEventsExport: "/owner/api/auth/security-events/export",
  },
  overview: {
    platform: "/owner/api/platform/overview",
    dashboardCards: "/owner/api/dashboard/cards",
    quota: "/owner/api/platform/quota?tenantId=:tenantId",
    commands: "/owner/api/control-panel/commands",
    controlPanelSettings: "/owner/api/control-panel/settings",
    controlPanelEnv: "/owner/api/control-panel/env",
    runtimeSupervisor: "/owner/api/runtime/supervisor",
    observabilityErrors: "/owner/api/observability/requests?limit=20&onlyErrors=true",
    observability: "/owner/api/observability?windowMs=21600000",
    deliveryLifecycle: "/owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000",
    opsState: "/owner/api/platform/ops-state",
    reconcile: "/owner/api/platform/reconcile?windowMs=3600000&pendingOverdueMs=1200000",
    live: "/admin/api/live",
  },
  security: {
    roleMatrix: "/owner/api/auth/role-matrix",
    users: "/owner/api/auth/users",
    rotationReport: "/owner/api/security/rotation-check",
    rotationExport: "/owner/api/security/rotation-check/export",
    auditQuery: "/owner/api/audit/query?limit=50",
    auditExport: "/owner/api/audit/export",
  },
  tenants: {
    list: "/owner/api/platform/tenants?limit=50",
    configs: "/owner/api/platform/tenant-configs?limit=50",
    config: "/owner/api/platform/tenant-config",
    featureAccess: "/owner/api/platform/tenant-feature-access",
    roleMatrix: "/owner/api/platform/tenant-role-matrix",
    staff: "/owner/api/platform/tenant-staff",
    diagnostics: "/owner/api/platform/tenant-diagnostics",
    diagnosticsExport: "/owner/api/platform/tenant-diagnostics/export",
    supportCase: "/admin/api/platform/tenant-support-case?tenantId=:tenantId&limit=25",
    supportCaseExport: "/admin/api/platform/tenant-support-case/export",
    deadLetter: "/admin/api/delivery/dead-letter?tenantId=:tenantId&limit=25",
    mutate: "/owner/api/platform/tenant",
  },
  packages: {
    packages: "/owner/api/platform/packages",
    licenses: "/owner/api/platform/licenses?limit=50",
    features: "/owner/api/platform/features",
    license: "/owner/api/platform/license",
    acceptLegal: "/owner/api/platform/license/accept-legal",
    create: "/owner/api/platform/package",
    update: "/owner/api/platform/package/update",
    delete: "/owner/api/platform/package/delete",
  },
  subscriptions: {
    list: "/owner/api/platform/subscriptions?limit=50",
    create: "/owner/api/platform/subscription",
    update: "/owner/api/platform/subscription/update",
  },
  billing: {
    overview: "/owner/api/platform/billing/overview",
    invoices: "/owner/api/platform/billing/invoices?limit=50",
    attempts: "/owner/api/platform/billing/payment-attempts?limit=50",
    invoiceUpdate: "/owner/api/platform/billing/invoice/update",
    attemptUpdate: "/owner/api/platform/billing/payment-attempt/update",
    checkoutSession: "/owner/api/platform/billing/checkout-session",
  },
  fleet: {
    agents: "/owner/api/platform/agents?limit=50",
    agentRuntimes: "/owner/api/platform/agent-runtimes",
    servers: "/owner/api/platform/servers?limit=50",
    server: "/owner/api/platform/server",
    serverDiscordLink: "/owner/api/platform/server-discord-link",
    serverDiscordLinks: "/owner/api/platform/server-discord-links",
    serverConfigJobs: "/owner/api/platform/server-config/jobs?limit=50",
    serverConfigWorkspace: "/owner/api/platform/server-config/workspace",
    serverConfigCategory: "/owner/api/platform/server-config/category",
    serverConfigBackups: "/owner/api/platform/server-config/backups",
    registry: "/owner/api/platform/agent-registry?limit=200",
    provisioning: "/owner/api/platform/agent-provisioning?limit=200",
    devices: "/owner/api/platform/agent-devices?limit=200",
    credentials: "/owner/api/platform/agent-credentials?limit=200",
    sessions: "/owner/api/platform/agent-sessions?limit=200",
    syncRuns: "/owner/api/platform/sync-runs?limit=100",
    syncEvents: "/owner/api/platform/sync-events?limit=100",
    runtimeDownload: "/owner/api/platform/runtime-download",
    runtimeDownloadPrepare: "/owner/api/platform/runtime-download/prepare",
    provision: "/owner/api/platform/agent-provision",
    issueToken: "/owner/api/platform/agent-token",
    rotateToken: "/owner/api/platform/agent-token/rotate",
    revokeDevice: "/owner/api/platform/agent-device/revoke",
    revokeRuntime: "/owner/api/platform/agent-runtime/revoke",
    revokeProvision: "/owner/api/platform/agent-provision/revoke",
    revokeToken: "/owner/api/platform/agent-token/revoke",
  },
  delivery: {
    capabilities: "/owner/api/delivery/capabilities",
    capabilityPreset: "/owner/api/delivery/capability-preset",
    capabilityPresetDelete: "/owner/api/delivery/capability-preset/delete",
    capabilityTest: "/owner/api/delivery/capability-test",
    commandTemplate: "/owner/api/delivery/command-template",
    queue: "/owner/api/delivery/queue",
    detail: "/owner/api/delivery/detail",
    runtime: "/owner/api/delivery/runtime",
    statuses: "/owner/api/purchase/statuses",
    lifecycle: "/owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000",
    lifecycleExport: "/owner/api/delivery/lifecycle/export",
    enqueue: "/owner/api/delivery/enqueue",
    preflight: "/owner/api/delivery/preflight",
    preview: "/owner/api/delivery/preview",
    retry: "/owner/api/delivery/retry",
    retryMany: "/owner/api/delivery/retry-many",
    cancel: "/owner/api/delivery/cancel",
    simulate: "/owner/api/delivery/simulate",
    testSend: "/owner/api/delivery/test-send",
    deadLetterRetry: "/admin/api/delivery/dead-letter/retry",
    deadLetterRetryMany: "/admin/api/delivery/dead-letter/retry-many",
    deadLetterDelete: "/admin/api/delivery/dead-letter/delete",
  },
  backup: {
    list: "/admin/api/backup/list",
    restoreStatus: "/admin/api/backup/restore/status",
    restoreHistory: "/admin/api/backup/restore/history?limit=12",
    create: "/admin/api/backup/create",
    restore: "/admin/api/backup/restore",
  },
  notifications: {
    list: "/owner/api/notifications?limit=20",
    ack: "/owner/api/notifications/ack",
    clear: "/owner/api/notifications/clear",
    export: "/owner/api/notifications/export",
  },
  automation: {
    run: "/admin/api/platform/automation/run",
  },
  integrations: {
    apiKeys: "/owner/api/platform/apikeys?limit=50",
    apiKey: "/owner/api/platform/apikey",
    webhooks: "/owner/api/platform/webhooks?limit=50",
    webhook: "/owner/api/platform/webhook",
    webhookTest: "/owner/api/platform/webhook/test",
    marketplace: "/owner/api/platform/marketplace?limit=50",
    marketplaceCreate: "/owner/api/platform/marketplace",
  },
  runtime: {
    restartPlans: "/owner/api/platform/restart-plans?limit=50",
    restartExecutions: "/owner/api/platform/restart-executions?limit=50",
    restartService: "/owner/api/runtime/restart-service",
  },
  commerce: {
    shopList: "/owner/api/shop/list",
    purchaseList: "/owner/api/purchase/list",
    purchaseStatuses: "/owner/api/purchase/statuses",
    dashboardCards: "/owner/api/dashboard/cards",
    donationsOverview: "/owner/api/donations/overview",
    modulesOverview: "/owner/api/modules/overview",
    events: "/owner/api/event/list",
    raids: "/owner/api/raid/list",
    killfeed: "/owner/api/killfeed/list",
    playerAccounts: "/owner/api/player/accounts",
    playerDashboard: "/owner/api/player/dashboard",
    playerIdentity: "/owner/api/player/identity",
    portalShop: "/owner/api/portal/shop/list",
    portalPurchaseList: "/owner/api/portal/purchase/list",
    portalBountyList: "/owner/api/portal/bounty/list",
    portalPlayerDashboard: "/owner/api/portal/player/dashboard",
  },
};

const FALLBACK_TENANTS = [
  { code: "K1", name: "Killzone Alpha", id: "TN-8492-XPA", status: "active", tier: "Legendary Tier", agents: 2, bots: 2, health: "healthy", revenue: "THB 42,500", cpu: 34, memory: 58 },
  { code: "S3", name: "Survivor Island S3", id: "TN-1022-LPR", status: "degraded", tier: "Survivor Tier", agents: 1, bots: 1, health: "critical", revenue: "THB 18,200", cpu: 71, memory: 88 },
  { code: "BS", name: "Bangkok Survival [TH]", id: "TN-0012-THB", status: "active", tier: "Legendary Tier", agents: 2, bots: 2, health: "stable", revenue: "THB 31,900", cpu: 42, memory: 63 },
  { code: "NZ", name: "Northern Sector Ops", id: "TN-9042-OPS", status: "active", tier: "Enterprise", agents: 3, bots: 2, health: "healthy", revenue: "THB 58,800", cpu: 42, memory: 78 },
];

const FALLBACK_PACKAGES = [
  { name: "Standard", sku: "SCUM-STND-01", tags: ["Runtime Core", "Basic Logs"], tenants: 142, health: "healthy" },
  { name: "Pro", sku: "SCUM-PRO-05", tags: ["Delivery Agent+", "Auto-Restart", "Advanced Diagnostics"], tenants: 58, health: "active" },
  { name: "Enterprise", sku: "SCUM-ENT-99", tags: ["Custom Runtime", "SLA Priority", "+12 modules"], tenants: 12, health: "stable" },
];

const FALLBACK_INVOICES = [
  { invoice: "INV-8921-SCUM", tenant: "Zone-Omega-Thai", date: "12 Oct 2023, 14:22", status: "paid", amount: "THB 12,500" },
  { invoice: "INV-8919-SCUM", tenant: "Global-Surv-HQ", date: "12 Oct 2023, 12:05", status: "failed", amount: "THB 45,200" },
  { invoice: "INV-8918-SCUM", tenant: "Apex-SCUM-RP", date: "11 Oct 2023, 23:59", status: "pending", amount: "THB 8,900" },
];

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["items", "rows", "data", "tenants", "subscriptions", "licenses", "invoices", "paymentAttempts", "agents", "runtimes", "events", "notifications", "files", "history"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.result && typeof payload.result === "object") return extractItems(payload.result);
  if (payload.payload && typeof payload.payload === "object") return extractItems(payload.payload);
  return [];
}

function normalizeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeStatus(value, fallback = "neutral") {
  return normalizeText(value, fallback).toLowerCase().replace(/\s+/g, "_");
}

function isOnline(value) {
  const status = normalizeStatus(value);
  return ["online", "active", "healthy", "synced", "ready", "connected"].some((word) => status.includes(word));
}

function runtimeKindOf(runtime) {
  const raw = [
    runtime.runtimeKind,
    runtime.kind,
    runtime.type,
    runtime.role,
    runtime.scope,
    runtime.runtimeKey,
    runtime.channel,
    runtime.name,
  ].map((value) => normalizeText(value).toLowerCase()).join(" ");

  if (raw.includes("server-bot") || raw.includes("server_bot") || raw.includes("sync")) return "server-bot";
  if (raw.includes("delivery") || raw.includes("execute") || raw.includes("agent")) return "delivery-agent";
  return "unknown";
}

function keyOf(record) {
  return normalizeText(record.id || record.tenantId || record.tenant_id || record.slug || record.name);
}

function tenantKeyOf(record) {
  return normalizeText(record.tenantId || record.tenant_id || record.tenant?.id || record.tenantSlug || record.slug);
}

function initials(nameOrSlug) {
  const source = normalizeText(nameOrSlug, "TN").replace(/[-_]/g, " ");
  const words = source.split(/\s+/).filter(Boolean);
  if (!words.length) return "TN";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function buildIndex(records) {
  const index = new Map();
  for (const record of records) {
    const keys = new Set([
      keyOf(record),
      tenantKeyOf(record),
      normalizeText(record.slug),
      normalizeText(record.tenantSlug),
    ].filter(Boolean));
    for (const key of keys) index.set(key, record);
  }
  return index;
}

function recordsForTenant(records, tenant) {
  const tenantKeys = new Set([
    normalizeText(tenant.id),
    normalizeText(tenant.tenantId),
    normalizeText(tenant.slug),
    normalizeText(tenant.tenantSlug),
  ].filter(Boolean));
  return records.filter((record) => tenantKeys.has(tenantKeyOf(record)) || tenantKeys.has(keyOf(record)));
}

function formatCurrency(amount, currency = "THB") {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return normalizeText(amount, `${currency} 0`);
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric)}`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function adaptTenantRows({ tenants = [], subscriptions = [], invoices = [], agents = [] } = {}) {
  const subscriptionIndex = buildIndex(subscriptions);
  return extractItems(tenants).map((tenant, index) => {
    const tenantId = normalizeText(tenant.id || tenant.tenantId || tenant.slug || `tenant_${index + 1}`);
    const tenantSlug = normalizeText(tenant.slug || tenant.tenantSlug || tenantId);
    const tenantName = normalizeText(tenant.name || tenant.displayName || tenant.serverName || tenantSlug, tenantId);
    const tenantSubscriptions = recordsForTenant(subscriptions, tenant);
    const subscription = tenantSubscriptions[0] || subscriptionIndex.get(tenantId) || {};
    const tenantInvoices = recordsForTenant(invoices, tenant);
    const tenantAgents = recordsForTenant(agents, tenant);
    const deliveryAgents = tenantAgents.filter((runtime) => runtimeKindOf(runtime) === "delivery-agent");
    const serverBots = tenantAgents.filter((runtime) => runtimeKindOf(runtime) === "server-bot");
    const hasOfflineDelivery = deliveryAgents.some((runtime) => !isOnline(runtime.status || runtime.state));
    const hasOfflineServerBot = serverBots.some((runtime) => !isOnline(runtime.status || runtime.state));
    const hasUnpaidInvoice = tenantInvoices.some((invoice) => {
      const status = normalizeStatus(invoice.status || invoice.paymentStatus);
      return status.includes("unpaid") || status.includes("failed") || status.includes("past_due");
    });
    const latestInvoice = tenantInvoices[0] || {};
    const revenue = latestInvoice.amount || latestInvoice.total || latestInvoice.totalAmount || tenant.revenue || 0;
    const currency = latestInvoice.currency || tenant.currency || "THB";
    const health = hasOfflineServerBot || hasUnpaidInvoice ? "critical" : hasOfflineDelivery ? "warning" : normalizeStatus(tenant.health || tenant.riskLevel || "healthy");

    return {
      code: initials(tenantSlug || tenantName),
      name: tenantName,
      id: tenantId,
      status: normalizeStatus(tenant.status || subscription.status || "active"),
      tier: normalizeText(subscription.packageName || subscription.package?.name || tenant.packageName || tenant.tier || tenant.package || "Unassigned"),
      agents: deliveryAgents.length,
      bots: serverBots.length,
      health,
      revenue: formatCurrency(revenue, currency),
      cpu: Number(tenant.cpu || tenant.cpuUsage || tenant.metrics?.cpu || 0),
      memory: Number(tenant.memory || tenant.memoryUsage || tenant.metrics?.memory || 0),
      locale: tenant.locale || "en",
      raw: tenant,
    };
  });
}

export function adaptBillingInvoices(payload = []) {
  return extractItems(payload).map((invoice, index) => {
    const amount = invoice.amount || invoice.total || invoice.totalAmount || invoice.amountDue || 0;
    return {
      invoice: normalizeText(invoice.invoice || invoice.invoiceId || invoice.id || `invoice_${index + 1}`),
      tenant: normalizeText(invoice.tenantName || invoice.tenant?.name || invoice.tenantId || invoice.customerName || "Unknown tenant"),
      date: formatDate(invoice.date || invoice.createdAt || invoice.issuedAt || invoice.dueAt),
      status: normalizeStatus(invoice.status || invoice.paymentStatus || "pending"),
      amount: formatCurrency(amount, invoice.currency || "THB"),
      raw: invoice,
    };
  });
}

export function adaptPackages(payload = []) {
  return extractItems(payload).map((item, index) => ({
    name: normalizeText(item.name || item.packageName || item.label || `Package ${index + 1}`),
    sku: normalizeText(item.sku || item.id || item.packageId || item.key || `pkg_${index + 1}`),
    tags: Array.isArray(item.features)
      ? item.features.slice(0, 4)
      : Array.isArray(item.tags)
        ? item.tags.slice(0, 4)
        : Array.isArray(item.entitlements)
          ? item.entitlements.slice(0, 4)
          : ["Entitlement", "Runtime"],
    tenants: Number(item.tenantCount || item.tenants || item.activeTenants || 0),
    health: normalizeStatus(item.status || item.health || "active"),
    raw: item,
  }));
}

export function adaptRuntimeFleet(payload = []) {
  const items = extractItems(payload);
  const deliveryAgents = [];
  const serverBots = [];

  for (const runtime of items) {
    const kind = runtimeKindOf(runtime);
    const row = {
      id: normalizeText(runtime.id || runtime.runtimeId || runtime.runtimeKey || runtime.name),
      tenantId: normalizeText(runtime.tenantId || runtime.tenant?.id),
      tenantName: normalizeText(runtime.tenantName || runtime.tenant?.name || runtime.tenantId || "Unassigned"),
      status: normalizeStatus(runtime.status || runtime.state || "unknown"),
      version: normalizeText(runtime.version || runtime.runtimeVersion || "unknown"),
      latestVersion: normalizeText(runtime.latestVersion || runtime.version || "unknown"),
      machineName: normalizeText(runtime.machineName || runtime.deviceName || runtime.host || "Unknown machine"),
      lastHeartbeatAt: runtime.lastHeartbeatAt || runtime.lastSeenAt || runtime.updatedAt,
      risk: normalizeStatus(runtime.riskLevel || runtime.health || "neutral"),
      raw: runtime,
    };

    if (kind === "server-bot") serverBots.push(row);
    else deliveryAgents.push(row);
  }

  return {
    deliveryAgents,
    serverBots,
    summary: {
      deliveryAgentsOnline: deliveryAgents.filter((runtime) => isOnline(runtime.status)).length,
      deliveryAgentsOffline: deliveryAgents.filter((runtime) => !isOnline(runtime.status)).length,
      serverBotsOnline: serverBots.filter((runtime) => isOnline(runtime.status)).length,
      serverBotsOffline: serverBots.filter((runtime) => !isOnline(runtime.status)).length,
      outdated: [...deliveryAgents, ...serverBots].filter((runtime) => runtime.latestVersion !== "unknown" && runtime.version !== runtime.latestVersion).length,
    },
  };
}

export function adaptOverviewData({
  tenants = [],
  invoices = [],
  paymentAttempts = [],
  agents = [],
  securityEvents = [],
  deliveryLifecycle = {},
} = {}) {
  const runtimeFleet = adaptRuntimeFleet(agents);
  const invoiceRows = adaptBillingInvoices(invoices);
  const unpaidInvoices = invoiceRows.filter((invoice) => ["unpaid", "failed", "past_due", "pending"].some((status) => invoice.status.includes(status)));
  const failedPaymentCount = extractItems(paymentAttempts).filter((attempt) => normalizeStatus(attempt.status).includes("failed")).length;
  const securityCount = extractItems(securityEvents).length;
  const deliverySummary = deliveryLifecycle?.summary || {};
  const failedJobs = Number(deliverySummary.failed24h || deliverySummary.failed || 0);
  const deadLetter = Number(deliverySummary.deadLetter || deliverySummary.deadLetterJobs || 0);
  const totalRevenue = extractItems(invoices).reduce((sum, invoice) => {
    const value = Number(invoice.amount || invoice.total || invoice.totalAmount || invoice.amountDue || 0);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  const stream = [];
  if (runtimeFleet.summary.serverBotsOffline) stream.push(["LIVE", "SERVER_BOT", `${runtimeFleet.summary.serverBotsOffline} Server Bot offline`, "degraded"]);
  if (runtimeFleet.summary.deliveryAgentsOffline) stream.push(["LIVE", "DELIVERY_AGENT", `${runtimeFleet.summary.deliveryAgentsOffline} Delivery Agent offline`, "degraded"]);
  if (unpaidInvoices.length) stream.push(["BILLING", "INVOICE", `${unpaidInvoices.length} invoice needs attention`, "failed"]);
  if (securityCount) stream.push(["SECURITY", "AUTH", `${securityCount} recent security event(s)`, "flagged"]);
  if (!stream.length) stream.push(["LIVE", "PLATFORM", "Owner API slices loaded", "success"]);

  return {
    stats: {
      revenueVelocity: formatCurrency(totalRevenue, extractItems(invoices)[0]?.currency || "THB"),
      incidentsNew: failedJobs + deadLetter + failedPaymentCount + securityCount,
      incidentsAck: unpaidInvoices.length,
      incidentsCleared: extractItems(tenants).length,
      securityScore: Math.max(0, 100 - securityCount * 5 - failedPaymentCount * 4),
      deliveryAgents: {
        total: runtimeFleet.deliveryAgents.length,
        online: runtimeFleet.summary.deliveryAgentsOnline,
        latent: runtimeFleet.summary.deliveryAgentsOffline,
      },
      serverBots: {
        total: runtimeFleet.serverBots.length,
        active: runtimeFleet.summary.serverBotsOnline,
        stale: runtimeFleet.summary.serverBotsOffline,
      },
    },
    tacticalStream: stream,
  };
}

export function buildFallbackPageData(page) {
  const overview = adaptOverviewData({
    tenants: FALLBACK_TENANTS.map((tenant) => ({ id: tenant.id, name: tenant.name })),
    invoices: FALLBACK_INVOICES.map((invoice) => ({ ...invoice, amount: Number(invoice.amount.replace(/\D/g, "")) || 0, currency: "THB" })),
    agents: [
      { tenantId: "TN-8492-XPA", runtimeKind: "delivery-agent", status: "online" },
      { tenantId: "TN-1022-LPR", runtimeKind: "server-bot", status: "offline" },
    ],
    securityEvents: [{ severity: "medium" }],
    deliveryLifecycle: { summary: { failed24h: 2, deadLetter: 1 } },
  });

  if (page === "tenants") return { tenants: FALLBACK_TENANTS };
  if (page === "packages") return { packages: FALLBACK_PACKAGES };
  if (page === "billing" || page === "subscriptions") return { invoices: FALLBACK_INVOICES };
  if (page === "fleet") {
    return {
      fleet: adaptRuntimeFleet([
        { id: "DA-FALLBACK-01", tenantId: "TN-8492-XPA", tenantName: "Killzone Alpha", runtimeKind: "delivery-agent", status: "online", version: "1.8.2" },
        { id: "SB-FALLBACK-01", tenantId: "TN-1022-LPR", tenantName: "Survivor Island S3", runtimeKind: "server-bot", status: "offline", version: "1.8.0" },
      ]),
    };
  }
  return overview;
}
