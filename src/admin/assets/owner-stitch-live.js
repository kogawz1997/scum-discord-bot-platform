(function () {
  'use strict';

  const PLACEHOLDER_IMAGE = '/admin/assets/visuals/owner/network-placeholder.svg';
  const CONTROL_ROUTE_KEYS = new Set([
    'overview',
    'tenants',
    'tenant-create',
    'tenant-detail',
    'packages',
    'packages-create',
    'packages-entitlements',
    'subscriptions',
    'subscriptions-registry',
    'billing',
    'billing-recovery',
    'billing-attempts',
    'recovery',
    'recovery-create',
    'recovery-preview',
    'recovery-restore',
    'recovery-history',
    'runtime',
    'runtime-create-server',
    'runtime-provision-runtime',
    'agents-bots',
    'fleet-diagnostics',
    'incidents',
    'jobs',
    'analytics',
    'analytics-risk',
    'analytics-packages',
    'automation',
    'support',
    'audit',
    'security',
    'access',
    'diagnostics',
    'settings',
    'settings-admin-users',
    'settings-services',
    'settings-access-policy',
    'settings-portal-policy',
    'settings-billing-policy',
    'settings-runtime-policy',
    'control',
    'support-detail',
  ]);

  let renderTimer = null;
  let lastSignature = '';
  let recoveryAttempts = 0;
  let bootstrapPromise = null;
  const sectionFilterState = new Map();
  const CP1252_REVERSE_MAP = new Map([
    [0x20AC, 0x80],
    [0x201A, 0x82],
    [0x0192, 0x83],
    [0x201E, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02C6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8A],
    [0x2039, 0x8B],
    [0x0152, 0x8C],
    [0x017D, 0x8E],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201C, 0x93],
    [0x201D, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02DC, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9A],
    [0x203A, 0x9B],
    [0x0153, 0x9C],
    [0x017E, 0x9E],
    [0x0178, 0x9F],
  ]);

  function repairMojibakeText(value) {
    const text = String(value ?? '');
    if (!text || !/(\u00C3|\u00C2|\u00E0|\u00E2|\u00EF|\u00BF)/.test(text) || typeof TextDecoder !== 'function') return text;
    try {
      const bytes = Uint8Array.from(Array.from(text, (char) => {
        const codePoint = char.codePointAt(0);
        return CP1252_REVERSE_MAP.get(codePoint) ?? (codePoint & 0xff);
      }));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return text;
    }
  }

  function trimText(value, maxLen) {
    const text = repairMojibakeText(value).trim();
    if (!text) return '';
    if (Number.isFinite(maxLen) && maxLen > 0 && text.length > maxLen) {
      return `${text.slice(0, maxLen - 1)}…`;
    }
    return text;
  }

  function escapeHtml(value) {
    return repairMojibakeText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    const objectValue = asObject(value);
    if (Array.isArray(objectValue.items)) return objectValue.items;
    if (Array.isArray(objectValue.rows)) return objectValue.rows;
    if (Array.isArray(objectValue.list)) return objectValue.list;
    if (Array.isArray(objectValue.data)) return objectValue.data;
    return [];
  }

  function mergeArrays() {
    return Array.from(arguments).flatMap((value) => toArray(value)).filter(Boolean);
  }

  function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return 'No timestamp';
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  function formatNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat('en-US').format(numeric)
      : (fallback || '0');
  }

  function formatCurrency(value, currency) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: trimText(currency, 8).toUpperCase() || 'THB',
      maximumFractionDigits: 2,
    }).format(numeric / 100);
  }

  function normalizePath(value) {
    const raw = String(value || '/owner').split('?')[0].split('#')[0].trim();
    const path = raw.startsWith('/') ? raw : `/${raw}`;
    return path.replace(/\/+$/, '') || '/owner';
  }

  function currentPath() {
    return normalizePath(window.__OWNER_STITCH_ROUTE__ || window.location.pathname || '/owner');
  }

  function pathSegments(pathname) {
    return normalizePath(pathname).split('/').filter(Boolean);
  }

  function segmentAt(pathname, index) {
    const value = pathSegments(pathname)[index] || '';
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function snapshot() {
    return asObject(window.__OWNER_STITCH_STATE__);
  }

  function payload() {
    return asObject(snapshot().payload);
  }

  async function liveApi(path, fallback, options) {
    const settings = asObject(options);
    try {
      const response = await fetch(path, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      });
      const parsed = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign('/owner/login');
        return fallback;
      }
      if (!response.ok || parsed?.ok === false) {
        if (settings.allowFailure) return fallback;
        throw new Error(String(parsed?.error || `Owner API request failed (${response.status})`));
      }
      return parsed?.data ?? fallback;
    } catch (error) {
      if (settings.allowFailure) return fallback;
      throw error;
    }
  }

  function publishFallbackState(payloadValue) {
    const nextState = {
      payload: asObject(payloadValue),
      rawRoute: routeKeyFromPath(currentPath()),
      page: routeKeyFromPath(currentPath()),
      pathname: currentPath(),
      updatedAt: Date.now(),
    };
    window.__OWNER_STITCH_STATE__ = nextState;
    window.dispatchEvent(new CustomEvent('owner-state-updated', { detail: nextState }));
    return nextState;
  }

  async function bootstrapFallbackStateFromApi() {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
    const me = await liveApi('/owner/api/me', null);
    if (asObject(me).tenantId) {
      window.location.assign('/tenant');
      return null;
    }
    const [
      overview,
      tenants,
      subscriptions,
      licenses,
      billingOverview,
      billingInvoices,
      billingPaymentAttempts,
      controlPanelSettings,
      agents,
      securityEvents,
      requestLogs,
      deliveryLifecycle,
      restoreState,
      restoreHistory,
      backupFiles,
    ] = await Promise.all([
      liveApi('/owner/api/platform/overview', {}, { allowFailure: true }),
      liveApi('/owner/api/platform/tenants?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/platform/subscriptions?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/platform/licenses?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/platform/billing/overview', { provider: null, summary: {} }, { allowFailure: true }),
      liveApi('/owner/api/platform/billing/invoices?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/platform/billing/payment-attempts?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/control-panel/settings', {}, { allowFailure: true }),
      liveApi('/owner/api/platform/agents?limit=50', [], { allowFailure: true }),
      liveApi('/owner/api/auth/security-events?limit=20', [], { allowFailure: true }),
      liveApi('/owner/api/observability/requests?limit=20&onlyErrors=true', { metrics: {}, items: [] }, { allowFailure: true }),
      liveApi('/owner/api/delivery/lifecycle?limit=80&pendingOverdueMs=1200000', {}, { allowFailure: true }),
      liveApi('/admin/api/backup/restore/status', {}, { allowFailure: true }),
      liveApi('/admin/api/backup/restore/history?limit=12', [], { allowFailure: true }),
      liveApi('/admin/api/backup/list', [], { allowFailure: true }),
    ]);
    return publishFallbackState({
      me,
      overview,
      tenants,
      subscriptions,
      licenses,
      billingOverview,
      billingInvoices,
      billingPaymentAttempts,
      controlPanelSettings,
      agents,
      agentRegistry: [],
      agentProvisioning: [],
      agentDevices: [],
      agentCredentials: [],
      sessions: [],
      notifications: [],
      securityEvents,
      runtimeSupervisor: null,
      requestLogs,
      deliveryLifecycle,
      restoreState,
      restoreHistory,
      backupFiles,
      tenantQuotaSnapshots: [],
      ownerUi: {},
      __loadWarnings: [],
    });
    })();
    try {
      return await bootstrapPromise;
    } finally {
      bootstrapPromise = null;
    }
  }

  function ownerUiState(currentSnapshot) {
    return asObject((currentSnapshot || snapshot()).payload?.ownerUi);
  }

  function routeKeyFromPath(pathname) {
    const path = normalizePath(pathname);
    const parts = pathSegments(path);
    if (path === '/owner' || path === '/owner/dashboard') return 'overview';
    if (path === '/owner/tenants') return 'tenants';
    if (path === '/owner/tenants/new') return 'tenant-create';
    if (parts[0] === 'owner' && parts[1] === 'tenants' && parts[2]) return 'tenant-detail';
    if (path === '/owner/packages') return 'packages';
    if (path === '/owner/packages/create') return 'packages-create';
    if (path === '/owner/packages/entitlements') return 'packages-entitlements';
    if (parts[0] === 'owner' && parts[1] === 'packages' && parts[2]) return 'package-detail';
    if (path === '/owner/subscriptions') return 'subscriptions';
    if (path === '/owner/subscriptions/registry') return 'subscriptions-registry';
    if (parts[0] === 'owner' && parts[1] === 'subscriptions' && parts[2]) return 'subscription-detail';
    if (path === '/owner/billing') return 'billing';
    if (path === '/owner/billing/recovery') return 'billing-recovery';
    if (path === '/owner/billing/attempts') return 'billing-attempts';
    if (path === '/owner/billing/invoice') return 'invoice-detail';
    if (parts[0] === 'owner' && parts[1] === 'billing' && parts[2] === 'invoice' && parts[3]) return 'invoice-detail';
    if (path === '/owner/billing/attempt') return 'attempt-detail';
    if (parts[0] === 'owner' && parts[1] === 'billing' && parts[2] === 'attempt' && parts[3]) return 'attempt-detail';
    if (path === '/owner/runtime' || path === '/owner/runtime/overview') return 'runtime';
    if (path === '/owner/runtime/create-server') return 'runtime-create-server';
    if (path === '/owner/runtime/provision-runtime') return 'runtime-provision-runtime';
    if (path === '/owner/runtime/agents-bots') return 'agents-bots';
    if (path === '/owner/runtime/fleet-diagnostics') return 'fleet-diagnostics';
    if (path === '/owner/incidents') return 'incidents';
    if (path === '/owner/jobs') return 'jobs';
    if (path === '/owner/analytics' || path === '/owner/analytics/overview' || path === '/owner/observability') return 'analytics';
    if (path === '/owner/analytics/risk') return 'analytics-risk';
    if (path === '/owner/analytics/packages') return 'analytics-packages';
    if (path === '/owner/automation') return 'automation';
    if (path === '/owner/support') return 'support';
    if (parts[0] === 'owner' && parts[1] === 'support' && parts[2]) return 'support-detail';
    if (path === '/owner/audit') return 'audit';
    if (path === '/owner/security' || path === '/owner/security/overview') return 'security';
    if (path === '/owner/access') return 'access';
    if (path === '/owner/diagnostics') return 'diagnostics';
    if (path === '/owner/settings' || path === '/owner/settings/overview') return 'settings';
    if (path === '/owner/settings/admin-users') return 'settings-admin-users';
    if (path === '/owner/settings/services') return 'settings-services';
    if (path === '/owner/settings/access-policy') return 'settings-access-policy';
    if (path === '/owner/settings/portal-policy') return 'settings-portal-policy';
    if (path === '/owner/settings/billing-policy') return 'settings-billing-policy';
    if (path === '/owner/settings/runtime-policy') return 'settings-runtime-policy';
    if (path === '/owner/control') return 'control';
    if (path === '/owner/recovery' || path === '/owner/recovery/overview') return 'recovery';
    if (path === '/owner/recovery/create') return 'recovery-create';
    if (path === '/owner/recovery/preview') return 'recovery-preview';
    if (path === '/owner/recovery/restore') return 'recovery-restore';
    if (path === '/owner/recovery/history') return 'recovery-history';
    if (parts[0] === 'owner' && parts[1] === 'recovery' && parts[2] === 'tenant-backup' && parts[3]) return 'backup-detail';
    return 'overview';
  }

  function controlRouteForPath(pathname, routeKey) {
    if (routeKey === 'overview') return 'overview';
    if (routeKey === 'tenants') return 'tenants';
    if (routeKey === 'tenant-create') return 'create-tenant';
    if (routeKey === 'tenant-detail') return `tenant-${segmentAt(pathname, 2)}`;
    if (routeKey === 'packages') return 'packages';
    if (routeKey === 'packages-create') return 'packages-create';
    if (routeKey === 'packages-entitlements') return 'packages-entitlements';
    if (routeKey === 'package-detail') return 'packages';
    if (routeKey === 'subscriptions') return 'subscriptions';
    if (routeKey === 'subscriptions-registry') return 'subscriptions-registry';
    if (routeKey === 'subscription-detail') return 'subscriptions-registry';
    if (routeKey === 'billing') return 'billing';
    if (routeKey === 'billing-recovery') return 'billing-recovery';
    if (routeKey === 'billing-attempts') return 'billing-attempts';
    if (routeKey === 'invoice-detail') return 'billing';
    if (routeKey === 'attempt-detail') return 'billing-attempts';
    if (routeKey === 'recovery' || routeKey === 'recovery-create' || routeKey === 'recovery-preview' || routeKey === 'recovery-restore' || routeKey === 'recovery-history') return routeKey;
    if (routeKey === 'runtime' || routeKey === 'runtime-create-server' || routeKey === 'runtime-provision-runtime' || routeKey === 'incidents' || routeKey === 'jobs' || routeKey === 'support') return routeKey;
    if (routeKey === 'agents-bots' || routeKey === 'fleet-diagnostics') return routeKey;
    if (routeKey === 'analytics' || routeKey === 'analytics-risk' || routeKey === 'analytics-packages') return routeKey;
    if (routeKey === 'automation') return 'automation';
    if (routeKey === 'audit' || routeKey === 'security' || routeKey === 'access' || routeKey === 'diagnostics') return routeKey;
    if (
      routeKey === 'settings'
      || routeKey === 'settings-admin-users'
      || routeKey === 'settings-services'
      || routeKey === 'settings-access-policy'
      || routeKey === 'settings-portal-policy'
      || routeKey === 'settings-billing-policy'
      || routeKey === 'settings-runtime-policy'
      || routeKey === 'control'
    ) return routeKey;
    if (routeKey === 'support-detail') return `support-${segmentAt(pathname, 2)}`;
    return 'overview';
  }

  function usesRecoveryWorkspace(routeKey) {
    return routeKey === 'backup-detail';
  }

  function routeMeta(pathname, routeKey) {
    const metaByRoute = {
      overview: { title: 'Platform overview', subtitle: 'Operational summary from the live Owner backend.' },
      tenants: { title: 'Tenant management', subtitle: 'Current tenant list, package assignment, billing posture, and support state.' },
      'tenant-create': { title: 'Create tenant', subtitle: 'Provision a new customer using the current Owner backend flow.' },
      'tenant-detail': { title: `Tenant dossier: ${segmentAt(pathname, 2)}`, subtitle: 'Tenant commercial, runtime, and support detail.' },
      packages: { title: 'Package management', subtitle: 'Live package catalog, feature mapping, and current adoption.' },
      'packages-create': { title: 'Create package', subtitle: 'Create a package without mixing the catalog or entitlement matrix.' },
      'packages-entitlements': { title: 'Package entitlements', subtitle: 'Review the feature entitlement matrix separately from package creation.' },
      'package-detail': { title: `Package detail: ${segmentAt(pathname, 2)}`, subtitle: 'Package metadata, entitlement coverage, and tenant usage.' },
      subscriptions: { title: 'Subscriptions', subtitle: 'Subscription lifecycle, renewals, invoices, and customer posture.' },
      'subscriptions-registry': { title: 'Subscription registry', subtitle: 'Review subscription records without mixing billing recovery work.' },
      'subscription-detail': { title: `Subscription detail: ${segmentAt(pathname, 2)}`, subtitle: 'Subscription, invoice, and payment attempt evidence.' },
      billing: { title: 'Billing overview', subtitle: 'Revenue, invoices, payment attempts, and commercial risk.' },
      'billing-recovery': { title: 'Billing recovery', subtitle: 'Resolve overdue invoices and failed payment attempts without mixing invoice registry work.' },
      'billing-attempts': { title: 'Payment attempts', subtitle: 'Inspect payment attempt outcomes separately from the invoice registry.' },
      'invoice-detail': { title: `Invoice detail: ${segmentAt(pathname, 3)}`, subtitle: 'Invoice context linked to real billing records.' },
      'attempt-detail': { title: `Payment attempt: ${segmentAt(pathname, 3)}`, subtitle: 'Payment attempt detail and invoice linkage.' },
      runtime: { title: 'Runtime overview', subtitle: 'Current Delivery Agent and Server Bot posture, queue state, and runtime readiness.' },
      'runtime-create-server': { title: 'Create server record', subtitle: 'Register the control-plane server before issuing runtime credentials.' },
      'runtime-provision-runtime': { title: 'Provision runtime', subtitle: 'Issue one-time setup tokens from a dedicated runtime provisioning page.' },
      'agents-bots': { title: 'Runtime registry', subtitle: 'Registered Delivery Agents and Server Bots, their bindings, and operational state.' },
      'fleet-diagnostics': { title: 'Runtime diagnostics', subtitle: 'Runtime readiness, version drift, and binding gaps.' },
      incidents: { title: 'Incidents and alerts', subtitle: 'Operational signals, alerts, and recent escalations from live inputs.' },
      jobs: { title: 'Job queue', subtitle: 'Restart, retry, and background queue posture separated from runtime provisioning.' },
      analytics: { title: 'Analytics overview', subtitle: 'Operational and commercial signals pulled from Owner telemetry.' },
      'analytics-risk': { title: 'Risk queue', subtitle: 'Review owner risk signals without mixing top-line analytics or package usage.' },
      'analytics-packages': { title: 'Package usage', subtitle: 'Inspect package adoption separately from risk and summary metrics.' },
      automation: { title: 'Automation', subtitle: 'Scheduled work and notification automation from current backend state.' },
      support: { title: 'Support queue', subtitle: 'Current support cases, dead letters, and customer operations follow-up.' },
      'support-detail': { title: `Support detail: ${segmentAt(pathname, 2)}`, subtitle: 'Support case context for the selected tenant.' },
      audit: { title: 'Audit log', subtitle: 'Current audit and operator evidence for the Owner control plane.' },
      security: { title: 'Security overview', subtitle: 'Security posture, sessions, and suspicious activity signals.' },
      access: { title: 'Access posture', subtitle: 'Session and access posture for the Owner backend.' },
      diagnostics: { title: 'Diagnostics and evidence', subtitle: 'System diagnostics, exports, and request troubleshooting.' },
      settings: { title: 'Settings overview', subtitle: 'Operational settings currently wired into the Owner backend.' },
      'settings-admin-users': { title: 'Admin users', subtitle: 'Manage Owner-panel administrators separately from platform policy.' },
      'settings-services': { title: 'Managed services', subtitle: 'Review shared managed services without mixing policy or automation.' },
      'settings-access-policy': { title: 'Access policy', subtitle: 'Adjust owner access, session, and security policy without mixing portal or billing settings.' },
      'settings-portal-policy': { title: 'Portal policy', subtitle: 'Review player-portal policy separately from owner access or runtime settings.' },
      'settings-billing-policy': { title: 'Billing policy', subtitle: 'Configure provider and billing behavior without mixing unrelated platform controls.' },
      'settings-runtime-policy': { title: 'Runtime policy', subtitle: 'Review orchestration and runtime service policy separately from other owner settings.' },
      control: { title: 'Platform controls', subtitle: 'Critical platform actions and guarded control flows.' },
      recovery: { title: 'Recovery overview', subtitle: 'Backups, restore posture, and recovery tooling.' },
      'recovery-create': { title: 'Create backup', subtitle: 'Create a platform backup without mixing preview or restore actions.' },
      'recovery-preview': { title: 'Restore preview', subtitle: 'Validate a restore preview before running a guarded restore.' },
      'recovery-restore': { title: 'Apply restore', subtitle: 'Apply a guarded restore with only the required recovery controls visible.' },
      'recovery-history': { title: 'Recovery history', subtitle: 'Review recovery history separately from current restore actions.' },
      'backup-detail': { title: `Backup detail: ${segmentAt(pathname, 3)}`, subtitle: 'Selected backup file, restore posture, and evidence.' },
    };
    return {
      ...(metaByRoute[routeKey] || metaByRoute.overview),
      routeKey,
    };
  }

  function gatherCollections(source, currentOwnerUi) {
    const state = asObject(source);
    const overview = asObject(state.overview);
    const restorePreview = asObject(currentOwnerUi.restorePreview);
    const automationPreview = asObject(currentOwnerUi.automationPreview);
    return {
      tenants: mergeArrays(state.tenants, state.tenantRows, state.customers, overview.tenants, overview.customers),
      packages: mergeArrays(state.packages, state.packageCatalog, overview.packages),
      features: mergeArrays(state.features, overview.features),
      subscriptions: mergeArrays(state.subscriptions, state.billingSubscriptions, overview.subscriptions),
      invoices: mergeArrays(state.billingInvoices, state.invoices),
      attempts: mergeArrays(state.billingPaymentAttempts, state.paymentAttempts),
      runtime: mergeArrays(state.runtimes, state.runtimeRows, state.agentPresence, state.deliveryAgents, state.serverBots, state.services),
      incidents: mergeArrays(state.incidents, state.alerts, state.notifications, state.events),
      jobs: mergeArrays(state.jobs, state.deliveryJobs, automationPreview.jobs, automationPreview.items),
      supportCases: mergeArrays(state.supportCases, state.supportQueue, currentOwnerUi.supportCase ? [currentOwnerUi.supportCase] : []),
      deadLetters: mergeArrays(currentOwnerUi.supportDeadLetters, state.deadLetters),
      backups: mergeArrays(restorePreview.files, restorePreview.backups, state.backups),
      automation: mergeArrays(automationPreview.rules, automationPreview.automations, state.automation),
      auditEvents: mergeArrays(state.auditEvents, state.auditLog, state.securityEvents),
    };
  }

  function uniqueById(rows, keys) {
    const seen = new Set();
    return rows.filter((row) => {
      const record = asObject(row);
      const id = keys.map((key) => trimText(record[key], 160)).find(Boolean);
      const signature = id || JSON.stringify(record);
      if (!signature || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function createSurfaceRoot() {
    const main = document.querySelector('main[data-owner-chrome="workspace"], main[data-owner-stitched="true"]');
    if (!main) return null;
    let surface = document.getElementById('ownerStitchSurface');
    if (!surface) {
      surface = document.createElement('div');
      surface.id = 'ownerStitchSurface';
      main.insertBefore(surface, main.firstChild || null);
    }
    let header = document.getElementById('ownerStitchRouteHeader');
    if (!header) {
      header = document.createElement('section');
      header.id = 'ownerStitchRouteHeader';
      surface.appendChild(header);
    }
    header.classList.add('owner-live-route-header');
    header.setAttribute('data-owner-layout', 'page-header');
    let liveData = document.getElementById('ownerStitchLiveData');
    if (!liveData) {
      liveData = document.createElement('div');
      liveData.id = 'ownerStitchLiveData';
      surface.appendChild(liveData);
    }
    liveData.style.display = 'block';
    liveData.style.visibility = 'visible';
    liveData.style.opacity = '1';
    liveData.style.minHeight = '240px';
    if (!String(liveData.innerHTML || '').trim()) {
      liveData.innerHTML = `
        <section class="owner-live-panel owner-live-empty" data-owner-section="panel" data-owner-section-label="Loading">
          <strong>Loading owner data</strong>
          <div class="owner-live-note">Refreshing live Owner data from the backend.</div>
        </section>
      `;
    }
    return { main, surface, header, liveData };
  }

  function publishExistingServerRender(root) {
    const currentRoot = root || createSurfaceRoot();
    if (!currentRoot?.liveData || !currentRoot?.header) return false;
    if (currentRoot.liveData.getAttribute('data-owner-server-rendered') !== 'true') return false;
    if (!hasRenderableContent(currentRoot)) return false;
    const pathname = currentPath();
    const route = routeKeyFromPath(pathname);
    const meta = routeMeta(pathname, route);
    applyRouteSurfacePresentation(currentRoot, route);
    if (!trimText(currentRoot.header.innerHTML || '', 4000)) {
      currentRoot.header.innerHTML = buildRouteHeaderMarkup(
        meta,
        CONTROL_ROUTE_KEYS.has(route)
          ? actionForControlRoute(pathname, route)
          : { label: 'Back to overview', href: '/owner', tone: 'default' },
      );
    }
    const sections = mountSectionSwitcher(currentRoot.liveData, route);
    window.__OWNER_STITCH_SERVER_RENDER_SNAPSHOT__ = {
      header: currentRoot.header.innerHTML,
      liveData: currentRoot.liveData.innerHTML,
    };
    window.dispatchEvent(new CustomEvent('owner-live-rendered', {
      detail: {
        route,
        rawRoute: trimText(snapshot().rawRoute || '', 160),
        pathname,
        sections,
      },
    }));
    return true;
  }

  function restoreServerRenderSnapshot() {
    const snapshotValue = asObject(window.__OWNER_STITCH_SERVER_RENDER_SNAPSHOT__);
    if (!trimText(snapshotValue.liveData || '', 4000)) return false;
    const root = createSurfaceRoot();
    if (!root?.liveData || !root?.header) return false;
    root.header.innerHTML = String(snapshotValue.header || '');
    root.liveData.innerHTML = String(snapshotValue.liveData || '');
    root.liveData.setAttribute('data-owner-server-rendered', 'true');
    root.liveData.hidden = false;
    root.liveData.style.display = 'block';
    root.liveData.style.visibility = 'visible';
    root.liveData.style.opacity = '1';
    const pathname = currentPath();
    const route = routeKeyFromPath(pathname);
    applyRouteSurfacePresentation(root, route);
    const sections = mountSectionSwitcher(root.liveData, route);
    window.dispatchEvent(new CustomEvent('owner-live-rendered', {
      detail: {
        route,
        rawRoute: trimText(snapshot().rawRoute || '', 160),
        pathname,
        sections,
      },
    }));
    return true;
  }

  function hasRenderableContent(root) {
    const liveRoot = root?.liveData || createSurfaceRoot()?.liveData;
    if (!liveRoot) return false;
    const textLength = trimText(liveRoot.innerText || '', 4000).length;
    if (textLength < 40) return false;
    const style = window.getComputedStyle(liveRoot);
    const rect = liveRoot.getBoundingClientRect();
    const child = liveRoot.firstElementChild;
    const childRect = child?.getBoundingClientRect?.() || { width: 0, height: 0 };
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0.05
      && rect.width >= 120
      && rect.height >= 80
      && (!child || childRect.height >= 40 || trimText(child.innerText || '', 4000).length >= 40);
  }

  function routeVisualPresentation(routeKey) {
    const key = trimText(routeKey, 80).toLowerCase();
    if (['recovery', 'recovery-create', 'recovery-preview', 'recovery-restore', 'recovery-history', 'backup-detail'].includes(key)) {
      return {
        visual: 'recovery',
        eyebrow: 'Recovery workspace',
        badges: ['Backups', 'Preview guard', 'Restore history'],
        focus: 'Keep backup creation, preview validation, and restore execution visibly separated.',
        highlights: ['Backup create', 'Preview guard', 'Restore apply'],
      };
    }
    if ([
      'packages',
      'packages-create',
      'packages-entitlements',
      'package-detail',
      'subscriptions',
      'subscriptions-registry',
      'subscription-detail',
      'billing',
      'billing-recovery',
      'billing-attempts',
      'invoice-detail',
      'attempt-detail',
    ].includes(key)) {
      return {
        visual: 'commerce',
        eyebrow: 'Commercial operations',
        badges: ['Packages', 'Subscriptions', 'Billing'],
        focus: 'Work catalog, renewals, and billing recovery as separate tracks instead of one long page.',
        highlights: ['Catalog control', 'Renewal queue', 'Invoice recovery'],
      };
    }
    if ([
      'runtime',
      'agents-bots',
      'fleet-diagnostics',
      'incidents',
      'jobs',
      'support',
      'support-detail',
    ].includes(key)) {
      return {
        visual: 'runtime',
        eyebrow: 'Runtime orchestration',
        badges: ['Delivery Agent', 'Server Bot', 'Operations'],
        focus: 'Handle server registration, setup token issue, and runtime review as distinct operator steps.',
        highlights: ['Server record', 'Token issue', 'Registry review'],
      };
    }
    if (['analytics', 'analytics-risk', 'analytics-packages', 'automation'].includes(key)) {
      return {
        visual: 'analytics',
        eyebrow: 'Operational telemetry',
        badges: ['Signals', 'Automation', 'Trend watch'],
        focus: 'Keep telemetry, scheduled actions, and operator escalations readable without mixing workflows.',
        highlights: ['Signals', 'Automation runs', 'Escalation queue'],
      };
    }
    if ([
      'audit',
      'security',
      'access',
      'diagnostics',
      'settings',
      'settings-admin-users',
      'settings-services',
      'settings-access-policy',
      'settings-portal-policy',
      'settings-billing-policy',
      'settings-runtime-policy',
      'control',
    ].includes(key)) {
      return {
        visual: 'governance',
        eyebrow: 'Governance and security',
        badges: ['Access', 'Security', 'Diagnostics'],
        focus: 'Separate audit evidence, access review, and platform policy so each control surface stays precise.',
        highlights: ['Audit evidence', 'Access review', 'Policy controls'],
      };
    }
    return {
      visual: 'overview',
      eyebrow: 'Owner command center',
      badges: ['Tenants', 'Revenue', 'Runtime watch'],
      focus: 'Scan commercial risk, tenant posture, and runtime health before drilling into a focused workspace.',
      highlights: ['Priority queue', 'Revenue posture', 'Runtime watch'],
    };
  }

  function applyRouteSurfacePresentation(root, routeKey) {
    const currentRoot = root || createSurfaceRoot();
    const presentation = routeVisualPresentation(routeKey);
    if (!currentRoot) return presentation;
    if (currentRoot.surface) {
      currentRoot.surface.setAttribute('data-owner-route-key', routeKey);
      currentRoot.surface.setAttribute('data-owner-route-visual', presentation.visual);
    }
    if (currentRoot.header) {
      currentRoot.header.classList.add('owner-live-route-header');
      currentRoot.header.setAttribute('data-owner-layout', 'page-header');
      currentRoot.header.setAttribute('data-owner-route-key', routeKey);
      currentRoot.header.setAttribute('data-owner-route-visual', presentation.visual);
    }
    return presentation;
  }

  function buildRouteHeaderMarkup(meta, action) {
    const presentation = routeVisualPresentation(meta.routeKey);
    const actionMarkup = action && action.href
      ? `<a href="${escapeHtml(action.href)}" data-owner-ui="action" data-owner-tone="${escapeHtml(action.tone || 'primary')}"${action.localFocus ? ' data-owner-local-focus="true"' : ''}>${escapeHtml(action.label || 'Open')}</a>`
      : '';
    const badgeMarkup = presentation.badges
      .map((label) => `<span class="owner-live-route-badge">${escapeHtml(label)}</span>`)
      .join('');
    const highlightMarkup = Array.isArray(presentation.highlights)
      ? presentation.highlights.map((label) => `<span class="owner-live-route-highlight">${escapeHtml(label)}</span>`).join('')
      : '';
    return `
      <div class="owner-live-route-copy">
        <div class="owner-live-route-topline">
          <span class="owner-live-route-eyebrow">${escapeHtml(presentation.eyebrow)}</span>
          <div class="owner-live-route-badges">${badgeMarkup}</div>
        </div>
        <div class="owner-live-route-heading">
          <h1 data-owner-role="page-heading">${escapeHtml(meta.title)}</h1>
          <p data-owner-role="page-subtitle">${escapeHtml(meta.subtitle)}</p>
        </div>
        <div class="owner-live-route-brief">
          <p class="owner-live-route-focus">${escapeHtml(presentation.focus || '')}</p>
          <div class="owner-live-route-highlights">${highlightMarkup}</div>
        </div>
      </div>
      <div class="owner-live-route-side">
        <div class="owner-live-route-media" aria-hidden="true">
          <span class="owner-live-route-media-glow"></span>
          <span class="owner-live-route-media-image"></span>
          <span class="owner-live-route-media-orbit owner-live-route-media-orbit-a"></span>
          <span class="owner-live-route-media-orbit owner-live-route-media-orbit-b"></span>
        </div>
        <div class="owner-live-route-actions" data-owner-layout="page-actions">${actionMarkup}</div>
      </div>
    `;
  }

  function wrapOwnerRouteShell(routeKey, bodyHtml) {
    return [
      `<div class="owner-live-route-shell" data-owner-route-key="${escapeHtml(trimText(routeKey, 80).toLowerCase() || 'overview')}">`,
      `<div class="owner-live-route-content">${bodyHtml || ''}</div>`,
      '</div>',
    ].join('');
  }

  function emptyStateMarkup(title, detail) {
    return `
      <section class="owner-live-panel owner-live-empty" data-owner-section="panel" data-owner-section-label="${escapeHtml(title)}">
        <strong>${escapeHtml(title)}</strong>
        <div class="owner-live-note">${escapeHtml(detail || 'No live data is available for this route yet.')}</div>
      </section>
    `;
  }

  function recoveryErrorMarkup(meta) {
    return `
      <section class="owner-live-panel owner-live-empty" data-owner-section="panel" data-owner-section-label="${escapeHtml(meta?.title || 'Owner data unavailable')}">
        <strong>${escapeHtml(meta?.title || 'Owner data unavailable')}</strong>
        <div class="owner-live-note">Live Owner data did not load in time. Refresh this page or sign in again.</div>
        <div class="owner-live-route-actions" data-owner-layout="page-actions">
          <a href="${escapeHtml(currentPath())}" data-owner-ui="action" data-owner-tone="primary">Refresh page</a>
          <a href="/owner/login" data-owner-ui="action" data-owner-tone="default">Open login</a>
        </div>
      </section>
    `;
  }

  function kvCardsMarkup(record, title) {
    const source = asObject(record);
    const entries = Object.entries(source)
      .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
      .slice(0, 10);
    if (!entries.length) return emptyStateMarkup(title, 'No record fields are available yet.');
    return `
      <section class="owner-live-panel" data-owner-section="panel" data-owner-section-label="${escapeHtml(title)}">
        <div class="owner-live-grid owner-live-metrics">
          ${entries.map(([key, value]) => `
            <article class="owner-live-panel owner-live-kv-card owner-live-metric">
              <span data-owner-role="section-heading">${escapeHtml(key.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' '))}</span>
              <strong>${escapeHtml(String(value))}</strong>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function tableMarkup(title, rows, columns, options) {
    const normalizedRows = Array.isArray(rows) ? rows : [];
    if (!normalizedRows.length) {
      return emptyStateMarkup(title, options?.emptyMessage || 'No live rows are available yet.');
    }
    const safeColumns = Array.isArray(columns) && columns.length
      ? columns
      : [{ key: 'label', label: 'Item', render: (row) => escapeHtml(trimText(row?.id || row?.name || row?.label || '-', 160)) }];
    return `
      <section class="owner-live-panel" data-owner-section="table" data-owner-section-label="${escapeHtml(title)}">
        <div class="owner-live-head">
          <span data-owner-role="section-heading">${escapeHtml(title)}</span>
          ${options?.note ? `<p>${escapeHtml(options.note)}</p>` : ''}
        </div>
        <div class="odvc4-table-wrap">
          <table class="odvc4-table owner-live-table">
            <thead>
              <tr>${safeColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${normalizedRows.map((row) => `
                <tr>
                  ${safeColumns.map((column) => `<td>${typeof column.render === 'function'
                    ? column.render(row)
                    : escapeHtml(trimText(asObject(row)[column.key], 160) || '-')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function textCell(primary, secondary) {
    const main = escapeHtml(trimText(primary, 160) || '-');
    const sub = trimText(secondary, 220);
    return sub
      ? `${main}<small>${escapeHtml(sub)}</small>`
      : main;
  }

  function normalizeRecordId(record) {
    const source = asObject(record);
    return trimText(source.id, 160)
      || trimText(source.tenantId, 160)
      || trimText(source.runtimeKey, 160)
      || trimText(source.subscriptionId, 160)
      || trimText(source.invoiceId, 160)
      || trimText(source.paymentAttemptId, 160)
      || '';
  }

  function findRecord(rows, targetId) {
    const id = trimText(targetId, 160);
    return uniqueById(rows, ['id', 'tenantId', 'runtimeKey', 'subscriptionId', 'invoiceId', 'paymentAttemptId'])
      .find((row) => {
        const source = asObject(row);
        return [source.id, source.tenantId, source.runtimeKey, source.subscriptionId, source.invoiceId, source.paymentAttemptId, source.planId, source.packageId]
          .map((value) => trimText(value, 160))
          .includes(id);
      }) || null;
  }

  function actionForControlRoute(pathname, routeKey) {
    const mapping = {
      overview: { label: 'Refresh overview', href: '/owner', tone: 'primary' },
      tenants: { label: 'สร้างผู้เช่าใหม่', href: '/owner/tenants/new', tone: 'primary' },
      'tenant-create': { label: 'กลับหน้าผู้เช่า', href: '/owner/tenants', tone: 'default' },
      'tenant-detail': { label: 'Open tenant form', href: '#owner-tenant-detail-form', tone: 'primary', localFocus: true },
      packages: { label: 'Billing', href: '/owner/billing', tone: 'default' },
      subscriptions: { label: 'Open Payment Attempt', href: '/owner/billing/attempt', tone: 'primary' },
      billing: { label: 'Quick Diagnostics', href: '/owner/diagnostics', tone: 'primary' },
      recovery: { label: 'Open recovery workspace', href: '#owner-recovery-workspace', tone: 'primary', localFocus: true },
      runtime: { label: 'Open runtime overview', href: '#owner-runtime-route-summary', tone: 'primary', localFocus: true },
      'runtime-create-server': { label: 'Open create server form', href: '#owner-runtime-server-workspace', tone: 'primary', localFocus: true },
      'runtime-provision-runtime': { label: 'Open provisioning form', href: '#owner-runtime-provisioning-workspace', tone: 'primary', localFocus: true },
      analytics: { label: 'Run Automation', href: '/owner/automation', tone: 'primary' },
      audit: { label: 'Open Access View', href: '/owner/access', tone: 'primary' },
      security: { label: 'Open security view', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      access: { label: 'Open access view', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      diagnostics: { label: 'Open diagnostics', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      settings: { label: 'Open platform settings', href: '#owner-settings-workspace', tone: 'primary', localFocus: true },
      control: { label: 'Open recovery overview', href: '/owner/recovery/overview', tone: 'primary' },
      'support-detail': { label: 'Open support case', href: '#owner-tenant-support-workspace', tone: 'primary', localFocus: true },
    };
    return mapping[routeKey] || { label: 'Back to overview', href: '/owner', tone: 'default' };
  }

  function actionForControlRoute(pathname, routeKey) {
    const mapping = {
      overview: { label: 'Refresh overview', href: '/owner', tone: 'primary' },
      tenants: { label: 'Create tenant', href: '/owner/tenants/new', tone: 'primary' },
      'tenant-create': { label: 'Back to tenants', href: '/owner/tenants', tone: 'default' },
      'tenant-detail': { label: 'Open tenant workspace', href: '#owner-tenant-detail-form', tone: 'primary', localFocus: true },
      packages: { label: 'Open package workspace', href: '#owner-packages-workspace', tone: 'primary', localFocus: true },
      'packages-create': { label: 'Open package form', href: '#owner-packages-create-form', tone: 'primary', localFocus: true },
      'packages-entitlements': { label: 'Open entitlement matrix', href: '#owner-packages-entitlements-workspace', tone: 'primary', localFocus: true },
      'package-detail': { label: 'Open package workspace', href: '#owner-packages-workspace', tone: 'primary', localFocus: true },
      subscriptions: { label: 'Open subscriptions workspace', href: '#owner-subscriptions-workspace', tone: 'primary', localFocus: true },
      'subscriptions-registry': { label: 'Open subscription registry', href: '#owner-subscriptions-registry-workspace', tone: 'primary', localFocus: true },
      'subscription-detail': { label: 'Open subscriptions workspace', href: '#owner-subscriptions-workspace', tone: 'primary', localFocus: true },
      billing: { label: 'Open billing workspace', href: '#owner-billing-invoices-workspace', tone: 'primary', localFocus: true },
      'billing-recovery': { label: 'Open billing recovery queue', href: '#owner-billing-recovery-queue', tone: 'primary', localFocus: true },
      'billing-attempts': { label: 'Open payment attempts', href: '#owner-billing-attempts-workspace', tone: 'primary', localFocus: true },
      recovery: { label: 'Open recovery workspace', href: '#owner-recovery-workspace', tone: 'primary', localFocus: true },
      'recovery-create': { label: 'Open backup creation', href: '#owner-recovery-create-workspace', tone: 'primary', localFocus: true },
      'recovery-preview': { label: 'Open restore preview', href: '#owner-recovery-preview-workspace', tone: 'primary', localFocus: true },
      'recovery-restore': { label: 'Open guarded restore', href: '#owner-recovery-restore-workspace', tone: 'primary', localFocus: true },
      'recovery-history': { label: 'Open restore history', href: '#owner-recovery-history-workspace', tone: 'primary', localFocus: true },
      'invoice-detail': { label: 'Open invoice registry', href: '#owner-billing-invoices-workspace', tone: 'primary', localFocus: true },
      'attempt-detail': { label: 'Open payment attempts', href: '#owner-billing-attempts-workspace', tone: 'primary', localFocus: true },
      runtime: { label: 'Open runtime overview', href: '#owner-runtime-route-summary', tone: 'primary', localFocus: true },
      'runtime-create-server': { label: 'Open create server form', href: '#owner-runtime-server-workspace', tone: 'primary', localFocus: true },
      'runtime-provision-runtime': { label: 'Open provisioning form', href: '#owner-runtime-provisioning-workspace', tone: 'primary', localFocus: true },
      'agents-bots': { label: 'Open runtime registry', href: '#owner-runtime-workspace', tone: 'primary', localFocus: true },
      'fleet-diagnostics': { label: 'Open diagnostics registry', href: '#owner-runtime-workspace', tone: 'primary', localFocus: true },
      incidents: { label: 'Open runtime alerts', href: '#owner-runtime-workspace', tone: 'primary', localFocus: true },
      jobs: { label: 'Open shared operations', href: '#owner-runtime-shared-ops', tone: 'primary', localFocus: true },
      analytics: { label: 'Open analytics workspace', href: '#owner-analytics-workspace', tone: 'primary', localFocus: true },
      'analytics-risk': { label: 'Open risk queue', href: '#owner-risk-queue', tone: 'primary', localFocus: true },
      'analytics-packages': { label: 'Open package usage', href: '#owner-analytics-packages-workspace', tone: 'primary', localFocus: true },
      automation: { label: 'Open automation workspace', href: '#owner-settings-automation-workspace', tone: 'primary', localFocus: true },
      support: { label: 'Open support workspace', href: '#owner-runtime-workspace', tone: 'primary', localFocus: true },
      audit: { label: 'Open audit workspace', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      security: { label: 'Open security view', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      access: { label: 'Open access view', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      diagnostics: { label: 'Open diagnostics', href: '#owner-audit-workspace', tone: 'primary', localFocus: true },
      settings: { label: 'Open platform settings', href: '#owner-settings-workspace', tone: 'primary', localFocus: true },
      'settings-admin-users': { label: 'Open admin users', href: '#owner-settings-admin-users', tone: 'primary', localFocus: true },
      'settings-services': { label: 'Open managed services', href: '#owner-settings-managed-services', tone: 'primary', localFocus: true },
      'settings-access-policy': { label: 'Open access policy', href: '#owner-settings-access-policy', tone: 'primary', localFocus: true },
      'settings-portal-policy': { label: 'Open portal policy', href: '#owner-settings-portal-policy', tone: 'primary', localFocus: true },
      'settings-billing-policy': { label: 'Open billing policy', href: '#owner-settings-billing-policy', tone: 'primary', localFocus: true },
      'settings-runtime-policy': { label: 'Open runtime policy', href: '#owner-settings-runtime-policy', tone: 'primary', localFocus: true },
      control: { label: 'Open platform settings', href: '#owner-settings-workspace', tone: 'primary', localFocus: true },
      'support-detail': { label: 'Open support case', href: '#owner-tenant-support-workspace', tone: 'primary', localFocus: true },
    };
    return mapping[routeKey] || { label: 'Back to overview', href: '/owner', tone: 'default' };
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function annotateSections(container) {
    const selector = '[data-owner-section-label], .owner-live-panel, .owner-live-disclosure, .odv4-panel, .odvc4-panel, section';
    const sections = [];
    const seen = new Set();
    const labelTops = new Map();
    Array.from(container.querySelectorAll(selector)).forEach((node, index) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.hasAttribute('data-owner-filter-ui') || node.closest('[data-owner-filter-ui]')) return;
      const ancestor = node.parentElement && node.parentElement.closest(selector);
      if (ancestor && ancestor !== container && ancestor.contains(node) && ancestor !== node && ancestor.hasAttribute('data-owner-section-label')) return;
      const label = trimText(
        node.getAttribute('data-owner-section-label')
        || node.querySelector('[data-owner-role="section-heading"], .odv4-section-title, .odv4-page-title, h2, h3, strong')?.textContent,
        120,
      );
      if (!label) return;
      const text = String(node.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 28) return;
      const top = Math.round(node.getBoundingClientRect().top + window.scrollY);
      const previousTop = labelTops.get(normalizeText(label));
      if (typeof previousTop === 'number' && Math.abs(previousTop - top) < 24) return;
      const id = trimText(node.id, 160) || `owner-live-section-${slugify(label) || index + 1}`;
      if (seen.has(id)) return;
      seen.add(id);
      labelTops.set(normalizeText(label), top);
      node.id = id;
      node.setAttribute('data-owner-section-label', label);
      if (!node.getAttribute('data-owner-section')) node.setAttribute('data-owner-section', 'panel');
      sections.push({ id, label, kind: node.getAttribute('data-owner-section') || 'panel' });
    });
    return sections.slice(0, 12);
  }

  function sectionScope(container) {
    if (!(container instanceof HTMLElement)) return null;
    return container.querySelector('.owner-live-route-content') || container;
  }

  function findSectionNode(scope, sectionId) {
    const candidate = document.getElementById(sectionId);
    return candidate instanceof HTMLElement && scope instanceof HTMLElement && scope.contains(candidate) ? candidate : null;
  }

  function shortSectionLabel(value) {
    const text = trimText(value, 44);
    return text.length > 24 ? `${text.slice(0, 23).trimEnd()}…` : text;
  }

  function collectFilterableSections(container) {
    const scope = sectionScope(container);
    if (!(scope instanceof HTMLElement)) return { scope: null, sections: [] };
    const sections = annotateSections(scope)
      .map((section) => ({
        ...section,
        node: findSectionNode(scope, section.id),
      }))
      .filter((section) => section.node)
      .filter((section) => {
        const label = normalizeText(section.label);
        return label && label !== 'owner classes' && label !== 'overview class menu';
      })
      .slice(0, 8);
    return { scope, sections };
  }

  function syncFilterButtonState(switcher, activeId) {
    if (!(switcher instanceof HTMLElement)) return;
    Array.from(switcher.querySelectorAll('[data-owner-section-target]')).forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const current = String(button.getAttribute('data-owner-section-target') || '') === activeId;
      button.classList.toggle('is-current', current);
      button.setAttribute('aria-pressed', current ? 'true' : 'false');
    });
  }

  function syncSectionContainerVisibility(scope) {
    if (!(scope instanceof HTMLElement)) return;
    Array.from(scope.querySelectorAll('.owner-live-page-main, .owner-live-page-side, .owner-live-overview-content')).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const hasVisibleContent = Array.from(node.children).some((child) => (
        child instanceof HTMLElement
        && !child.hidden
        && child.getAttribute('data-owner-filter-ui') !== 'switcher'
      ));
      node.hidden = !hasVisibleContent;
    });
  }

  function applySectionFilter(routeKey, scope, sections, targetId) {
    if (!(scope instanceof HTMLElement)) return 'all';
    if (!Array.isArray(sections) || !sections.length) {
      scope.classList.remove('owner-live-focus-mode');
      scope.setAttribute('data-owner-section-filter', 'all');
      Array.from(scope.querySelectorAll('.owner-live-page-main, .owner-live-page-side, .owner-live-overview-content')).forEach((node) => {
        if (node instanceof HTMLElement) node.hidden = false;
      });
      return 'all';
    }
    const normalizedTarget = sections.some((section) => section.id === targetId) ? targetId : 'all';
    sectionFilterState.set(routeKey, normalizedTarget);
    scope.classList.toggle('owner-live-focus-mode', normalizedTarget !== 'all');
    scope.setAttribute('data-owner-section-filter', normalizedTarget);
    sections.forEach((section) => {
      if (!(section.node instanceof HTMLElement)) return;
      const visible = normalizedTarget === 'all' || section.id === normalizedTarget;
      section.node.hidden = !visible;
      section.node.setAttribute('data-owner-filter-hidden', visible ? 'false' : 'true');
      section.node.classList.toggle('is-section-focus', normalizedTarget !== 'all' && visible);
    });
    syncSectionContainerVisibility(scope);
    return normalizedTarget;
  }

  function renderSectionSwitcherMarkup(sections) {
    return `
      <section class="owner-live-section-switcher" data-owner-filter-ui="switcher">
        <div class="owner-live-section-switcher-head">
          <span data-owner-role="section-heading">Section buttons</span>
          <p>Use buttons to isolate one block at a time inside this page.</p>
        </div>
        <div class="owner-live-section-switcher-buttons" data-owner-section-buttons>
          <button class="owner-live-section-button" type="button" data-owner-section-target="all">All content</button>
          ${sections.map((section) => `
            <button class="owner-live-section-button" type="button" data-owner-section-target="${escapeHtml(section.id)}">${escapeHtml(shortSectionLabel(section.label))}</button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function mountSectionSwitcher(container, routeKey) {
    const { scope, sections } = collectFilterableSections(container);
    if (!(scope instanceof HTMLElement)) return [];
    Array.from(scope.querySelectorAll('[data-owner-filter-ui="switcher"]')).forEach((node) => node.remove());
    applySectionFilter(routeKey, scope, sections, 'all');
    return sections.map(({ id, label, kind }) => ({ id, label, kind }));
  }

  function renderControlWorkspace(pathname, routeKey, currentSnapshot, meta) {
    if (!window.OwnerControlV4?.createOwnerControlV4Model || !window.OwnerControlV4?.buildOwnerControlV4Html) {
      return {
        header: buildRouteHeaderMarkup(meta, actionForControlRoute(pathname, routeKey)),
        html: emptyStateMarkup(meta.title, 'Owner control modules are not ready yet.'),
      };
    }
    const currentPayload = payload();
    const currentOwnerUi = ownerUiState(currentSnapshot);
    const rawRoute = controlRouteForPath(pathname, routeKey);
    const model = window.OwnerControlV4.createOwnerControlV4Model(currentPayload, {
      currentRoute: rawRoute,
      selectedRuntimeKey: currentOwnerUi.selectedRuntimeKey,
      runtimeBootstrap: currentOwnerUi.runtimeBootstrap,
      restorePreview: currentOwnerUi.restorePreview,
      automationPreview: currentOwnerUi.automationPreview,
      supportCase: currentOwnerUi.supportCase,
      supportCaseLoading: currentOwnerUi.supportCaseLoading === true,
      supportDeadLetters: currentOwnerUi.supportDeadLetters,
      supportDeadLettersLoading: currentOwnerUi.supportDeadLettersLoading === true,
    });
    const workspaceHtml = trimText(window.OwnerControlV4.buildOwnerControlV4Html(model), 200000) || emptyStateMarkup(meta.title, 'No live workspace content is available.');
    return {
      header: buildRouteHeaderMarkup(meta, actionForControlRoute(pathname, routeKey)),
      html: `<section class="owner-live-workspace-shell">${workspaceHtml}</section>`,
    };
  }

  function renderRecoveryWorkspace(currentSnapshot, meta) {
    if (!window.OwnerRuntimeHealthV4?.createOwnerRuntimeHealthV4Model || !window.OwnerRuntimeHealthV4?.buildOwnerRuntimeHealthV4Html) {
      return null;
    }
    const currentPayload = payload();
    const currentOwnerUi = ownerUiState(currentSnapshot);
    const model = window.OwnerRuntimeHealthV4.createOwnerRuntimeHealthV4Model({
      ...currentPayload,
      restorePreview: currentOwnerUi.restorePreview,
    }, {
      currentRoute: 'recovery',
    });
    const workspaceHtml = trimText(
      window.OwnerRuntimeHealthV4.buildOwnerRuntimeHealthV4Html(model),
      200000,
    ) || emptyStateMarkup(meta.title, 'Recovery workbench is not ready yet.');
    return {
      header: buildRouteHeaderMarkup(meta, {
        label: 'Open recovery workbench',
        href: '#recovery',
        tone: 'primary',
        localFocus: true,
      }),
      html: `<section class="owner-live-workspace-shell">${workspaceHtml}</section>`,
    };
  }

  function relatedByAnyId(rows, keys, targetId) {
    const id = trimText(targetId, 160);
    return uniqueById(rows, ['id', 'tenantId', 'runtimeKey', 'subscriptionId', 'invoiceId', 'paymentAttemptId']).filter((row) => {
      const source = asObject(row);
      return keys.some((key) => trimText(source[key], 160) === id);
    });
  }

  function buildCustomRouteMarkup(pathname, routeKey, currentSnapshot, meta) {
    const currentPayload = payload();
    const currentOwnerUi = ownerUiState(currentSnapshot);
    const collections = gatherCollections(currentPayload, currentOwnerUi);
    const routeId = segmentAt(pathname, routeKey === 'backup-detail' || routeKey === 'invoice-detail' || routeKey === 'attempt-detail' ? 3 : 2);
    let body = '';

    if (routeKey === 'recovery') {
      const recoveryWorkspace = renderRecoveryWorkspace(currentSnapshot, meta);
      if (recoveryWorkspace) {
        return recoveryWorkspace;
      }
      body = tableMarkup('Backup and recovery assets', collections.backups, [
        { label: 'Backup', render: (row) => textCell(row.file || row.name || normalizeRecordId(row), row.description || row.note) },
        { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || '-', 80)) },
        { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.at || row.timestamp)) },
      ], { emptyMessage: 'No live backup rows are available for this route yet.' });
    } else if (routeKey === 'package-detail') {
      const record = findRecord(collections.packages, routeId);
      const tenants = relatedByAnyId(collections.tenants, ['packageId', 'planId'], routeId);
      body = kvCardsMarkup(record, 'Package details')
        + tableMarkup('Assigned tenants', tenants, [
          { label: 'Tenant', render: (row) => textCell(row.tenantName || row.name || row.tenantId, row.tenantId) },
          { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.subscriptionStatus || '-', 80)) },
          { label: 'Usage', render: (row) => textCell(formatNumber(row.playerCount || row.activePlayers || 0), row.notes || row.region) },
        ], { emptyMessage: 'No tenants are currently assigned to this package.' });
    } else if (routeKey === 'subscription-detail') {
      const effectiveId = routeId || normalizeRecordId(collections.subscriptions[0]);
      const record = findRecord(collections.subscriptions, effectiveId);
      const invoices = relatedByAnyId(collections.invoices, ['subscriptionId', 'id'], effectiveId);
      body = kvCardsMarkup(record, 'Subscription detail')
        + tableMarkup('Invoices', invoices, [
          { label: 'Invoice', render: (row) => textCell(row.id || row.invoiceId, row.status || row.state) },
          { label: 'Amount', render: (row) => escapeHtml(formatCurrency(row.amountCents || row.totalCents || row.amount, row.currency || 'THB')) },
          { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.dueAt)) },
        ], { emptyMessage: 'No invoices are linked to this subscription yet.' });
    } else if (routeKey === 'invoice-detail') {
      const effectiveId = routeId || normalizeRecordId(collections.invoices[0]);
      const record = findRecord(collections.invoices, effectiveId);
      const attempts = relatedByAnyId(collections.attempts, ['invoiceId', 'id'], effectiveId);
      body = kvCardsMarkup(record, 'Invoice summary')
        + tableMarkup('Payment attempts', attempts, [
          { label: 'Attempt', render: (row) => textCell(row.id || row.paymentAttemptId, row.status || row.state) },
          { label: 'Provider', render: (row) => escapeHtml(trimText(row.provider || row.gateway || '-', 80)) },
          { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt)) },
        ], { emptyMessage: 'No payment attempts are linked to this invoice.' });
    } else if (routeKey === 'attempt-detail') {
      const effectiveId = routeId || normalizeRecordId(collections.attempts[0]);
      const record = findRecord(collections.attempts, effectiveId);
      body = kvCardsMarkup(record, 'Payment attempt detail');
    } else if (routeKey === 'agents-bots' || routeKey === 'fleet-diagnostics') {
      const rows = uniqueById(collections.runtime, ['runtimeKey', 'id']);
      body = tableMarkup(routeKey === 'agents-bots' ? 'Runtime fleet' : 'Fleet diagnostics', rows, [
        { label: 'Runtime', render: (row) => textCell(row.runtimeKey || row.machineName || row.name, row.role || row.runtimeKind) },
        { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.health || '-', 80)) },
        { label: 'Last seen', render: (row) => escapeHtml(formatDateTime(row.lastSeenAt || row.updatedAt || row.createdAt)) },
        { label: 'Tenant', render: (row) => escapeHtml(trimText(row.tenantId || row.tenantName || '-', 80)) },
      ], { emptyMessage: 'No runtime fleet rows are currently available.' });
    } else if (routeKey === 'incidents' || routeKey === 'jobs' || routeKey === 'automation' || routeKey === 'support' || routeKey === 'recovery') {
      const lookup = {
        incidents: collections.incidents,
        jobs: collections.jobs,
        automation: collections.automation.length ? collections.automation : collections.jobs,
        support: collections.supportCases.length ? collections.supportCases : collections.deadLetters,
        recovery: collections.backups,
      };
      const titleByRoute = {
        incidents: 'Current incidents',
        jobs: 'Background jobs',
        automation: 'Automation signals',
        support: 'Support items',
        recovery: 'Backup and recovery assets',
      };
      body = tableMarkup(titleByRoute[routeKey], lookup[routeKey], [
        { label: 'Item', render: (row) => textCell(row.title || row.name || normalizeRecordId(row), row.description || row.reason || row.tenantId) },
        { label: 'Status', render: (row) => escapeHtml(trimText(row.status || row.state || row.severity || '-', 80)) },
        { label: 'Updated', render: (row) => escapeHtml(formatDateTime(row.updatedAt || row.createdAt || row.at || row.timestamp)) },
      ], { emptyMessage: 'No live rows are available for this route yet.' });
    } else if (routeKey === 'backup-detail') {
      const effectiveId = routeId || normalizeRecordId(collections.backups[0]);
      const record = findRecord(collections.backups, effectiveId);
      body = kvCardsMarkup(record, 'Backup detail');
    } else {
      body = emptyStateMarkup(meta.title, 'This route is ready, but the live detail renderer still has no route-specific template.');
    }

    const customAction = {
      incidents: { label: 'Open Tenant', href: '/owner/tenants/context', tone: 'primary' },
      support: { label: 'Open Support Case', href: '/owner/support/context', tone: 'primary' },
      automation: { label: 'Open analytics overview', href: '/owner/analytics/overview', tone: 'primary' },
      recovery: { label: 'Open Diagnostics', href: '/owner/diagnostics', tone: 'default' },
      'package-detail': { label: 'Back to packages', href: '/owner/packages', tone: 'default' },
      'subscription-detail': { label: 'Back to subscriptions', href: '/owner/subscriptions', tone: 'default' },
      'invoice-detail': { label: 'Back to billing', href: '/owner/billing', tone: 'default' },
      'attempt-detail': { label: 'Back to billing', href: '/owner/billing', tone: 'default' },
      'agents-bots': { label: 'Back to runtime overview', href: '/owner/runtime/overview', tone: 'default' },
      'fleet-diagnostics': { label: 'Back to runtime overview', href: '/owner/runtime/overview', tone: 'default' },
      'backup-detail': { label: 'Back to recovery overview', href: '/owner/recovery/overview', tone: 'default' },
    };

    return {
      header: buildRouteHeaderMarkup(meta, customAction[routeKey] || { label: 'Back to overview', href: '/owner', tone: 'default' }),
      html: body,
    };
  }

  function renderRoute() {
    const root = createSurfaceRoot();
    if (!root) return;
    const currentSnapshot = snapshot();
    const pathname = currentPath();
    const routeKey = routeKeyFromPath(pathname);
    const meta = routeMeta(pathname, routeKey);
    applyRouteSurfacePresentation(root, routeKey);
    const signature = JSON.stringify({
      pathname,
      routeKey,
      statePath: trimText(currentSnapshot.pathname, 200),
      payloadKeys: Object.keys(asObject(currentSnapshot.payload)).sort(),
      ownerUiKeys: Object.keys(asObject(currentSnapshot.payload?.ownerUi)).sort(),
    });
    if (signature === lastSignature && hasRenderableContent(root)) return;
    lastSignature = signature;

    const renderResult = CONTROL_ROUTE_KEYS.has(routeKey)
      ? renderControlWorkspace(pathname, routeKey, currentSnapshot, meta)
      : buildCustomRouteMarkup(pathname, routeKey, currentSnapshot, meta);

    root.header.innerHTML = renderResult.header || '';
    root.liveData.innerHTML = `
      <div style="display:block;visibility:visible;opacity:1;min-height:120px;position:relative;z-index:1">
        ${wrapOwnerRouteShell(routeKey, renderResult.html || emptyStateMarkup(meta.title, meta.subtitle))}
      </div>
    `;
    root.liveData.hidden = false;
    root.liveData.style.display = 'block';
    root.liveData.style.visibility = 'visible';
    root.liveData.style.opacity = '1';
    recoveryAttempts = 0;
    const sections = mountSectionSwitcher(root.liveData, routeKey);
    window.dispatchEvent(new CustomEvent('owner-live-rendered', {
      detail: {
        route: routeKey,
        rawRoute: trimText(currentSnapshot.rawRoute || '', 160),
        pathname,
        sections,
      },
    }));
  }

  function renderRoute() {
    const root = createSurfaceRoot();
    if (!root) return;
    const currentSnapshot = snapshot();
    const pathname = currentPath();
    const routeKey = routeKeyFromPath(pathname);
    const meta = routeMeta(pathname, routeKey);
    applyRouteSurfacePresentation(root, routeKey);
    const signature = JSON.stringify({
      pathname,
      routeKey,
      statePath: trimText(currentSnapshot.pathname, 200),
      updatedAt: Number(currentSnapshot.updatedAt) || 0,
      rawRoute: trimText(currentSnapshot.rawRoute, 200),
      page: trimText(currentSnapshot.page, 120),
      payloadKeys: Object.keys(asObject(currentSnapshot.payload)).sort(),
      ownerUiKeys: Object.keys(asObject(currentSnapshot.payload?.ownerUi)).sort(),
    });
    if (signature === lastSignature && hasRenderableContent(root)) return;
    lastSignature = signature;

    let renderResult = null;
    if (usesRecoveryWorkspace(routeKey)) {
      renderResult = renderRecoveryWorkspace(currentSnapshot, meta);
    }
    if (!renderResult) {
      renderResult = CONTROL_ROUTE_KEYS.has(routeKey)
        ? renderControlWorkspace(pathname, routeKey, currentSnapshot, meta)
        : buildCustomRouteMarkup(pathname, routeKey, currentSnapshot, meta);
    }

    root.header.innerHTML = renderResult.header || '';
    root.liveData.innerHTML = `
      <div style="display:block;visibility:visible;opacity:1;min-height:120px;position:relative;z-index:1">
        ${wrapOwnerRouteShell(routeKey, renderResult.html || emptyStateMarkup(meta.title, meta.subtitle))}
      </div>
    `;
    root.liveData.removeAttribute('data-owner-server-rendered');
    root.liveData.setAttribute('data-owner-rendered', 'live');
    root.liveData.hidden = false;
    root.liveData.style.display = 'block';
    root.liveData.style.visibility = 'visible';
    root.liveData.style.opacity = '1';
    if (document.body) {
      document.body.classList.add('owner-live-ready');
      document.body.classList.remove('owner-live-timeout');
    }
    recoveryAttempts = 0;
    const sections = annotateSections(root.liveData);
    window.dispatchEvent(new CustomEvent('owner-live-rendered', {
      detail: {
        route: routeKey,
        rawRoute: trimText(currentSnapshot.rawRoute || '', 160),
        pathname,
        sections,
      },
    }));
  }

  function needsRecovery() {
    return !hasRenderableContent(createSurfaceRoot());
  }

  function scheduleRecoveryCheck(delayMs) {
    window.setTimeout(() => {
      if (!needsRecovery()) return;
      if (recoveryAttempts >= 3) {
        const root = createSurfaceRoot();
        if (root && root.liveData) {
          root.liveData.innerHTML = recoveryErrorMarkup(routeMeta(currentPath(), routeKeyFromPath(currentPath())));
          root.liveData.removeAttribute('data-owner-server-rendered');
          root.liveData.setAttribute('data-owner-rendered', 'live');
          if (document.body) {
            document.body.classList.add('owner-live-ready');
            document.body.classList.remove('owner-live-timeout');
          }
        }
        return;
      }
      recoveryAttempts += 1;
      lastSignature = '';
      bootstrapFallbackStateFromApi()
        .catch(() => null)
        .finally(() => {
          renderRoute();
        });
    }, delayMs);
  }

  function scheduleRender() {
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      renderRoute();
      scheduleRecoveryCheck(180);
      scheduleRecoveryCheck(900);
      scheduleRecoveryCheck(2200);
    }, 16);
  }

  function observeSurfaceHealth() {
    if (window.__OWNER_STITCH_LIVE_OBSERVER__) return;
    const root = createSurfaceRoot();
    if (!root?.liveData) return;
    const observer = new MutationObserver(() => {
      if (renderTimer) return;
      if (hasRenderableContent(root)) return;
      lastSignature = '';
      scheduleRender();
    });
    observer.observe(root.liveData, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
      characterData: true,
    });
    window.__OWNER_STITCH_LIVE_OBSERVER__ = observer;
  }

  function startHealthWatchdog() {
    if (window.__OWNER_STITCH_LIVE_WATCHDOG__) return;
    window.__OWNER_STITCH_LIVE_WATCHDOG__ = window.setInterval(() => {
      if (hasRenderableContent(createSurfaceRoot())) return;
      lastSignature = '';
      if (!payload() || !Object.keys(payload()).length) {
        bootstrapFallbackStateFromApi()
          .catch(() => null)
          .finally(() => {
            scheduleRender();
          });
        return;
      }
      scheduleRender();
    }, 1500);
  }

  function initOwnerStitchLive() {
    const root = createSurfaceRoot();
    if (publishExistingServerRender(root)) {
      window.__OWNER_STITCH_SERVER_MODE__ = 'server-rendered';
      return;
    }
    observeSurfaceHealth();
    startHealthWatchdog();
    scheduleRender();
    if (!payload() || !Object.keys(payload()).length) {
      bootstrapFallbackStateFromApi()
        .catch(() => null)
        .finally(() => {
          scheduleRender();
        });
    }
  }

  function initOwnerStitchLive() {
    const root = createSurfaceRoot();
    publishExistingServerRender(root);
    observeSurfaceHealth();
    startHealthWatchdog();
    scheduleRender();
    if (!payload() || !Object.keys(payload()).length) {
      bootstrapFallbackStateFromApi()
        .catch(() => null)
        .finally(() => {
          scheduleRender();
        });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initOwnerStitchLive();
    }, { once: true });
  } else {
    initOwnerStitchLive();
  }

  function scheduleRenderWhenNeeded() {
    if (window.__OWNER_STITCH_SERVER_MODE__ === 'server-rendered') {
      const root = createSurfaceRoot();
      if (hasRenderableContent(root)) return;
      if (restoreServerRenderSnapshot()) return;
      const liveData = root?.liveData;
      if (liveData) {
        liveData.innerHTML = recoveryErrorMarkup(routeMeta(currentPath(), routeKeyFromPath(currentPath())));
        liveData.setAttribute('data-owner-server-rendered', 'true');
      }
      return;
    }
    scheduleRender();
  }

  function scheduleRenderWhenNeeded() {
    lastSignature = '';
    scheduleRender();
  }

  window.addEventListener('owner-state-updated', scheduleRenderWhenNeeded);
  window.addEventListener('popstate', scheduleRenderWhenNeeded);
  window.addEventListener('hashchange', scheduleRenderWhenNeeded);
})();
