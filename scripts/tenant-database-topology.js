'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const {
  buildTenantDatabaseAdminUrl,
  getTenantDatabaseTopologyMode,
  resolveTenantDatabaseTarget,
} = require('../src/utils/tenantDatabaseTopology');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function parseArgs(argv) {
  const result = {
    action: 'preview',
    tenantId: '',
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim();
    if (!current) continue;
    if (current === '--json') {
      result.json = true;
      continue;
    }
    if (current.startsWith('--action=')) {
      result.action = trimText(current.slice('--action='.length), 80) || result.action;
      continue;
    }
    if (current === '--action' && argv[index + 1]) {
      result.action = trimText(argv[index + 1], 80) || result.action;
      index += 1;
      continue;
    }
    if (current.startsWith('--tenant=')) {
      result.tenantId = trimText(current.slice('--tenant='.length), 120);
      continue;
    }
    if ((current === '--tenant' || current === '--tenant-id') && argv[index + 1]) {
      result.tenantId = trimText(argv[index + 1], 120);
      index += 1;
    }
  }
  return result;
}

function logResult(payload, asJson) {
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (payload.ok) {
    console.log(`[tenant-db-topology] action=${payload.action} mode=${payload.mode} tenant=${payload.tenantId || '-'} target=${payload.target?.datasourceUrl || '-'}`);
    return;
  }
  console.error(`[tenant-db-topology] action=${payload.action} failed: ${payload.error || 'unknown error'}`);
}

function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function runDbPush(databaseUrl) {
  const scriptPath = path.resolve(__dirname, 'prisma-with-provider.js');
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--provider', 'postgresql', 'db', 'push', '--skip-generate'],
    {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
    },
  );
  if (result.status !== 0) {
    throw new Error(trimText(result.stderr || result.stdout || 'db push failed', 2000));
  }
  return {
    stdout: trimText(result.stdout, 4000) || null,
    stderr: trimText(result.stderr, 4000) || null,
  };
}

async function provisionTenantSchema(target) {
  if (!target.schemaName) {
    throw new Error('schema-per-tenant target is required');
  }
  const client = createPrismaClient(process.env.DATABASE_URL);
  try {
    await client.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(target.schemaName)};`);
  } finally {
    await client.$disconnect().catch(() => {});
  }
  const pushed = runDbPush(target.datasourceUrl);
  return {
    createdSchema: target.schemaName,
    datasourceUrl: target.datasourceUrl,
    dbPush: pushed,
  };
}

async function provisionTenantDatabase(target) {
  if (!target.databaseName) {
    throw new Error('database-per-tenant target is required');
  }
  const adminUrl = buildTenantDatabaseAdminUrl(process.env.DATABASE_URL);
  const client = createPrismaClient(adminUrl);
  try {
    const rows = await client.$queryRaw`
      SELECT datname
      FROM pg_database
      WHERE datname = ${target.databaseName}
    `;
    if (!Array.isArray(rows) || rows.length === 0) {
      await client.$executeRawUnsafe(`CREATE DATABASE ${quoteIdentifier(target.databaseName)};`);
    }
  } finally {
    await client.$disconnect().catch(() => {});
  }
  const pushed = runDbPush(target.datasourceUrl);
  return {
    createdDatabase: target.databaseName,
    datasourceUrl: target.datasourceUrl,
    dbPush: pushed,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = resolveTenantDatabaseTarget({
    tenantId: args.tenantId,
    env: process.env,
  });
  const mode = getTenantDatabaseTopologyMode(process.env);
  if (!target.supported) {
    logResult({
      ok: false,
      action: args.action,
      mode,
      tenantId: args.tenantId || null,
      error: 'DATABASE_URL is not PostgreSQL; tenant DB topology actions require PostgreSQL',
    }, args.json);
    process.exitCode = 1;
    return;
  }

  try {
    let data = null;
    if (args.action === 'preview') {
      data = { target };
    } else if (args.action === 'provision-schema') {
      if (mode !== 'schema-per-tenant') {
        throw new Error(`TENANT_DB_TOPOLOGY_MODE=${mode} does not support provision-schema`);
      }
      if (!args.tenantId) {
        throw new Error('--tenant is required for provision-schema');
      }
      data = await provisionTenantSchema(target);
    } else if (args.action === 'provision-database') {
      if (mode !== 'database-per-tenant') {
        throw new Error(`TENANT_DB_TOPOLOGY_MODE=${mode} does not support provision-database`);
      }
      if (!args.tenantId) {
        throw new Error('--tenant is required for provision-database');
      }
      data = await provisionTenantDatabase(target);
    } else {
      throw new Error(`Unsupported action: ${args.action}`);
    }

    logResult({
      ok: true,
      action: args.action,
      mode,
      tenantId: args.tenantId || null,
      target,
      data,
    }, args.json);
  } catch (error) {
    logResult({
      ok: false,
      action: args.action,
      mode,
      tenantId: args.tenantId || null,
      target,
      error: trimText(error?.message || error, 2000),
    }, args.json);
    process.exitCode = 1;
  }
}

void main();
