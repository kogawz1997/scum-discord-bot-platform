export const OWNER_ACTION_FORMS = {
  runMonitoring: {
    title: "Run monitoring",
    description: "Runs the mapped owner monitoring endpoint and records a platform automation check.",
    submitLabel: "Run Monitoring",
    fields: [
      { name: "source", label: "Source", required: true, placeholder: "owner-ui-prototype", defaultValue: "owner-ui-prototype" },
      { name: "scope", label: "Scope", required: false, placeholder: "platform" },
    ],
  },
  createTenant: {
    title: "Create tenant",
    description: "Creates a tenant through the real owner tenant endpoint.",
    submitLabel: "Create Tenant",
    fields: [
      { name: "name", label: "Tenant name", required: true, placeholder: "Bangkok Survival" },
      { name: "slug", label: "Tenant slug", required: true, placeholder: "bangkok-survival" },
    ],
  },
  updateTenant: {
    title: "Update tenant",
    description: "Updates the selected tenant through the original owner tenant endpoint.",
    submitLabel: "Update Tenant",
    fields: [
      { name: "id", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "name", label: "Tenant name", required: false, placeholder: "Bangkok Survival" },
      { name: "slug", label: "Tenant slug", required: false, placeholder: "bangkok-survival" },
      { name: "ownerName", label: "Owner name", required: false, placeholder: "Operator name" },
      { name: "ownerEmail", label: "Owner email", required: false, placeholder: "owner@example.com" },
      { name: "status", label: "Status", required: false, placeholder: "active" },
      { name: "locale", label: "Locale", required: false, placeholder: "th" },
    ],
  },
  setTenantStatus: {
    title: "Set tenant status",
    description: "Changes tenant status using the same tenant mutation as the old owner panel.",
    submitLabel: "Set Status",
    fields: [
      { name: "id", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "status", label: "Target status", required: true, placeholder: "active / suspended / trialing" },
    ],
  },
  createPackage: {
    title: "Create package",
    description: "Creates a package/license tier through the mapped package endpoint.",
    submitLabel: "Create Package",
    fields: [
      { name: "id", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
      { name: "name", label: "Package name", required: true, placeholder: "Pro" },
    ],
  },
  updatePackage: {
    title: "Update package",
    description: "Updates package catalog fields through the owner package endpoint.",
    submitLabel: "Update Package",
    fields: [
      { name: "id", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
      { name: "title", label: "Package title", required: false, placeholder: "Pro" },
      { name: "description", label: "Description", required: false, placeholder: "Runtime and delivery automation" },
      { name: "status", label: "Status", required: false, placeholder: "active" },
      { name: "position", label: "Position", required: false, placeholder: "10" },
      { name: "featureText", label: "Feature text", required: false, placeholder: "Delivery Agent, Server Bot, Restart" },
    ],
  },
  deletePackage: {
    title: "Delete package",
    description: "Deletes a package only after typed confirmation.",
    submitLabel: "Delete Package",
    danger: true,
    fields: [
      { name: "packageId", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
      { name: "confirmText", label: "Type DELETE", required: true, placeholder: "DELETE", defaultValue: "DELETE" },
    ],
  },
  issueLicense: {
    title: "Issue license",
    description: "Issues a package license for a tenant through the old owner license endpoint.",
    submitLabel: "Issue License",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "packageId", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
      { name: "expiresAt", label: "Expires at", required: false, placeholder: "2026-05-23T00:00:00.000Z" },
    ],
  },
  createCheckoutSession: {
    title: "Create checkout session",
    description: "Starts a backend checkout session for a tenant and package.",
    submitLabel: "Create Checkout",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "packageId", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
    ],
  },
  createSubscription: {
    title: "Create subscription",
    description: "Creates or renews a tenant subscription through the owner backend.",
    submitLabel: "Create Subscription",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "packageId", label: "Package ID", required: true, placeholder: "SCUM-PRO-01" },
    ],
  },
  updateSubscription: {
    title: "Update subscription",
    description: "Updates subscription billing state through the owner billing lifecycle endpoint.",
    submitLabel: "Update Subscription",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "subscriptionId", label: "Subscription ID", required: true, placeholder: "sub_..." },
      { name: "planId", label: "Plan ID", required: true, placeholder: "pro-monthly" },
      { name: "packageId", label: "Package ID", required: false, placeholder: "SCUM-PRO-01" },
      { name: "billingCycle", label: "Billing cycle", required: false, placeholder: "monthly" },
      { name: "status", label: "Status", required: false, placeholder: "active" },
      { name: "amountCents", label: "Amount cents", required: false, placeholder: "790000" },
      { name: "currency", label: "Currency", required: false, placeholder: "THB" },
    ],
  },
  cancelSubscription: {
    title: "Cancel subscription",
    description: "Cancels a subscription with typed confirmation.",
    submitLabel: "Cancel Subscription",
    danger: true,
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "subscriptionId", label: "Subscription ID", required: true, placeholder: "sub_..." },
      { name: "planId", label: "Plan ID", required: true, placeholder: "pro-monthly" },
      { name: "confirmText", label: "Type CANCEL", required: true, placeholder: "CANCEL", defaultValue: "CANCEL" },
    ],
  },
  reactivateSubscription: {
    title: "Reactivate subscription",
    description: "Reactivates a canceled subscription.",
    submitLabel: "Reactivate Subscription",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "subscriptionId", label: "Subscription ID", required: true, placeholder: "sub_..." },
      { name: "planId", label: "Plan ID", required: true, placeholder: "pro-monthly" },
    ],
  },
  updateInvoiceStatus: {
    title: "Update invoice status",
    description: "Marks invoice state from the owner billing console.",
    submitLabel: "Update Invoice",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "invoiceId", label: "Invoice ID", required: true, placeholder: "inv_..." },
      { name: "status", label: "Status", required: true, placeholder: "paid / failed / past_due" },
    ],
  },
  updatePaymentAttemptStatus: {
    title: "Update payment attempt",
    description: "Marks payment attempt state from the owner billing console.",
    submitLabel: "Update Payment",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "attemptId", label: "Attempt ID", required: true, placeholder: "pay_..." },
      { name: "status", label: "Status", required: true, placeholder: "succeeded / failed / canceled" },
    ],
  },
  provisionDeliveryAgent: {
    title: "Provision delivery agent",
    description: "Binds a delivery-agent runtime. Delivery and server-management roles stay separate.",
    submitLabel: "Provision Delivery Agent",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "serverId", label: "Server ID", required: true, placeholder: "server_..." },
      { name: "runtimeKey", label: "Runtime key", required: true, placeholder: "delivery-agent-main" },
      { name: "name", label: "Display name", required: true, placeholder: "Delivery Agent Main" },
      { name: "minimumVersion", label: "Minimum version", required: true, placeholder: "1.0.0" },
      { name: "expiresAt", label: "Setup token expires at", required: true, placeholder: "2026-04-23T12:00:00.000Z" },
    ],
  },
  createPlatformServer: {
    title: "Create server record",
    description: "Creates a platform server record before provisioning runtimes.",
    submitLabel: "Create Server",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "name", label: "Server name", required: true, placeholder: "SCUM Main" },
      { name: "slug", label: "Slug", required: false, placeholder: "scum-main" },
      { name: "guildId", label: "Discord guild ID", required: false, placeholder: "1234567890" },
      { name: "status", label: "Status", required: false, placeholder: "active", defaultValue: "active" },
      { name: "locale", label: "Locale", required: false, placeholder: "th", defaultValue: "th" },
    ],
  },
  reissueRuntimeToken: {
    title: "Reissue runtime token",
    description: "Issues a replacement setup token for an existing runtime binding.",
    submitLabel: "Reissue Token",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "serverId", label: "Server ID", required: true, placeholder: "server_..." },
      { name: "agentId", label: "Agent ID", required: true, placeholder: "agent_..." },
      { name: "runtimeKey", label: "Runtime key", required: true, placeholder: "server-bot-main" },
      { name: "runtimeKind", label: "Runtime kind", required: true, placeholder: "server-bots / delivery-agents" },
      { name: "minimumVersion", label: "Minimum version", required: false, placeholder: "1.0.0" },
    ],
  },
  resetRuntimeBinding: {
    title: "Reset runtime binding",
    description: "Revokes a bound runtime device after typed confirmation.",
    submitLabel: "Reset Binding",
    danger: true,
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "deviceId", label: "Device ID", required: true, placeholder: "device_..." },
      { name: "runtimeKind", label: "Runtime kind", required: true, placeholder: "server-bots / delivery-agents" },
      { name: "confirmText", label: "Type RESET", required: true, placeholder: "RESET", defaultValue: "RESET" },
    ],
  },
  revokeRuntime: {
    title: "Revoke runtime",
    description: "Revokes runtime access after typed confirmation.",
    submitLabel: "Revoke Runtime",
    danger: true,
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "runtimeKind", label: "Runtime kind", required: true, placeholder: "server-bots / delivery-agents" },
      { name: "runtimeKey", label: "Runtime key", required: false, placeholder: "server-bot-main" },
      { name: "confirmText", label: "Type REVOKE", required: true, placeholder: "REVOKE", defaultValue: "REVOKE" },
    ],
  },
  provisionServerBot: {
    title: "Provision server bot",
    description: "Binds a server-bot runtime for log sync/config/restart work only.",
    submitLabel: "Provision Server Bot",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "serverId", label: "Server ID", required: true, placeholder: "server_..." },
      { name: "runtimeKey", label: "Runtime key", required: true, placeholder: "server-bot-main" },
      { name: "name", label: "Display name", required: true, placeholder: "Server Bot Main" },
      { name: "minimumVersion", label: "Minimum version", required: true, placeholder: "1.0.0" },
      { name: "expiresAt", label: "Setup token expires at", required: true, placeholder: "2026-04-23T12:00:00.000Z" },
    ],
  },
  acknowledgeNotifications: {
    title: "Acknowledge notifications",
    description: "Acknowledges notification IDs from the real notifications endpoint.",
    submitLabel: "Acknowledge",
    fields: [
      { name: "ids", label: "Notification IDs", required: true, placeholder: "id-1, id-2" },
    ],
  },
  openSupportCase: {
    title: "Open tenant support case",
    description: "Opens the backend tenant support-case export bundle for escalation or handoff.",
    submitLabel: "Open Support Case",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "format", label: "Format", required: true, placeholder: "json", defaultValue: "json" },
    ],
  },
  exportSupport: {
    title: "Export support data",
    description: "Exports delivery lifecycle evidence; tenant ID is optional.",
    submitLabel: "Export Support",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: false, placeholder: "tenant_..." },
      { name: "limit", label: "Limit", required: false, placeholder: "120", defaultValue: "120" },
      { name: "format", label: "Format", required: true, placeholder: "json", defaultValue: "json" },
    ],
  },
  exportTenantDiagnostics: {
    title: "Export tenant diagnostics",
    description: "Exports a tenant-scoped diagnostics bundle.",
    submitLabel: "Export Diagnostics",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "limit", label: "Limit", required: false, placeholder: "25", defaultValue: "25" },
      { name: "format", label: "Format", required: true, placeholder: "json", defaultValue: "json" },
    ],
  },
  retryDeadLetter: {
    title: "Retry dead-letter",
    description: "Returns a dead-letter delivery job to the queue.",
    submitLabel: "Retry Job",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "code", label: "Purchase/job code", required: true, placeholder: "purchase-code" },
      { name: "guildId", label: "Guild ID", required: false, placeholder: "1234567890" },
    ],
  },
  clearDeadLetter: {
    title: "Clear dead-letter",
    description: "Deletes a dead-letter row after typed confirmation.",
    submitLabel: "Clear Job",
    danger: true,
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "code", label: "Purchase/job code", required: true, placeholder: "purchase-code" },
      { name: "confirmText", label: "Type CLEAR", required: true, placeholder: "CLEAR", defaultValue: "CLEAR" },
    ],
  },
  createRestorePoint: {
    title: "Create restore point",
    description: "Creates a backend restore point with an operator note and optional snapshot capture.",
    submitLabel: "Create Restore Point",
    fields: [
      { name: "note", label: "Operator note", required: false, placeholder: "Before package migration" },
      { name: "includeSnapshot", label: "Include snapshot", required: false, placeholder: "true", defaultValue: "true" },
    ],
  },
  confirmRestore: {
    title: "Confirm restore",
    description: "Runs restore only after backup, preview token, and typed confirmation are present.",
    submitLabel: "Confirm Restore",
    danger: true,
    fields: [
      { name: "backup", label: "Backup file", required: true, placeholder: "backup-2026-04-22.zip" },
      { name: "previewToken", label: "Preview token", required: true, placeholder: "token from restore preview" },
      { name: "confirmBackup", label: "Confirm backup file", required: true, placeholder: "same backup file" },
      { name: "confirmText", label: "Type RESTORE", required: true, placeholder: "RESTORE", defaultValue: "RESTORE" },
    ],
  },
  previewRestore: {
    title: "Preview restore",
    description: "Runs the backend restore dry-run and returns a preview token.",
    submitLabel: "Preview Restore",
    danger: true,
    fields: [
      { name: "backup", label: "Backup file", required: true, placeholder: "backup-2026-04-22.zip" },
    ],
  },
  restartOwnerRuntime: {
    title: "Restart owner runtime service",
    description: "Runs the mapped restart endpoint only after services and typed confirmation are present.",
    submitLabel: "Restart Service",
    danger: true,
    fields: [
      { name: "services", label: "Services", required: true, placeholder: "owner-web, admin-web" },
      { name: "confirmText", label: "Type RESTART", required: true, placeholder: "RESTART", defaultValue: "RESTART" },
    ],
  },
  updateControlPanelEnv: {
    title: "Save environment patch",
    description: "Sends a validated JSON patch to the old owner ENV endpoint.",
    submitLabel: "Save ENV",
    danger: true,
    fields: [
      { name: "patch", label: "Patch JSON", required: true, placeholder: "{\"ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS\":\"false\"}" },
      { name: "confirmText", label: "Type SAVE", required: true, placeholder: "SAVE", defaultValue: "SAVE" },
    ],
  },
  upsertAdminUser: {
    title: "Save admin user",
    description: "Creates or updates an owner/admin user through the old auth endpoint.",
    submitLabel: "Save User",
    danger: true,
    fields: [
      { name: "username", label: "Username", required: true, placeholder: "operator" },
      { name: "role", label: "Role", required: true, placeholder: "owner / operator" },
      { name: "password", label: "Password", required: false, placeholder: "Only when rotating password" },
      { name: "tenantId", label: "Tenant ID", required: false, placeholder: "tenant_..." },
      { name: "isActive", label: "Active", required: false, placeholder: "true", defaultValue: "true" },
    ],
  },
  createApiKey: {
    title: "Create API key",
    description: "Creates a platform API key and returns the raw value once.",
    submitLabel: "Create API Key",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "name", label: "Key name", required: true, placeholder: "Runtime provisioning key" },
      { name: "scopes", label: "Scopes", required: false, placeholder: "platform-api,runtime" },
    ],
  },
  createWebhook: {
    title: "Create webhook",
    description: "Registers a platform webhook endpoint.",
    submitLabel: "Create Webhook",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "url", label: "Webhook URL", required: true, placeholder: "https://example.com/webhook" },
      { name: "events", label: "Events", required: false, placeholder: "invoice.paid,delivery.failed" },
      { name: "secret", label: "Secret", required: false, placeholder: "optional secret" },
    ],
  },
  testWebhook: {
    title: "Test webhook",
    description: "Dispatches a test event through the backend webhook endpoint.",
    submitLabel: "Test Webhook",
    fields: [
      { name: "webhookId", label: "Webhook ID", required: true, placeholder: "webhook_..." },
      { name: "eventType", label: "Event type", required: false, placeholder: "owner.test", defaultValue: "owner.test" },
    ],
  },
  createMarketplaceOffer: {
    title: "Create marketplace offer",
    description: "Creates a tenant-facing marketplace offer.",
    submitLabel: "Create Offer",
    fields: [
      { name: "tenantId", label: "Tenant ID", required: true, placeholder: "tenant_..." },
      { name: "title", label: "Offer title", required: true, placeholder: "Premium support bundle" },
      { name: "status", label: "Status", required: false, placeholder: "draft", defaultValue: "draft" },
      { name: "meta", label: "Meta JSON", required: false, placeholder: "{\"price\":\"990\"}" },
    ],
  },
  runPlatformAutomation: {
    title: "Run platform automation",
    description: "Runs the shared platform automation cycle.",
    submitLabel: "Run Automation",
    fields: [
      { name: "force", label: "Force", required: false, placeholder: "true", defaultValue: "true" },
      { name: "dryRun", label: "Dry run", required: false, placeholder: "false", defaultValue: "false" },
    ],
  },
  previewPlatformAutomation: {
    title: "Preview platform automation",
    description: "Runs automation in dry-run mode.",
    submitLabel: "Preview Automation",
    fields: [
      { name: "force", label: "Force", required: false, placeholder: "true", defaultValue: "true" },
      { name: "dryRun", label: "Dry run", required: false, placeholder: "true", defaultValue: "true" },
    ],
  },
  revokeAdminSession: {
    title: "Revoke admin session",
    description: "Revokes one active owner/admin session after typed confirmation.",
    submitLabel: "Revoke Session",
    danger: true,
    fields: [
      { name: "sessionId", label: "Session ID", required: true, placeholder: "session_..." },
      { name: "reason", label: "Reason", required: false, placeholder: "owner-audit-revoke", defaultValue: "owner-audit-revoke" },
      { name: "confirmText", label: "Type REVOKE", required: true, placeholder: "REVOKE", defaultValue: "REVOKE" },
    ],
  },
};

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function parseCsv(value) {
  if (Array.isArray(value)) return value.filter((item) => !isBlank(item));
  if (isBlank(value)) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (isBlank(value)) return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  return String(value || "").trim().toLowerCase() === "true";
}

function parseNumber(value) {
  if (isBlank(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export function getActionForm(actionKey) {
  return OWNER_ACTION_FORMS[actionKey] || null;
}

export function getInitialActionValues(actionKey, preset = {}) {
  const form = getActionForm(actionKey);
  const values = {};
  if (!form) return values;

  for (const field of form.fields) {
    values[field.name] = preset[field.name] ?? field.defaultValue ?? "";
  }

  return values;
}

export function buildActionPayload(actionKey, values = {}) {
  const payload = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isBlank(value)) payload[key] = value;
  }

  if (actionKey === "acknowledgeNotifications") {
    payload.ids = parseCsv(values.ids);
  }

  if (["restartOwnerRuntime"].includes(actionKey)) {
    payload.services = parseCsv(values.services);
  }

  if (["createApiKey"].includes(actionKey)) {
    payload.scopes = parseCsv(values.scopes);
  }

  if (["createWebhook"].includes(actionKey)) {
    payload.events = parseCsv(values.events);
  }

  if (["updateControlPanelEnv"].includes(actionKey)) {
    payload.patch = parseJsonObject(values.patch);
  }

  if (["createMarketplaceOffer"].includes(actionKey)) {
    payload.meta = parseJsonObject(values.meta);
  }

  for (const key of ["amountCents", "position", "limit"]) {
    if (key in payload) payload[key] = parseNumber(payload[key]);
  }

  for (const key of ["includeSnapshot", "dryRun", "force", "isActive"]) {
    if (key in payload) payload[key] = parseBoolean(payload[key]);
  }

  if (actionKey === "confirmRestore" && payload.backup && !payload.confirmBackup) {
    payload.confirmBackup = payload.backup;
  }

  if (actionKey === "createRestorePoint" && "includeSnapshot" in payload) {
    payload.includeSnapshot = String(payload.includeSnapshot).toLowerCase() !== "false";
  }

  return payload;
}
