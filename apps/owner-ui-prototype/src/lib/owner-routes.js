export const OWNER_LOGIN_PATH = "/login";
export const OWNER_DASHBOARD_PATH = "/";
export const OWNER_DEFAULT_PAGE = "overview";

export const OWNER_PAGE_KEYS = [
  "overview",
  "tenants",
  "create-tenant",
  "tenant-dossier",
  "packages",
  "package-detail",
  "billing",
  "invoice-detail",
  "payment-attempt-detail",
  "subscriptions",
  "subscription-detail",
  "fleet",
  "fleet-diagnostics",
  "runtime-detail",
  "observability",
  "diagnostics-evidence",
  "incidents",
  "support",
  "support-context",
  "recovery",
  "backup-detail",
  "security",
  "access-posture",
  "settings",
  "platform-controls",
  "automation",
];

export const OWNER_PAGE_PATHS = Object.freeze(
  OWNER_PAGE_KEYS.reduce((paths, page) => ({
    ...paths,
    [page]: `/${page}`,
  }), {}),
);

export const OWNER_DETAIL_PAGE_PATHS = Object.freeze({
  "tenant-dossier": "/tenant-dossier",
  "package-detail": "/package-detail",
  "invoice-detail": "/billing/invoices",
  "payment-attempt-detail": "/billing/payment-attempts",
  "subscription-detail": "/billing/subscriptions",
  "runtime-detail": "/fleet/runtime",
  "diagnostics-evidence": "/observability/evidence",
  "support-context": "/support/cases",
  "backup-detail": "/recovery/backups",
  "access-posture": "/security/access",
});

export const OWNER_LEGACY_PAGE_ALIASES = Object.freeze({
  "/owner": "overview",
  "/owner/dashboard": "overview",
  "/owner/tenants": "tenants",
  "/owner/tenants/new": "create-tenant",
  "/owner/tenants/context": "tenant-dossier",
  "/owner/packages": "packages",
  "/owner/packages/create": "packages",
  "/owner/packages/entitlements": "packages",
  "/owner/subscriptions": "subscriptions",
  "/owner/subscriptions/registry": "subscriptions",
  "/owner/billing": "billing",
  "/owner/billing/recovery": "billing",
  "/owner/billing/attempts": "billing",
  "/owner/runtime": "fleet",
  "/owner/runtime/overview": "fleet",
  "/owner/runtime/create-server": "fleet",
  "/owner/runtime/provision-runtime": "fleet",
  "/owner/runtime/fleet-diagnostics": "fleet-diagnostics",
  "/owner/runtime/agents-bots": "runtime-detail",
  "/owner/analytics": "observability",
  "/owner/analytics/overview": "observability",
  "/owner/analytics/risk": "observability",
  "/owner/analytics/packages": "observability",
  "/owner/observability": "observability",
  "/owner/jobs": "observability",
  "/owner/automation": "automation",
  "/owner/incidents": "incidents",
  "/owner/support": "support",
  "/owner/support/context": "support-context",
  "/owner/recovery": "recovery",
  "/owner/recovery/overview": "recovery",
  "/owner/recovery/create": "recovery",
  "/owner/recovery/preview": "recovery",
  "/owner/recovery/restore": "recovery",
  "/owner/recovery/history": "recovery",
  "/owner/recovery/tenant-backup": "backup-detail",
  "/owner/audit": "security",
  "/owner/security": "security",
  "/owner/security/overview": "security",
  "/owner/access": "access-posture",
  "/owner/diagnostics": "diagnostics-evidence",
  "/owner/control": "platform-controls",
  "/owner/settings": "settings",
  "/owner/settings/overview": "settings",
  "/owner/settings/admin-users": "settings",
  "/owner/settings/services": "settings",
  "/owner/settings/access-policy": "settings",
  "/owner/settings/portal-policy": "settings",
  "/owner/settings/billing-policy": "settings",
  "/owner/settings/runtime-policy": "settings",
});

export const OWNER_LEGACY_DETAIL_PREFIXES = Object.freeze({
  "/owner/tenants": "tenant-dossier",
  "/owner/packages": "package-detail",
  "/owner/subscriptions": "subscription-detail",
  "/owner/billing/invoice": "invoice-detail",
  "/owner/billing/attempt": "payment-attempt-detail",
  "/owner/runtime/fleet-diagnostics": "fleet-diagnostics",
  "/owner/runtime/agents-bots": "runtime-detail",
  "/owner/support": "support-context",
  "/owner/recovery/tenant-backup": "backup-detail",
});

function normalizePath(pathname = OWNER_DASHBOARD_PATH) {
  return String(pathname || OWNER_DASHBOARD_PATH).replace(/\/+$/, "") || OWNER_DASHBOARD_PATH;
}

export function resolveOwnerPrototypeRoute(pathname = OWNER_DASHBOARD_PATH) {
  const normalized = normalizePath(pathname);
  if (normalized === OWNER_LOGIN_PATH || normalized === "/owner/login") return "login";
  return "dashboard";
}

export function resolveOwnerPageFromPath(pathname = OWNER_DASHBOARD_PATH) {
  return resolveOwnerRouteFromPath(pathname).page;
}

export function resolveOwnerRouteFromPath(pathname = OWNER_DASHBOARD_PATH) {
  const normalized = normalizePath(pathname);
  const legacyExactPage = OWNER_LEGACY_PAGE_ALIASES[normalized];
  if (legacyExactPage) return { page: legacyExactPage, recordId: "" };

  const legacyDetailMatch = Object.entries(OWNER_LEGACY_DETAIL_PREFIXES)
    .sort((left, right) => right[0].length - left[0].length)
    .find(([path]) => normalized.startsWith(`${path}/`));
  if (legacyDetailMatch) {
    const [path, page] = legacyDetailMatch;
    const recordId = decodeURIComponent(normalized.slice(path.length).replace(/^\/+/, ""));
    return { page, recordId: recordId || "" };
  }

  const detailMatch = Object.entries(OWNER_DETAIL_PAGE_PATHS)
    .find(([, path]) => normalized === path || normalized.startsWith(`${path}/`));
  if (detailMatch) {
    const [page, path] = detailMatch;
    const recordId = decodeURIComponent(normalized.slice(path.length).replace(/^\/+/, ""));
    return { page, recordId: recordId || "" };
  }

  const match = Object.entries(OWNER_PAGE_PATHS).find(([, path]) => path === normalized);
  return { page: match?.[0] || OWNER_DEFAULT_PAGE, recordId: "" };
}

export function buildOwnerPagePath(page = OWNER_DEFAULT_PAGE, recordId = "") {
  if (!recordId) return OWNER_PAGE_PATHS[page] || OWNER_PAGE_PATHS[OWNER_DEFAULT_PAGE];
  const basePath = OWNER_DETAIL_PAGE_PATHS[page] || OWNER_PAGE_PATHS[page];
  if (!basePath) return OWNER_PAGE_PATHS[OWNER_DEFAULT_PAGE];
  return `${basePath}/${encodeURIComponent(recordId)}`;
}
