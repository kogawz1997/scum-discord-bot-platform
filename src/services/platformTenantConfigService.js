'use strict';

const { prisma, getTenantScopedPrismaClient } = require('../prisma');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');
const { withTenantDbIsolation } = require('../utils/tenantDbIsolation');

function getDatabaseEngine() {
  const runtime = resolveDatabaseRuntime();
  return runtime.engine === 'unsupported' ? 'sqlite' : runtime.engine;
}

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

function normalizeRow(row) {
  if (!row) return null;
  return {
    tenantId: normalizeTenantId(row.tenantId) || '',
    configPatch: parseJsonObject(row.configPatchJson),
    portalEnvPatch: parseJsonObject(row.portalEnvPatchJson),
    featureFlags: parseJsonObject(row.featureFlagsJson),
    updatedBy: String(row.updatedBy || '').trim() || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
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

async function ensurePlatformTenantConfigTable(client = prisma) {
  const engine = getDatabaseEngine();
  if (engine === 'postgresql') {
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_tenant_configs (
        tenant_id TEXT PRIMARY KEY,
        config_patch_json TEXT,
        portal_env_patch_json TEXT,
        feature_flags_json TEXT,
        updated_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return;
  }
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_tenant_configs (
      tenant_id TEXT PRIMARY KEY,
      config_patch_json TEXT,
      portal_env_patch_json TEXT,
      feature_flags_json TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function listTenantConfigRows(db, limit) {
  await ensurePlatformTenantConfigTable(db);
  const rows = await db.$queryRaw`
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

async function getSharedTenantRegistryRow(tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!id) return null;
  return prisma.platformTenant.findUnique({
    where: { id },
    select: { id: true },
  }).catch(() => null);
}

async function getPlatformTenantConfig(tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!id) return null;
  const tenant = await getSharedTenantRegistryRow(id);
  if (!tenant) return null;
  const tenantPrisma = getTenantScopedPrismaClient(id);
  return withTenantDbIsolation(
    tenantPrisma,
    { tenantId: id, enforce: true },
    async (db) => {
      const rows = await listTenantConfigRows(db, 1);
      return rows.find((row) => row.tenantId === id) || null;
    },
  );
}

async function listPlatformTenantConfigs(options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const limit = Math.max(1, Math.min(500, Number(options.limit || 200) || 200));
  if (tenantId) {
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return [];
    return withTenantDbIsolation(
      getTenantScopedPrismaClient(tenantId),
      { tenantId, enforce: true },
      async (db) => {
        const rows = await listTenantConfigRows(db, limit);
        return rows.filter((row) => row.tenantId === tenantId);
      },
    );
  }

  const topologyMode = getTenantDatabaseTopologyMode();
  const sharedRows = (await listTenantConfigRows(prisma, limit).catch(() => []))
    .map((row) => annotateTenantConfigScope(row, null));
  if (topologyMode === 'shared') {
    return dedupeTenantConfigRows(sharedRows).slice(0, limit);
  }

  const tenantRows = await prisma.platformTenant.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
    take: limit,
  }).catch(() => []);

  const aggregated = [...sharedRows];
  for (const row of tenantRows) {
    const id = normalizeTenantId(row?.id);
    if (!id) continue;
    const scopedRows = await withTenantDbIsolation(
      getTenantScopedPrismaClient(id),
      { tenantId: id, enforce: true },
      (db) => listTenantConfigRows(db, limit),
    ).catch(() => []);
    aggregated.push(...scopedRows.map((row) => annotateTenantConfigScope(row, id)));
  }

  return dedupeTenantConfigRows(aggregated)
    .sort((left, right) => String(left?.tenantId || '').localeCompare(String(right?.tenantId || '')))
    .slice(0, limit);
}

async function upsertPlatformTenantConfig(input = {}) {
  const tenantId = normalizeTenantId(input.tenantId);
  if (!tenantId) return { ok: false, reason: 'tenant-required' };
  const tenant = await getSharedTenantRegistryRow(tenantId);
  if (!tenant) return { ok: false, reason: 'tenant-not-found' };
  const configPatch = input.configPatch && typeof input.configPatch === 'object' && !Array.isArray(input.configPatch)
    ? input.configPatch
    : {};
  const portalEnvPatch = input.portalEnvPatch && typeof input.portalEnvPatch === 'object' && !Array.isArray(input.portalEnvPatch)
    ? input.portalEnvPatch
    : {};
  const featureFlags = input.featureFlags && typeof input.featureFlags === 'object' && !Array.isArray(input.featureFlags)
    ? input.featureFlags
    : {};
  const updatedBy = String(input.updatedBy || '').trim() || null;
  const tenantPrisma = getTenantScopedPrismaClient(tenantId);
  await withTenantDbIsolation(
    tenantPrisma,
    { tenantId, enforce: true },
    async (db) => {
      await ensurePlatformTenantConfigTable(db);
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
          ${tenantId},
          ${JSON.stringify(configPatch)},
          ${JSON.stringify(portalEnvPatch)},
          ${JSON.stringify(featureFlags)},
          ${updatedBy},
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
    },
  );
  return {
    ok: true,
    data: await getPlatformTenantConfig(tenantId),
  };
}

module.exports = {
  ensurePlatformTenantConfigTable,
  getPlatformTenantConfig,
  listPlatformTenantConfigs,
  upsertPlatformTenantConfig,
};
