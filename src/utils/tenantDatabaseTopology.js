'use strict';

const { resolveDatabaseRuntime } = require('./dbEngine');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeTenantDatabaseTopologyMode(value, fallback = 'shared') {
  const text = trimText(value, 80).toLowerCase();
  if (!text) return fallback;
  if (['shared', 'shared-db', 'shared-database', 'rls'].includes(text)) return 'shared';
  if (['schema', 'schema-per-tenant', 'tenant-schema'].includes(text)) return 'schema-per-tenant';
  if (['database', 'database-per-tenant', 'tenant-database', 'db-per-tenant'].includes(text)) {
    return 'database-per-tenant';
  }
  return fallback;
}

function getTenantDatabaseTopologyMode(env = process.env) {
  return normalizeTenantDatabaseTopologyMode(env.TENANT_DB_TOPOLOGY_MODE, 'shared');
}

function sanitizeTenantDatabaseToken(value, fallback = 'tenant') {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || fallback;
}

function buildTenantSchemaName(tenantId, env = process.env) {
  const prefix = trimText(env.TENANT_DB_SCHEMA_PREFIX || 'tenant_', 80) || 'tenant_';
  return `${prefix}${sanitizeTenantDatabaseToken(tenantId)}`;
}

function buildTenantDatabaseName(tenantId, env = process.env) {
  const prefix = trimText(env.TENANT_DB_DATABASE_PREFIX || 'tenant_', 80) || 'tenant_';
  return `${prefix}${sanitizeTenantDatabaseToken(tenantId)}`;
}

function buildTenantDatabaseAdminUrl(databaseUrl, env = process.env) {
  const rawUrl = trimText(databaseUrl || env.DATABASE_URL, 2000);
  if (!/^postgres(?:ql)?:\/\//i.test(rawUrl)) return rawUrl;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  const adminDatabase = trimText(env.TENANT_DB_ADMIN_DATABASE || 'postgres', 120) || 'postgres';
  parsed.pathname = `/${adminDatabase}`;
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

function resolveTenantDatabaseTarget(options = {}) {
  const env = options.env || process.env;
  const databaseUrl = trimText(options.databaseUrl || env.DATABASE_URL, 2000);
  const mode = normalizeTenantDatabaseTopologyMode(
    options.mode || env.TENANT_DB_TOPOLOGY_MODE,
    'shared',
  );
  const tenantId = trimText(options.tenantId, 120) || null;
  const database = resolveDatabaseRuntime({
    databaseUrl,
    provider: options.provider || env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const supported = database.engine === 'postgresql';

  const result = {
    mode,
    tenantId,
    supported,
    database,
    datasourceUrl: databaseUrl,
    schemaName: null,
    databaseName: null,
    adminUrl: buildTenantDatabaseAdminUrl(databaseUrl, env),
  };

  if (!supported || !databaseUrl || !tenantId || mode === 'shared') {
    return Object.freeze(result);
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return Object.freeze(result);
  }

  if (mode === 'schema-per-tenant') {
    const schemaName = buildTenantSchemaName(tenantId, env);
    parsed.searchParams.set('schema', schemaName);
    return Object.freeze({
      ...result,
      schemaName,
      datasourceUrl: parsed.toString(),
    });
  }

  if (mode === 'database-per-tenant') {
    const databaseName = buildTenantDatabaseName(tenantId, env);
    parsed.pathname = `/${databaseName}`;
    parsed.searchParams.delete('schema');
    return Object.freeze({
      ...result,
      databaseName,
      datasourceUrl: parsed.toString(),
    });
  }

  return Object.freeze(result);
}

module.exports = {
  buildTenantDatabaseAdminUrl,
  buildTenantDatabaseName,
  buildTenantSchemaName,
  getTenantDatabaseTopologyMode,
  normalizeTenantDatabaseTopologyMode,
  resolveTenantDatabaseTarget,
  sanitizeTenantDatabaseToken,
};
