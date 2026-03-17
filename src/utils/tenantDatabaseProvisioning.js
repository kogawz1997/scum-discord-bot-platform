'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  buildTenantDatabaseAdminUrl,
  resolveTenantDatabaseTarget,
} = require('./tenantDatabaseTopology');

const provisionedTargetCache = new Set();

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function normalizeBooleanText(value) {
  return trimText(value, 40).toLowerCase();
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function projectRoot() {
  return path.resolve(__dirname, '..', '..');
}

function runNodeSnippet(source, env = {}) {
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: projectRoot(),
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (Number(result.status || 0) !== 0) {
    throw new Error(trimText(result.stderr || result.stdout || 'tenant provisioning failed', 4000));
  }
}

function runDbPush(databaseUrl) {
  const scriptPath = path.resolve(projectRoot(), 'scripts', 'prisma-with-provider.js');
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--provider', 'postgresql', 'db', 'push', '--skip-generate'],
    {
      cwd: projectRoot(),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (Number(result.status || 0) !== 0) {
    throw new Error(trimText(result.stderr || result.stdout || 'db push failed', 4000));
  }
}

function shouldAutoProvisionTenantDatabaseTarget(options = {}) {
  if (options.autoProvision === true) return true;
  if (options.autoProvision === false) return false;
  const env = options.env || process.env;
  const raw = normalizeBooleanText(env.TENANT_DB_AUTO_PROVISION);
  if (['1', 'true', 'yes', 'on', 'always'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off', 'never'].includes(raw)) return false;
  return options.isTestRuntime === true;
}

function ensureTenantSchema(target, env = {}) {
  const sourceDatabaseUrl = trimText(env.DATABASE_URL || process.env.DATABASE_URL, 2000);
  if (!sourceDatabaseUrl || !target?.schemaName) {
    throw new Error('schema-per-tenant provisioning requires DATABASE_URL and target schema');
  }
  const sql = `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(target.schemaName)};`;
  runNodeSnippet(
    `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: ${JSON.stringify(sourceDatabaseUrl)},
          },
        },
      });
      (async () => {
        try {
          await prisma.$executeRawUnsafe(${JSON.stringify(sql)});
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      })().catch((error) => {
        console.error(error && error.message ? error.message : error);
        process.exit(1);
      });
    `,
    env,
  );
  runDbPush(target.datasourceUrl);
}

function ensureTenantDatabase(target, env = {}) {
  const adminUrl = trimText(
    target?.adminUrl || buildTenantDatabaseAdminUrl(env.DATABASE_URL || process.env.DATABASE_URL, env),
    2000,
  );
  if (!adminUrl || !target?.databaseName) {
    throw new Error('database-per-tenant provisioning requires admin url and target database');
  }
  runNodeSnippet(
    `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: ${JSON.stringify(adminUrl)},
          },
        },
      });
      (async () => {
        try {
          const rows = await prisma.$queryRawUnsafe(
            'SELECT datname AS "name" FROM pg_database WHERE datname = $1',
            ${JSON.stringify(target.databaseName)},
          );
          if (!Array.isArray(rows) || rows.length === 0) {
            await prisma.$executeRawUnsafe(
              ${JSON.stringify(`CREATE DATABASE ${quoteIdentifier(target.databaseName)};`)},
            );
          }
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      })().catch((error) => {
        console.error(error && error.message ? error.message : error);
        process.exit(1);
      });
    `,
    env,
  );
  runDbPush(target.datasourceUrl);
}

function ensureTenantDatabaseTargetProvisioned(tenantId, options = {}) {
  const id = trimText(tenantId, 120);
  if (!id) return null;
  const env = options.env || process.env;
  const target = resolveTenantDatabaseTarget({
    tenantId: id,
    env,
    databaseUrl: options.databaseUrl || env.DATABASE_URL,
    mode: options.mode || env.TENANT_DB_TOPOLOGY_MODE,
    provider: options.provider || env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  if (!target.supported || target.mode === 'shared' || !target.datasourceUrl) {
    return target;
  }
  const cacheKey = `${target.mode}:${target.datasourceUrl}`;
  if (provisionedTargetCache.has(cacheKey)) {
    return target;
  }
  if (target.mode === 'schema-per-tenant') {
    ensureTenantSchema(target, env);
  } else if (target.mode === 'database-per-tenant') {
    ensureTenantDatabase(target, env);
  }
  provisionedTargetCache.add(cacheKey);
  return target;
}

function clearProvisionedTenantDatabaseTargets() {
  provisionedTargetCache.clear();
}

module.exports = {
  clearProvisionedTenantDatabaseTargets,
  ensureTenantDatabaseTargetProvisioned,
  shouldAutoProvisionTenantDatabaseTarget,
};
