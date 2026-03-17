'use strict';

const { withTenantDbIsolation } = require('../utils/tenantDbIsolation');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');

function getPrismaModule() {
  return require('../prisma');
}

function getDefaultPrismaClient() {
  return getPrismaModule().prisma;
}

function getScopedPrismaClient(tenantId, options = {}) {
  const prismaModule = getPrismaModule();
  if (typeof prismaModule.getTenantScopedPrismaClient === 'function') {
    return prismaModule.getTenantScopedPrismaClient(tenantId, options);
  }
  return prismaModule.prisma;
}

function normalizeTenantId(value) {
  const text = String(value || '').trim();
  return text || null;
}

function annotateScopeRow(row, scope = {}) {
  if (!row || typeof row !== 'object') return row;
  const scopeTenantId = normalizeTenantId(scope.tenantId);
  try {
    Object.defineProperty(row, '__scopeTenantId', {
      value: scopeTenantId,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    row.__scopeTenantId = scopeTenantId;
  }
  return row;
}

function resolveScopedRowTenantId(row, options = {}) {
  const env = options.env || process.env;
  const directTenantId = normalizeTenantId(row?.tenantId);
  if (directTenantId) return directTenantId;
  const scopeTenantId = normalizeTenantId(row?.__scopeTenantId);
  if (scopeTenantId) return scopeTenantId;
  if (options.mapSharedScopeToDefaultTenant) {
    return normalizeTenantId(
      options.defaultTenantId || env.PLATFORM_DEFAULT_TENANT_ID || env.DEFAULT_TENANT_ID,
    );
  }
  return null;
}

function normalizeScopedRowKeyPart(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function buildScopedRowKey(row, fields = ['id'], options = {}) {
  const normalizedFields = Array.isArray(fields) ? fields : [fields];
  const tenantId = resolveScopedRowTenantId(row, options) || '__shared__';
  const parts = [tenantId];
  for (const field of normalizedFields) {
    const key = String(field || '').trim();
    if (!key) continue;
    parts.push(normalizeScopedRowKeyPart(row?.[key]));
  }
  return parts.join(':');
}

function shouldReplaceScopedDuplicate(currentRow, nextRow) {
  const currentScopeTenantId = normalizeTenantId(currentRow?.__scopeTenantId);
  const nextScopeTenantId = normalizeTenantId(nextRow?.__scopeTenantId);
  return !currentScopeTenantId && Boolean(nextScopeTenantId);
}

function dedupeScopedRows(rows = [], buildKey, options = {}) {
  const keyBuilder = typeof buildKey === 'function'
    ? buildKey
    : (row) => buildScopedRowKey(row, buildKey, options);
  const deduped = [];
  const keyIndex = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = normalizeScopedRowKeyPart(keyBuilder(row));
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
    if (shouldReplaceScopedDuplicate(deduped[index], row)) {
      deduped[index] = row;
    }
  }
  return deduped;
}

function resolvePersistenceScope(tenantId, options = {}) {
  const env = options.env || process.env;
  const normalizedTenantId = normalizeTenantId(tenantId);
  const topologyMode = getTenantDatabaseTopologyMode(env);
  const usesIsolatedTopology = normalizedTenantId && topologyMode !== 'shared';
  return {
    tenantId: normalizedTenantId,
    topologyMode,
    usesIsolatedTopology,
    db: normalizedTenantId ? getScopedPrismaClient(normalizedTenantId, options) : getDefaultPrismaClient(),
    whereTenant: normalizedTenantId ? { tenantId: normalizedTenantId } : {},
  };
}

async function runWithDeliveryPersistenceScope(tenantId, work, options = {}) {
  if (typeof work !== 'function') {
    throw new TypeError('runWithDeliveryPersistenceScope requires a callback');
  }
  const scope = resolvePersistenceScope(tenantId, options);
  const supportsIsolationSession =
    scope.db
    && typeof scope.db.$transaction === 'function'
    && (
      typeof scope.db.$executeRaw === 'function'
      || typeof scope.db.$executeRawUnsafe === 'function'
    );
  if (!scope.tenantId || !supportsIsolationSession) {
    return work(scope.db, scope);
  }
  return withTenantDbIsolation(
    scope.db,
    { tenantId: scope.tenantId, enforce: true, env: options.env || process.env },
    async (db, isolation) => work(db, { ...scope, db, isolation }),
  );
}

async function listDeliveryPersistenceScopes(options = {}) {
  const env = options.env || process.env;
  const tenantId = normalizeTenantId(options.tenantId);
  if (tenantId) {
    return [resolvePersistenceScope(tenantId, options)];
  }

  const topologyMode = getTenantDatabaseTopologyMode(env);
  if (topologyMode === 'shared') {
    return [resolvePersistenceScope(null, options)];
  }

  const scopes = [resolvePersistenceScope(null, options)];
  const seen = new Set();
  const defaultTenantId = normalizeTenantId(
    env.PLATFORM_DEFAULT_TENANT_ID || env.DEFAULT_TENANT_ID,
  );
  if (defaultTenantId) {
    seen.add(defaultTenantId);
    scopes.push(resolvePersistenceScope(defaultTenantId, options));
  }
  try {
    const rows = await getDefaultPrismaClient().platformTenant.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    for (const row of rows) {
      const scopedTenantId = normalizeTenantId(row?.id);
      if (!scopedTenantId || seen.has(scopedTenantId)) continue;
      seen.add(scopedTenantId);
      scopes.push(resolvePersistenceScope(scopedTenantId, options));
    }
  } catch {
    // Fallback to the shared scope only when tenant enumeration is unavailable.
  }
  return scopes;
}

async function readAcrossDeliveryPersistenceScopes(readWork, options = {}) {
  if (typeof readWork !== 'function') {
    throw new TypeError('readAcrossDeliveryPersistenceScopes requires a callback');
  }
  const scopes = await listDeliveryPersistenceScopes(options);
  const results = [];
  for (const scope of scopes) {
    const rows = await runWithDeliveryPersistenceScope(scope.tenantId, (db, scoped) =>
      readWork(db, scoped), options);
    if (Array.isArray(rows)) {
      results.push(...rows.map((row) => annotateScopeRow(row, scope)));
    }
  }
  return results;
}

function groupRowsByTenant(rows) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const tenantId = normalizeTenantId(row?.tenantId);
    if (!groups.has(tenantId)) {
      groups.set(tenantId, []);
    }
    groups.get(tenantId).push(row);
  }
  return groups;
}

module.exports = {
  normalizeTenantId,
  buildScopedRowKey,
  dedupeScopedRows,
  resolvePersistenceScope,
  resolveScopedRowTenantId,
  runWithDeliveryPersistenceScope,
  listDeliveryPersistenceScopes,
  readAcrossDeliveryPersistenceScopes,
  groupRowsByTenant,
};
