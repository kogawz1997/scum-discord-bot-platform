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
  resolveFeatureAccess,
  resolvePackageForPlan,
} = require('../domain/billing/packageCatalogService');
const {
  getPlatformTenantConfig,
} = require('./platformTenantConfigService');

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

function hmacSha256(secret, payload) {
  return crypto.createHmac('sha256', String(secret || '')).update(String(payload || ''), 'utf8').digest('hex');
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

async function listPlatformApiKeyCandidates(options = {}) {
  const keyPrefix = trimText(options.keyPrefix, 120);
  if (!keyPrefix) return [];
  const take = Math.max(1, Math.min(50, asInt(options.limit, 10, 1)));
  const rows = [];
  const sharedRows = await prisma.platformApiKey.findMany({
    where: { keyPrefix },
    take,
  }).catch(() => []);
  if (Array.isArray(sharedRows)) {
    rows.push(...sharedRows.map((row) => annotatePlatformScopeRow(row, null)));
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
    const scopedRows = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformApiKey.findMany({
      where: { keyPrefix },
      take,
    }), { cache: false }).catch(() => []);
    if (Array.isArray(scopedRows)) {
      rows.push(...scopedRows.map((row) => annotatePlatformScopeRow(row, tenantId)));
    }
  }
  return dedupePlatformRows(
    rows,
    // Prefer the tenant-scoped copy when shared cutover rows still exist for the same key material.
    (row) => [
      trimText(row?.tenantId, 120) || '__shared__',
      trimText(row?.keyPrefix, 120),
      trimText(row?.keyHash, 240),
    ].join(':'),
  );
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

function getPackageCatalogSummary() {
  return getPackageCatalog();
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

function maskSecret(value, visible = 6) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= visible) return text;
  return `${text.slice(0, visible)}***`;
}

function maskLicenseKey(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= 8) return text;
  return `${text.slice(0, 4)}-${text.slice(4, 8)}-****`;
}

function buildApiKeyScopes(scopes) {
  const allowed = new Set(PLATFORM_SCOPE_GROUPS.flatMap((group) => group.scopes));
  return Array.from(
    new Set((Array.isArray(scopes) ? scopes : [scopes])
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => allowed.has(entry))),
  );
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

function sanitizeApiKeyRow(row) {
  if (!row) return null;
  return {
    ...row,
    scopes: parseJsonOrFallback(row.scopesJson, []),
    keyHash: undefined,
    lastUsedAt: toIso(row.lastUsedAt),
    revokedAt: toIso(row.revokedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function sanitizeWebhookRow(row, options = {}) {
  if (!row) return null;
  const includeSecret = options.includeSecret === true;
  return {
    ...row,
    secretValue: includeSecret ? row.secretValue : maskSecret(row.secretValue),
    lastSuccessAt: toIso(row.lastSuccessAt),
    lastFailureAt: toIso(row.lastFailureAt),
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

function sanitizeMarketplaceRow(row) {
  if (!row) return null;
  return {
    ...row,
    meta: safeMeta(row),
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

async function loadTenantSubscriptionAndLicense(db, tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return { subscription: null, license: null, missingScopedSchema: false };
  }
  try {
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
    return { subscription, license, missingScopedSchema: false };
  } catch (error) {
    if (shouldUsePreviewScopedFallback(error, id)) {
      return { subscription: null, license: null, missingScopedSchema: true };
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

async function getTenantOperationalStateInternal(db, tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return { ok: false, reason: 'tenant-required', tenant: null, subscription: null, license: null };
  }
  const tenant = await getSharedTenantRegistryRow(id);
  if (!tenant) {
    return { ok: false, reason: 'tenant-not-found', tenant: null, subscription: null, license: null };
  }

  const {
    subscription,
    license,
    missingScopedSchema,
  } = await loadTenantSubscriptionAndLicense(db, id);

  if (!isTenantRuntimeStatusAllowed(tenant.status)) {
    return {
      ok: false,
      reason: 'tenant-access-suspended',
      tenant: sanitizeTenantRow(tenant),
      subscription: sanitizeSubscriptionRow(subscription),
      license: sanitizeLicenseRow(license),
    };
  }
  if (missingScopedSchema) {
    return {
      ok: false,
      reason: 'tenant-preview-provisioning-pending',
      tenant: sanitizeTenantRow(tenant),
      subscription: null,
      license: null,
    };
  }
  if (!isSubscriptionOperational(subscription)) {
    return {
      ok: false,
      reason: 'tenant-subscription-inactive',
      tenant: sanitizeTenantRow(tenant),
      subscription: sanitizeSubscriptionRow(subscription),
      license: sanitizeLicenseRow(license),
    };
  }
  if (!isLicenseOperational(license)) {
    return {
      ok: false,
      reason: 'tenant-license-inactive',
      tenant: sanitizeTenantRow(tenant),
      subscription: sanitizeSubscriptionRow(subscription),
      license: sanitizeLicenseRow(license),
    };
  }

  return {
    ok: true,
    reason: 'ready',
    tenant: sanitizeTenantRow(tenant),
    subscription: sanitizeSubscriptionRow(subscription),
    license: sanitizeLicenseRow(license),
  };
}

async function getTenantOperationalState(tenantId, options = {}) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return { ok: false, reason: 'tenant-required', tenant: null, subscription: null, license: null };
  }
  if (options.db) {
    return getTenantOperationalStateInternal(options.db, id);
  }
  return runWithTenantScopePreference(id, (db) => getTenantOperationalStateInternal(db, id), options);
}

async function getTenantQuotaSnapshotInternal(db, tenantId) {
  const id = trimText(tenantId, 120);
  const tenantConfig = id ? await getPlatformTenantConfig(id).catch(() => null) : null;
  if (!id) {
    return {
      ok: false,
      reason: 'tenant-required',
      tenantId: null,
      plan: null,
      subscription: null,
      license: null,
      package: null,
      features: [],
      enabledFeatureKeys: [],
      featureOverrides: { enabled: [], disabled: [] },
      quotas: {},
    };
  }

  const tenantState = await getTenantOperationalStateInternal(db, id);
  const activeState = tenantState.ok
    ? tenantState
    : await (async () => {
      const tenant = await getSharedTenantRegistryRow(id);
      if (!tenant) return tenantState;
      const { subscription, license } = await loadTenantSubscriptionAndLicense(db, id);
      return {
        ok: false,
        reason: tenantState.reason || 'tenant-not-ready',
        tenant: sanitizeTenantRow(tenant),
        subscription: sanitizeSubscriptionRow(subscription),
        license: sanitizeLicenseRow(license),
      };
    })();

  if (!activeState.tenant) {
    const featureAccess = resolveFeatureAccess({
      planId: activeState.subscription?.planId || null,
      featureFlags: tenantConfig?.featureFlags || null,
      metadata: activeState.subscription?.metadata || null,
    });
    return {
      ok: false,
      reason: activeState.reason || 'tenant-not-found',
      tenantId: id,
      tenant: null,
      plan: null,
      subscription: null,
      license: null,
      package: featureAccess.package,
      features: featureAccess.catalog,
      enabledFeatureKeys: featureAccess.enabledFeatureKeys,
      featureOverrides: featureAccess.overrides,
      quotas: {},
    };
  }

  const plan = findPlanById(activeState.subscription?.planId);
  const featureAccess = resolveFeatureAccess({
    planId: activeState.subscription?.planId || null,
    featureFlags: tenantConfig?.featureFlags || null,
    metadata: activeState.subscription?.metadata || null,
  });
  const quotas = normalizePlanQuotas(plan?.quotas);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    apiKeysUsed,
    webhooksUsed,
    agentRuntimesUsed,
    marketplaceOffersUsed,
    purchases30dUsed,
  ] = await Promise.all([
    safePreviewScopedCount(db, 'platformApiKey', {
      where: {
        tenantId: id,
        status: 'active',
        revokedAt: null,
      },
    }, id),
    safePreviewScopedCount(db, 'platformWebhookEndpoint', {
      where: {
        tenantId: id,
        enabled: true,
      },
    }, id),
    safePreviewScopedCount(db, 'platformAgentRuntime', {
      where: {
        tenantId: id,
      },
    }, id),
    safePreviewScopedCount(db, 'platformMarketplaceOffer', {
      where: {
        tenantId: id,
        status: {
          not: 'archived',
        },
      },
    }, id),
    safePreviewScopedCount(db, 'purchase', {
      where: {
        tenantId: id,
        createdAt: {
          gte: since30d,
        },
      },
    }, id),
  ]);

  return {
    ok: true,
    reason: activeState.ok ? 'ready' : activeState.reason || 'tenant-not-ready',
    tenantId: id,
    tenant: activeState.tenant,
    plan: plan ? {
      id: plan.id,
      name: plan.name,
      billingCycle: plan.billingCycle,
      quotas: plan.quotas,
    } : null,
    subscription: activeState.subscription || null,
    license: activeState.license || null,
    package: featureAccess.package,
    features: featureAccess.catalog,
    enabledFeatureKeys: featureAccess.enabledFeatureKeys,
    featureOverrides: featureAccess.overrides,
    quotas: {
      apiKeys: buildQuotaEntry(quotas.apiKeys, apiKeysUsed),
      webhooks: buildQuotaEntry(quotas.webhooks, webhooksUsed),
      agentRuntimes: buildQuotaEntry(quotas.agentRuntimes, agentRuntimesUsed),
      marketplaceOffers: buildQuotaEntry(quotas.marketplaceOffers, marketplaceOffersUsed),
      purchases30d: buildQuotaEntry(quotas.purchases30d, purchases30dUsed),
    },
  };
}

async function getTenantQuotaSnapshot(tenantId, options = {}) {
  const id = trimText(tenantId, 120);
  if (!id) {
    return {
      ok: false,
      reason: 'tenant-required',
      tenantId: null,
      plan: null,
      subscription: null,
      license: null,
      package: null,
      features: [],
      enabledFeatureKeys: [],
      featureOverrides: { enabled: [], disabled: [] },
      quotas: {},
    };
  }
  if (options.db) {
    return getTenantQuotaSnapshotInternal(options.db, id);
  }
  return runWithTenantScopePreference(id, (db) => getTenantQuotaSnapshotInternal(db, id), options);
}

async function assertTenantQuotaAvailable(tenantId, quotaKey, nextUsageIncrement = 1) {
  const normalizedQuotaKey = trimText(quotaKey, 80);
  const increment = Math.max(1, asInt(nextUsageIncrement, 1, 1));
  const snapshot = await getTenantQuotaSnapshot(tenantId);
  if (!snapshot.ok && !snapshot.tenant) {
    return {
      ok: false,
      reason: snapshot.reason || 'tenant-required',
      quotaKey: normalizedQuotaKey || null,
      snapshot,
    };
  }
  const entry = snapshot.quotas?.[normalizedQuotaKey];
  if (!entry) {
    return {
      ok: false,
      reason: 'unknown-quota-key',
      quotaKey: normalizedQuotaKey || null,
      snapshot,
    };
  }
  if (entry.unlimited) {
    return {
      ok: true,
      quotaKey: normalizedQuotaKey,
      quota: {
        ...entry,
        projectedUsed: entry.used + increment,
      },
      snapshot,
    };
  }
  if (entry.used + increment > entry.limit) {
    return {
      ok: false,
      reason: 'tenant-quota-exceeded',
      quotaKey: normalizedQuotaKey,
      quota: {
        ...entry,
        projectedUsed: entry.used + increment,
      },
      snapshot,
    };
  }
  return {
    ok: true,
    quotaKey: normalizedQuotaKey,
    quota: {
      ...entry,
      projectedUsed: entry.used + increment,
    },
    snapshot,
  };
}

async function dispatchPlatformWebhookEvent(eventType, payload = {}, options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform webhook dispatch',
  });
  return runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    const endpoints = await db.platformWebhookEndpoint.findMany({
      where: {
        enabled: true,
        ...(tenantId ? { tenantId } : {}),
        OR: [
          { eventType: String(eventType || '').trim() || 'unknown' },
          { eventType: '*' },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const body = JSON.stringify({
      eventType: String(eventType || 'platform.unknown'),
      deliveredAt: nowIso(),
      payload: payload && typeof payload === 'object' ? payload : {},
    });
    const results = [];
    for (const endpoint of endpoints) {
      const signature = hmacSha256(endpoint.secretValue, body);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(endpoint.targetUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'x-scum-platform-event': String(eventType || 'platform.unknown'),
            'x-scum-signature': `sha256=${signature}`,
          },
          body,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        await db.platformWebhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            lastSuccessAt: new Date(),
            lastError: null,
          },
        });
        results.push({ id: endpoint.id, ok: true, status: res.status });
      } catch (error) {
        await db.platformWebhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            lastFailureAt: new Date(),
            lastError: trimText(error?.message || error, 400),
          },
        });
        publishAdminLiveUpdate('ops-alert', {
          source: 'platform-webhook',
          kind: 'platform-webhook-failed',
          tenantId: endpoint.tenantId,
          endpointId: endpoint.id,
          targetUrl: endpoint.targetUrl,
          eventType,
          error: trimText(error?.message || error, 240),
        });
        results.push({ id: endpoint.id, ok: false, error: trimText(error?.message || error, 400) });
      }
    }
    return results;
  });
}

async function emitPlatformEvent(eventType, payload = {}, options = {}) {
  publishAdminLiveUpdate('platform-event', {
    eventType,
    source: 'platform-service',
    ...payload,
  });
  try {
    await dispatchPlatformWebhookEvent(eventType, payload, options);
  } catch (error) {
    console.error('[platform] webhook dispatch failed:', error.message);
  }
}

async function createTenant(input = {}, actor = 'system') {
  const id = trimText(input.id, 120) || createId('tenant');
  const slug = normalizeSlug(input.slug || input.name);
  const name = trimText(input.name, 180);
  if (!slug || !name) {
    return { ok: false, reason: 'invalid-tenant' };
  }
  const parentTenantId = trimText(input.parentTenantId, 120) || null;
  if (parentTenantId && parentTenantId === id) {
    return { ok: false, reason: 'tenant-parent-self' };
  }
  if (parentTenantId) {
    const parentTenant = await prisma.platformTenant.findUnique({ where: { id: parentTenantId } });
    if (!parentTenant) {
      return { ok: false, reason: 'tenant-parent-not-found' };
    }
  }
  const rowData = {
    slug,
    name,
    type: normalizeTenantType(input.type),
    status: normalizeStatus(input.status, ['active', 'trialing', 'paused', 'suspended', 'inactive']),
    locale: normalizeLocale(input.locale),
    ownerName: trimText(input.ownerName, 180) || null,
    ownerEmail: trimText(input.ownerEmail, 180) || null,
    parentTenantId,
    metadataJson: stringifyMeta(input.metadata),
  };
  try {
    const row = await prisma.platformTenant.upsert({
      where: { id },
      update: rowData,
      create: {
        id,
        ...rowData,
      },
    });
    if (getTenantDatabaseTopologyMode() !== 'shared') {
      ensureTenantDatabaseTargetProvisioned(row.id, {
        env: process.env,
        mode: getTenantDatabaseTopologyMode(),
      });
    }
    await emitPlatformEvent('platform.tenant.upserted', {
      tenantId: row.id,
      tenantSlug: row.slug,
      actor,
    }, { tenantId: row.id });
    return { ok: true, tenant: sanitizeTenantRow(row) };
  } catch (error) {
    if (error?.code === 'P2002') {
      return { ok: false, reason: 'tenant-slug-conflict' };
    }
    throw error;
  }
}

async function listPlatformTenants(options = {}) {
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (options.status) where.status = normalizeStatus(options.status, ['active', 'trialing', 'paused', 'suspended', 'inactive']);
  if (options.type) where.type = normalizeTenantType(options.type);
  const rows = await prisma.platformTenant.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take,
  });
  return rows.map(sanitizeTenantRow);
}

async function getPlatformTenantById(tenantId) {
  const id = trimText(tenantId, 120);
  if (!id) return null;
  const row = await prisma.platformTenant.findUnique({ where: { id } });
  return sanitizeTenantRow(row);
}

async function createSubscription(input = {}, actor = 'system') {
  const tenantId = trimText(input.tenantId, 120);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    const plan = findPlanById(input.planId);
    const baseMetadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata
      : {};
    const resolvedPackage = resolvePackageForPlan(input.planId, baseMetadata);
    const metadata = {
      ...baseMetadata,
      packageId: trimText(input.packageId, 120) || resolvedPackage?.id || baseMetadata.packageId || null,
    };
    const startedAt = parseDateOrNull(input.startedAt) || new Date();
    const cycle = normalizeBillingCycle(input.billingCycle || plan?.billingCycle);
    const intervalDays = asInt(
      input.intervalDays,
      plan?.intervalDays || (cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : cycle === 'trial' ? 14 : 30),
      1,
    );
    const renewsAt = parseDateOrNull(input.renewsAt) || new Date(startedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    return db.platformSubscription.create({
      data: {
        id: trimText(input.id, 120) || createId('sub'),
        tenantId,
        planId: trimText(input.planId, 120) || plan?.id || 'custom',
        billingCycle: cycle,
        status: normalizeStatus(input.status, ['active', 'trialing', 'paused', 'past_due', 'canceled', 'expired']),
        currency: normalizeCurrency(input.currency || config.platform?.billing?.currency),
        amountCents: asInt(input.amountCents, plan?.amountCents || 0, 0),
        startedAt,
        renewsAt,
        canceledAt: parseDateOrNull(input.canceledAt),
        externalRef: trimText(input.externalRef, 180) || null,
        metadataJson: stringifyMeta(metadata),
      },
    });
  });
  if (!row) return { ok: false, reason: 'tenant-not-found' };
  await emitPlatformEvent('platform.subscription.created', {
    tenantId,
    subscriptionId: row.id,
    planId: row.planId,
    actor,
  }, { tenantId });
  return { ok: true, subscription: sanitizeSubscriptionRow(row) };
}

async function listPlatformSubscriptions(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform subscription listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.status) where.status = normalizeStatus(options.status, ['active', 'trialing', 'paused', 'past_due', 'canceled', 'expired']);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformSubscription.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformSubscription.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map(sanitizeSubscriptionRow);
}

function generateLicenseKey() {
  const parts = [
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
    crypto.randomBytes(2).toString('hex'),
  ];
  return parts.join('-').toUpperCase();
}

async function issuePlatformLicense(input = {}, actor = 'system') {
  const tenantId = trimText(input.tenantId, 120);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const legalVersion = trimText(
    input.legalDocVersion || config.platform?.legal?.currentVersion,
    80,
  ) || null;
  const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    return db.platformLicense.create({
      data: {
        id: trimText(input.id, 120) || createId('license'),
        tenantId,
        licenseKey: trimText(input.licenseKey, 80) || generateLicenseKey(),
        status: normalizeStatus(input.status, ['active', 'trialing', 'expired', 'revoked']),
        seats: asInt(input.seats, 1, 1),
        issuedAt: parseDateOrNull(input.issuedAt) || new Date(),
        expiresAt: parseDateOrNull(input.expiresAt),
        legalDocVersion: legalVersion,
        legalAcceptedAt: parseDateOrNull(input.legalAcceptedAt),
        metadataJson: stringifyMeta(input.metadata),
      },
    });
  });
  if (!row) return { ok: false, reason: 'tenant-not-found' };
  await emitPlatformEvent('platform.license.issued', {
    tenantId,
    licenseId: row.id,
    actor,
  }, { tenantId });
  return { ok: true, license: sanitizeLicenseRow(row, { exposeFullKey: true }) };
}

async function acceptPlatformLicenseLegal(input = {}, actor = 'system') {
  const licenseId = trimText(input.licenseId, 120);
  if (!licenseId) return { ok: false, reason: 'license-required' };
  let row = null;
  const tenantRows = await prisma.platformTenant.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  }).catch(() => []);
  for (const tenant of tenantRows) {
    const tenantId = trimText(tenant?.id, 120);
    if (!tenantId) continue;
    row = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformLicense.update({
      where: { id: licenseId },
      data: {
        legalDocVersion: trimText(input.legalDocVersion || config.platform?.legal?.currentVersion, 80) || null,
        legalAcceptedAt: new Date(),
        metadataJson: stringifyMeta({
          ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
          acceptedBy: actor,
        }),
      },
    })).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)));
    if (row) break;
  }
  if (!row) {
    row = await prisma.platformLicense.update({
      where: { id: licenseId },
      data: {
        legalDocVersion: trimText(input.legalDocVersion || config.platform?.legal?.currentVersion, 80) || null,
        legalAcceptedAt: new Date(),
        metadataJson: stringifyMeta({
          ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
          acceptedBy: actor,
        }),
      },
    }).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)));
  }
  if (!row) return { ok: false, reason: 'license-not-found' };
  await emitPlatformEvent('platform.license.legal.accepted', {
    tenantId: row.tenantId,
    licenseId: row.id,
    actor,
  }, { tenantId: row.tenantId });
  return { ok: true, license: sanitizeLicenseRow(row) };
}

async function listPlatformLicenses(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform license listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.status) where.status = normalizeStatus(options.status, ['active', 'trialing', 'expired', 'revoked']);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformLicense.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformLicense.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map((row) => sanitizeLicenseRow(row));
}

function generateApiKey() {
  const prefix = `sk_${crypto.randomBytes(6).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('hex');
  return `${prefix}.${secret}`;
}

async function createPlatformApiKey(input = {}, actor = 'system') {
  const tenantId = trimText(input.tenantId, 120);
  const name = trimText(input.name, 160);
  if (!tenantId || !name) return { ok: false, reason: 'invalid-api-key' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'apiKeys', 1);
  if (!quotaCheck.ok) {
    return {
      ok: false,
      reason: quotaCheck.reason || 'tenant-quota-exceeded',
      quotaKey: quotaCheck.quotaKey || 'apiKeys',
      quota: quotaCheck.quota || null,
      snapshot: quotaCheck.snapshot || null,
    };
  }
  const rawKey = generateApiKey();
  const scopes = buildApiKeyScopes(input.scopes);
  const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    return db.platformApiKey.create({
      data: {
        id: trimText(input.id, 120) || createId('apikey'),
        tenantId,
        name,
        keyPrefix: rawKey.slice(0, 16),
        keyHash: sha256(rawKey),
        scopesJson: JSON.stringify(scopes),
        status: normalizeStatus(input.status, ['active', 'revoked', 'disabled']),
      },
    });
  });
  if (!row) return { ok: false, reason: 'tenant-not-found' };
  await emitPlatformEvent('platform.apikey.created', {
    tenantId,
    apiKeyId: row.id,
    actor,
  }, { tenantId });
  return {
    ok: true,
    apiKey: sanitizeApiKeyRow(row),
    rawKey,
  };
}

async function listPlatformApiKeys(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform API key listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.status) where.status = normalizeStatus(options.status, ['active', 'revoked', 'disabled']);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformApiKey.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformApiKey.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map(sanitizeApiKeyRow);
}

async function revokePlatformApiKey(apiKeyId, actor = 'system') {
  const id = trimText(apiKeyId, 120);
  if (!id) return { ok: false, reason: 'invalid-api-key-id' };
  const rows = await listPlatformApiKeys({ allowGlobal: true, limit: 1000 });
  const target = rows.find((row) => String(row?.id || '') === id) || null;
  if (!target) return { ok: false, reason: 'platform-apikey-not-found' };
  const row = await runWithOptionalTenantDbIsolation(target.tenantId, (db) => db.platformApiKey.update({
    where: { id },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  })).catch(() => null);
  if (!row) return { ok: false, reason: 'platform-apikey-revoke-failed' };
  await emitPlatformEvent('platform.apikey.revoked', {
    tenantId: target.tenantId,
    apiKeyId: id,
    actor,
  }, { tenantId: target.tenantId });
  return {
    ok: true,
    apiKey: sanitizeApiKeyRow(row),
  };
}

async function rotatePlatformApiKey(input = {}, actor = 'system') {
  const apiKeyId = trimText(input.apiKeyId, 120);
  if (!apiKeyId) return { ok: false, reason: 'invalid-api-key-id' };
  const rows = await listPlatformApiKeys({ allowGlobal: true, limit: 1000 });
  const target = rows.find((row) => String(row?.id || '') === apiKeyId) || null;
  if (!target) return { ok: false, reason: 'platform-apikey-not-found' };
  const created = await createPlatformApiKey({
    tenantId: target.tenantId,
    name: trimText(input.name, 160) || target.name,
    scopes: Array.isArray(target.scopes) ? target.scopes : [],
    status: 'active',
  }, actor);
  if (!created.ok) return created;
  await revokePlatformApiKey(apiKeyId, actor).catch(() => null);
  return {
    ok: true,
    apiKey: created.apiKey,
    rawKey: created.rawKey,
    rotatedFrom: apiKeyId,
  };
}

async function verifyPlatformApiKey(rawKey, requiredScopes = []) {
  const key = trimText(rawKey, 500);
  if (!key) return { ok: false, reason: 'missing-api-key' };
  const keyPrefix = key.slice(0, 16);
  const rows = await listPlatformApiKeyCandidates({ keyPrefix, limit: 10 });
  const matched = rows.find((row) => sha256(key) === row.keyHash) || null;
  if (!matched || matched.status !== 'active' || matched.revokedAt) {
    return { ok: false, reason: 'invalid-api-key' };
  }
  const scopes = parseJsonOrFallback(matched.scopesJson, []);
  const missingScopes = buildApiKeyScopes(requiredScopes).filter((scope) => !scopes.includes(scope));
  if (missingScopes.length > 0) {
    return { ok: false, reason: 'insufficient-scope', missingScopes };
  }
  await runWithOptionalTenantDbIsolation(
    matched.tenantId,
    (db) => db.platformApiKey.update({
      where: { id: matched.id },
      data: {
        lastUsedAt: new Date(),
      },
    }),
  ).catch(() => null);
  const tenantState = await getTenantOperationalState(matched.tenantId);
  if (!tenantState.ok) {
    return {
      ok: false,
      reason: tenantState.reason,
      tenant: tenantState.tenant || null,
      subscription: tenantState.subscription || null,
      license: tenantState.license || null,
    };
  }
  return {
    ok: true,
    apiKey: sanitizeApiKeyRow({
      ...matched,
      lastUsedAt: new Date(),
    }),
    tenant: tenantState.tenant,
    subscription: tenantState.subscription || null,
    license: tenantState.license || null,
    scopes,
  };
}

async function createPlatformWebhookEndpoint(input = {}, actor = 'system') {
  const tenantId = trimText(input.tenantId, 120);
  const name = trimText(input.name, 160);
  const targetUrl = trimText(input.targetUrl, 400);
  const eventType = trimText(input.eventType, 120) || '*';
  if (!tenantId || !name || !targetUrl) {
    return { ok: false, reason: 'invalid-webhook' };
  }
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  try {
    new URL(targetUrl);
  } catch {
    return { ok: false, reason: 'invalid-webhook-url' };
  }
  const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'webhooks', 1);
  if (!quotaCheck.ok) {
    return {
      ok: false,
      reason: quotaCheck.reason || 'tenant-quota-exceeded',
      quotaKey: quotaCheck.quotaKey || 'webhooks',
      quota: quotaCheck.quota || null,
      snapshot: quotaCheck.snapshot || null,
    };
  }
  const secretValue = trimText(input.secretValue, 200) || crypto.randomBytes(18).toString('hex');
  const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    return db.platformWebhookEndpoint.create({
      data: {
        id: trimText(input.id, 120) || createId('hook'),
        tenantId,
        name,
        eventType,
        targetUrl,
        secretValue,
        enabled: input.enabled !== false,
      },
    });
  });
  if (!row) return { ok: false, reason: 'tenant-not-found' };
  await emitPlatformEvent('platform.webhook.created', {
    tenantId,
    webhookId: row.id,
    actor,
  }, { tenantId });
  return {
    ok: true,
    webhook: sanitizeWebhookRow(row, { includeSecret: true }),
  };
}

async function listPlatformWebhookEndpoints(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform webhook listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.eventType) where.eventType = trimText(options.eventType, 120);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformWebhookEndpoint.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformWebhookEndpoint.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map((row) => sanitizeWebhookRow(row));
}

async function recordPlatformAgentHeartbeat(input = {}, actor = 'platform-api') {
  const tenantId = trimText(input.tenantId, 120);
  const runtimeKey = trimText(input.runtimeKey, 160);
  const version = trimText(input.version, 80);
  if (!tenantId || !runtimeKey || !version) {
    return { ok: false, reason: 'invalid-agent-heartbeat' };
  }
  const tenantExists = await getSharedTenantRegistryRow(tenantId);
  if (!tenantExists) return { ok: false, reason: 'tenant-not-found' };
  const existingRuntime = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.findUnique({
    where: {
      tenantId_runtimeKey: {
        tenantId,
        runtimeKey,
      },
    },
  }));
  if (!existingRuntime) {
    const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'agentRuntimes', 1);
    if (!quotaCheck.ok) {
      return {
        ok: false,
        reason: quotaCheck.reason || 'tenant-quota-exceeded',
        quotaKey: quotaCheck.quotaKey || 'agentRuntimes',
        quota: quotaCheck.quota || null,
        snapshot: quotaCheck.snapshot || null,
      };
    }
  }
  const minimumVersion = trimText(
    input.minRequiredVersion || config.platform?.agent?.minimumVersion || '1.0.0',
    80,
  ) || '1.0.0';
  const status =
    compareVersions(version, minimumVersion) < 0
      ? 'outdated'
      : normalizeStatus(input.status, ['online', 'degraded', 'outdated', 'offline']);
  const channel = trimText(input.channel, 80) || null;
  const inputMeta =
    input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
      ? input.meta
      : typeof input.meta === 'string'
        ? parseJsonOrFallback(input.meta, null)
        : null;
  const runtimeProfile = normalizeAgentRuntimeProfile({
    runtimeKey,
    channel,
    meta: inputMeta,
  });
  const storedMeta = inputMeta ? mergeAgentRuntimeProfile(inputMeta, runtimeProfile) : null;
  const metaJson = storedMeta ? stringifyMeta(storedMeta) : stringifyMeta(input.meta);
  const row = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.upsert({
    where: {
      tenantId_runtimeKey: {
        tenantId,
        runtimeKey,
      },
    },
    update: {
      channel,
      version,
      minRequiredVersion: minimumVersion,
      status,
      lastSeenAt: new Date(),
      metaJson,
    },
    create: {
      id: createId('agent'),
      tenantId,
      runtimeKey,
      channel,
      version,
      minRequiredVersion: minimumVersion,
      status,
      lastSeenAt: new Date(),
      metaJson,
    },
  }));
  if (status === 'outdated') {
    publishAdminLiveUpdate('ops-alert', {
      source: 'platform-agent',
      kind: 'agent-version-outdated',
      tenantId,
      runtimeKey,
      version,
      minimumVersion,
    });
  }
  await emitPlatformEvent('platform.agent.heartbeat', {
    tenantId,
    runtimeKey,
    version,
    status,
    actor,
  }, { tenantId });
  return { ok: true, runtime: sanitizeAgentRow(row) };
}

async function listPlatformAgentRuntimes(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform agent runtime listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.status) where.status = normalizeStatus(options.status, ['online', 'degraded', 'outdated', 'offline']);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformAgentRuntime.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map(sanitizeAgentRow);
}

async function createMarketplaceOffer(input = {}, actor = 'system') {
  const tenantId = trimText(input.tenantId, 120);
  const title = trimText(input.title, 180);
  if (!tenantId || !title) return { ok: false, reason: 'invalid-marketplace-offer' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'marketplaceOffers', 1);
  if (!quotaCheck.ok) {
    return {
      ok: false,
      reason: quotaCheck.reason || 'tenant-quota-exceeded',
      quotaKey: quotaCheck.quotaKey || 'marketplaceOffers',
      quota: quotaCheck.quota || null,
      snapshot: quotaCheck.snapshot || null,
    };
  }
  const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    return db.platformMarketplaceOffer.create({
      data: {
        id: trimText(input.id, 120) || createId('offer'),
        tenantId,
        title,
        kind: trimText(input.kind, 80) || 'service',
        priceCents: asInt(input.priceCents, 0, 0),
        currency: normalizeCurrency(input.currency),
        status: normalizeStatus(input.status, ['active', 'draft', 'archived']),
        locale: normalizeLocale(input.locale),
        metaJson: stringifyMeta(input.meta),
      },
    });
  });
  if (!row) return { ok: false, reason: 'tenant-not-found' };
  await emitPlatformEvent('platform.marketplace.offer.created', {
    tenantId,
    offerId: row.id,
    actor,
  }, { tenantId });
  return { ok: true, offer: sanitizeMarketplaceRow(row) };
}

async function listMarketplaceOffers(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform marketplace listing',
  });
  const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (options.status) where.status = normalizeStatus(options.status, ['active', 'draft', 'archived']);
  if (options.locale) where.locale = normalizeLocale(options.locale);
  const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
    ? sortRowsByTimestampDesc(
      await readAcrossPlatformTenantScopes(
        (db) => db.platformMarketplaceOffer.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
        { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
      ),
    ).slice(0, take)
    : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformMarketplaceOffer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take,
    }));
  return rows.map(sanitizeMarketplaceRow);
}

async function getPlatformAnalyticsOverview(options = {}) {
  const { tenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform analytics overview',
  });
  const tenantTopologyMode = getTenantDatabaseTopologyMode();
  const aggregateTenantCommerce = !tenantId && tenantTopologyMode !== 'shared';
  const tenantWhere = tenantId ? { tenantId } : {};
  const purchaseWhere = {
    ...(tenantId ? { tenantId } : {}),
    createdAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  };
  const analyticsRows = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
    const [
      tenantRows,
      subscriptionRows,
      licenseRows,
      apiKeyRows,
      webhookRows,
      agentRows,
      offerRows,
      purchaseCount30d,
      deliveredCount,
      failedCount,
      queueJobsCount,
      deadLettersCount,
      auditRowsCount,
      quota,
    ] = await Promise.all([
      prisma.platformTenant.findMany(tenantId ? { where: { id: tenantId } } : {}),
      db.platformSubscription.findMany({ where: tenantWhere }),
      db.platformLicense.findMany({ where: tenantWhere }),
      db.platformApiKey.findMany({ where: tenantWhere }),
      db.platformWebhookEndpoint.findMany({ where: tenantWhere }),
      db.platformAgentRuntime.findMany({ where: tenantWhere }),
      db.platformMarketplaceOffer.findMany({ where: tenantWhere }),
      aggregateTenantCommerce
        ? Promise.resolve(null)
        : db.purchase.count({ where: purchaseWhere }),
      aggregateTenantCommerce
        ? Promise.resolve(null)
        : db.purchase.count({
        where: {
          ...purchaseWhere,
          status: 'delivered',
        },
      }),
      aggregateTenantCommerce
        ? Promise.resolve(null)
        : db.purchase.count({
        where: {
          ...purchaseWhere,
          status: 'delivery_failed',
        },
      }),
      aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryQueueJob.count({ where: tenantWhere }),
      aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryDeadLetter.count({ where: tenantWhere }),
      aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryAudit.count({ where: tenantWhere }),
      tenantId ? getTenantQuotaSnapshot(tenantId, { db }).catch(() => null) : Promise.resolve(null),
    ]);
    return {
      tenantRows,
      subscriptionRows,
      licenseRows,
      apiKeyRows,
      webhookRows,
      agentRows,
      offerRows,
      purchaseCount30d,
      deliveredCount,
      failedCount,
      queueJobsCount,
      deadLettersCount,
      auditRowsCount,
      quota,
    };
  });
  const {
    tenantRows,
    subscriptionRows,
    licenseRows,
    apiKeyRows,
    webhookRows,
    agentRows,
    offerRows,
    purchaseCount30d,
    deliveredCount,
    failedCount,
    queueJobsCount,
    deadLettersCount,
    auditRowsCount,
    quota,
  } = analyticsRows;

  const [
    aggregatedSubscriptionRows,
    aggregatedLicenseRows,
    aggregatedApiKeyRows,
    aggregatedWebhookRows,
    aggregatedAgentRows,
    aggregatedOfferRows,
  ] = aggregateTenantCommerce
    ? await (async () => {
      const rows = await readAcrossPlatformTenantScopesBatch({
        subscriptionRows: (db) => db.platformSubscription.findMany({ where: tenantWhere }),
        licenseRows: (db) => db.platformLicense.findMany({ where: tenantWhere }),
        apiKeyRows: (db) => db.platformApiKey.findMany({ where: tenantWhere }),
        webhookRows: (db) => db.platformWebhookEndpoint.findMany({ where: tenantWhere }),
        agentRows: (db) => db.platformAgentRuntime.findMany({ where: tenantWhere }),
        offerRows: (db) => db.platformMarketplaceOffer.findMany({ where: tenantWhere }),
      });
      return [
        dedupePlatformRows(rows.subscriptionRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        dedupePlatformRows(rows.licenseRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        dedupePlatformRows(rows.apiKeyRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        dedupePlatformRows(rows.webhookRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        dedupePlatformRows(rows.agentRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        dedupePlatformRows(rows.offerRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
      ];
    })()
    : [
      subscriptionRows,
      licenseRows,
      apiKeyRows,
      webhookRows,
      agentRows,
      offerRows,
    ];

  const [
    purchaseRows30d,
    deliveredRows30d,
    failedRows30d,
    queueJobs,
    deadLetters,
    auditRows,
  ] = aggregateTenantCommerce
    ? await (async () => {
      const rows = await readAcrossDeliveryPersistenceScopeBatch({
        purchaseRows30d: (db) => db.purchase.findMany({
          where: purchaseWhere,
          select: { code: true, tenantId: true },
        }),
        deliveredRows30d: (db) => db.purchase.findMany({
          where: {
            ...purchaseWhere,
            status: 'delivered',
          },
          select: { code: true, tenantId: true },
        }),
        failedRows30d: (db) => db.purchase.findMany({
          where: {
            ...purchaseWhere,
            status: 'delivery_failed',
          },
          select: { code: true, tenantId: true },
        }),
        queueJobs: (db) => db.deliveryQueueJob.findMany({
          select: { purchaseCode: true, tenantId: true },
        }),
        deadLetters: (db) => db.deliveryDeadLetter.findMany({
          select: { purchaseCode: true, tenantId: true },
        }),
        auditRows: (db) => db.deliveryAudit.findMany({
          select: { id: true, tenantId: true },
        }),
      });
      return [
        rows.purchaseRows30d,
        rows.deliveredRows30d,
        rows.failedRows30d,
        rows.queueJobs,
        rows.deadLetters,
        rows.auditRows,
      ];
    })()
    : [null, null, null, null, null, null];

  const dedupedPurchaseRows30d = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(purchaseRows30d, ['code'])
    : null;
  const dedupedDeliveredRows30d = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(deliveredRows30d, ['code'])
    : null;
  const dedupedFailedRows30d = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(failedRows30d, ['code'])
    : null;
  const dedupedQueueJobs = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(queueJobs, ['purchaseCode'])
    : null;
  const dedupedDeadLetters = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(deadLetters, ['purchaseCode'])
    : null;
  const dedupedAuditRows = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(auditRows, ['id'])
    : null;

  const resolvedPurchaseCount30d = aggregateTenantCommerce ? dedupedPurchaseRows30d.length : purchaseCount30d;
  const resolvedDeliveredCount = aggregateTenantCommerce ? dedupedDeliveredRows30d.length : deliveredCount;
  const resolvedFailedCount = aggregateTenantCommerce ? dedupedFailedRows30d.length : failedCount;
  const resolvedQueueJobsCount = aggregateTenantCommerce ? dedupedQueueJobs.length : queueJobsCount;
  const resolvedDeadLettersCount = aggregateTenantCommerce ? dedupedDeadLetters.length : deadLettersCount;
  const resolvedAuditRowsCount = aggregateTenantCommerce ? dedupedAuditRows.length : auditRowsCount;

  const effectiveSubscriptionRows = aggregatedSubscriptionRows;
  const effectiveLicenseRows = aggregatedLicenseRows;
  const effectiveApiKeyRows = aggregatedApiKeyRows;
  const effectiveWebhookRows = aggregatedWebhookRows;
  const effectiveAgentRows = aggregatedAgentRows;
  const effectiveOfferRows = aggregatedOfferRows;

  const mrrCents = effectiveSubscriptionRows
    .filter((row) => row.status === 'active' || row.status === 'trialing')
    .reduce((sum, row) => {
      if (row.billingCycle === 'yearly') return sum + Math.round(row.amountCents / 12);
      if (row.billingCycle === 'quarterly') return sum + Math.round(row.amountCents / 3);
      if (row.billingCycle === 'one-time' || row.billingCycle === 'trial') return sum;
      return sum + row.amountCents;
    }, 0);

  const successRate = resolvedPurchaseCount30d > 0
    ? Number((resolvedDeliveredCount / resolvedPurchaseCount30d).toFixed(4))
    : 0;

  return {
    generatedAt: nowIso(),
    scope: tenantId
      ? {
        tenantId,
        mode: 'tenant-isolated',
        deliveryMetricsScoped: true,
      }
      : {
        tenantId: null,
        mode: 'global',
        deliveryMetricsScoped: true,
      },
    tenants: {
      total: tenantRows.length,
      active: tenantRows.filter((row) => row.status === 'active').length,
      trialing: tenantRows.filter((row) => row.type === 'trial' || row.status === 'trialing').length,
      reseller: tenantRows.filter((row) => row.type === 'reseller').length,
    },
    subscriptions: {
      total: effectiveSubscriptionRows.length,
      active: effectiveSubscriptionRows.filter((row) => row.status === 'active').length,
      mrrCents,
    },
    licenses: {
      total: effectiveLicenseRows.length,
      active: effectiveLicenseRows.filter((row) => row.status === 'active').length,
      acceptedLegal: effectiveLicenseRows.filter((row) => row.legalAcceptedAt).length,
    },
    api: {
      apiKeys: effectiveApiKeyRows.filter((row) => row.status === 'active').length,
      webhooks: effectiveWebhookRows.filter((row) => row.enabled).length,
    },
    agent: {
      runtimes: effectiveAgentRows.length,
      outdated: effectiveAgentRows.filter((row) => row.status === 'outdated').length,
    },
    marketplace: {
      offers: effectiveOfferRows.filter((row) => row.status === 'active').length,
      draftOffers: effectiveOfferRows.filter((row) => row.status === 'draft').length,
    },
    delivery: {
      purchaseCount30d: resolvedPurchaseCount30d,
      deliveredCount: resolvedDeliveredCount,
      failedCount: resolvedFailedCount,
      successRate,
      queueJobs: resolvedQueueJobsCount,
      deadLetters: resolvedDeadLettersCount,
      auditEvents: resolvedAuditRowsCount,
      note: tenantId
        ? 'Tenant analytics include only tenant-tagged commerce rows; legacy rows without tenantId stay out of tenant views'
        : (aggregateTenantCommerce ? 'Global analytics aggregate delivery and purchase rows across shared and tenant-scoped commerce topology' : null),
    },
    quota: quota?.ok ? quota : null,
  };
}

async function reconcileDeliveryState(options = {}) {
  const { tenantId: scopedTenantId } = assertTenantDbIsolationScope({
    tenantId: options.tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform delivery reconcile',
  });
  const tenantTopologyMode = getTenantDatabaseTopologyMode();
  const aggregateTenantCommerce = !scopedTenantId && tenantTopologyMode !== 'shared';
  const antiAbuse = config.platform?.antiAbuse || {};
  const windowMs = asInt(options.windowMs, antiAbuse.windowMs || (60 * 60 * 1000), 60 * 1000);
  const pendingOverdueMs = asInt(options.pendingOverdueMs, antiAbuse.pendingOverdueMs || (20 * 60 * 1000), 60 * 1000);
  const since = new Date(Date.now() - windowMs);

  if (scopedTenantId) {
    const scopedRows = await runWithOptionalTenantDbIsolation(scopedTenantId, async (db) => {
      const [tenantState, agentRows, webhookRows, purchases, queueJobs, deadLetters, auditRows] = await Promise.all([
        getTenantOperationalState(scopedTenantId, { db }),
        db.platformAgentRuntime.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        db.platformWebhookEndpoint.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        db.purchase.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        db.deliveryQueueJob.findMany({
          where: { tenantId: scopedTenantId },
        }),
        db.deliveryDeadLetter.findMany({
          where: { tenantId: scopedTenantId },
        }),
        db.deliveryAudit.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        }),
      ]);
      const purchaseItemIds = [...new Set(
        purchases.map((row) => trimText(row.itemId, 120)).filter(Boolean),
      )];
      const shopItems = purchaseItemIds.length > 0
        ? await db.shopItem.findMany({
          where: {
            id: {
              in: purchaseItemIds,
            },
          },
          select: {
            id: true,
            kind: true,
          },
        })
        : [];
      return { tenantState, agentRows, webhookRows, purchases, queueJobs, deadLetters, auditRows, shopItems };
    });
    const {
      tenantState,
      agentRows,
      webhookRows,
      purchases,
      queueJobs,
      deadLetters,
      auditRows,
      shopItems,
    } = scopedRows;

    const queueByCode = new Map(queueJobs.map((row) => [String(row.purchaseCode), row]));
    const deadByCode = new Map(deadLetters.map((row) => [String(row.purchaseCode), row]));
    const auditByCode = new Map();
    const itemKinds = new Map();
    for (const row of auditRows) {
      const code = trimText(row.purchaseCode, 120);
      if (!code) continue;
      const list = auditByCode.get(code) || [];
      list.push(row);
      auditByCode.set(code, list);
    }
    for (const row of shopItems) {
      itemKinds.set(String(row.id), normalizeShopKind(row.kind));
    }

    const anomalies = [];
    if (!tenantState.ok) {
      anomalies.push({
        code: scopedTenantId,
        type: tenantState.reason,
        severity: 'error',
        detail: 'Tenant operational state is blocking public platform access',
      });
    }
    for (const runtime of agentRows) {
      if (String(runtime.status || '').trim().toLowerCase() === 'outdated') {
        anomalies.push({
          code: runtime.runtimeKey,
          type: 'agent-version-outdated',
          severity: 'warn',
          detail: `Runtime ${runtime.runtimeKey} is below ${runtime.minRequiredVersion || 'minimum version'}`,
        });
      }
      const lastSeenAt = parseDateOrNull(runtime.lastSeenAt);
      if (lastSeenAt && Date.now() - lastSeenAt.getTime() >= (config.platform?.monitoring?.agentStaleMs || 10 * 60 * 1000)) {
        anomalies.push({
          code: runtime.runtimeKey,
          type: 'agent-runtime-stale',
          severity: 'warn',
          detail: `Runtime ${runtime.runtimeKey} heartbeat is stale`,
        });
      }
    }
    for (const webhook of webhookRows) {
      if (webhook.enabled && webhook.lastError) {
        anomalies.push({
          code: webhook.id,
          type: 'webhook-last-error',
          severity: 'warn',
          detail: trimText(webhook.lastError, 240),
        });
      }
    }

    for (const purchase of purchases) {
      const code = String(purchase.code || '');
      const queue = queueByCode.get(code) || null;
      const dead = deadByCode.get(code) || null;
      const audit = auditByCode.get(code) || [];
      const ageMs = Date.now() - new Date(purchase.createdAt).getTime();
      const itemKind = itemKinds.get(String(purchase.itemId || '')) || 'item';
      const expectsDeliveryRuntime = itemKind !== 'vip';

      if (purchase.status === 'delivered' && queue) {
        anomalies.push({ code, type: 'delivered-still-queued', severity: 'error', detail: 'Purchase is delivered but queue job still exists' });
      }
      if (expectsDeliveryRuntime && purchase.status === 'delivery_failed' && !dead) {
        anomalies.push({ code, type: 'failed-without-dead-letter', severity: 'warn', detail: 'Purchase is marked failed but no dead-letter record exists' });
      }
      if (expectsDeliveryRuntime && (purchase.status === 'pending' || purchase.status === 'delivering') && !queue && !dead && ageMs >= pendingOverdueMs) {
        anomalies.push({ code, type: 'stuck-without-runtime-state', severity: 'error', detail: 'Pending purchase has neither queue nor dead-letter state' });
      }
      if (expectsDeliveryRuntime && purchase.status === 'delivered' && audit.length === 0) {
        anomalies.push({ code, type: 'delivered-without-audit', severity: 'warn', detail: 'Delivered purchase has no delivery audit evidence' });
      }
    }

    const recentPurchases = purchases.filter((row) => new Date(row.createdAt) >= since);
    const ordersByUser = new Map();
    const userItemCounts = new Map();
    const failedByUser = new Map();
    for (const row of recentPurchases) {
      const userId = trimText(row.userId, 80) || 'unknown';
      ordersByUser.set(userId, (ordersByUser.get(userId) || 0) + 1);
      const itemKey = `${userId}:${trimText(row.itemId, 120) || 'unknown'}`;
      userItemCounts.set(itemKey, (userItemCounts.get(itemKey) || 0) + 1);
      if (row.status === 'delivery_failed') {
        failedByUser.set(userId, (failedByUser.get(userId) || 0) + 1);
      }
    }

    const abuseFindings = [];
    const maxOrdersPerUser = asInt(antiAbuse.maxOrdersPerUser, 8, 1);
    const maxSameItemPerUser = asInt(antiAbuse.maxSameItemPerUser, 4, 1);
    const failedDeliveriesThreshold = asInt(antiAbuse.failedDeliveriesThreshold, 3, 1);

    for (const [userId, count] of ordersByUser.entries()) {
      if (count > maxOrdersPerUser) {
        abuseFindings.push({ type: 'order-burst', userId, count, threshold: maxOrdersPerUser });
      }
    }
    for (const [key, count] of userItemCounts.entries()) {
      if (count > maxSameItemPerUser) {
        const [userId, itemId] = key.split(':');
        abuseFindings.push({ type: 'same-item-burst', userId, itemId, count, threshold: maxSameItemPerUser });
      }
    }
    for (const [userId, count] of failedByUser.entries()) {
      if (count >= failedDeliveriesThreshold) {
        abuseFindings.push({ type: 'repeated-delivery-failures', userId, count, threshold: failedDeliveriesThreshold });
      }
    }

    return {
      generatedAt: nowIso(),
      scope: {
        tenantId: scopedTenantId,
        mode: 'tenant-isolated',
        includesSharedCommerceTables: true,
      },
      notes: [
        'Tenant reconcile uses tenant-tagged purchase, queue, dead-letter, and audit rows.',
      ],
      summary: {
        purchases: purchases.length,
        queueJobs: queueJobs.length,
        deadLetters: deadLetters.length,
        anomalies: anomalies.length,
        abuseFindings: abuseFindings.length,
        windowMs,
      },
      anomalies,
      abuseFindings,
    };
  }

  const [purchases, queueJobs, deadLetters, auditRows] = aggregateTenantCommerce
    ? await (async () => {
      const rows = await readAcrossDeliveryPersistenceScopeBatch({
        purchases: (db) => db.purchase.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        queueJobs: (db) => db.deliveryQueueJob.findMany(),
        deadLetters: (db) => db.deliveryDeadLetter.findMany(),
        auditRows: (db) => db.deliveryAudit.findMany({
          orderBy: { createdAt: 'desc' },
          take: 2000,
        }),
      });
      return [
        rows.purchases,
        rows.queueJobs,
        rows.deadLetters,
        rows.auditRows,
      ];
    })()
    : await Promise.all([
      prisma.purchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.deliveryQueueJob.findMany(),
      prisma.deliveryDeadLetter.findMany(),
      prisma.deliveryAudit.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
    ]);

  const normalizedPurchases = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(purchases, ['code'])
      .slice()
      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
      .slice(0, 500)
    : purchases;
  const normalizedAuditRows = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(auditRows, ['id'])
      .slice()
      .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
      .slice(0, 2000)
    : auditRows;
  const normalizedQueueJobs = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(queueJobs, ['purchaseCode'])
    : queueJobs;
  const normalizedDeadLetters = aggregateTenantCommerce
    ? dedupeDeliveryScopeRows(deadLetters, ['purchaseCode'])
    : deadLetters;

  const queueByCode = new Map(normalizedQueueJobs.map((row) => [String(row.purchaseCode), row]));
  const deadByCode = new Map(normalizedDeadLetters.map((row) => [String(row.purchaseCode), row]));
  const auditByCode = new Map();
  const itemKinds = new Map();
  for (const row of normalizedAuditRows) {
    const code = trimText(row.purchaseCode, 120);
    if (!code) continue;
    const list = auditByCode.get(code) || [];
    list.push(row);
    auditByCode.set(code, list);
  }
  const purchaseItemIds = [...new Set(
    normalizedPurchases.map((row) => trimText(row.itemId, 120)).filter(Boolean),
  )];
  if (purchaseItemIds.length > 0) {
    const shopItems = aggregateTenantCommerce
      ? await readAcrossDeliveryPersistenceScopes((db) => db.shopItem.findMany({
        where: {
          id: {
            in: purchaseItemIds,
          },
        },
        select: {
          id: true,
          kind: true,
        },
      }))
      : await prisma.shopItem.findMany({
        where: {
          id: {
            in: purchaseItemIds,
          },
        },
        select: {
          id: true,
          kind: true,
        },
      });
    for (const row of shopItems) {
      itemKinds.set(String(row.id), normalizeShopKind(row.kind));
    }
  }

  const anomalies = [];
  for (const purchase of normalizedPurchases) {
    const code = String(purchase.code || '');
    const queue = queueByCode.get(code) || null;
    const dead = deadByCode.get(code) || null;
    const audit = auditByCode.get(code) || [];
    const ageMs = Date.now() - new Date(purchase.createdAt).getTime();
    const itemKind = itemKinds.get(String(purchase.itemId || '')) || 'item';
    const expectsDeliveryRuntime = itemKind !== 'vip';

    if (purchase.status === 'delivered' && queue) {
      anomalies.push({ code, type: 'delivered-still-queued', severity: 'error', detail: 'Purchase is delivered but queue job still exists' });
    }
    if (expectsDeliveryRuntime && purchase.status === 'delivery_failed' && !dead) {
      anomalies.push({ code, type: 'failed-without-dead-letter', severity: 'warn', detail: 'Purchase is marked failed but no dead-letter record exists' });
    }
    if (expectsDeliveryRuntime && (purchase.status === 'pending' || purchase.status === 'delivering') && !queue && !dead && ageMs >= pendingOverdueMs) {
      anomalies.push({ code, type: 'stuck-without-runtime-state', severity: 'error', detail: 'Pending purchase has neither queue nor dead-letter state' });
    }
    if (expectsDeliveryRuntime && purchase.status === 'delivered' && audit.length === 0) {
      anomalies.push({ code, type: 'delivered-without-audit', severity: 'warn', detail: 'Delivered purchase has no delivery audit evidence' });
    }
  }

  const recentPurchases = normalizedPurchases.filter((row) => new Date(row.createdAt) >= since);
  const ordersByUser = new Map();
  const userItemCounts = new Map();
  const failedByUser = new Map();
  for (const row of recentPurchases) {
    const userId = trimText(row.userId, 80) || 'unknown';
    ordersByUser.set(userId, (ordersByUser.get(userId) || 0) + 1);
    const itemKey = `${userId}:${trimText(row.itemId, 120) || 'unknown'}`;
    userItemCounts.set(itemKey, (userItemCounts.get(itemKey) || 0) + 1);
    if (row.status === 'delivery_failed') {
      failedByUser.set(userId, (failedByUser.get(userId) || 0) + 1);
    }
  }

  const abuseFindings = [];
  const maxOrdersPerUser = asInt(antiAbuse.maxOrdersPerUser, 8, 1);
  const maxSameItemPerUser = asInt(antiAbuse.maxSameItemPerUser, 4, 1);
  const failedDeliveriesThreshold = asInt(antiAbuse.failedDeliveriesThreshold, 3, 1);

  for (const [userId, count] of ordersByUser.entries()) {
    if (count > maxOrdersPerUser) {
      abuseFindings.push({ type: 'order-burst', userId, count, threshold: maxOrdersPerUser });
    }
  }
  for (const [key, count] of userItemCounts.entries()) {
    if (count > maxSameItemPerUser) {
      const [userId, itemId] = key.split(':');
      abuseFindings.push({ type: 'same-item-burst', userId, itemId, count, threshold: maxSameItemPerUser });
    }
  }
  for (const [userId, count] of failedByUser.entries()) {
    if (count >= failedDeliveriesThreshold) {
      abuseFindings.push({ type: 'repeated-delivery-failures', userId, count, threshold: failedDeliveriesThreshold });
    }
  }

  return {
    generatedAt: nowIso(),
    scope: {
      tenantId: null,
      mode: 'global',
      topology: aggregateTenantCommerce ? tenantTopologyMode : 'shared',
    },
    notes: [
      aggregateTenantCommerce
        ? 'Global reconcile aggregates purchase, queue, dead-letter, and audit rows across shared and tenant-scoped commerce topology.'
        : 'Global reconcile uses all purchase, queue, dead-letter, and audit rows.',
    ],
    summary: {
      purchases: normalizedPurchases.length,
      queueJobs: normalizedQueueJobs.length,
      deadLetters: normalizedDeadLetters.length,
      anomalies: anomalies.length,
      abuseFindings: abuseFindings.length,
      windowMs,
    },
    anomalies,
    abuseFindings,
  };
}

async function getPlatformPublicOverview() {
  const analytics = await getPlatformAnalyticsOverview({ allowGlobal: true }).catch(() => ({
    overview: {
      activeTenants: 0,
      activeSubscriptions: 0,
      activeLicenses: 0,
      activeApiKeys: 0,
      activeWebhooks: 0,
      onlineAgentRuntimes: 0,
      totalAgentRuntimes: 0,
      totalEvents: 0,
      totalActivity: 0,
      totalTickets: 0,
      totalRevenueCents: 0,
      currency: config.platform?.billing?.currency || 'THB',
    },
    trends: {
      windowDays: 7,
      timeline: [],
    },
    posture: {
      expiringSubscriptions: [],
      expiringLicenses: [],
      recentlyRevokedApiKeys: [],
      failedWebhooks: [],
      unresolvedTickets: [],
      offlineAgentRuntimes: [],
    },
  }));
  const legalDocs = Array.isArray(config.platform?.legal?.docs)
    ? config.platform.legal.docs.map((doc) => {
      const pathValue = trimText(doc.path, 260) || null;
      const fileName = pathValue ? pathValue.split(/[\\/]/).pop() : null;
      return {
        id: trimText(doc.id, 80) || null,
        version: trimText(doc.version, 80) || null,
        title: trimText(doc.title, 180) || fileName || 'Document',
        path: pathValue,
        url: trimText(doc.url, 260) || (fileName ? `/docs/${fileName}` : null),
      };
    })
    : [];
  return {
    generatedAt: nowIso(),
    brand: {
      name: config.serverInfo?.name || 'SCUM Ops Platform',
      description:
        'SCUM platform with delivery runtime, admin control plane, player portal, monitoring, API/webhooks, and tenant-ready operations.',
    },
    localization: config.platform?.localization || {},
    billing: {
      currency: config.platform?.billing?.currency || 'THB',
      plans: getPlanCatalog(),
      packages: getPackageCatalogSummary(),
      features: getFeatureCatalogSummary(),
    },
    trial: config.platform?.demo?.trialEnabled === true ? { enabled: true, cta: '/trial' } : { enabled: false },
    marketplace: {
      enabled: config.platform?.marketplace?.enabled === true,
      offers: await listMarketplaceOffers({ status: 'active', limit: 20, allowGlobal: true }).catch(() => []),
    },
    analytics,
    legal: {
      currentVersion: config.platform?.legal?.currentVersion || null,
      docs: legalDocs,
    },
  };
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
  createPlatformApiKey,
  createPlatformWebhookEndpoint,
  createSubscription,
  createTenant,
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
  verifyPlatformApiKey,
};
