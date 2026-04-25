'use strict';

const { prisma, getTenantScopedPrismaClient } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');
const {
  assertTenantDbIsolationScope,
  withTenantDbIsolation,
} = require('../utils/tenantDbIsolation');
const { reconcileSqliteDateColumns } = require('../utils/sqliteDateTimeCompatibility');

function normalizeTenantId(value) {
  const text = String(value || '').trim();
  return text || null;
}

function parseJsonObject(value) {
  if (value == null || String(value).trim() === '') return {};
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toIsoText(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    tenantId: normalizeTenantId(row.tenantId) || '',
    configPatch: parseJsonObject(row.configPatchJson),
    portalEnvPatch: parseJsonObject(row.portalEnvPatchJson),
    featureFlags: parseJsonObject(row.featureFlagsJson),
    updatedBy: String(row.updatedBy || '').trim() || null,
    createdAt: toIsoText(row.createdAt),
    updatedAt: toIsoText(row.updatedAt),
  };
}

function annotateTenantConfigScope(row, scopeTenantId = null) {
  if (!row || typeof row !== 'object') return row;
  try {
    Object.defineProperty(row, '__scopeTenantId', {
      value: normalizeTenantId(scopeTenantId),
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    row.__scopeTenantId = normalizeTenantId(scopeTenantId);
  }
  return row;
}

function dedupeTenantConfigRows(rows = []) {
  const deduped = [];
  const keyIndex = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const tenantId = normalizeTenantId(row?.tenantId);
    if (!tenantId) continue;
    if (!keyIndex.has(tenantId)) {
      keyIndex.set(tenantId, deduped.length);
      deduped.push(row);
      continue;
    }
    const index = keyIndex.get(tenantId);
    const currentScopeTenantId = normalizeTenantId(deduped[index]?.__scopeTenantId);
    const nextScopeTenantId = normalizeTenantId(row?.__scopeTenantId);
    if (!currentScopeTenantId && nextScopeTenantId) {
      deduped[index] = row;
    }
  }
  return deduped;
}

function getTenantConfigDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformTenantConfig : null;
  if (!delegate || typeof delegate.findUnique !== 'function') return null;
  return delegate;
}

function getTenantConfigDelegateOrThrow(client = null) {
  const delegate = getTenantConfigDelegate(client);
  if (delegate) return delegate;
  throw new Error('platform-tenant-config-delegate-unavailable');
}

function getTenantConfigPersistenceMode() {
  const requireDb = ['1', 'true', 'yes', 'on'].includes(
    String(process.env.PERSIST_REQUIRE_DB || '')
      .trim()
      .toLowerCase(),
  );
  if (requireDb) return 'prisma';
  const runtime = resolveDatabaseRuntime();
  if (runtime.isSqlite) {
    // Keep tenant-config persistence on the SQL compatibility path for SQLite.
    // Legacy local databases can carry INTEGER-backed created_at/updated_at values
    // that Prisma DateTime delegates reject, while the raw SQL path continues to
    // preserve the existing API contract safely.
    return 'sql';
  }
  return runtime.isServerEngine ? 'prisma' : 'sql';
}

function isTenantConfigDbOnlyPosture() {
  return (
    ['1', 'true', 'yes', 'on'].includes(
      String(process.env.PERSIST_REQUIRE_DB || '')
        .trim()
        .toLowerCase(),
    ) ||
    String(process.env.NODE_ENV || '')
      .trim()
      .toLowerCase() === 'production'
  );
}

function isTenantConfigDateCompatibilityError(error) {
  if (!error) return false;
  if (
    String(error.code || '')
      .trim()
      .toUpperCase() === 'P2023'
  )
    return true;
  const message = String(error.message || '').toLowerCase();
  return (
    message.includes('created_at') ||
    message.includes('updated_at') ||
    message.includes('type `datetime`')
  );
}

async function repairTenantConfigDateColumnsForSqlite(db) {
  const runtime = resolveDatabaseRuntime();
  if (!runtime.isSqlite) {
    return false;
  }
  if (
    !db ||
    typeof db.$queryRawUnsafe !== 'function' ||
    typeof db.$executeRawUnsafe !== 'function'
  ) {
    return false;
  }
  await reconcileSqliteDateColumns(db, {
    tableName: 'platform_tenant_configs',
    idColumn: 'tenant_id',
    dateColumns: ['created_at', 'updated_at'],
  });
  return true;
}

async function repairTenantConfigDateColumnsIfPossible(db, error) {
  if (!isTenantConfigDateCompatibilityError(error)) {
    return false;
  }
  return repairTenantConfigDateColumnsForSqlite(db);
}

async function listTenantConfigRowsViaSql(db, limit, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const rows = tenantId
    ? await db.$queryRaw`
      SELECT
        tenant_id AS "tenantId",
        config_patch_json AS "configPatchJson",
        portal_env_patch_json AS "portalEnvPatchJson",
        feature_flags_json AS "featureFlagsJson",
        updated_by AS "updatedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_tenant_configs
      WHERE tenant_id = ${tenantId}
      ORDER BY tenant_id ASC
      LIMIT ${limit}
    `
    : await db.$queryRaw`
      SELECT
        tenant_id AS "tenantId",
        config_patch_json AS "configPatchJson",
        portal_env_patch_json AS "portalEnvPatchJson",
        feature_flags_json AS "featureFlagsJson",
        updated_by AS "updatedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_tenant_configs
      ORDER BY tenant_id ASC
      LIMIT ${limit}
    `;
  return Array.isArray(rows) ? rows.map(normalizeRow).filter(Boolean) : [];
}

async function upsertTenantConfigRowViaSql(db, input) {
  await db.$executeRaw`
    INSERT INTO platform_tenant_configs (
      tenant_id,
      config_patch_json,
      portal_env_patch_json,
      feature_flags_json,
      updated_by,
      created_at,
      updated_at
    )
    VALUES (
      ${input.tenantId},
      ${JSON.stringify(input.configPatch)},
      ${JSON.stringify(input.portalEnvPatch)},
      ${JSON.stringify(input.featureFlags)},
      ${input.updatedBy},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      config_patch_json = EXCLUDED.config_patch_json,
      portal_env_patch_json = EXCLUDED.portal_env_patch_json,
      feature_flags_json = EXCLUDED.feature_flags_json,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `;
}

async function listTenantConfigRows(db, limit, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const persistenceMode = getTenantConfigPersistenceMode();
  if (persistenceMode === 'prisma') {
    try {
      const delegate = getTenantConfigDelegateOrThrow(db);
      const rows = await delegate.findMany({
        ...(tenantId ? { where: { tenantId } } : {}),
        orderBy: { tenantId: 'asc' },
        take: limit,
      });
      return Array.isArray(rows) ? rows.map(normalizeRow).filter(Boolean) : [];
    } catch (error) {
      if (!isTenantConfigDateCompatibilityError(error) || isTenantConfigDbOnlyPosture()) {
        throw error;
      }
    }
  }
  return listTenantConfigRowsViaSql(db, limit, { tenantId });
}

async function getSharedTenantRegistryRow(tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!id) return null;
  return prisma.platformTenant
    .findUnique({
      where: { id },
      select: { id: true },
    })
    .catch(() => null);
}

async function getPlatformTenantConfig(tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!id) return null;
  const tenant = await getSharedTenantRegistryRow(id);
  if (!tenant) return null;
  const tenantPrisma = getTenantScopedPrismaClient(id);
  return withTenantDbIsolation(tenantPrisma, { tenantId: id, enforce: true }, async (db) => {
    const rows = await listTenantConfigRows(db, 1, { tenantId: id });
    return rows[0] || null;
  });
}

async function listPlatformTenantConfigs(options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  assertTenantDbIsolationScope({
    tenantId,
    allowGlobal: options.allowGlobal === true,
    operation: 'platform tenant config listing',
    env: options.env || process.env,
  });
  const limit = Math.max(1, Math.min(500, Number(options.limit || 200) || 200));
  const allowCompatibilityFallback = !isTenantConfigDbOnlyPosture();
  if (tenantId) {
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return [];
    return withTenantDbIsolation(
      getTenantScopedPrismaClient(tenantId),
      { tenantId, enforce: true },
      async (db) => {
        return listTenantConfigRows(db, limit, { tenantId });
      },
    );
  }

  const topologyMode = getTenantDatabaseTopologyMode();
  const sharedRows = (
    await listTenantConfigRows(prisma, limit).catch((error) => {
      if (!allowCompatibilityFallback) {
        throw error;
      }
      return [];
    })
  ).map((row) => annotateTenantConfigScope(row, null));
  if (topologyMode === 'shared') {
    return dedupeTenantConfigRows(sharedRows).slice(0, limit);
  }

  const tenantRows = await prisma.platformTenant
    .findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    })
    .catch(() => []);

  const aggregated = [...sharedRows];
  for (const row of tenantRows) {
    const id = normalizeTenantId(row?.id);
    if (!id) continue;
    const scopedRows = await withTenantDbIsolation(
      getTenantScopedPrismaClient(id),
      { tenantId: id, enforce: true },
      (db) => listTenantConfigRows(db, limit),
    ).catch((error) => {
      if (!allowCompatibilityFallback) {
        throw error;
      }
      return [];
    });
    aggregated.push(...scopedRows.map((row) => annotateTenantConfigScope(row, id)));
  }

  return dedupeTenantConfigRows(aggregated)
    .sort((left, right) =>
      String(left?.tenantId || '').localeCompare(String(right?.tenantId || '')),
    )
    .slice(0, limit);
}

async function upsertPlatformTenantConfig(input = {}) {
  const tenantId = normalizeTenantId(input.tenantId);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const configPatch =
    input.configPatch && typeof input.configPatch === 'object' && !Array.isArray(input.configPatch)
      ? input.configPatch
      : {};
  const portalEnvPatch =
    input.portalEnvPatch &&
    typeof input.portalEnvPatch === 'object' &&
    !Array.isArray(input.portalEnvPatch)
      ? input.portalEnvPatch
      : {};
  const featureFlags =
    input.featureFlags &&
    typeof input.featureFlags === 'object' &&
    !Array.isArray(input.featureFlags)
      ? input.featureFlags
      : {};
  const updatedBy = String(input.updatedBy || '').trim() || null;
  const tenantPrisma = getTenantScopedPrismaClient(tenantId);
  await withTenantDbIsolation(tenantPrisma, { tenantId, enforce: true }, async (db) => {
    const upsertPayload = {
      where: { tenantId },
      create: {
        tenantId,
        configPatchJson: JSON.stringify(configPatch),
        portalEnvPatchJson: JSON.stringify(portalEnvPatch),
        featureFlagsJson: JSON.stringify(featureFlags),
        updatedBy,
      },
      update: {
        configPatchJson: JSON.stringify(configPatch),
        portalEnvPatchJson: JSON.stringify(portalEnvPatch),
        featureFlagsJson: JSON.stringify(featureFlags),
        updatedBy,
      },
      select: { tenantId: true },
    };
    if (getTenantConfigPersistenceMode() === 'prisma') {
      try {
        const delegate = getTenantConfigDelegateOrThrow(db);
        await delegate.upsert(upsertPayload);
        await repairTenantConfigDateColumnsForSqlite(db);
        return;
      } catch (error) {
        if (await repairTenantConfigDateColumnsIfPossible(db, error)) {
          const delegate = getTenantConfigDelegateOrThrow(db);
          await delegate.upsert(upsertPayload);
          await repairTenantConfigDateColumnsForSqlite(db);
          return;
        }
        if (!isTenantConfigDateCompatibilityError(error) || isTenantConfigDbOnlyPosture()) {
          throw error;
        }
      }
    }

    await upsertTenantConfigRowViaSql(db, {
      tenantId,
      configPatch,
      portalEnvPatch,
      featureFlags,
      updatedBy,
    });
  });
  return {
    ok: true,
    data: await getPlatformTenantConfig(tenantId),
  };
}

module.exports = {
  getPlatformTenantConfig,
  listPlatformTenantConfigs,
  upsertPlatformTenantConfig,
  __test: {
    getTenantConfigPersistenceMode,
  },
};
