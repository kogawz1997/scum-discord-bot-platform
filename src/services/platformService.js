const crypto = require('node:crypto');

const config = require('../config');
const { prisma, getTenantScopedPrismaClient, withTenantScopedPrismaClient } = require('../prisma');
const {
  withTenantDbIsolation,
  assertTenantDbIsolationScope,
} = require('../utils/tenantDbIsolation');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');
const {
  buildScopedRowKey,
  dedupeScopedRows,
  isMissingScopedRelationError,
  readAcrossDeliveryPersistenceScopes,
  readAcrossDeliveryPersistenceScopeBatch,
} = require('./deliveryPersistenceDb');
const { publishAdminLiveUpdate } = require('./adminLiveBus');
const { ensureTenantDatabaseTargetProvisioned } = require('../utils/tenantDatabaseProvisioning');
const {
  mergeAgentRuntimeProfile,
  normalizeAgentRuntimeProfile,
} = require('../utils/agentRuntimeProfile');
const {
  getFeatureCatalog,
  getPackageCatalog,
  listPersistedPackageCatalog,
  resolveFeatureAccess,
  resolvePackageForPlan,
  createPackageCatalogEntry,
  updatePackageCatalogEntry,
  deletePackageCatalogEntry,
} = require('../domain/billing/packageCatalogService');
const {
  getPlatformTenantConfig,
} = require('./platformTenantConfigService');
const {
  createInvoiceDraft,
  ensureBillingCustomer,
  recordSubscriptionEvent,
} = require('./platformBillingLifecycleService');
const {
  createPlatformAnalyticsService,
} = require('./platformAnalyticsService');
const {
  createPlatformIntegrationService,
} = require('./platformIntegrationService');
const {
  createPlatformMarketplaceService,
} = require('./platformMarketplaceService');
const {
  createPlatformTenantStateService,
} = require('./platformTenantStateService');
const {
  createPlatformTenantRegistryService,
} = require('./platformTenantRegistryService');
const {
  createPlatformCommercialService,
} = require('./platformCommercialService');
const {
  createPlatformAgentRuntimeService,
} = require('./platformAgentRuntimeService');
const {
  createPlatformEventDispatchService,
} = require('./platformEventDispatchService');
const {
  createPlatformDeliveryReconcileService,
} = require('./platformDeliveryReconcileService');

const PLATFORM_SCOPE_GROUPS = Object.freeze([
  {
    key: 'tenant',
    title: 'Tenant Management',
    scopes: ['tenant:read', 'tenant:write'],
  },
  {
    key: 'subscription',
    title: 'Billing + Subscription',
    scopes: ['subscription:read', 'subscription:write'],
  },
  {
    key: 'license',
    title: 'License + Legal',
    scopes: ['license:read', 'license:write'],
  },
  {
    key: 'marketplace',
    title: 'Marketplace Economy',
    scopes: ['marketplace:read', 'marketplace:write'],
  },
  {
    key: 'webhook',
    title: 'Public API + Webhooks',
    scopes: ['webhook:read', 'webhook:write'],
  },
  {
    key: 'server',
    title: 'Server + Guild Mapping',
    scopes: ['server:read', 'server:write'],
  },
  {
    key: 'server-control',
    title: 'Server Control + Config',
    scopes: ['config:read', 'config:write', 'server:control', 'backup:write'],
  },
  {
    key: 'analytics',
    title: 'Analytics + Monitoring',
    scopes: [
      'analytics:read',
      'delivery:reconcile',
      'agent:write',
      'agent:register',
      'agent:session',
      'agent:sync',
      'agent:execute',
    ],
  },
]);

async function runWithOptionalTenantDbIsolation(tenantId, work, options = {}) {
  const scopedTenantId = trimText(tenantId, 120) || null;
  if (!scopedTenantId) {
    return work(prisma, {
      applied: false,
      tenantId: null,
      enforce: false,
      bypass: false,
      mode: 'application',
    });
  }
  const executeWithTenantClient = typeof withTenantScopedPrismaClient === 'function'
    ? (callback) => withTenantScopedPrismaClient(
      scopedTenantId,
      {
        ...options,
        cache: options.cache === false ? false : options.cache,
        transient: options.transient === true,
      },
      callback,
    )
    : (callback) => callback(getTenantScopedPrismaClient(scopedTenantId, options));
  return executeWithTenantClient((tenantPrisma) => withTenantDbIsolation(
    tenantPrisma,
    { tenantId: scopedTenantId, enforce: true },
    (db, context) => work(db, context),
  ));
}

function shouldUseTransientTenantClient(tenantId, options = {}) {
  if (options.cache === false || options.transient === true) {
    return true;
  }
  return isPreviewTenantId(tenantId);
}

async function runWithTenantScopePreference(tenantId, work, options = {}) {
  return runWithOptionalTenantDbIsolation(
    tenantId,
    work,
    shouldUseTransientTenantClient(tenantId, options)
      ? { ...options, cache: false }
      : options,
  );
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'platform') {
  const suffix = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  return `${prefix}-${suffix}`;
}

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeSlug(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || null;
}

function normalizeTenantType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['direct', 'trial', 'reseller', 'demo'].includes(text)) return text;
  return 'direct';
}

function normalizeStatus(value, allowed = ['active']) {
  const text = String(value || '').trim().toLowerCase();
  if (allowed.includes(text)) return text;
  return allowed[0] || 'active';
}

function normalizeLocale(value) {
  const supported = new Set(
    (config.platform?.localization?.supportedLocales || ['th', 'en'])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean),
  );
  const fallback = String(config.platform?.localization?.defaultLocale || 'th').trim().toLowerCase() || 'th';
  const text = String(value || '').trim().toLowerCase();
  if (text && supported.has(text)) return text;
  return fallback;
}

function normalizeBillingCycle(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['trial', 'monthly', 'quarterly', 'yearly', 'one-time'].includes(text)) return text;
  return 'monthly';
}

function normalizeCurrency(value) {
  return trimText(value || config.platform?.billing?.currency || 'THB', 12).toUpperCase() || 'THB';
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeShopKind(value) {
  const raw = String(value || 'item').trim().toLowerCase();
  if (!raw) return 'item';
  if (raw === 'vip') return 'vip';
  if (raw === 'item') return 'item';
  return raw;
}

function toIso(value) {
  const date = parseDateOrNull(value);
  return date ? date.toISOString() : null;
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function parseJsonOrFallback(value, fallback = null) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function stringifyMeta(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text || null;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function safeMeta(row) {
  return parseJsonOrFallback(row?.metadataJson || row?.metaJson, null);
}

function buildPlatformRowScopeKey(row, fallbackFields = ['id']) {
  const tenantId = trimText(row?.tenantId, 120);
  const fields = Array.isArray(fallbackFields) ? fallbackFields : [fallbackFields];
  const parts = [tenantId || '__shared__'];
  for (const field of fields) {
    const value = trimText(row?.[field], 240);
    if (value) parts.push(value);
  }
  return parts.join(':');
}

function annotatePlatformScopeRow(row, scopeTenantId = null) {
  if (!row || typeof row !== 'object') return row;
  try {
    Object.defineProperty(row, '__scopeTenantId', {
      value: trimText(scopeTenantId, 120) || null,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    row.__scopeTenantId = trimText(scopeTenantId, 120) || null;
  }
  return row;
}

function shouldReplacePlatformDuplicate(currentRow, nextRow) {
  const currentScopeTenantId = trimText(currentRow?.__scopeTenantId, 120);
  const nextScopeTenantId = trimText(nextRow?.__scopeTenantId, 120);
  return !currentScopeTenantId && Boolean(nextScopeTenantId);
}

function dedupePlatformRows(rows, buildKey) {
  const keyBuilder = typeof buildKey === 'function'
    ? buildKey
    : (row) => buildPlatformRowScopeKey(row);
  const deduped = [];
  const keyIndex = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyBuilder(row);
    if (!key) {
      deduped.push(row);
      continue;
    }
    if (!keyIndex.has(key)) {
      keyIndex.set(key, deduped.length);
      deduped.push(row);
      continue;
    }
    const index = keyIndex.get(key);
    if (shouldReplacePlatformDuplicate(deduped[index], row)) {
      deduped[index] = row;
    }
  }
  return deduped;
}

function dedupeDeliveryScopeRows(rows, fields) {
  return dedupeScopedRows(
    rows,
    (row) => buildScopedRowKey(row, fields, { mapSharedScopeToDefaultTenant: true }),
  );
}

async function runTaskSequence(tasks = []) {
  const results = [];
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (typeof task !== 'function') {
      results.push(task);
      continue;
    }
    results.push(await task());
  }
  return results;
}

function sortRowsByTimestampDesc(rows, fields = ['updatedAt', 'createdAt']) {
  const candidates = Array.isArray(fields) ? fields : [fields];
  return (Array.isArray(rows) ? rows : []).slice().sort((left, right) => {
    const leftTime = candidates
      .map((field) => parseDateOrNull(left?.[field]))
      .find(Boolean)?.getTime() || 0;
    const rightTime = candidates
      .map((field) => parseDateOrNull(right?.[field]))
      .find(Boolean)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

async function readAcrossPlatformTenantScopes(readWork, options = {}) {
  if (typeof readWork !== 'function') {
    throw new TypeError('readAcrossPlatformTenantScopes requires a callback');
  }
  const rows = [];
  if (options.includeShared !== false) {
    const sharedRows = await readWork(prisma, null).catch(() => []);
    if (Array.isArray(sharedRows)) rows.push(...sharedRows.map((row) => annotatePlatformScopeRow(row, null)));
  }
  const tenantRows = await prisma.platformTenant.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  }).catch(() => []);
  const seenTenantIds = new Set();
  for (const tenant of tenantRows) {
    const tenantId = trimText(tenant?.id, 120);
    if (!tenantId || seenTenantIds.has(tenantId)) continue;
    seenTenantIds.add(tenantId);
    const scopedRows = await runWithOptionalTenantDbIsolation(
      tenantId,
      (db) => readWork(db, tenantId),
      { cache: false },
    ).catch(() => []);
    if (Array.isArray(scopedRows)) {
      rows.push(...scopedRows.map((row) => annotatePlatformScopeRow(row, tenantId)));
    }
  }
  return dedupePlatformRows(rows, options.buildKey);
}

async function readAcrossPlatformTenantScopesBatch(taskEntries, options = {}) {
  const entries = Object.entries(taskEntries || {})
    .filter(([key, task]) => trimText(key, 120) && typeof task === 'function');
  const results = Object.fromEntries(entries.map(([key]) => [key, []]));
  if (entries.length === 0) {
    return results;
  }

  if (options.includeShared !== false) {
    for (const [key, task] of entries) {
      const sharedRows = await task(prisma, null).catch(() => []);
      if (Array.isArray(sharedRows)) {
        results[key].push(...sharedRows.map((row) => annotatePlatformScopeRow(row, null)));
      }
    }
  }

  const tenantRows = await prisma.platformTenant.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  }).catch(() => []);
  const seenTenantIds = new Set();
  for (const tenant of tenantRows) {
    const tenantId = trimText(tenant?.id, 120);
    if (!tenantId || seenTenantIds.has(tenantId)) continue;
    seenTenantIds.add(tenantId);
    const scopedResults = await runWithOptionalTenantDbIsolation(
      tenantId,
      async (db) => {
        const scopedRows = {};
        for (const [key, task] of entries) {
          const rows = await task(db, tenantId);
          scopedRows[key] = Array.isArray(rows) ? rows : [];
        }
        return scopedRows;
      },
      { cache: false },
    ).catch(() => null);
    if (!scopedResults || typeof scopedResults !== 'object') continue;
    for (const [key] of entries) {
      const scopedRows = Array.isArray(scopedResults[key]) ? scopedResults[key] : [];
      if (scopedRows.length > 0) {
        results[key].push(...scopedRows.map((row) => annotatePlatformScopeRow(row, tenantId)));
      }
    }
  }

  return results;
}

function compareVersions(left, right) {
  const leftParts = String(left || '').trim().split('.').map((item) => Number(item || 0));
  const rightParts = String(right || '').trim().split('.').map((item) => Number(item || 0));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let i = 0; i < length; i += 1) {
    const l = Number.isFinite(leftParts[i]) ? leftParts[i] : 0;
    const r = Number.isFinite(rightParts[i]) ? rightParts[i] : 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

function getPlanCatalog() {
  return Array.isArray(config.platform?.billing?.plans)
    ? config.platform.billing.plans.map((plan) => ({
      id: trimText(plan.id, 80),
      name: trimText(plan.name, 160),
      type: trimText(plan.type, 40) || 'subscription',
      amountCents: asInt(plan.amountCents, 0, 0),
      billingCycle: normalizeBillingCycle(plan.billingCycle),
      intervalDays: asInt(plan.intervalDays, 30, 1),
      seats: asInt(plan.seats, 1, 1),
      features: Array.isArray(plan.features)
        ? plan.features.map((entry) => trimText(entry, 200)).filter(Boolean)
        : [],
      quotas: normalizePlanQuotas(plan.quotas),
    })).filter((plan) => plan.id && plan.name)
    : [];
}

function getFeatureCatalogSummary() {
  return getFeatureCatalog();
}

function getPackageCatalogSummary(options = {}) {
  return getPackageCatalog(options);
}

function findPlanById(planId) {
  const requested = trimText(planId, 120);
  if (!requested) return null;
  const normalizedRequested = requested.toLowerCase().replace(/^platform-/, '');
  return getPlanCatalog().find((plan) => {
    const current = trimText(plan.id, 120);
    if (!current) return false;
    const normalizedCurrent = current.toLowerCase().replace(/^platform-/, '');
    return current === requested || normalizedCurrent === normalizedRequested;
  }) || null;
}

function normalizeQuotaLimit(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.max(0, Math.trunc(parsed));
}

function normalizePlanQuotas(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    apiKeys: normalizeQuotaLimit(source.apiKeys),
    webhooks: normalizeQuotaLimit(source.webhooks),
    agentRuntimes: normalizeQuotaLimit(source.agentRuntimes),
    marketplaceOffers: normalizeQuotaLimit(source.marketplaceOffers),
    purchases30d: normalizeQuotaLimit(source.purchases30d),
  };
}

function buildQuotaEntry(limit, used) {
  const normalizedLimit = normalizeQuotaLimit(limit);
  const normalizedUsed = Math.max(0, asInt(used, 0, 0));
  const unlimited = normalizedLimit == null;
  return {
    limit: unlimited ? null : normalizedLimit,
    used: normalizedUsed,
    remaining: unlimited ? null : Math.max(0, normalizedLimit - normalizedUsed),
    exceeded: unlimited ? false : normalizedUsed >= normalizedLimit,
    unlimited,
  };
}

function maskLicenseKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}-${text.slice(4, 8)}-****`;
}

function sanitizeTenantRow(row) {
  if (!row) return null;
  return {
    ...row,
    metadata: safeMeta(row),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function getSharedTenantRegistryRow(tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) return null;
  return prisma.platformTenant.findUnique({
    where: { id },
  });
}

function sanitizeSubscriptionRow(row) {
  if (!row) return null;
  return {
    ...row,
    metadata: safeMeta(row),
    startedAt: toIso(row.startedAt),
    renewsAt: toIso(row.renewsAt),
    canceledAt: toIso(row.canceledAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function sanitizeLicenseRow(row, options = {}) {
  if (!row) return null;
  const exposeFullKey = options.exposeFullKey === true;
  return {
    ...row,
    licenseKey: exposeFullKey ? row.licenseKey : maskLicenseKey(row.licenseKey),
    metadata: safeMeta(row),
    issuedAt: toIso(row.issuedAt),
    expiresAt: toIso(row.expiresAt),
    legalAcceptedAt: toIso(row.legalAcceptedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function sanitizeAgentRow(row) {
  if (!row) return null;
  const meta = safeMeta(row);
  const runtimeProfile = normalizeAgentRuntimeProfile({
    runtimeKey: row.runtimeKey,
    channel: row.channel,
    meta,
  });
  return {
    ...row,
    meta: mergeAgentRuntimeProfile(meta, runtimeProfile),
    lastSeenAt: toIso(row.lastSeenAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function isTenantRuntimeStatusAllowed(status) {
  const normalized = normalizeStatus(status, ['active', 'trialing', 'paused', 'suspended', 'inactive']);
  return normalized === 'active' || normalized === 'trialing';
}

function isSubscriptionOperational(row) {
  if (!row) return true;
  const status = normalizeStatus(row.status, ['active', 'trialing', 'paused', 'past_due', 'canceled', 'expired']);
  return status === 'active' || status === 'trialing';
}

function isLicenseOperational(row) {
  if (!row) return true;
  const status = normalizeStatus(row.status, ['active', 'trialing', 'expired', 'revoked']);
  if (!(status === 'active' || status === 'trialing')) return false;
  const expiresAt = parseDateOrNull(row.expiresAt);
  return !expiresAt || expiresAt.getTime() >= Date.now();
}

function isPreviewTenantId(tenantId) {
  const id = trimText(tenantId, 120).toLowerCase();
  return id.startsWith('tenant-preview-') || id.startsWith('preview-');
}

function shouldUsePreviewScopedFallback(error, tenantId) {
  return isPreviewTenantId(tenantId) && isMissingScopedRelationError(error, tenantId);
}

function isPreviewScopedTransactionAbort(error, tenantId) {
  if (!isPreviewTenantId(tenantId)) return false;
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('current transaction is aborted')
    || message.includes('25p02')
    || message.includes('error in batch request');
}

function isScopedTransactionTimeout(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return String(error?.code || '').trim().toUpperCase() === 'P2028'
    || message.includes('transaction already closed')
    || message.includes('expired transaction')
    || message.includes('current transaction is aborted')
    || message.includes('error in batch request');
}

async function readTenantSubscriptionAndLicense(db, tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return { subscription: null, license: null };
  }
  const [subscription, license] = await Promise.all([
    db.platformSubscription.findFirst({
      where: { tenantId: id },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    db.platformLicense.findFirst({
      where: { tenantId: id },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);
  return { subscription, license };
}

async function loadTenantSubscriptionAndLicense(db, tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return { subscription: null, license: null, missingScopedSchema: false };
  }
  try {
    const { subscription, license } = await readTenantSubscriptionAndLicense(db, id);
    return { subscription, license, missingScopedSchema: false };
  } catch (error) {
    if (shouldUsePreviewScopedFallback(error, id)) {
      return { subscription: null, license: null, missingScopedSchema: true };
    }
    if (db !== prisma && isScopedTransactionTimeout(error)) {
      const { subscription, license } = await readTenantSubscriptionAndLicense(prisma, id);
      return { subscription, license, missingScopedSchema: false };
    }
    throw error;
  }
}

async function safePreviewScopedCount(db, modelName, args, tenantId) {
  try {
    return await db[modelName].count(args);
  } catch (error) {
    if (shouldUsePreviewScopedFallback(error, tenantId)) {
      return 0;
    }
    throw error;
  }
}

async function dispatchPlatformWebhookEvent(eventType, payload = {}, options = {}) {
  return platformEventDispatchService.dispatchPlatformWebhookEvent(eventType, payload, options);
}

async function emitPlatformEvent(eventType, payload = {}, options = {}) {
  return platformEventDispatchService.emitPlatformEvent(eventType, payload, options);
}

const platformTenantStateService = createPlatformTenantStateService({
  prisma,
  trimText,
  getPlatformTenantConfig,
  resolveFeatureAccess,
  findPlanById,
  normalizePlanQuotas,
  buildQuotaEntry,
  sanitizeTenantRow,
  sanitizeSubscriptionRow,
  sanitizeLicenseRow,
  isTenantRuntimeStatusAllowed,
  isSubscriptionOperational,
  isLicenseOperational,
  getSharedTenantRegistryRow,
  loadTenantSubscriptionAndLicense,
  safePreviewScopedCount,
  runWithTenantScopePreference,
  shouldUsePreviewScopedFallback,
  isPreviewScopedTransactionAbort,
  isScopedTransactionTimeout,
  isPreviewTenantId,
});

const platformEventDispatchService = createPlatformEventDispatchService({
  trimText,
  nowIso,
  publishAdminLiveUpdate,
  assertTenantDbIsolationScope,
  runWithOptionalTenantDbIsolation,
});

const platformTenantRegistryService = createPlatformTenantRegistryService({
  prisma,
  trimText,
  createId,
  normalizeSlug,
  normalizeTenantType,
  normalizeStatus,
  normalizeLocale,
  stringifyMeta,
  sanitizeTenantRow,
  getTenantDatabaseTopologyMode,
  ensureTenantDatabaseTargetProvisioned,
  emitPlatformEvent,
});

const platformCommercialService = createPlatformCommercialService({
  crypto,
  config,
  prisma,
  trimText,
  asInt,
  normalizeStatus,
  normalizeBillingCycle,
  normalizeCurrency,
  parseDateOrNull,
  stringifyMeta,
  createId,
  findPlanById,
  sanitizeSubscriptionRow,
  sanitizeLicenseRow,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  readAcrossPlatformTenantScopes,
  sortRowsByTimestampDesc,
  buildPlatformRowScopeKey,
  getSharedTenantRegistryRow,
  resolvePackageForPlan,
  ensureBillingCustomer,
  createInvoiceDraft,
  recordSubscriptionEvent,
  emitPlatformEvent,
});

const platformAgentRuntimeService = createPlatformAgentRuntimeService({
  config,
  trimText,
  asInt,
  normalizeStatus,
  parseJsonOrFallback,
  stringifyMeta,
  createId,
  compareVersions,
  sanitizeAgentRow,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  readAcrossPlatformTenantScopes,
  sortRowsByTimestampDesc,
  buildPlatformRowScopeKey,
  getSharedTenantRegistryRow,
  assertTenantQuotaAvailable,
  mergeAgentRuntimeProfile,
  normalizeAgentRuntimeProfile,
  publishAdminLiveUpdate,
  emitPlatformEvent,
});

async function createTenant(input = {}, actor = 'system') {
  return platformTenantRegistryService.createTenant(input, actor);
}

async function listPlatformTenants(options = {}) {
  return platformTenantRegistryService.listPlatformTenants(options);
}

async function getPlatformTenantById(tenantId) {
  return platformTenantRegistryService.getPlatformTenantById(tenantId);
}

async function getTenantOperationalState(tenantId, options = {}) {
  return platformTenantStateService.getTenantOperationalState(tenantId, options);
}

async function getTenantQuotaSnapshot(tenantId, options = {}) {
  return platformTenantStateService.getTenantQuotaSnapshot(tenantId, options);
}

async function assertTenantQuotaAvailable(tenantId, quotaKey, nextUsageIncrement = 1) {
  return platformTenantStateService.assertTenantQuotaAvailable(tenantId, quotaKey, nextUsageIncrement);
}

async function createSubscription(input = {}, actor = 'system') {
  return platformCommercialService.createSubscription(input, actor);
}

async function listPlatformSubscriptions(options = {}) {
  return platformCommercialService.listPlatformSubscriptions(options);
}

async function issuePlatformLicense(input = {}, actor = 'system') {
  return platformCommercialService.issuePlatformLicense(input, actor);
}

async function acceptPlatformLicenseLegal(input = {}, actor = 'system') {
  return platformCommercialService.acceptPlatformLicenseLegal(input, actor);
}

async function listPlatformLicenses(options = {}) {
  return platformCommercialService.listPlatformLicenses(options);
}

async function recordPlatformAgentHeartbeat(input = {}, actor = 'platform-api') {
  return platformAgentRuntimeService.recordPlatformAgentHeartbeat(input, actor);
}

async function listPlatformAgentRuntimes(options = {}) {
  return platformAgentRuntimeService.listPlatformAgentRuntimes(options);
}

const platformAnalyticsService = createPlatformAnalyticsService({
  config,
  prisma,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  readAcrossPlatformTenantScopesBatch,
  readAcrossDeliveryPersistenceScopeBatch,
  dedupePlatformRows,
  buildPlatformRowScopeKey,
  dedupeDeliveryScopeRows,
  getTenantQuotaSnapshot,
  nowIso,
  trimText,
  asInt,
  normalizeShopKind,
  getPlanCatalog,
  getFeatureCatalogSummary,
  getPackageCatalogSummary,
  listPersistedPackageCatalog,
  listMarketplaceOffers,
});

const platformIntegrationService = createPlatformIntegrationService({
  crypto,
  prisma,
  scopeGroups: PLATFORM_SCOPE_GROUPS,
  trimText,
  asInt,
  normalizeStatus,
  parseJsonOrFallback,
  toIso,
  createId,
  sha256,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  readAcrossPlatformTenantScopes,
  sortRowsByTimestampDesc,
  buildPlatformRowScopeKey,
  dedupePlatformRows,
  annotatePlatformScopeRow,
  getSharedTenantRegistryRow,
  assertTenantQuotaAvailable,
  emitPlatformEvent,
  getTenantOperationalState,
});

const platformMarketplaceService = createPlatformMarketplaceService({
  trimText,
  asInt,
  normalizeStatus,
  normalizeCurrency,
  normalizeLocale,
  stringifyMeta,
  toIso,
  createId,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  readAcrossPlatformTenantScopes,
  sortRowsByTimestampDesc,
  buildPlatformRowScopeKey,
  getSharedTenantRegistryRow,
  assertTenantQuotaAvailable,
  emitPlatformEvent,
});

const platformDeliveryReconcileService = createPlatformDeliveryReconcileService({
  config,
  prisma,
  assertTenantDbIsolationScope,
  getTenantDatabaseTopologyMode,
  runWithOptionalTenantDbIsolation,
  getTenantOperationalState,
  readAcrossDeliveryPersistenceScopes,
  readAcrossDeliveryPersistenceScopeBatch,
  dedupeDeliveryScopeRows,
  nowIso,
  trimText,
  asInt,
  parseDateOrNull,
  normalizeShopKind,
});

async function createMarketplaceOffer(input = {}, actor = 'system') {
  return platformMarketplaceService.createMarketplaceOffer(input, actor);
}

async function listMarketplaceOffers(options = {}) {
  return platformMarketplaceService.listMarketplaceOffers(options);
}

async function createPlatformApiKey(input = {}, actor = 'system') {
  return platformIntegrationService.createPlatformApiKey(input, actor);
}

async function listPlatformApiKeys(options = {}) {
  return platformIntegrationService.listPlatformApiKeys(options);
}

async function revokePlatformApiKey(apiKeyId, actor = 'system') {
  return platformIntegrationService.revokePlatformApiKey(apiKeyId, actor);
}

async function rotatePlatformApiKey(input = {}, actor = 'system') {
  return platformIntegrationService.rotatePlatformApiKey(input, actor);
}

async function verifyPlatformApiKey(rawKey, requiredScopes = []) {
  return platformIntegrationService.verifyPlatformApiKey(rawKey, requiredScopes);
}

async function createPlatformWebhookEndpoint(input = {}, actor = 'system') {
  return platformIntegrationService.createPlatformWebhookEndpoint(input, actor);
}

async function listPlatformWebhookEndpoints(options = {}) {
  return platformIntegrationService.listPlatformWebhookEndpoints(options);
}

async function getPlatformAnalyticsOverview(options = {}) {
  return platformAnalyticsService.getPlatformAnalyticsOverview(options);
}

async function reconcileDeliveryState(options = {}) {
  return platformDeliveryReconcileService.reconcileDeliveryState(options);
}

async function getPlatformPublicOverview() {
  return platformAnalyticsService.getPlatformPublicOverview();
}

function getPlatformPermissionCatalog() {
  return PLATFORM_SCOPE_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    scopes: [...group.scopes],
  }));
}

module.exports = {
  acceptPlatformLicenseLegal,
  assertTenantQuotaAvailable,
  compareVersions,
  createMarketplaceOffer,
  createPackageCatalogEntry,
  createPlatformApiKey,
  createPlatformWebhookEndpoint,
  createSubscription,
  createTenant,
  deletePackageCatalogEntry,
  dispatchPlatformWebhookEvent,
  emitPlatformEvent,
  getFeatureCatalog: getFeatureCatalogSummary,
  getPlanCatalog,
  getPackageCatalog: getPackageCatalogSummary,
  getPlatformAnalyticsOverview,
  getPlatformPermissionCatalog,
  getPlatformPublicOverview,
  getPlatformTenantById,
  getTenantFeatureAccess: async (tenantId, options = {}) => {
    const snapshot = await getTenantQuotaSnapshot(tenantId, options);
    return {
      tenantId: snapshot?.tenantId || trimText(tenantId, 120) || null,
      package: snapshot?.package || null,
      features: Array.isArray(snapshot?.features) ? snapshot.features : [],
      enabledFeatureKeys: Array.isArray(snapshot?.enabledFeatureKeys) ? snapshot.enabledFeatureKeys : [],
      featureOverrides: snapshot?.featureOverrides || { enabled: [], disabled: [] },
      plan: snapshot?.plan || null,
    };
  },
  getTenantQuotaSnapshot,
  getTenantOperationalState,
  issuePlatformLicense,
  listMarketplaceOffers,
  listPersistedPackageCatalog,
  listPlatformAgentRuntimes,
  listPlatformApiKeys,
  listPlatformLicenses,
  listPlatformSubscriptions,
  listPlatformTenants,
  listPlatformWebhookEndpoints,
  recordPlatformAgentHeartbeat,
  reconcileDeliveryState,
  revokePlatformApiKey,
  rotatePlatformApiKey,
  updatePackageCatalogEntry,
  verifyPlatformApiKey,
};
