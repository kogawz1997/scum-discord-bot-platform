import {
  REAL_OWNER_API_MAP,
  adaptBillingInvoices,
  adaptOverviewData,
  adaptPackages,
  adaptRuntimeFleet,
  adaptTenantRows,
  buildFallbackPageData,
  extractItems,
} from "./owner-adapters.js";

export { REAL_OWNER_API_MAP };

const SLICE_PATHS = {
  authSession: "/owner/api/me",
  authProviders: REAL_OWNER_API_MAP.auth.providers,
  overview: REAL_OWNER_API_MAP.overview.platform,
  dashboardCards: REAL_OWNER_API_MAP.overview.dashboardCards,
  commands: REAL_OWNER_API_MAP.overview.commands,
  tenants: REAL_OWNER_API_MAP.tenants.list,
  tenantStaff: REAL_OWNER_API_MAP.tenants.staff,
  tenantFeatureAccess: REAL_OWNER_API_MAP.tenants.featureAccess,
  tenantRoleMatrix: REAL_OWNER_API_MAP.tenants.roleMatrix,
  subscriptions: REAL_OWNER_API_MAP.subscriptions.list,
  packageCatalog: REAL_OWNER_API_MAP.packages.packages,
  licenses: REAL_OWNER_API_MAP.packages.licenses,
  platformFeatures: REAL_OWNER_API_MAP.packages.features,
  billingOverview: REAL_OWNER_API_MAP.billing.overview,
  invoices: REAL_OWNER_API_MAP.billing.invoices,
  paymentAttempts: REAL_OWNER_API_MAP.billing.attempts,
  agents: REAL_OWNER_API_MAP.fleet.agents,
  agentRuntimes: REAL_OWNER_API_MAP.fleet.agentRuntimes,
  registry: REAL_OWNER_API_MAP.fleet.registry,
  provisioning: REAL_OWNER_API_MAP.fleet.provisioning,
  devices: REAL_OWNER_API_MAP.fleet.devices,
  credentials: REAL_OWNER_API_MAP.fleet.credentials,
  sessions: REAL_OWNER_API_MAP.auth.sessions,
  securityEvents: REAL_OWNER_API_MAP.auth.securityEvents,
  roleMatrix: REAL_OWNER_API_MAP.security.roleMatrix,
  users: REAL_OWNER_API_MAP.security.users,
  rotationReport: REAL_OWNER_API_MAP.security.rotationReport,
  auditQuery: REAL_OWNER_API_MAP.security.auditQuery,
  runtimeSupervisor: REAL_OWNER_API_MAP.overview.runtimeSupervisor,
  observability: REAL_OWNER_API_MAP.overview.observability,
  observabilityErrors: REAL_OWNER_API_MAP.overview.observabilityErrors,
  deliveryCapabilities: REAL_OWNER_API_MAP.delivery.capabilities,
  deliveryQueue: REAL_OWNER_API_MAP.delivery.queue,
  deliveryRuntime: REAL_OWNER_API_MAP.delivery.runtime,
  deliveryStatuses: REAL_OWNER_API_MAP.delivery.statuses,
  deliveryLifecycle: REAL_OWNER_API_MAP.delivery.lifecycle,
  opsState: REAL_OWNER_API_MAP.overview.opsState,
  reconcile: REAL_OWNER_API_MAP.overview.reconcile,
  backupStatus: REAL_OWNER_API_MAP.backup.restoreStatus,
  backupHistory: REAL_OWNER_API_MAP.backup.restoreHistory,
  backupList: REAL_OWNER_API_MAP.backup.list,
  notifications: REAL_OWNER_API_MAP.notifications.list,
  controlPanelSettings: REAL_OWNER_API_MAP.overview.controlPanelSettings,
  tenantConfigs: REAL_OWNER_API_MAP.tenants.configs,
  tenantDiagnostics: REAL_OWNER_API_MAP.tenants.diagnostics,
  servers: REAL_OWNER_API_MAP.fleet.servers,
  serverDiscordLinks: REAL_OWNER_API_MAP.fleet.serverDiscordLinks,
  serverConfigJobs: REAL_OWNER_API_MAP.fleet.serverConfigJobs,
  serverConfigWorkspace: REAL_OWNER_API_MAP.fleet.serverConfigWorkspace,
  serverConfigBackups: REAL_OWNER_API_MAP.fleet.serverConfigBackups,
  agentSessions: REAL_OWNER_API_MAP.fleet.sessions,
  syncRuns: REAL_OWNER_API_MAP.fleet.syncRuns,
  syncEvents: REAL_OWNER_API_MAP.fleet.syncEvents,
  apiKeys: REAL_OWNER_API_MAP.integrations.apiKeys,
  webhooks: REAL_OWNER_API_MAP.integrations.webhooks,
  marketplace: REAL_OWNER_API_MAP.integrations.marketplace,
  restartPlans: REAL_OWNER_API_MAP.runtime.restartPlans,
  restartExecutions: REAL_OWNER_API_MAP.runtime.restartExecutions,
  shopList: REAL_OWNER_API_MAP.commerce.shopList,
  purchaseList: REAL_OWNER_API_MAP.commerce.purchaseList,
  purchaseStatuses: REAL_OWNER_API_MAP.commerce.purchaseStatuses,
  donationsOverview: REAL_OWNER_API_MAP.commerce.donationsOverview,
  modulesOverview: REAL_OWNER_API_MAP.commerce.modulesOverview,
  events: REAL_OWNER_API_MAP.commerce.events,
  raids: REAL_OWNER_API_MAP.commerce.raids,
  killfeed: REAL_OWNER_API_MAP.commerce.killfeed,
  playerAccounts: REAL_OWNER_API_MAP.commerce.playerAccounts,
  playerDashboard: REAL_OWNER_API_MAP.commerce.playerDashboard,
  playerIdentity: REAL_OWNER_API_MAP.commerce.playerIdentity,
};

const PAGE_SLICE_KEYS = {
  overview: [
    "overview",
    "dashboardCards",
    "tenants",
    "invoices",
    "paymentAttempts",
    "agents",
    "registry",
    "securityEvents",
    "runtimeSupervisor",
    "observability",
    "observabilityErrors",
    "deliveryLifecycle",
    "opsState",
    "reconcile",
    "notifications",
  ],
  tenants: [
    "tenants",
    "tenantStaff",
    "tenantFeatureAccess",
    "tenantRoleMatrix",
    "subscriptions",
    "invoices",
    "agents",
    "registry",
    "tenantConfigs",
    "tenantDiagnostics",
    "servers",
  ],
  packages: [
    "packageCatalog",
    "licenses",
    "platformFeatures",
    "subscriptions",
    "tenants",
  ],
  billing: [
    "billingOverview",
    "invoices",
    "paymentAttempts",
    "subscriptions",
    "tenants",
  ],
  subscriptions: [
    "subscriptions",
    "invoices",
    "paymentAttempts",
    "tenants",
    "licenses",
  ],
  fleet: [
    "agents",
    "agentRuntimes",
    "servers",
    "serverDiscordLinks",
    "registry",
    "provisioning",
    "devices",
    "credentials",
    "agentSessions",
    "syncRuns",
    "syncEvents",
    "serverConfigJobs",
    "serverConfigWorkspace",
    "serverConfigBackups",
  ],
  observability: [
    "observability",
    "observabilityErrors",
    "deliveryCapabilities",
    "deliveryQueue",
    "deliveryRuntime",
    "deliveryStatuses",
    "deliveryLifecycle",
    "opsState",
    "reconcile",
    "runtimeSupervisor",
    "syncRuns",
    "syncEvents",
  ],
  incidents: [
    "notifications",
    "securityEvents",
    "observabilityErrors",
    "deliveryLifecycle",
  ],
  support: [
    "tenants",
    "playerAccounts",
    "playerIdentity",
    "deliveryLifecycle",
    "deliveryQueue",
    "observabilityErrors",
    "notifications",
    "syncRuns",
    "purchaseList",
  ],
  recovery: [
    "backupStatus",
    "backupHistory",
    "backupList",
    "serverConfigBackups",
  ],
  security: [
    "securityEvents",
    "sessions",
    "authProviders",
    "users",
    "roleMatrix",
    "rotationReport",
    "auditQuery",
  ],
  settings: [
    "controlPanelSettings",
    "commands",
    "runtimeSupervisor",
    "apiKeys",
    "webhooks",
    "marketplace",
    "restartPlans",
    "restartExecutions",
    "tenantConfigs",
  ],
  automation: [
    "notifications",
    "opsState",
    "reconcile",
    "restartPlans",
    "restartExecutions",
  ],
  commerce: [
    "shopList",
    "purchaseList",
    "purchaseStatuses",
    "donationsOverview",
    "modulesOverview",
    "events",
    "raids",
    "killfeed",
    "playerAccounts",
    "playerDashboard",
  ],
};

const PAGE_DATA_PARENT = {
  "create-tenant": "tenants",
  "tenant-dossier": "tenants",
  "package-detail": "packages",
  "invoice-detail": "billing",
  "payment-attempt-detail": "billing",
  "subscription-detail": "subscriptions",
  "fleet-diagnostics": "fleet",
  "runtime-detail": "fleet",
  "diagnostics-evidence": "observability",
  "support-context": "support",
  "backup-detail": "recovery",
  "access-posture": "security",
  "platform-controls": "settings",
  automation: "automation",
};

function effectivePage(page) {
  return PAGE_SLICE_KEYS[page] ? page : PAGE_DATA_PARENT[page] || "overview";
}

function pageSliceKeys(page) {
  const parentPage = effectivePage(page);
  return Array.from(new Set([
    "authSession",
    ...(PAGE_SLICE_KEYS[parentPage] || PAGE_SLICE_KEYS.overview),
  ]));
}

async function fetchJson(path, fetchImpl = fetch) {
  const response = await fetchImpl(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText || "Request failed"} for ${path}`);
    error.status = response.status;
    error.path = path;
    throw error;
  }
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON for ${path}, received ${contentType || "unknown content type"}`);
  }
  return response.json();
}

async function readOptional(path, fetchImpl) {
  try {
    return { ok: true, data: await fetchJson(path, fetchImpl), path };
  } catch (error) {
    return { ok: false, error, path };
  }
}

async function loadSlices(fetchImpl, page) {
  const entries = pageSliceKeys(page).map((key) => [key, SLICE_PATHS[key]]).filter(([, path]) => Boolean(path));
  const results = await Promise.all(entries.map(async ([key, path]) => [key, await readOptional(path, fetchImpl)]));
  const slices = {};
  const errors = [];
  const endpointStatus = [];
  let okCount = 0;

  for (const [key, result] of results) {
    endpointStatus.push({
      key,
      path: result.path,
      ok: result.ok,
      status: result.ok ? 200 : result.error.status || 0,
      error: result.ok ? "" : result.error.message,
    });
    if (result.ok) {
      slices[key] = result.data;
      if (key !== "authSession") okCount += 1;
    } else {
      slices[key] = null;
      errors.push(`${key}: ${result.error.message}`);
    }
  }

  return { slices, errors, endpointStatus, okCount };
}

function buildCommonData(slices) {
  const tenants = extractItems(slices.tenants);
  const subscriptions = extractItems(slices.subscriptions);
  const invoices = extractItems(slices.invoices);
  const paymentAttempts = extractItems(slices.paymentAttempts);
  const agents = [
    ...extractItems(slices.agents),
    ...extractItems(slices.agentRuntimes),
    ...extractItems(slices.registry),
  ];
  const packages = extractItems(slices.licenses).length
    ? extractItems(slices.licenses)
    : extractItems(slices.packageCatalog).length
      ? extractItems(slices.packageCatalog)
      : extractItems(slices.overview?.packages || slices.overview?.packageCatalog);

  return {
    overview: adaptOverviewData({
      tenants,
      invoices,
      paymentAttempts,
      agents,
      securityEvents: extractItems(slices.securityEvents),
      deliveryLifecycle: slices.deliveryLifecycle || {},
    }),
    tenants: adaptTenantRows({ tenants, subscriptions, invoices, agents }),
    packages: adaptPackages(packages),
    invoices: adaptBillingInvoices(invoices),
    fleet: adaptRuntimeFleet(agents),
    raw: slices,
  };
}

function buildPageData(page, common) {
  const parentPage = effectivePage(page);
  if (parentPage === "tenants") return { tenants: common.tenants, raw: common.raw };
  if (parentPage === "packages") return { packages: common.packages, raw: common.raw };
  if (parentPage === "billing" || parentPage === "subscriptions") return { invoices: common.invoices, raw: common.raw };
  if (parentPage === "fleet") return { fleet: common.fleet, raw: common.raw };
  return { ...common.overview, raw: common.raw };
}

export async function fetchOwnerPageData(page, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const allowMockFallback = options.allowMockFallback === true;
  const { slices, errors, endpointStatus, okCount } = await loadSlices(fetchImpl, page);
  const common = buildCommonData(slices);

  if (!okCount) {
    if (allowMockFallback) {
      return {
        source: "mock",
        live: false,
        data: buildFallbackPageData(page),
        errors,
        endpointStatus,
      };
    }

    const authRequired = errors.some((error) => /\b401\b/.test(error));
    return {
      source: authRequired ? "auth-required" : "offline",
      live: false,
      data: buildPageData(page, common),
      errors,
      endpointStatus,
    };
  }

  const pageData = buildPageData(page, common);

  return {
    source: errors.length ? "backend-partial" : "backend",
    live: true,
    data: pageData,
    errors,
    endpointStatus,
  };
}

export function buildApiMap() {
  return REAL_OWNER_API_MAP;
}
