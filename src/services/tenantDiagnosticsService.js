/**
 * Tenant diagnostics bundle builder for support and owner workflows.
 * This stays read-only and reuses existing services/stores so we do not
 * introduce a new source of truth or change runtime/business behavior.
 */

'use strict';

const { assertTenantDbIsolationScope } = require('../utils/tenantDbIsolation');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function nowIso() {
  return new Date().toISOString();
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function filterRowsByTenant(rows, tenantId) {
  const scopedTenantId = trimText(tenantId, 120);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    return trimText(
      row?.tenantId
      || row?.data?.tenantId
      || row?.data?.tenant?.id,
      120,
    ) === scopedTenantId;
  });
}

function summarizeRequestErrors(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    total: list.length,
    serverErrors: list.filter((row) => Number(row?.statusCode) >= 500).length,
    unauthorized: list.filter((row) => Number(row?.statusCode) === 401 || Number(row?.statusCode) === 403).length,
    latestAt: list[0]?.at || null,
  };
}

function summarizeRuntimeSupervisor(snapshot) {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const degraded = items.filter((item) => String(item?.status || '').trim().toLowerCase() !== 'ready');
  return {
    refreshedAt: snapshot?.refreshedAt || null,
    total: items.length,
    degraded: degraded.length,
    items: items.map((item) => ({
      runtimeKey: trimText(item?.runtimeKey, 120),
      status: trimText(item?.status, 80) || 'unknown',
      detail: trimText(item?.detail, 240),
      lastSeenAt: item?.lastSeenAt || null,
    })),
  };
}

function summarizeDeliveryDiagnostics(reconcile) {
  const summary = reconcile?.summary || {};
  return {
    generatedAt: reconcile?.generatedAt || null,
    windowMs: asInt(summary.windowMs, 0),
    purchases: asInt(summary.purchases, 0),
    queueJobs: asInt(summary.queueJobs, 0),
    deadLetters: asInt(summary.deadLetters, 0),
    anomalies: asInt(summary.anomalies, 0),
    abuseFindings: asInt(summary.abuseFindings, 0),
    anomalySample: (Array.isArray(reconcile?.anomalies) ? reconcile.anomalies : []).slice(0, 10),
    abuseSample: (Array.isArray(reconcile?.abuseFindings) ? reconcile.abuseFindings : []).slice(0, 10),
  };
}

function summarizeIdentityDiagnostics(accounts = []) {
  const rows = Array.isArray(accounts) ? accounts : [];
  const items = rows.slice(0, 12).map((row) => {
    const linked = Boolean(trimText(row?.steamId, 120));
    const active = row?.isActive !== false;
    const status = !linked
      ? 'missing-steam'
      : !active
        ? 'inactive'
        : 'linked';
    return {
      discordId: trimText(row?.discordId, 120),
      displayName: trimText(row?.displayName || row?.username || row?.discordId, 160) || 'player',
      steamId: trimText(row?.steamId, 120) || null,
      isActive: active,
      status,
      detail: !linked
        ? 'Steam link is still missing for this player account.'
        : !active
          ? 'Player account exists but is currently marked inactive.'
          : 'Steam link is present and ready for support follow-up.',
      updatedAt: row?.updatedAt || row?.createdAt || null,
    };
  });
  const linkedCount = rows.filter((row) => Boolean(trimText(row?.steamId, 120))).length;
  const missingSteamCount = rows.filter((row) => !trimText(row?.steamId, 120)).length;
  const inactiveCount = rows.filter((row) => row?.isActive === false).length;
  return {
    total: rows.length,
    linked: linkedCount,
    missingSteam: missingSteamCount,
    inactive: inactiveCount,
    needsSupport: items.filter((item) => item.status !== 'linked').length,
    items,
  };
}

function normalizeIdentitySupportIntent(value, fallback = 'review') {
  const normalized = trimText(value, 80).toLowerCase();
  if (normalized === 'set') return 'bind';
  if (normalized === 'remove' || normalized === 'unbind') return 'unlink';
  if (['bind', 'unlink', 'relink', 'conflict', 'review'].includes(normalized)) {
    return normalized;
  }
  return trimText(fallback, 80).toLowerCase() || 'review';
}

function normalizeIdentitySupportOutcome(value, fallback = 'reviewing') {
  const normalized = trimText(value, 80).toLowerCase().replace(/\s+/g, '-');
  if (['resolved', 'pending-verification', 'pending-player-reply', 'reviewing'].includes(normalized)) {
    return normalized;
  }
  return trimText(fallback, 80).toLowerCase() || 'reviewing';
}

function isIdentitySupportNotification(row) {
  return trimText(row?.data?.eventType || row?.kind, 160).toLowerCase() === 'platform.player.identity.support';
}

function isNotificationAcknowledged(row) {
  return row?.acknowledged === true || Boolean(row?.acknowledgedAt);
}

function summarizeIdentitySupportTrail(notifications = [], identity = {}) {
  const identityItems = Array.isArray(identity?.items) ? identity.items : [];
  const playerLookup = new Map(
    identityItems
      .filter((row) => trimText(row?.discordId, 120))
      .map((row) => [trimText(row.discordId, 120), row]),
  );
  const rows = (Array.isArray(notifications) ? notifications : [])
    .filter((row) => isIdentitySupportNotification(row))
    .slice()
    .sort((left, right) => {
      const leftTime = parseDateOrNull(left?.createdAt || left?.updatedAt || left?.data?.occurredAt)?.getTime() || 0;
      const rightTime = parseDateOrNull(right?.createdAt || right?.updatedAt || right?.data?.occurredAt)?.getTime() || 0;
      return rightTime - leftTime;
    });

  return {
    total: rows.length,
    items: rows.slice(0, 8).map((row) => {
      const userId = trimText(row?.data?.userId, 120);
      const player = playerLookup.get(userId) || null;
      return {
        notificationId: trimText(row?.id, 160) || null,
        userId: userId || null,
        displayName: trimText(
          row?.data?.displayName
          || player?.displayName
          || player?.discordId
          || userId,
          160,
        ) || 'player',
        steamId: trimText(row?.data?.steamId || player?.steamId, 120) || null,
        supportIntent: normalizeIdentitySupportIntent(row?.data?.supportIntent || row?.data?.action || 'review'),
        supportOutcome: normalizeIdentitySupportOutcome(row?.data?.supportOutcome || row?.severity || 'reviewing'),
        supportSource: trimText(row?.data?.supportSource || row?.source, 80) || 'tenant',
        supportReason: trimText(row?.data?.supportReason || row?.detail || row?.message, 400) || null,
        followupAction: normalizeIdentitySupportIntent(row?.data?.followupAction || 'review'),
        actor: trimText(row?.data?.actor, 160) || 'admin-web',
        createdAt: row?.createdAt || row?.updatedAt || row?.data?.occurredAt || null,
        acknowledged: isNotificationAcknowledged(row),
        acknowledgedAt: row?.acknowledgedAt || null,
      };
    }),
  };
}

function buildDiagnosticsHeadline(bundle) {
  const tenantName = bundle?.tenant?.name || bundle?.tenant?.slug || bundle?.tenantId || 'tenant';
  const delivery = bundle?.delivery || {};
  const requests = bundle?.requestErrors?.summary || {};
  return {
    tenant: tenantName,
    tenantId: bundle?.tenantId || null,
    status: bundle?.tenant?.status || bundle?.tenantState?.reason || 'unknown',
    deliveryAnomalies: asInt(delivery.anomalies, 0),
    deadLetters: asInt(delivery.deadLetters, 0),
    requestErrors: asInt(requests.total, 0),
    openNotifications: Array.isArray(bundle?.notifications) ? bundle.notifications.length : 0,
  };
}

function resolveTenantDiagnosticsDeps(overrides = {}) {
  const resolved = {
    ...(overrides && typeof overrides === 'object' ? overrides : {}),
  };

  const requirePlatformService = () => require('./platformService');
  const requireRuntimeSupervisorService = () => require('./runtimeSupervisorService');
  const requireAdminNotificationStore = () => require('../store/adminNotificationStore');
  const requireAdminRequestLogStore = () => require('../store/adminRequestLogStore');
  const requirePlatformOpsStateStore = () => require('../store/platformOpsStateStore');
  const requirePlatformAutomationStateStore = () => require('../store/platformAutomationStateStore');
  const requirePlayerAccountStore = () => require('../store/playerAccountStore');

  if (
    !resolved.getPlatformAnalyticsOverview
    || !resolved.getPlatformTenantById
    || !resolved.getTenantOperationalState
    || !resolved.getTenantQuotaSnapshot
    || !resolved.listMarketplaceOffers
    || !resolved.listPlatformAgentRuntimes
    || !resolved.listPlatformApiKeys
    || !resolved.listPlatformLicenses
    || !resolved.listPlatformSubscriptions
    || !resolved.listPlatformWebhookEndpoints
    || !resolved.reconcileDeliveryState
  ) {
    const platformService = requirePlatformService();
    resolved.getPlatformAnalyticsOverview =
      resolved.getPlatformAnalyticsOverview || platformService.getPlatformAnalyticsOverview;
    resolved.getPlatformTenantById =
      resolved.getPlatformTenantById || platformService.getPlatformTenantById;
    resolved.getTenantOperationalState =
      resolved.getTenantOperationalState || platformService.getTenantOperationalState;
    resolved.getTenantQuotaSnapshot =
      resolved.getTenantQuotaSnapshot || platformService.getTenantQuotaSnapshot;
    resolved.listMarketplaceOffers =
      resolved.listMarketplaceOffers || platformService.listMarketplaceOffers;
    resolved.listPlatformAgentRuntimes =
      resolved.listPlatformAgentRuntimes || platformService.listPlatformAgentRuntimes;
    resolved.listPlatformApiKeys =
      resolved.listPlatformApiKeys || platformService.listPlatformApiKeys;
    resolved.listPlatformLicenses =
      resolved.listPlatformLicenses || platformService.listPlatformLicenses;
    resolved.listPlatformSubscriptions =
      resolved.listPlatformSubscriptions || platformService.listPlatformSubscriptions;
    resolved.listPlatformWebhookEndpoints =
      resolved.listPlatformWebhookEndpoints || platformService.listPlatformWebhookEndpoints;
    resolved.reconcileDeliveryState =
      resolved.reconcileDeliveryState || platformService.reconcileDeliveryState;
  }

  if (!resolved.getRuntimeSupervisorSnapshot) {
    resolved.getRuntimeSupervisorSnapshot =
      requireRuntimeSupervisorService().getRuntimeSupervisorSnapshot;
  }
  if (!resolved.listAdminNotifications) {
    resolved.listAdminNotifications =
      requireAdminNotificationStore().listAdminNotifications;
  }
  if (!resolved.listAdminRequestLogs) {
    resolved.listAdminRequestLogs =
      requireAdminRequestLogStore().listAdminRequestLogs;
  }
  if (!resolved.getPlatformOpsState) {
    resolved.getPlatformOpsState =
      requirePlatformOpsStateStore().getPlatformOpsState;
  }
  if (!resolved.getPlatformAutomationState) {
    resolved.getPlatformAutomationState =
      requirePlatformAutomationStateStore().getPlatformAutomationState;
  }
  if (!resolved.listPlayerAccounts) {
    resolved.listPlayerAccounts =
      requirePlayerAccountStore().listPlayerAccounts;
  }

  return resolved;
}

async function buildTenantDiagnosticsBundle(tenantId, options = {}) {
  const scope = assertTenantDbIsolationScope({
    tenantId: trimText(tenantId, 120) || null,
    operation: 'tenant diagnostics bundle',
    env: options.env || process.env,
  });
  const scopedTenantId = trimText(scope.tenantId, 120);
  if (!scopedTenantId) {
    return null;
  }
  const sampleLimit = Math.max(5, Math.min(100, asInt(options.limit, 25, 5)));
  const deps = resolveTenantDiagnosticsDeps(options.deps);

  // Keep this bundle composed from existing sources so support can trust it
  // without learning a second state model.
  const [
    tenant,
    tenantState,
    quota,
    analytics,
    subscriptions,
    licenses,
    apiKeys,
    webhooks,
    agentRuntimes,
    offers,
    reconcile,
    runtimeSupervisor,
    platformOps,
    automation,
    playerAccounts,
  ] = await Promise.all([
    deps.getPlatformTenantById(scopedTenantId),
    deps.getTenantOperationalState(scopedTenantId).catch(() => null),
    deps.getTenantQuotaSnapshot(scopedTenantId).catch(() => null),
    deps.getPlatformAnalyticsOverview({ tenantId: scopedTenantId }).catch(() => null),
    deps.listPlatformSubscriptions({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.listPlatformLicenses({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.listPlatformApiKeys({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.listPlatformWebhookEndpoints({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.listPlatformAgentRuntimes({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.listMarketplaceOffers({ tenantId: scopedTenantId, allowGlobal: false, limit: sampleLimit }).catch(() => []),
    deps.reconcileDeliveryState({
      tenantId: scopedTenantId,
      allowGlobal: false,
      windowMs: options.windowMs,
      pendingOverdueMs: options.pendingOverdueMs,
    }).catch(() => null),
    deps.getRuntimeSupervisorSnapshot().catch(() => null),
    Promise.resolve(deps.getPlatformOpsState()),
    Promise.resolve(deps.getPlatformAutomationState()),
    deps.listPlayerAccounts(sampleLimit, {
      tenantId: scopedTenantId,
      allowGlobal: false,
      env: options.env || process.env,
    }).catch(() => []),
  ]);

  const allNotificationRows = filterRowsByTenant(
    deps.listAdminNotifications({
      limit: sampleLimit * 6,
      tenantId: scopedTenantId,
    }),
    scopedTenantId,
  );
  const notificationRows = allNotificationRows
    .filter((row) => !isNotificationAcknowledged(row))
    .filter((row) => !isIdentitySupportNotification(row))
    .slice(0, sampleLimit);

  const identity = summarizeIdentityDiagnostics(playerAccounts);
  const identityTrail = summarizeIdentitySupportTrail(allNotificationRows, identity);

  const requestErrorRows = deps.listAdminRequestLogs({
    tenantId: scopedTenantId,
    limit: sampleLimit,
    onlyErrors: true,
  });

  const bundle = {
    generatedAt: nowIso(),
    tenantId: scopedTenantId,
    tenant: tenant || null,
    tenantState: tenantState || null,
    quota: quota || null,
    analytics: analytics || null,
    commercial: {
      subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
      licenses: Array.isArray(licenses) ? licenses : [],
      offers: Array.isArray(offers) ? offers : [],
    },
    integrations: {
      apiKeys: Array.isArray(apiKeys) ? apiKeys : [],
      webhooks: Array.isArray(webhooks) ? webhooks : [],
      agentRuntimes: Array.isArray(agentRuntimes) ? agentRuntimes : [],
    },
    delivery: summarizeDeliveryDiagnostics(reconcile || {}),
    notifications: notificationRows,
    requestErrors: {
      summary: summarizeRequestErrors(requestErrorRows),
      items: requestErrorRows,
    },
    runtime: summarizeRuntimeSupervisor(runtimeSupervisor || {}),
    identity: {
      ...identity,
      trail: identityTrail.items,
      trailTotal: identityTrail.total,
    },
    platform: {
      lastMonitoringAt: platformOps?.lastMonitoringAt || null,
      lastReconcileAt: platformOps?.lastReconcileAt || null,
      lastAutomationAt: automation?.lastAutomationAt || null,
      lastForcedMonitoringAt: automation?.lastForcedMonitoringAt || null,
    },
  };

  bundle.headline = buildDiagnosticsHeadline(bundle);
  return bundle;
}

function buildTenantDiagnosticsCsv(bundle) {
  const headline = buildDiagnosticsHeadline(bundle || {});
  const rows = [
    ['generatedAt', bundle?.generatedAt || nowIso()],
    ['tenantId', headline.tenantId || ''],
    ['tenant', headline.tenant || ''],
    ['tenantStatus', headline.status || ''],
    ['deliveryAnomalies', headline.deliveryAnomalies],
    ['deadLetters', headline.deadLetters],
    ['requestErrors', headline.requestErrors],
    ['openNotifications', headline.openNotifications],
    ['subscriptions', Array.isArray(bundle?.commercial?.subscriptions) ? bundle.commercial.subscriptions.length : 0],
    ['licenses', Array.isArray(bundle?.commercial?.licenses) ? bundle.commercial.licenses.length : 0],
    ['apiKeys', Array.isArray(bundle?.integrations?.apiKeys) ? bundle.integrations.apiKeys.length : 0],
    ['webhooks', Array.isArray(bundle?.integrations?.webhooks) ? bundle.integrations.webhooks.length : 0],
    ['agentRuntimes', Array.isArray(bundle?.integrations?.agentRuntimes) ? bundle.integrations.agentRuntimes.length : 0],
    ['marketplaceOffers', Array.isArray(bundle?.commercial?.offers) ? bundle.commercial.offers.length : 0],
    ['runtimeServices', asInt(bundle?.runtime?.total, 0)],
    ['runtimeDegraded', asInt(bundle?.runtime?.degraded, 0)],
    ['lastMonitoringAt', bundle?.platform?.lastMonitoringAt || ''],
    ['lastReconcileAt', bundle?.platform?.lastReconcileAt || ''],
    ['lastAutomationAt', bundle?.platform?.lastAutomationAt || ''],
    ['latestRequestErrorAt', bundle?.requestErrors?.summary?.latestAt || ''],
  ];
  return `${['key', 'value'].join(',')}\n${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

function normalizeStatusToken(value, fallback = 'unknown') {
  const text = trimText(value, 80).toLowerCase();
  return text || fallback;
}

function countQuotaHotspots(quota) {
  const entries = quota && typeof quota === 'object' ? Object.values(quota.quotas || {}) : [];
  return entries.filter((entry) => entry && typeof entry === 'object' && entry.exceeded === true).length;
}

function buildSupportPhase(bundle) {
  const tenantStatus = normalizeStatusToken(bundle?.tenant?.status);
  const subscriptionStatus = normalizeStatusToken(bundle?.tenantState?.subscription?.status, 'missing');
  const licenseStatus = normalizeStatusToken(bundle?.tenantState?.license?.status, 'missing');
  const deadLetters = asInt(bundle?.delivery?.deadLetters, 0);
  const anomalies = asInt(bundle?.delivery?.anomalies, 0);
  const notifications = Array.isArray(bundle?.notifications) ? bundle.notifications.length : 0;
  const degradedRuntime = asInt(bundle?.runtime?.degraded, 0);
  const identityNeedsSupport = asInt(bundle?.identity?.needsSupport, 0);

  if (tenantStatus === 'suspended' || tenantStatus === 'inactive') {
    return {
      key: 'blocked',
      tone: 'danger',
      label: 'blocked',
      detail: 'Tenant access is suspended or inactive.',
    };
  }
  if (bundle?.tenantState?.ok === false && ['tenant-subscription-inactive', 'tenant-license-inactive'].includes(bundle?.tenantState?.reason)) {
    return {
      key: 'commercial-gate',
      tone: 'danger',
      label: 'commercial gate',
      detail: 'Subscription or license state is blocking tenant operations.',
    };
  }
  if (subscriptionStatus === 'trialing' || tenantStatus === 'trialing' || normalizeStatusToken(bundle?.tenant?.type) === 'trial') {
    return {
      key: 'trial',
      tone: 'warning',
      label: 'trial',
      detail: 'Tenant is operating under a trial or pre-commercial lifecycle.',
    };
  }
  if (deadLetters > 0 || anomalies > 0 || notifications > 0 || degradedRuntime > 0) {
    return {
      key: 'attention',
      tone: 'warning',
      label: 'needs attention',
      detail: 'Support or runtime signals need follow-up before the tenant is considered quiet.',
    };
  }
  if (identityNeedsSupport > 0) {
    return {
      key: 'identity-attention',
      tone: 'warning',
      label: 'identity attention',
      detail: 'Player identity issues still need follow-up before player-facing support is quiet.',
    };
  }
  if (subscriptionStatus === 'active' && (licenseStatus === 'active' || licenseStatus === 'trialing')) {
    return {
      key: 'active',
      tone: 'success',
      label: 'active',
      detail: 'Tenant lifecycle and support posture look operational.',
    };
  }
  return {
    key: 'setup',
    tone: 'info',
    label: 'setup',
    detail: 'Tenant exists but onboarding or commercial setup is still incomplete.',
  };
}

function buildOnboardingSteps(bundle) {
  const subscription = bundle?.tenantState?.subscription || bundle?.commercial?.subscriptions?.[0] || null;
  const license = bundle?.tenantState?.license || bundle?.commercial?.licenses?.[0] || null;
  const apiKeys = Array.isArray(bundle?.integrations?.apiKeys) ? bundle.integrations.apiKeys : [];
  const webhooks = Array.isArray(bundle?.integrations?.webhooks) ? bundle.integrations.webhooks : [];
  const runtimes = Array.isArray(bundle?.integrations?.agentRuntimes) ? bundle.integrations.agentRuntimes : [];
  const readyRuntimes = runtimes.filter((row) => normalizeStatusToken(row?.status) === 'ready');

  return [
    {
      key: 'tenant-record',
      required: true,
      status: bundle?.tenant ? 'done' : 'missing',
      detail: bundle?.tenant
        ? `Tenant ${bundle.tenant.name || bundle.tenant.slug || bundle.tenant.id || bundle.tenantId} is registered.`
        : 'Tenant registry row is missing.',
    },
    {
      key: 'operational-gate',
      required: true,
      status: bundle?.tenantState?.ok ? 'done' : 'blocked',
      detail: bundle?.tenantState?.ok
        ? 'Commercial and tenant runtime gate currently allow operations.'
        : `Operational gate reports ${bundle?.tenantState?.reason || 'tenant-not-ready'}.`,
    },
    {
      key: 'subscription',
      required: true,
      status: subscription ? (['active', 'trialing'].includes(normalizeStatusToken(subscription.status)) ? 'done' : 'blocked') : 'missing',
      detail: subscription
        ? `Subscription ${subscription.status || 'unknown'} on ${subscription.planId || subscription.billingCycle || 'custom plan'}.`
        : 'No subscription record is linked to this tenant.',
    },
    {
      key: 'license',
      required: true,
      status: license ? (['active', 'trialing'].includes(normalizeStatusToken(license.status)) ? 'done' : 'blocked') : 'missing',
      detail: license
        ? `License ${license.status || 'unknown'}${license.expiresAt ? ` until ${license.expiresAt}` : ''}.`
        : 'No license record is linked to this tenant.',
    },
    {
      key: 'api-credential',
      required: false,
      status: apiKeys.length > 0 ? 'done' : 'optional',
      detail: apiKeys.length > 0
        ? `${apiKeys.length} API credential(s) provisioned.`
        : 'No API key provisioned yet; keep this empty unless the tenant needs integrations.',
    },
    {
      key: 'webhook-route',
      required: false,
      status: webhooks.length > 0 ? 'done' : 'optional',
      detail: webhooks.length > 0
        ? `${webhooks.length} webhook endpoint(s) configured.`
        : 'No webhook route configured yet; this is optional for tenants without outbound automation.',
    },
    {
      key: 'agent-runtime',
      required: false,
      status: readyRuntimes.length > 0 ? 'done' : (runtimes.length > 0 ? 'warning' : 'optional'),
      detail: readyRuntimes.length > 0
        ? `${readyRuntimes.length} runtime(s) currently report ready state.`
        : (runtimes.length > 0
          ? 'Agent runtimes exist but none currently report ready.'
          : 'No agent runtime heartbeat registered yet.'),
    },
  ];
}

function buildSupportSignals(bundle) {
  const items = [];
  const notificationCount = Array.isArray(bundle?.notifications) ? bundle.notifications.length : 0;
  const requestErrorCount = asInt(bundle?.requestErrors?.summary?.total, 0);
  const deadLetters = asInt(bundle?.delivery?.deadLetters, 0);
  const anomalies = asInt(bundle?.delivery?.anomalies, 0);
  const abuseFindings = asInt(bundle?.delivery?.abuseFindings, 0);
  const degradedRuntime = asInt(bundle?.runtime?.degraded, 0);
  const quotaHotspots = countQuotaHotspots(bundle?.quota);

  if (bundle?.tenantState?.ok === false) {
    items.push({
      key: 'commercial-gate',
      tone: 'danger',
      count: 1,
      detail: `Tenant gate returned ${bundle?.tenantState?.reason || 'tenant-not-ready'}.`,
    });
  }
  if (deadLetters > 0) {
    items.push({
      key: 'dead-letters',
      tone: 'danger',
      count: deadLetters,
      detail: 'Delivery dead letters are present and need operator review.',
    });
  }
  if (anomalies > 0) {
    items.push({
      key: 'delivery-anomalies',
      tone: 'warning',
      count: anomalies,
      detail: 'Delivery reconcile anomalies are still open.',
    });
  }
  if (degradedRuntime > 0) {
    items.push({
      key: 'runtime-degraded',
      tone: 'warning',
      count: degradedRuntime,
      detail: 'One or more managed runtimes are degraded.',
    });
  }
  if (requestErrorCount > 0) {
    items.push({
      key: 'request-errors',
      tone: 'warning',
      count: requestErrorCount,
      detail: 'Admin or support request errors were recorded recently.',
    });
  }
  if (notificationCount > 0) {
    items.push({
      key: 'open-alerts',
      tone: 'warning',
      count: notificationCount,
      detail: 'Open tenant-tagged notifications still need acknowledgement or follow-up.',
    });
  }
  if (quotaHotspots > 0) {
    items.push({
      key: 'quota-hotspots',
      tone: 'warning',
      count: quotaHotspots,
      detail: 'One or more quota buckets are at or over their configured boundary.',
    });
  }
  if (abuseFindings > 0) {
    items.push({
      key: 'abuse-signals',
      tone: 'warning',
      count: abuseFindings,
      detail: 'Anti-abuse signals were raised for this tenant.',
    });
  }
  if (asInt(bundle?.identity?.needsSupport, 0) > 0) {
    items.push({
      key: 'identity-gaps',
      tone: 'warning',
      count: asInt(bundle?.identity?.needsSupport, 0),
      detail: 'Some player identities are missing Steam links or still need account recovery follow-up.',
    });
  }
  return items;
}

function buildSupportActions(bundle, signals) {
  const actions = [];
  const pushAction = (key, tone, detail) => {
    if (actions.some((item) => item.key === key)) return;
    actions.push({ key, tone, detail });
  };

  if (bundle?.tenantState?.ok === false) {
    pushAction('review-commercial-gate', 'danger', 'Confirm tenant status, subscription, and license before continuing with tenant-facing support.');
  }
  if (signals.some((item) => item.key === 'dead-letters')) {
    pushAction('inspect-dead-letters', 'danger', 'Review delivery dead letters and retry posture before confirming any customer-facing outcome.');
  }
  if (signals.some((item) => item.key === 'delivery-anomalies')) {
    pushAction('reconcile-delivery', 'warning', 'Review reconcile anomalies and verify whether purchases were queued, executed, or only partially verified.');
  }
  if (signals.some((item) => item.key === 'runtime-degraded')) {
    pushAction('review-runtime', 'warning', 'Check runtime readiness and restart posture before concluding the tenant issue is resolved.');
  }
  if (signals.some((item) => item.key === 'request-errors')) {
    pushAction('review-request-errors', 'warning', 'Inspect recent request errors for support or operator actions that may have failed mid-flow.');
  }
  if (signals.some((item) => item.key === 'open-alerts')) {
    pushAction('clear-alerts', 'info', 'Review and acknowledge tenant-tagged notifications so the support context is quiet again.');
  }
  if (signals.some((item) => item.key === 'identity-gaps')) {
    pushAction('review-player-identity', 'warning', 'Open the player identity workspace and confirm Steam linking or recovery status before retrying player-facing steps.');
  }
  if (!Array.isArray(bundle?.integrations?.apiKeys) || bundle.integrations.apiKeys.length === 0) {
    pushAction('confirm-integrations', 'info', 'Only provision API keys or webhooks if the tenant actually needs an integration path.');
  }
  if (actions.length === 0) {
    pushAction('case-quiet', 'success', 'No immediate support action is suggested. Export the case bundle if you need a shareable snapshot.');
  }
  return actions.slice(0, 6);
}

async function buildTenantSupportCaseBundle(tenantId, options = {}) {
  assertTenantDbIsolationScope({
    tenantId: trimText(tenantId, 120) || null,
    operation: 'tenant support case bundle',
    env: options.env || process.env,
  });
  const diagnostics = await buildTenantDiagnosticsBundle(tenantId, options);
  if (!diagnostics) return null;

  const phase = buildSupportPhase(diagnostics);
  const onboarding = buildOnboardingSteps(diagnostics);
  const signals = buildSupportSignals(diagnostics);
  const actions = buildSupportActions(diagnostics, signals);
  const completedOnboarding = onboarding.filter((item) => item.status === 'done').length;
  const requiredOnboarding = onboarding.filter((item) => item.required).length;
  const requiredOnboardingReady = onboarding.filter((item) => item.required && item.status === 'done').length;

  return {
    generatedAt: nowIso(),
    tenantId: diagnostics.tenantId,
    tenant: diagnostics.tenant,
    headline: diagnostics.headline,
    lifecycle: {
      ...phase,
      tenantStatus: normalizeStatusToken(diagnostics?.tenant?.status),
      subscriptionStatus: normalizeStatusToken(diagnostics?.tenantState?.subscription?.status, 'missing'),
      licenseStatus: normalizeStatusToken(diagnostics?.tenantState?.license?.status, 'missing'),
    },
    onboarding: {
      completed: completedOnboarding,
      total: onboarding.length,
      requiredCompleted: requiredOnboardingReady,
      requiredTotal: requiredOnboarding,
      items: onboarding,
    },
    signals: {
      total: signals.length,
      items: signals,
    },
    identity: diagnostics.identity || null,
    actions,
    diagnostics,
  };
}

function buildTenantSupportCaseCsv(bundle) {
  const rows = [
    ['generatedAt', bundle?.generatedAt || nowIso()],
    ['tenantId', bundle?.tenantId || ''],
    ['tenant', bundle?.tenant?.name || bundle?.tenant?.slug || bundle?.tenant?.id || ''],
    ['lifecyclePhase', bundle?.lifecycle?.key || ''],
    ['lifecycleDetail', bundle?.lifecycle?.detail || ''],
    ['tenantStatus', bundle?.lifecycle?.tenantStatus || ''],
    ['subscriptionStatus', bundle?.lifecycle?.subscriptionStatus || ''],
    ['licenseStatus', bundle?.lifecycle?.licenseStatus || ''],
    ['onboardingCompleted', asInt(bundle?.onboarding?.completed, 0)],
    ['onboardingTotal', asInt(bundle?.onboarding?.total, 0)],
    ['requiredOnboardingCompleted', asInt(bundle?.onboarding?.requiredCompleted, 0)],
    ['requiredOnboardingTotal', asInt(bundle?.onboarding?.requiredTotal, 0)],
    ['signals', asInt(bundle?.signals?.total, 0)],
    ['actions', Array.isArray(bundle?.actions) ? bundle.actions.length : 0],
    ['identityPlayers', asInt(bundle?.identity?.total, 0)],
    ['identityNeedsSupport', asInt(bundle?.identity?.needsSupport, 0)],
    ['identityMissingSteam', asInt(bundle?.identity?.missingSteam, 0)],
    ['identitySupportTrail', asInt(bundle?.identity?.trailTotal, Array.isArray(bundle?.identity?.trail) ? bundle.identity.trail.length : 0)],
    ['deliveryAnomalies', asInt(bundle?.diagnostics?.delivery?.anomalies, 0)],
    ['deadLetters', asInt(bundle?.diagnostics?.delivery?.deadLetters, 0)],
    ['requestErrors', asInt(bundle?.diagnostics?.requestErrors?.summary?.total, 0)],
    ['notifications', Array.isArray(bundle?.diagnostics?.notifications) ? bundle.diagnostics.notifications.length : 0],
    ['runtimeDegraded', asInt(bundle?.diagnostics?.runtime?.degraded, 0)],
  ];
  return `${['key', 'value'].join(',')}\n${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

module.exports = {
  buildTenantDiagnosticsBundle,
  buildTenantDiagnosticsCsv,
  buildTenantSupportCaseBundle,
  buildTenantSupportCaseCsv,
};
