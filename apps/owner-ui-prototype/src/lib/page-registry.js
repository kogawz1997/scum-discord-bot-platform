/**
 * Page Registry - Central location for all page definitions
 * Each entry maps a page key to its metadata and requirements
 */

export const PAGE_REGISTRY = {
  // Core Management
  overview: {
    key: "overview",
    title: "Platform Overview",
    shortTitle: "Overview",
    description: "Monitor platform health and key metrics",
    isDetail: false,
    requiredSlices: [
      "overview",
      "tenants",
      "invoices",
      "agents",
      "servers",
      "packages",
      "events",
      "subscriptions",
      "billingOverview",
    ],
    allowedActions: ["refresh", "gotoTenants", "gotoFleet", "gotoIncidents"],
  },

  tenants: {
    key: "tenants",
    title: "Tenants",
    shortTitle: "Tenants",
    description: "Manage community servers",
    isDetail: false,
    requiredSlices: ["tenants", "subscriptions", "invoices", "agents", "registry", "tenantConfigs", "servers"],
    allowedActions: ["createTenant", "refresh", "exportBillingLedger"],
  },

  "create-tenant": {
    key: "create-tenant",
    title: "Create Tenant",
    shortTitle: "Create",
    description: "Add a new community server",
    isDetail: false,
    requiredSlices: ["tenants", "packages"],
    allowedActions: ["createTenant"],
    parentPage: "tenants",
  },

  "tenant-dossier": {
    key: "tenant-dossier",
    title: "Tenant Details",
    shortTitle: "Dossier",
    description: "View tenant configuration and status",
    isDetail: true,
    requiredSlices: [
      "tenants",
      "subscriptions",
      "invoices",
      "agents",
      "registry",
      "tenantConfigs",
      "servers",
      "events",
    ],
    allowedActions: ["editTenant", "runDiagnostics", "provisionDeliveryAgent", "provisionServerBot"],
    parentPage: "tenants",
  },

  // Commercial Plane
  packages: {
    key: "packages",
    title: "Packages",
    shortTitle: "Packages",
    description: "Manage pricing and features",
    isDetail: false,
    requiredSlices: ["packages", "tenants", "subscriptions"],
    allowedActions: ["createPackage", "refresh"],
  },

  "package-detail": {
    key: "package-detail",
    title: "Package Details",
    shortTitle: "Details",
    description: "Edit package configuration",
    isDetail: true,
    requiredSlices: ["packages", "tenants"],
    allowedActions: ["updatePackage", "deletePackage"],
    parentPage: "packages",
  },

  billing: {
    key: "billing",
    title: "Billing & Subscriptions",
    shortTitle: "Billing",
    description: "Monitor revenue and ledger",
    isDetail: false,
    requiredSlices: ["billingOverview", "invoices", "paymentAttempts", "subscriptions", "tenants"],
    allowedActions: ["exportBillingLedger", "createCheckoutSession", "refresh"],
  },

  "invoice-detail": {
    key: "invoice-detail",
    title: "Invoice Details",
    shortTitle: "Invoice",
    description: "View invoice information",
    isDetail: true,
    requiredSlices: ["invoices", "billingOverview", "tenants"],
    allowedActions: ["downloadInvoice"],
    parentPage: "billing",
  },

  "payment-attempt-detail": {
    key: "payment-attempt-detail",
    title: "Payment Attempt Details",
    shortTitle: "Payment",
    description: "View payment attempt details",
    isDetail: true,
    requiredSlices: ["paymentAttempts", "invoices"],
    allowedActions: ["retryPayment"],
    parentPage: "billing",
  },

  subscriptions: {
    key: "subscriptions",
    title: "Subscriptions",
    shortTitle: "Subscriptions",
    description: "Manage customer subscriptions",
    isDetail: false,
    requiredSlices: ["subscriptions", "tenants", "packages", "billingOverview"],
    allowedActions: ["createSubscription", "refresh"],
  },

  "subscription-detail": {
    key: "subscription-detail",
    title: "Subscription Details",
    shortTitle: "Details",
    description: "Manage subscription lifecycle",
    isDetail: true,
    requiredSlices: ["subscriptions", "tenants", "packages"],
    allowedActions: ["upgradeSubscription", "renewSubscription", "cancelSubscription"],
    parentPage: "subscriptions",
  },

  // Fleet & Runtime
  fleet: {
    key: "fleet",
    title: "Fleet Overview",
    shortTitle: "Fleet",
    description: "Monitor agents and server bots",
    isDetail: false,
    requiredSlices: [
      "agents",
      "servers",
      "registry",
      "provisioning",
      "devices",
      "agentCredentials",
      "sessions",
      "syncRuns",
    ],
    allowedActions: ["provisionDeliveryAgent", "provisionServerBot", "refresh", "runMonitoring"],
  },

  "fleet-diagnostics": {
    key: "fleet-diagnostics",
    title: "Fleet Diagnostics",
    shortTitle: "Diagnostics",
    description: "Run health checks on agents and bots",
    isDetail: false,
    requiredSlices: ["agents", "servers", "registry"],
    allowedActions: ["runDiagnostics"],
    parentPage: "fleet",
  },

  // Observability
  observability: {
    key: "observability",
    title: "Observability",
    shortTitle: "Observability",
    description: "View metrics and logs",
    isDetail: false,
    requiredSlices: ["observability", "requests", "events", "syncRuns"],
    allowedActions: ["exportObservability", "refresh"],
  },

  "diagnostics-evidence": {
    key: "diagnostics-evidence",
    title: "Diagnostic Evidence",
    shortTitle: "Evidence",
    description: "View detailed diagnostic information",
    isDetail: false,
    requiredSlices: ["observability", "requests", "events"],
    allowedActions: ["downloadDiagnostics"],
    parentPage: "observability",
  },

  // Incidents
  incidents: {
    key: "incidents",
    title: "Incidents & Alerts",
    shortTitle: "Incidents",
    description: "Monitor notifications and alerts",
    isDetail: false,
    requiredSlices: ["notifications", "events", "incidents"],
    allowedActions: ["acknowledgeNotifications", "refresh"],
  },

  // Support & Operations
  support: {
    key: "support",
    title: "Support Diagnostics",
    shortTitle: "Support",
    description: "Diagnostics and support tools",
    isDetail: false,
    requiredSlices: ["support", "requests", "events", "tenants"],
    allowedActions: ["openSupportCase", "exportSupport"],
  },

  "support-context": {
    key: "support-context",
    title: "Support Context",
    shortTitle: "Context",
    description: "View support context information",
    isDetail: false,
    requiredSlices: ["support", "tenants", "requests"],
    allowedActions: ["exportSupportContext"],
    parentPage: "support",
  },

  recovery: {
    key: "recovery",
    title: "Recovery & Backups",
    shortTitle: "Recovery",
    description: "Backup and restore readiness",
    isDetail: false,
    requiredSlices: ["recovery", "backups", "tenants"],
    allowedActions: ["createRestorePoint", "confirmRestore"],
  },

  "backup-detail": {
    key: "backup-detail",
    title: "Backup Details",
    shortTitle: "Backup",
    description: "View backup information",
    isDetail: true,
    requiredSlices: ["backups", "recovery"],
    allowedActions: ["restoreFromBackup"],
    parentPage: "recovery",
  },

  // Security & Compliance
  security: {
    key: "security",
    title: "Security & Audit",
    shortTitle: "Security",
    description: "Audit logs and security events",
    isDetail: false,
    requiredSlices: ["audit", "securityEvents", "sessions"],
    allowedActions: ["exportAudit", "revokeSession"],
  },

  "access-posture": {
    key: "access-posture",
    title: "Access Posture",
    shortTitle: "Access",
    description: "View access and permission status",
    isDetail: false,
    requiredSlices: ["audit", "sessions", "users"],
    allowedActions: ["updateAccessPolicy"],
    parentPage: "security",
  },

  // System
  settings: {
    key: "settings",
    title: "Settings",
    shortTitle: "Settings",
    description: "System configuration and integration",
    isDetail: false,
    requiredSlices: ["controlPanelSettings", "integrations"],
    allowedActions: ["updateSettings"],
  },

  "platform-controls": {
    key: "platform-controls",
    title: "Platform Controls",
    shortTitle: "Controls",
    description: "Low-level platform controls",
    isDetail: false,
    requiredSlices: ["controlPanelEnv", "controlPanelSettings"],
    allowedActions: ["updateControlPanelEnv", "restartOwnerRuntime"],
    requiresAdmin: true,
  },

  automation: {
    key: "automation",
    title: "Automation & Notifications",
    shortTitle: "Automation",
    description: "Setup automations and notification rules",
    isDetail: false,
    requiredSlices: ["automation", "notificationRules"],
    allowedActions: ["createAutomationRule", "updateNotificationRule"],
    requiresAdmin: true,
  },

  // Auth (not a normal page, but routes to login)
  login: {
    key: "login",
    title: "Owner Login",
    shortTitle: "Login",
    description: "Authenticate to owner surface",
    isDetail: false,
    requiredSlices: [],
    allowedActions: ["login"],
    skipLayout: true,
  },
};

/**
 * Get all page keys (sorted)
 */
export function getAllPageKeys() {
  return Object.keys(PAGE_REGISTRY).sort();
}

/**
 * Get main page keys (non-detail pages)
 */
export function getMainPageKeys() {
  return Object.values(PAGE_REGISTRY)
    .filter((page) => !page.isDetail)
    .map((page) => page.key)
    .sort();
}

/**
 * Get detail page keys
 */
export function getDetailPageKeys() {
  return Object.values(PAGE_REGISTRY)
    .filter((page) => page.isDetail)
    .map((page) => page.key)
    .sort();
}

/**
 * Get page by key
 */
export function getPageConfig(pageKey) {
  return PAGE_REGISTRY[pageKey];
}

/**
 * Check if page exists
 */
export function pageExists(pageKey) {
  return Boolean(PAGE_REGISTRY[pageKey]);
}
