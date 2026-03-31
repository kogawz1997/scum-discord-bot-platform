'use strict';

const { Prisma } = require('@prisma/client');

const { prisma } = require('../../prisma');
const { resolveDatabaseRuntime } = require('../../utils/dbEngine');

const TABLE_NAME = 'PlatformPackageCatalogEntry';
const PACKAGE_STATUS_VALUES = Object.freeze(['active', 'draft', 'archived']);

const FEATURE_CATALOG = Object.freeze([
  { key: 'server_hosting', title: 'Server Hosting', category: 'server' },
  { key: 'server_settings', title: 'Server Settings', category: 'server' },
  { key: 'server_status', title: 'Server Status', category: 'server' },
  { key: 'bot_log', title: 'Bot Log', category: 'bot' },
  { key: 'bot_delivery', title: 'Bot Delivery', category: 'bot' },
  { key: 'discord_integration', title: 'Discord Integration', category: 'integration' },
  { key: 'log_dashboard', title: 'Log Dashboard', category: 'ui' },
  { key: 'delivery_dashboard', title: 'Delivery Dashboard', category: 'ui' },
  { key: 'shop_module', title: 'Shop Module', category: 'commerce' },
  { key: 'orders_module', title: 'Orders Module', category: 'commerce' },
  { key: 'player_module', title: 'Player Module', category: 'portal' },
  { key: 'donation_module', title: 'Donation Module', category: 'community' },
  { key: 'event_module', title: 'Event Module', category: 'community' },
  { key: 'event_auto_reward', title: 'Event Auto Reward', category: 'community' },
  { key: 'wallet_module', title: 'Wallet Module', category: 'commerce' },
  { key: 'promo_module', title: 'Promo Module', category: 'commerce' },
  { key: 'ranking_module', title: 'Ranking Module', category: 'community' },
  { key: 'restart_announce_module', title: 'Restart Announce Module', category: 'server' },
  { key: 'support_module', title: 'Support Module', category: 'support' },
  { key: 'staff_roles', title: 'Staff Roles', category: 'security' },
  { key: 'analytics_module', title: 'Analytics Module', category: 'analytics' },
  { key: 'sync_agent', title: 'Sync Agent', category: 'agent' },
  { key: 'execute_agent', title: 'Execute Agent', category: 'agent' },
]);

const FEATURE_KEYS = Object.freeze(FEATURE_CATALOG.map((entry) => entry.key));

const BUILTIN_PACKAGE_CATALOG = Object.freeze([
  {
    id: 'BOT_LOG',
    title: 'Bot Log',
    description: 'Discord log sync and basic operational visibility.',
    status: 'active',
    position: 10,
    isSystem: true,
    features: [
      'bot_log',
      'discord_integration',
      'log_dashboard',
      'sync_agent',
      'support_module',
      'analytics_module',
    ],
  },
  {
    id: 'BOT_LOG_DELIVERY',
    title: 'Bot Log + Delivery',
    description: 'Managed delivery plus player-facing commerce and sync.',
    status: 'active',
    position: 20,
    isSystem: true,
    features: [
      'bot_log',
      'bot_delivery',
      'discord_integration',
      'log_dashboard',
      'delivery_dashboard',
      'shop_module',
      'orders_module',
      'player_module',
      'wallet_module',
      'donation_module',
      'support_module',
      'ranking_module',
      'analytics_module',
      'restart_announce_module',
      'sync_agent',
      'execute_agent',
    ],
  },
  {
    id: 'FULL_OPTION',
    title: 'Full Option',
    description: 'Full managed server operations with hosting, settings, and delivery.',
    status: 'active',
    position: 30,
    isSystem: true,
    features: [
      'server_hosting',
      'server_settings',
      'server_status',
      'bot_log',
      'bot_delivery',
      'discord_integration',
      'log_dashboard',
      'delivery_dashboard',
      'shop_module',
      'orders_module',
      'player_module',
      'donation_module',
      'event_module',
      'event_auto_reward',
      'wallet_module',
      'promo_module',
      'ranking_module',
      'restart_announce_module',
      'support_module',
      'staff_roles',
      'analytics_module',
      'sync_agent',
      'execute_agent',
    ],
  },
  {
    id: 'SERVER_ONLY',
    title: 'Server Only',
    description: 'Managed server controls without log and delivery add-ons.',
    status: 'active',
    position: 40,
    isSystem: true,
    features: [
      'server_hosting',
      'server_settings',
      'server_status',
      'sync_agent',
      'restart_announce_module',
      'support_module',
      'analytics_module',
    ],
  },
]);

const PACKAGE_CATALOG = Object.freeze(BUILTIN_PACKAGE_CATALOG.map((entry) => ({
  ...entry,
  features: [...entry.features],
})));

const PLAN_PACKAGE_ALIASES = Object.freeze({
  'trial-14d': 'BOT_LOG_DELIVERY',
  'platform-starter': 'BOT_LOG_DELIVERY',
  'platform-growth': 'FULL_OPTION',
});

let packageCatalogCache = PACKAGE_CATALOG.map(clonePackageEntry);
let packageCatalogRefreshPromise = null;
let packageCatalogReady = false;

function trimText(value, maxLen = 200) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clonePackageEntry(entry = {}) {
  return {
    id: trimText(entry.id, 120).toUpperCase(),
    title: trimText(entry.title, 180),
    description: trimText(entry.description, 400),
    status: normalizePackageStatus(entry.status),
    position: normalizePackagePosition(entry.position, 0),
    isSystem: entry.isSystem === true,
    features: normalizePackageFeatures(entry.features),
    metadata: normalizePackageMetadata(entry.metadata),
    actor: trimText(entry.actor, 180) || null,
    createdAt: toIsoString(entry.createdAt),
    updatedAt: toIsoString(entry.updatedAt),
  };
}

function normalizePackageId(value) {
  const text = trimText(value, 120)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return text || '';
}

function normalizeFeatureKey(value) {
  const text = trimText(value, 120).toLowerCase();
  return FEATURE_KEYS.includes(text) ? text : '';
}

function normalizePackageStatus(value) {
  const text = trimText(value, 40).toLowerCase();
  return PACKAGE_STATUS_VALUES.includes(text) ? text : 'active';
}

function normalizePackagePosition(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.max(0, Math.trunc(parsed));
}

function normalizePackageMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function stringifyJson(value) {
  if (value == null) return null;
  return JSON.stringify(value);
}

function normalizePackageFeatures(value) {
  const seen = new Set();
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\n,]+/g)
      .map((entry) => entry.trim());
  const normalized = [];
  for (const entry of rawValues) {
    const key = normalizeFeatureKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function sanitizeFeatureFlags(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function filterPackageCatalogRows(rows = [], options = {}) {
  const activeOnly = options.activeOnly === true;
  const requestedStatus = Array.isArray(options.status)
    ? options.status.map((entry) => normalizePackageStatus(entry))
    : trimText(options.status, 40)
      ? [normalizePackageStatus(options.status)]
      : [];
  let filtered = Array.isArray(rows) ? rows : [];
  if (activeOnly) {
    filtered = filtered.filter((entry) => normalizePackageStatus(entry.status) === 'active');
  }
  if (requestedStatus.length > 0) {
    filtered = filtered.filter((entry) => requestedStatus.includes(normalizePackageStatus(entry.status)));
  }
  return filtered.map(clonePackageEntry);
}

function getFeatureCatalog() {
  return FEATURE_CATALOG.map((entry) => ({ ...entry }));
}

function getFeatureKeys() {
  return [...FEATURE_KEYS];
}

function schedulePackageCatalogRefresh(db = prisma) {
  if (packageCatalogReady || packageCatalogRefreshPromise) return;
  packageCatalogRefreshPromise = refreshPackageCatalogCache({ db, silent: true })
    .catch(() => {})
    .finally(() => {
      packageCatalogRefreshPromise = null;
    });
}

function getPackageCatalog(options = {}) {
  schedulePackageCatalogRefresh();
  return filterPackageCatalogRows(packageCatalogCache, options);
}

function getPackageById(packageId, options = {}) {
  const requested = normalizePackageId(packageId);
  if (!requested) return null;
  const packages = filterPackageCatalogRows(packageCatalogCache, options);
  return packages.find((entry) => entry.id === requested) || null;
}

function resolvePackageForPlan(planId, metadata = null) {
  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const explicitPackageId = normalizePackageId(meta.packageId || meta.planPackageId);
  if (explicitPackageId) {
    return getPackageById(explicitPackageId) || null;
  }
  const requestedPlanId = trimText(planId, 120).toLowerCase();
  if (!requestedPlanId) return null;
  return getPackageById(PLAN_PACKAGE_ALIASES[requestedPlanId] || null) || null;
}

function collectEnabledFeatures(featureFlags = {}) {
  const flags = sanitizeFeatureFlags(featureFlags);
  const enabled = new Set();
  const disabled = new Set();

  const applyKeyValue = (source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const [key, rawValue] of Object.entries(source)) {
      const normalized = normalizeFeatureKey(key);
      if (!normalized) continue;
      if (rawValue === true) enabled.add(normalized);
      if (rawValue === false) disabled.add(normalized);
    }
  };

  const applyArray = (values, target) => {
    for (const entry of Array.isArray(values) ? values : []) {
      const normalized = normalizeFeatureKey(entry);
      if (normalized) target.add(normalized);
    }
  };

  applyKeyValue(flags);
  applyKeyValue(flags.features);
  applyKeyValue(flags.featureToggles);
  applyArray(flags.enabledFeatures, enabled);
  applyArray(flags.disabledFeatures, disabled);

  return {
    enabled: [...enabled],
    disabled: [...disabled],
  };
}

function resolveFeatureAccess(options = {}) {
  const {
    planId,
    packageId,
    featureFlags,
    metadata,
  } = options;

  const resolvedPackage = getPackageById(packageId) || resolvePackageForPlan(planId, metadata) || null;
  const enabled = new Set(resolvedPackage?.features || []);
  const overrides = collectEnabledFeatures(featureFlags);
  for (const key of overrides.enabled) enabled.add(key);
  for (const key of overrides.disabled) enabled.delete(key);

  const catalog = getFeatureCatalog().map((entry) => ({
    ...entry,
    enabled: enabled.has(entry.key),
  }));

  return {
    package: resolvedPackage,
    enabledFeatureKeys: catalog.filter((entry) => entry.enabled).map((entry) => entry.key),
    disabledFeatureKeys: catalog.filter((entry) => !entry.enabled).map((entry) => entry.key),
    overrides,
    catalog,
  };
}

function hasFeature(access, featureKey) {
  const requested = normalizeFeatureKey(featureKey);
  if (!requested) return false;
  const enabledKeys = Array.isArray(access?.enabledFeatureKeys)
    ? access.enabledFeatureKeys
    : [];
  return enabledKeys.includes(requested);
}

function getDatabaseRuntime() {
  return resolveDatabaseRuntime();
}

async function ensurePackageCatalogTable(db = prisma) {
  const runtime = getDatabaseRuntime();
  if (runtime.isSqlite) {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${TABLE_NAME}" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "featuresJson" TEXT NOT NULL,
        "position" INTEGER NOT NULL DEFAULT 0,
        "isSystem" INTEGER NOT NULL DEFAULT 0,
        "metadataJson" TEXT,
        "actor" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${TABLE_NAME}" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "featuresJson" TEXT NOT NULL,
        "position" INTEGER NOT NULL DEFAULT 0,
        "isSystem" BOOLEAN NOT NULL DEFAULT FALSE,
        "metadataJson" TEXT,
        "actor" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "${TABLE_NAME}_status_position_idx"
    ON "${TABLE_NAME}" ("status", "position", "updatedAt")
  `);
}

function normalizePackageCatalogRow(row = {}) {
  return clonePackageEntry({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    isSystem: row.isSystem === true || row.isSystem === 1 || row.isSystem === '1',
    features: parseJson(row.featuresJson, []),
    metadata: parseJson(row.metadataJson, null),
    actor: row.actor,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

async function readPersistedPackageCatalogRows(db = prisma) {
  await ensurePackageCatalogTable(db);
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT *
    FROM "PlatformPackageCatalogEntry"
    ORDER BY "position" ASC, "createdAt" ASC, "id" ASC
  `);
  return Array.isArray(rows) ? rows.map(normalizePackageCatalogRow) : [];
}

async function ensurePackageCatalogSeeded(db = prisma) {
  const existingRows = await readPersistedPackageCatalogRows(db);
  const existingIds = new Set(existingRows.map((entry) => entry.id));
  for (const entry of BUILTIN_PACKAGE_CATALOG) {
    if (existingIds.has(entry.id)) continue;
    const normalized = clonePackageEntry(entry);
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "PlatformPackageCatalogEntry" (
        "id",
        "title",
        "description",
        "status",
        "featuresJson",
        "position",
        "isSystem",
        "metadataJson",
        "actor",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${normalized.id},
        ${normalized.title},
        ${normalized.description || null},
        ${normalized.status},
        ${JSON.stringify(normalized.features)},
        ${normalized.position},
        ${normalized.isSystem},
        ${stringifyJson(normalized.metadata)},
        ${'system:seed'},
        ${new Date()},
        ${new Date()}
      )
    `);
  }
}

async function refreshPackageCatalogCache(options = {}) {
  const db = options.db || prisma;
  const silent = options.silent === true;
  if (packageCatalogRefreshPromise && options.force !== true) {
    return packageCatalogRefreshPromise;
  }
  packageCatalogRefreshPromise = (async () => {
    try {
      await ensurePackageCatalogSeeded(db);
      const rows = await readPersistedPackageCatalogRows(db);
      packageCatalogCache = rows.length ? rows : PACKAGE_CATALOG.map(clonePackageEntry);
      packageCatalogReady = true;
      return packageCatalogCache.map(clonePackageEntry);
    } catch (error) {
      if (!silent) {
        throw error;
      }
      return packageCatalogCache.map(clonePackageEntry);
    } finally {
      packageCatalogRefreshPromise = null;
    }
  })();
  return packageCatalogRefreshPromise;
}

async function listPersistedPackageCatalog(options = {}, db = prisma) {
  const rows = await refreshPackageCatalogCache({ db, force: true });
  return filterPackageCatalogRows(rows, options);
}

function normalizePackageInput(input = {}, options = {}) {
  const existing = options.existing && typeof options.existing === 'object' ? options.existing : null;
  const id = normalizePackageId(input.id || existing?.id);
  const title = trimText(input.title != null ? input.title : existing?.title, 180);
  const description = trimText(
    input.description != null ? input.description : existing?.description,
    400,
  );
  const features = normalizePackageFeatures(
    input.features != null
      ? input.features
      : (input.featureText != null ? input.featureText : existing?.features),
  );
  const status = normalizePackageStatus(input.status != null ? input.status : existing?.status);
  const position = normalizePackagePosition(
    input.position != null ? input.position : existing?.position,
    existing?.position || 0,
  );
  const metadata = normalizePackageMetadata(
    input.metadata != null ? input.metadata : existing?.metadata,
  );
  const actor = trimText(input.actor || options.actor, 180) || null;
  const isSystem = existing?.isSystem === true || input.isSystem === true;
  return {
    id,
    title,
    description,
    features,
    status,
    position,
    metadata,
    actor,
    isSystem,
  };
}

async function createPackageCatalogEntry(input = {}, actor = 'system', db = prisma) {
  await refreshPackageCatalogCache({ db, force: true });
  const normalized = normalizePackageInput(input, { actor });
  if (!normalized.id) return { ok: false, reason: 'package-id-required' };
  if (!normalized.title) return { ok: false, reason: 'package-title-required' };
  if (normalized.features.length === 0) return { ok: false, reason: 'package-features-required' };
  if (getPackageById(normalized.id, { includeInactive: true })) {
    return { ok: false, reason: 'package-already-exists' };
  }
  await ensurePackageCatalogTable(db);
  const now = new Date();
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "PlatformPackageCatalogEntry" (
      "id",
      "title",
      "description",
      "status",
      "featuresJson",
      "position",
      "isSystem",
      "metadataJson",
      "actor",
      "createdAt",
      "updatedAt"
    ) VALUES (
      ${normalized.id},
      ${normalized.title},
      ${normalized.description || null},
      ${normalized.status},
      ${JSON.stringify(normalized.features)},
      ${normalized.position},
      ${false},
      ${stringifyJson(normalized.metadata)},
      ${normalized.actor || null},
      ${now},
      ${now}
    )
  `);
  const rows = await refreshPackageCatalogCache({ db, force: true });
  return {
    ok: true,
    package: rows.find((entry) => entry.id === normalized.id) || null,
  };
}

async function updatePackageCatalogEntry(input = {}, actor = 'system', db = prisma) {
  await refreshPackageCatalogCache({ db, force: true });
  const packageId = normalizePackageId(input.id);
  if (!packageId) return { ok: false, reason: 'package-id-required' };
  const existing = getPackageById(packageId, { includeInactive: true });
  if (!existing) return { ok: false, reason: 'package-not-found' };
  const normalized = normalizePackageInput(input, { actor, existing });
  if (!normalized.title) return { ok: false, reason: 'package-title-required' };
  if (normalized.features.length === 0) return { ok: false, reason: 'package-features-required' };
  await ensurePackageCatalogTable(db);
  const now = new Date();
  await db.$executeRaw(Prisma.sql`
    UPDATE "PlatformPackageCatalogEntry"
    SET
      "title" = ${normalized.title},
      "description" = ${normalized.description || null},
      "status" = ${normalized.status},
      "featuresJson" = ${JSON.stringify(normalized.features)},
      "position" = ${normalized.position},
      "metadataJson" = ${stringifyJson(normalized.metadata)},
      "actor" = ${normalized.actor || existing.actor || null},
      "updatedAt" = ${now}
    WHERE "id" = ${packageId}
  `);
  const rows = await refreshPackageCatalogCache({ db, force: true });
  return {
    ok: true,
    package: rows.find((entry) => entry.id === packageId) || null,
  };
}

async function deletePackageCatalogEntry(input = {}, actor = 'system', db = prisma) {
  await refreshPackageCatalogCache({ db, force: true });
  const packageId = normalizePackageId(input.id || input.packageId);
  if (!packageId) return { ok: false, reason: 'package-id-required' };
  const existing = getPackageById(packageId, { includeInactive: true });
  if (!existing) return { ok: false, reason: 'package-not-found' };
  if (existing.isSystem) return { ok: false, reason: 'package-system-delete-blocked' };
  await ensurePackageCatalogTable(db);
  await db.$executeRaw(Prisma.sql`
    DELETE FROM "PlatformPackageCatalogEntry"
    WHERE "id" = ${packageId}
  `);
  await refreshPackageCatalogCache({ db, force: true });
  return {
    ok: true,
    deletedPackageId: packageId,
    actor: trimText(actor, 180) || null,
  };
}

module.exports = {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  PACKAGE_CATALOG,
  PACKAGE_STATUS_VALUES,
  PLAN_PACKAGE_ALIASES,
  createPackageCatalogEntry,
  deletePackageCatalogEntry,
  ensurePackageCatalogSeeded,
  ensurePackageCatalogTable,
  getFeatureCatalog,
  getFeatureKeys,
  getPackageById,
  getPackageCatalog,
  hasFeature,
  listPersistedPackageCatalog,
  refreshPackageCatalogCache,
  resolveFeatureAccess,
  resolvePackageForPlan,
  updatePackageCatalogEntry,
};
