import { REAL_OWNER_API_MAP } from "./owner-adapters.js";

const LOGIN_REQUIRED_REASON = "Owner login required before this action can run against the backend.";

export const OWNER_ACTIONS = {
  refresh: {
    key: "refresh",
    label: "Refresh",
    page: "all",
    kind: "local",
  },
  gotoTenants: {
    key: "gotoTenants",
    label: "View Tenants",
    page: "overview",
    kind: "navigation",
    targetPage: "tenants",
  },
  gotoIncidents: {
    key: "gotoIncidents",
    label: "Incidents",
    page: "overview",
    kind: "navigation",
    targetPage: "incidents",
  },
  gotoFleet: {
    key: "gotoFleet",
    label: "Fleet",
    page: "overview",
    kind: "navigation",
    targetPage: "fleet",
  },
  gotoTenantDossier: {
    key: "gotoTenantDossier",
    label: "Tenant Detail",
    page: "tenants",
    kind: "navigation",
    targetPage: "tenant-dossier",
  },
  gotoPackageDetail: {
    key: "gotoPackageDetail",
    label: "Package Detail",
    page: "packages",
    kind: "navigation",
    targetPage: "package-detail",
  },
  gotoInvoiceDetail: {
    key: "gotoInvoiceDetail",
    label: "Invoice Detail",
    page: "billing",
    kind: "navigation",
    targetPage: "invoice-detail",
  },
  gotoPaymentAttemptDetail: {
    key: "gotoPaymentAttemptDetail",
    label: "Payment Attempt Detail",
    page: "billing",
    kind: "navigation",
    targetPage: "payment-attempt-detail",
  },
  gotoSubscriptionDetail: {
    key: "gotoSubscriptionDetail",
    label: "Subscription Detail",
    page: "subscriptions",
    kind: "navigation",
    targetPage: "subscription-detail",
  },
  runMonitoring: {
    key: "runMonitoring",
    label: "Run Monitoring",
    page: "overview",
    kind: "mutation",
    method: "POST",
    endpoint: "/owner/api/platform/monitoring/run",
    defaultPayload: { source: "owner-ui-prototype" },
    risk: "safe",
  },
  createTenant: {
    key: "createTenant",
    label: "New Tenant",
    page: "tenants",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.tenants.mutate,
    requiredPayload: ["name", "slug"],
    risk: "business",
  },
  updateTenant: {
    key: "updateTenant",
    label: "Update Tenant",
    page: "tenant-dossier",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.tenants.mutate,
    requiredPayload: ["id"],
    risk: "business",
  },
  setTenantStatus: {
    key: "setTenantStatus",
    label: "Set Tenant Status",
    page: "tenant-dossier",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.tenants.mutate,
    requiredPayload: ["id", "status"],
    risk: "business",
  },
  createPackage: {
    key: "createPackage",
    label: "Create Package",
    page: "packages",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.packages.create,
    requiredPayload: ["id", "name"],
    risk: "business",
  },
  updatePackage: {
    key: "updatePackage",
    label: "Update Package",
    page: "package-detail",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.packages.update,
    requiredPayload: ["id"],
    risk: "business",
  },
  deletePackage: {
    key: "deletePackage",
    label: "Delete Package",
    page: "package-detail",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.packages.delete,
    requiredPayload: ["packageId"],
    confirmText: "DELETE",
    risk: "dangerous",
  },
  issueLicense: {
    key: "issueLicense",
    label: "Issue License",
    page: "packages",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.packages.license,
    requiredPayload: ["tenantId", "packageId"],
    risk: "business",
  },
  acceptLicenseLegal: {
    key: "acceptLicenseLegal",
    label: "Accept License Legal",
    page: "packages",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.packages.acceptLegal,
    requiredPayload: ["licenseId"],
    risk: "business",
  },
  exportBillingLedger: {
    key: "exportBillingLedger",
    label: "Export Ledger",
    page: "billing",
    kind: "download",
    endpoint: "/owner/api/platform/billing/export",
  },
  createCheckoutSession: {
    key: "createCheckoutSession",
    label: "Create Checkout Session",
    page: "billing",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.billing.checkoutSession,
    requiredPayload: ["tenantId", "packageId"],
    risk: "business",
  },
  createSubscription: {
    key: "createSubscription",
    label: "Create Subscription",
    page: "subscriptions",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.subscriptions.create,
    requiredPayload: ["tenantId", "packageId"],
    risk: "business",
  },
  updateSubscription: {
    key: "updateSubscription",
    label: "Update Subscription",
    page: "subscriptions",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.subscriptions.update,
    requiredPayload: ["tenantId", "subscriptionId", "planId"],
    risk: "business",
  },
  cancelSubscription: {
    key: "cancelSubscription",
    label: "Cancel Subscription",
    page: "subscriptions",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.subscriptions.update,
    requiredPayload: ["tenantId", "subscriptionId", "planId"],
    defaultPayload: { status: "canceled" },
    confirmText: "CANCEL",
    risk: "dangerous",
  },
  reactivateSubscription: {
    key: "reactivateSubscription",
    label: "Reactivate Subscription",
    page: "subscriptions",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.subscriptions.update,
    requiredPayload: ["tenantId", "subscriptionId", "planId"],
    defaultPayload: { status: "active" },
    risk: "business",
  },
  updateInvoiceStatus: {
    key: "updateInvoiceStatus",
    label: "Update Invoice Status",
    page: "billing",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.billing.invoiceUpdate,
    requiredPayload: ["tenantId", "invoiceId", "status"],
    risk: "business",
  },
  updatePaymentAttemptStatus: {
    key: "updatePaymentAttemptStatus",
    label: "Update Payment Attempt",
    page: "billing",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.billing.attemptUpdate,
    requiredPayload: ["tenantId", "attemptId", "status"],
    risk: "business",
  },
  provisionDeliveryAgent: {
    key: "provisionDeliveryAgent",
    label: "Provision Delivery Agent",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.provision,
    requiredPayload: ["tenantId", "serverId", "runtimeKey", "name", "minimumVersion", "expiresAt"],
    defaultPayload: { runtimeKind: "delivery-agent", role: "delivery-agent", scope: "delivery" },
    risk: "runtime",
  },
  provisionServerBot: {
    key: "provisionServerBot",
    label: "Provision Server Bot",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.provision,
    requiredPayload: ["tenantId", "serverId", "runtimeKey", "name", "minimumVersion", "expiresAt"],
    defaultPayload: { runtimeKind: "server-bot", role: "server-bot", scope: "server" },
    risk: "runtime",
  },
  createPlatformServer: {
    key: "createPlatformServer",
    label: "Create Server",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.server,
    requiredPayload: ["tenantId", "name"],
    defaultPayload: { status: "active", locale: "th" },
    risk: "runtime",
  },
  reissueRuntimeToken: {
    key: "reissueRuntimeToken",
    label: "Reissue Runtime Token",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.provision,
    requiredPayload: ["tenantId", "serverId", "runtimeKey", "agentId", "runtimeKind"],
    risk: "runtime",
  },
  resetRuntimeBinding: {
    key: "resetRuntimeBinding",
    label: "Reset Runtime Binding",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.revokeDevice,
    requiredPayload: ["tenantId", "deviceId", "runtimeKind"],
    confirmText: "RESET",
    risk: "dangerous",
  },
  revokeRuntime: {
    key: "revokeRuntime",
    label: "Revoke Runtime",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.revokeRuntime,
    requiredPayload: ["tenantId", "runtimeKind"],
    confirmText: "REVOKE",
    risk: "dangerous",
  },
  revokeRuntimeToken: {
    key: "revokeRuntimeToken",
    label: "Revoke Runtime Token",
    page: "fleet",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.fleet.revokeToken,
    requiredPayload: ["tenantId"],
    confirmText: "REVOKE",
    risk: "dangerous",
  },
  exportObservability: {
    key: "exportObservability",
    label: "Export Diagnostics",
    page: "observability",
    kind: "download",
    endpoint: "/owner/api/observability/export",
  },
  acknowledgeNotifications: {
    key: "acknowledgeNotifications",
    label: "Acknowledge",
    page: "incidents",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.notifications.ack,
    requiredPayload: ["ids"],
    risk: "safe",
  },
  openSupportCase: {
    key: "openSupportCase",
    label: "Open Support Case",
    page: "support",
    kind: "download",
    endpoint: REAL_OWNER_API_MAP.tenants.supportCaseExport,
    requiredPayload: ["tenantId"],
    defaultPayload: { format: "json" },
    queryPayload: ["tenantId", "format"],
  },
  openDeadLetter: {
    key: "openDeadLetter",
    label: "Open Dead-Letter",
    page: "support",
    kind: "navigation",
    targetPage: "observability",
  },
  retryDeadLetter: {
    key: "retryDeadLetter",
    label: "Retry Dead-Letter",
    page: "support",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.delivery.deadLetterRetry,
    requiredPayload: ["tenantId", "code"],
    risk: "runtime",
  },
  clearDeadLetter: {
    key: "clearDeadLetter",
    label: "Clear Dead-Letter",
    page: "support",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.delivery.deadLetterDelete,
    requiredPayload: ["tenantId", "code"],
    confirmText: "CLEAR",
    risk: "dangerous",
  },
  exportSupport: {
    key: "exportSupport",
    label: "Export Support Data",
    page: "support",
    kind: "download",
    endpoint: REAL_OWNER_API_MAP.delivery.lifecycleExport,
    defaultPayload: { format: "json" },
    queryPayload: ["tenantId", "limit", "format"],
  },
  exportTenantDiagnostics: {
    key: "exportTenantDiagnostics",
    label: "Export Tenant Diagnostics",
    page: "support",
    kind: "download",
    endpoint: REAL_OWNER_API_MAP.tenants.diagnosticsExport,
    requiredPayload: ["tenantId"],
    defaultPayload: { format: "json", limit: "25" },
    queryPayload: ["tenantId", "limit", "format"],
  },
  createRestorePoint: {
    key: "createRestorePoint",
    label: "Create Restore Point",
    page: "recovery",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.backup.create,
    defaultPayload: {
      note: "Created from owner-ui-prototype",
      includeSnapshot: true,
    },
    risk: "safe",
  },
  confirmRestore: {
    key: "confirmRestore",
    label: "Confirm Restore",
    page: "recovery",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.backup.restore,
    requiredPayload: ["backup", "previewToken", "confirmBackup"],
    confirmText: "RESTORE",
    risk: "dangerous",
  },
  previewRestore: {
    key: "previewRestore",
    label: "Preview Restore",
    page: "recovery",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.backup.restore,
    requiredPayload: ["backup"],
    defaultPayload: { dryRun: true },
    risk: "dangerous",
  },
  exportAudit: {
    key: "exportAudit",
    label: "Export Audit",
    page: "security",
    kind: "download",
    endpoint: "/owner/api/audit/export",
  },
  exportSecurityEvents: {
    key: "exportSecurityEvents",
    label: "Export Security Events",
    page: "security",
    kind: "download",
    endpoint: REAL_OWNER_API_MAP.auth.securityEventsExport,
    defaultPayload: { format: "json" },
    queryPayload: ["format"],
  },
  revokeAdminSession: {
    key: "revokeAdminSession",
    label: "Revoke Session",
    page: "security",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.auth.revokeSession,
    requiredPayload: ["sessionId"],
    defaultPayload: { reason: "owner-audit-revoke" },
    confirmText: "REVOKE",
    risk: "dangerous",
  },
  clearAcknowledgedNotifications: {
    key: "clearAcknowledgedNotifications",
    label: "Clear Acknowledged",
    page: "incidents",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.notifications.clear,
    defaultPayload: { acknowledgedOnly: true },
    risk: "safe",
  },
  restartOwnerRuntime: {
    key: "restartOwnerRuntime",
    label: "Restart Service",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: "/owner/api/runtime/restart-service",
    requiredPayload: ["services"],
    confirmText: "RESTART",
    risk: "dangerous",
  },
  updateControlPanelEnv: {
    key: "updateControlPanelEnv",
    label: "Save ENV",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.overview.controlPanelEnv,
    requiredPayload: ["patch"],
    confirmText: "SAVE",
    risk: "dangerous",
  },
  upsertAdminUser: {
    key: "upsertAdminUser",
    label: "Save Admin User",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.auth.user,
    requiredPayload: ["username", "role"],
    risk: "dangerous",
  },
  createApiKey: {
    key: "createApiKey",
    label: "Create API Key",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.integrations.apiKey,
    requiredPayload: ["tenantId", "name"],
    risk: "business",
  },
  createWebhook: {
    key: "createWebhook",
    label: "Create Webhook",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.integrations.webhook,
    requiredPayload: ["tenantId", "url"],
    risk: "business",
  },
  testWebhook: {
    key: "testWebhook",
    label: "Test Webhook",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.integrations.webhookTest,
    requiredPayload: ["webhookId"],
    risk: "safe",
  },
  createMarketplaceOffer: {
    key: "createMarketplaceOffer",
    label: "Create Marketplace Offer",
    page: "settings",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.integrations.marketplaceCreate,
    requiredPayload: ["tenantId", "title"],
    risk: "business",
  },
  runPlatformAutomation: {
    key: "runPlatformAutomation",
    label: "Run Automation",
    page: "automation",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.automation.run,
    defaultPayload: { force: true, dryRun: false },
    risk: "runtime",
  },
  previewPlatformAutomation: {
    key: "previewPlatformAutomation",
    label: "Preview Automation",
    page: "automation",
    kind: "mutation",
    method: "POST",
    endpoint: REAL_OWNER_API_MAP.automation.run,
    defaultPayload: { force: true, dryRun: true },
    risk: "safe",
  },
};

const PAGE_ACTIONS = {
  overview: ["gotoTenants", "gotoIncidents", "runMonitoring"],
  tenants: ["createTenant"],
  "create-tenant": ["createTenant"],
  "tenant-dossier": ["gotoTenants", "updateTenant", "setTenantStatus"],
  packages: ["createPackage", "issueLicense"],
  "package-detail": ["updatePackage", "deletePackage"],
  billing: ["exportBillingLedger", "createCheckoutSession", "updateInvoiceStatus", "updatePaymentAttemptStatus"],
  "invoice-detail": ["updateInvoiceStatus", "exportBillingLedger"],
  "payment-attempt-detail": ["updatePaymentAttemptStatus", "createCheckoutSession", "exportBillingLedger"],
  subscriptions: ["exportBillingLedger", "createSubscription", "updateSubscription"],
  "subscription-detail": ["updateSubscription", "cancelSubscription", "reactivateSubscription"],
  fleet: ["refresh", "createPlatformServer", "provisionDeliveryAgent", "provisionServerBot"],
  "fleet-diagnostics": ["refresh", "createPlatformServer", "provisionDeliveryAgent", "provisionServerBot"],
  "runtime-detail": ["refresh"],
  observability: ["exportObservability"],
  "diagnostics-evidence": ["exportObservability"],
  incidents: ["acknowledgeNotifications", "clearAcknowledgedNotifications"],
  support: ["exportSupport", "exportTenantDiagnostics", "openSupportCase", "runMonitoring", "openDeadLetter"],
  "support-context": ["exportTenantDiagnostics", "openSupportCase", "retryDeadLetter", "clearDeadLetter"],
  recovery: ["createRestorePoint", "previewRestore", "confirmRestore"],
  "backup-detail": ["createRestorePoint", "previewRestore", "confirmRestore"],
  security: ["exportAudit", "exportSecurityEvents", "revokeAdminSession"],
  "access-posture": ["exportAudit", "revokeAdminSession"],
  settings: ["createApiKey", "createWebhook", "createMarketplaceOffer", "restartOwnerRuntime"],
  "platform-controls": ["runPlatformAutomation", "previewPlatformAutomation", "restartOwnerRuntime"],
  automation: ["previewPlatformAutomation", "runPlatformAutomation", "runMonitoring"],
};

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function missingPayloadKeys(action, payload = {}) {
  return (action.requiredPayload || []).filter((key) => !hasValue(payload[key]));
}

function buildActionEndpoint(action, payload = {}) {
  if (!action?.endpoint) return "";

  const consumed = new Set();
  const endpoint = action.endpoint.replace(/:([A-Za-z0-9_]+)/g, (match, key) => {
    consumed.add(key);
    return encodeURIComponent(payload[key] ?? "");
  });

  const queryKeys = (action.queryPayload || []).filter((key) => !consumed.has(key));
  if (!queryKeys.length) return endpoint;

  const params = new URLSearchParams();
  for (const key of queryKeys) {
    if (hasValue(payload[key])) params.set(key, String(payload[key]));
  }

  const query = params.toString();
  if (!query) return endpoint;
  return `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`;
}

function isLiveSource(context = {}) {
  if (context.live === true) return true;
  return context.source === "backend" || context.source === "backend-partial";
}

export function getPageActions(page) {
  return (PAGE_ACTIONS[page] || []).map((key) => OWNER_ACTIONS[key]).filter(Boolean);
}

export function resolveOwnerAction(actionKey, context = {}) {
  const action = OWNER_ACTIONS[actionKey];
  if (!action) {
    return { enabled: false, reason: `Unknown action: ${actionKey}` };
  }

  if (action.kind === "disabled") {
    return { action, enabled: false, reason: action.reason || "This action is not implemented." };
  }

  if (action.kind === "local" || action.kind === "navigation") {
    return { action, enabled: true, reason: "" };
  }

  if (!isLiveSource(context)) {
    return { action, enabled: false, reason: LOGIN_REQUIRED_REASON };
  }

  if (!action.endpoint) {
    return { action, enabled: false, reason: "No backend endpoint is mapped for this action." };
  }

  const payload = {
    ...(action.defaultPayload || {}),
    ...(context.payload || {}),
  };
  const missing = missingPayloadKeys(action, payload);
  if (missing.length > 0) {
    return { action, enabled: false, reason: `Missing required payload: ${missing.join(", ")}` };
  }

  if (action.confirmText && payload.confirmText !== action.confirmText) {
    return { action, enabled: false, reason: `Requires confirmation: ${action.confirmText}` };
  }

  return { action, enabled: true, reason: "", payload, endpoint: buildActionEndpoint(action, payload) };
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok || payload?.ok === false) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error || response.statusText || "Owner action failed",
      data: payload?.data || null,
    };
  }
  return {
    ok: true,
    status: response.status,
    data: payload?.data ?? payload,
  };
}

export async function runOwnerAction(actionKey, context = {}) {
  const resolved = resolveOwnerAction(actionKey, context);
  if (!resolved.enabled) {
    return {
      ok: false,
      action: resolved.action || null,
      error: resolved.reason,
    };
  }

  const { action, payload, endpoint } = resolved;

  if (action.kind === "local") {
    if (typeof context.onRefresh === "function") context.onRefresh();
    return { ok: true, action, data: { refreshed: true } };
  }

  if (action.kind === "navigation") {
    if (typeof context.onNavigate === "function") {
      context.onNavigate(action.targetPage, {
        recordId: context.payload?.recordId || context.payload?.id || "",
      });
    }
    return {
      ok: true,
      action,
      data: {
        targetPage: action.targetPage,
        recordId: context.payload?.recordId || context.payload?.id || "",
      },
    };
  }

  if (action.kind === "download") {
    if (typeof context.openUrl === "function") context.openUrl(endpoint);
    return { ok: true, action, data: { url: endpoint } };
  }

  const fetchImpl = context.fetchImpl || fetch;
  const response = await fetchImpl(endpoint || action.endpoint, {
    method: action.method || "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  return {
    action,
    ...(await parseJsonResponse(response)),
  };
}
