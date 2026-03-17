'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { ensurePlatformTenantConfigTable } = require('../src/services/platformTenantConfigService');
const { resolveTenantDatabaseTarget } = require('../src/utils/tenantDatabaseTopology');

const EXCLUDED_SHARED_TABLES = new Set([
  '_prisma_migrations',
  'PlatformTenant',
  'BotConfig',
  'AdminAuditPreset',
  'admin_web_users',
]);

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    tenantId: trimText(process.env.DISCORD_GUILD_ID, 120) || 'default',
    tenantSlug: 'genz',
    tenantName: 'GENZ',
    tenantType: 'direct',
    tenantLocale: 'th',
    sourceSchema: '',
    dryRun: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const current = trimText(argv[index], 240);
    if (!current) continue;
    if (current === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (current === '--json') {
      options.json = true;
      continue;
    }
    if (current.startsWith('--tenant=')) {
      options.tenantId = trimText(current.slice('--tenant='.length), 120) || options.tenantId;
      continue;
    }
    if (current === '--tenant' && argv[index + 1]) {
      options.tenantId = trimText(argv[index + 1], 120) || options.tenantId;
      index += 1;
      continue;
    }
    if (current.startsWith('--slug=')) {
      options.tenantSlug = trimText(current.slice('--slug='.length), 120) || options.tenantSlug;
      continue;
    }
    if (current === '--slug' && argv[index + 1]) {
      options.tenantSlug = trimText(argv[index + 1], 120) || options.tenantSlug;
      index += 1;
      continue;
    }
    if (current.startsWith('--name=')) {
      options.tenantName = trimText(current.slice('--name='.length), 180) || options.tenantName;
      continue;
    }
    if (current === '--name' && argv[index + 1]) {
      options.tenantName = trimText(argv[index + 1], 180) || options.tenantName;
      index += 1;
      continue;
    }
    if (current.startsWith('--type=')) {
      options.tenantType = trimText(current.slice('--type='.length), 80) || options.tenantType;
      continue;
    }
    if (current === '--type' && argv[index + 1]) {
      options.tenantType = trimText(argv[index + 1], 80) || options.tenantType;
      index += 1;
      continue;
    }
    if (current.startsWith('--locale=')) {
      options.tenantLocale = trimText(current.slice('--locale='.length), 20) || options.tenantLocale;
      continue;
    }
    if (current === '--locale' && argv[index + 1]) {
      options.tenantLocale = trimText(argv[index + 1], 20) || options.tenantLocale;
      index += 1;
      continue;
    }
    if (current.startsWith('--source-schema=')) {
      options.sourceSchema = trimText(current.slice('--source-schema='.length), 80);
      continue;
    }
    if (current === '--source-schema' && argv[index + 1]) {
      options.sourceSchema = trimText(argv[index + 1], 80);
      index += 1;
    }
  }
  return options;
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
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

function parseSourceSchema(databaseUrl = process.env.DATABASE_URL) {
  const raw = trimText(databaseUrl, 2000);
  if (!raw) return 'public';
  try {
    const parsed = new URL(raw);
    return trimText(parsed.searchParams.get('schema'), 120) || 'public';
  } catch {
    return 'public';
  }
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
    throw new Error(trimText(result.stderr || result.stdout || 'db push failed', 4000));
  }
  return {
    stdout: trimText(result.stdout, 4000) || null,
    stderr: trimText(result.stderr, 4000) || null,
  };
}

async function ensureTenantSchema(target) {
  if (!target.schemaName) {
    throw new Error('schema-per-tenant target is required');
  }
  const client = createPrismaClient(process.env.DATABASE_URL);
  try {
    await client.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(target.schemaName)};`,
    );
  } finally {
    await client.$disconnect().catch(() => {});
  }
  return runDbPush(target.datasourceUrl);
}

async function ensureTenantRegistryRow(client, options) {
  const now = new Date();
  await client.platformTenant.upsert({
    where: { id: options.tenantId },
    update: {
      slug: options.tenantSlug,
      name: options.tenantName,
      type: options.tenantType,
      status: 'active',
      locale: options.tenantLocale,
      metadataJson: JSON.stringify({
        source: 'shared-to-schema-cutover',
        guildId: trimText(process.env.DISCORD_GUILD_ID, 120) || null,
        adminOrigin: trimText(process.env.ADMIN_WEB_ALLOWED_ORIGINS, 240) || null,
        playerOrigin: trimText(process.env.WEB_PORTAL_BASE_URL, 240) || null,
      }),
      updatedAt: now,
    },
    create: {
      id: options.tenantId,
      slug: options.tenantSlug,
      name: options.tenantName,
      type: options.tenantType,
      status: 'active',
      locale: options.tenantLocale,
      metadataJson: JSON.stringify({
        source: 'shared-to-schema-cutover',
        guildId: trimText(process.env.DISCORD_GUILD_ID, 120) || null,
        adminOrigin: trimText(process.env.ADMIN_WEB_ALLOWED_ORIGINS, 240) || null,
        playerOrigin: trimText(process.env.WEB_PORTAL_BASE_URL, 240) || null,
      }),
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function listCommonTables(client, sourceSchema, targetSchema) {
  const rows = await client.$queryRawUnsafe(
    `
      SELECT src.table_name AS "tableName"
      FROM information_schema.tables src
      INNER JOIN information_schema.tables tgt
        ON tgt.table_name = src.table_name
       AND tgt.table_schema = $2
       AND tgt.table_type = 'BASE TABLE'
      WHERE src.table_schema = $1
        AND src.table_type = 'BASE TABLE'
      ORDER BY src.table_name ASC
    `,
    sourceSchema,
    targetSchema,
  );
  return (Array.isArray(rows) ? rows : [])
    .map((row) => trimText(row?.tableName, 160))
    .filter((tableName) => tableName && !EXCLUDED_SHARED_TABLES.has(tableName));
}

async function listTenantColumnTables(client, schemaName, tableNames) {
  if (!Array.isArray(tableNames) || tableNames.length === 0) return [];
  const rows = await client.$queryRawUnsafe(
    `
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = ANY($2::text[])
        AND column_name IN ('tenantId', 'tenant_id')
      ORDER BY table_name ASC, column_name ASC
    `,
    schemaName,
    tableNames,
  );
  return Array.isArray(rows) ? rows : [];
}

async function backfillSourceTenantColumns(client, schemaName, tableNames, tenantId) {
  const tenantColumnRows = await listTenantColumnTables(client, schemaName, tableNames);
  const updatedTables = [];
  for (const row of tenantColumnRows) {
    const tableName = trimText(row?.tableName, 160);
    const columnName = trimText(row?.columnName, 160);
    if (!tableName || !columnName) continue;
    await client.$executeRawUnsafe(
      `
        UPDATE ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
        SET ${quoteIdentifier(columnName)} = $1
        WHERE ${quoteIdentifier(columnName)} IS NULL
      `,
      tenantId,
    );
    updatedTables.push({ tableName, columnName });
  }
  return updatedTables;
}

async function listTableColumns(client, schemaName, tableName) {
  const rows = await client.$queryRawUnsafe(
    `
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position ASC
    `,
    schemaName,
    tableName,
  );
  return (Array.isArray(rows) ? rows : [])
    .map((row) => trimText(row?.columnName, 160))
    .filter(Boolean);
}

async function listForeignKeyEdges(client, schemaName, tableNames) {
  if (!Array.isArray(tableNames) || tableNames.length === 0) return [];
  const rows = await client.$queryRawUnsafe(
    `
      SELECT
        tc.table_name AS "childTable",
        ccu.table_name AS "parentTable"
      FROM information_schema.table_constraints tc
      INNER JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = $1
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ANY($2::text[])
        AND ccu.table_name = ANY($2::text[])
      ORDER BY tc.table_name ASC, ccu.table_name ASC
    `,
    schemaName,
    tableNames,
  );
  return Array.isArray(rows) ? rows : [];
}

function topoSortTables(tableNames, edges) {
  const childrenByParent = new Map();
  const indegree = new Map(tableNames.map((tableName) => [tableName, 0]));
  for (const edge of Array.isArray(edges) ? edges : []) {
    const parent = trimText(edge?.parentTable, 160);
    const child = trimText(edge?.childTable, 160);
    if (!parent || !child || parent === child) continue;
    if (!childrenByParent.has(parent)) {
      childrenByParent.set(parent, new Set());
    }
    if (!childrenByParent.get(parent).has(child)) {
      childrenByParent.get(parent).add(child);
      indegree.set(child, (indegree.get(child) || 0) + 1);
    }
  }
  const queue = tableNames
    .filter((tableName) => (indegree.get(tableName) || 0) === 0)
    .sort();
  const ordered = [];
  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);
    const children = Array.from(childrenByParent.get(current) || []).sort();
    for (const child of children) {
      const next = (indegree.get(child) || 0) - 1;
      indegree.set(child, next);
      if (next === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }
  if (ordered.length === tableNames.length) return ordered;
  const missing = tableNames.filter((tableName) => !ordered.includes(tableName)).sort();
  return [...ordered, ...missing];
}

async function clearTargetTables(client, schemaName, orderedTables) {
  for (const tableName of [...orderedTables].reverse()) {
    await client.$executeRawUnsafe(
      `DELETE FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)};`,
    );
  }
}

async function copyTable(client, options) {
  const columns = await listTableColumns(client, options.targetSchema, options.tableName);
  if (columns.length === 0) {
    return { copied: false, rowCount: 0 };
  }
  const insertColumns = columns.map((columnName) => quoteIdentifier(columnName)).join(', ');
  const selectColumns = columns.map((columnName) => {
    if (columnName === 'tenantId' || columnName === 'tenant_id') {
      return `COALESCE(src.${quoteIdentifier(columnName)}, $1)`;
    }
    return `src.${quoteIdentifier(columnName)}`;
  }).join(', ');
  const sql = `
    INSERT INTO ${quoteIdentifier(options.targetSchema)}.${quoteIdentifier(options.tableName)} (${insertColumns})
    SELECT ${selectColumns}
    FROM ${quoteIdentifier(options.sourceSchema)}.${quoteIdentifier(options.tableName)} src
  `;
  const usesTenantBackfill = columns.includes('tenantId') || columns.includes('tenant_id');
  if (usesTenantBackfill) {
    await client.$executeRawUnsafe(sql, options.tenantId);
  } else {
    await client.$executeRawUnsafe(sql);
  }
  const countRows = await client.$queryRawUnsafe(
    `
      SELECT COUNT(*)::int AS total
      FROM ${quoteIdentifier(options.targetSchema)}.${quoteIdentifier(options.tableName)}
    `,
  );
  return {
    copied: true,
    rowCount: Number(countRows?.[0]?.total || 0),
  };
}

async function resetOwnedSequences(client, schemaName, tableName) {
  const columns = await client.$queryRawUnsafe(
    `
      SELECT
        a.attname AS "columnName",
        pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) AS "sequenceName"
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      INNER JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = $1
        AND c.relname = $2
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum ASC
    `,
    schemaName,
    tableName,
  );
  for (const row of Array.isArray(columns) ? columns : []) {
    const columnName = trimText(row?.columnName, 160);
    const sequenceName = trimText(row?.sequenceName, 500);
    if (!columnName || !sequenceName) continue;
    const maxRows = await client.$queryRawUnsafe(
      `
        SELECT MAX(${quoteIdentifier(columnName)})::bigint AS max_id
        FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
      `,
    );
    const maxId = maxRows?.[0]?.max_id == null ? null : Number(maxRows[0].max_id);
    if (maxId == null) {
      await client.$executeRawUnsafe('SELECT setval($1, 1, false)', sequenceName);
    } else {
      await client.$executeRawUnsafe('SELECT setval($1, $2, true)', sequenceName, maxId);
    }
  }
}

async function buildCopyPlan(client, sourceSchema, targetSchema, tenantId) {
  const commonTables = await listCommonTables(client, sourceSchema, targetSchema);
  const edges = await listForeignKeyEdges(client, targetSchema, commonTables);
  const orderedTables = topoSortTables(commonTables, edges);
  const sourceCounts = {};
  for (const tableName of orderedTables) {
    const rows = await client.$queryRawUnsafe(
      `
        SELECT COUNT(*)::int AS total
        FROM ${quoteIdentifier(sourceSchema)}.${quoteIdentifier(tableName)}
      `,
    );
    sourceCounts[tableName] = Number(rows?.[0]?.total || 0);
  }
  return {
    tenantId,
    sourceSchema,
    targetSchema,
    orderedTables,
    sourceCounts,
  };
}

async function executeCopy(client, plan) {
  await backfillSourceTenantColumns(
    client,
    plan.sourceSchema,
    plan.orderedTables,
    plan.tenantId,
  );
  await clearTargetTables(client, plan.targetSchema, plan.orderedTables);
  const copiedTables = [];
  for (const tableName of plan.orderedTables) {
    const copied = await copyTable(client, {
      sourceSchema: plan.sourceSchema,
      targetSchema: plan.targetSchema,
      tableName,
      tenantId: plan.tenantId,
    });
    await resetOwnedSequences(client, plan.targetSchema, tableName);
    copiedTables.push({
      tableName,
      sourceRows: plan.sourceCounts[tableName] || 0,
      targetRows: copied.rowCount,
    });
  }
  return copiedTables;
}

function printResult(result, asJson = false) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.ok) {
    console.error(`[tenant-schema-cutover] failed: ${result.error || 'unknown error'}`);
    return;
  }
  console.log(`[tenant-schema-cutover] tenant=${result.tenantId} schema=${result.targetSchema} dryRun=${result.dryRun}`);
  console.log(`[tenant-schema-cutover] source=${result.sourceSchema} tables=${result.tableCount}`);
}

async function main() {
  const options = parseArgs();
  const target = resolveTenantDatabaseTarget({
    tenantId: options.tenantId,
    env: process.env,
    mode: 'schema-per-tenant',
  });
  if (!target.supported) {
    throw new Error('DATABASE_URL must target PostgreSQL for schema-per-tenant cutover');
  }
  if (!target.schemaName) {
    throw new Error('Failed to resolve tenant schema target');
  }

  const sourceSchema = options.sourceSchema || parseSourceSchema(process.env.DATABASE_URL);
  const sharedClient = createPrismaClient(process.env.DATABASE_URL);
  try {
    if (!options.dryRun) {
      await ensureTenantRegistryRow(sharedClient, options);
      await ensureTenantSchema(target);
      const scopedClient = createPrismaClient(target.datasourceUrl);
      try {
        await ensurePlatformTenantConfigTable(scopedClient);
      } finally {
        await scopedClient.$disconnect().catch(() => {});
      }
    }

    const plan = await buildCopyPlan(
      sharedClient,
      sourceSchema,
      target.schemaName,
      options.tenantId,
    );

    let copiedTables = [];
    if (!options.dryRun) {
      copiedTables = await executeCopy(sharedClient, plan);
    }

    const result = {
      ok: true,
      dryRun: options.dryRun,
      tenantId: options.tenantId,
      tenantSlug: options.tenantSlug,
      tenantName: options.tenantName,
      sourceSchema,
      targetSchema: target.schemaName,
      targetDatasourceUrl: target.datasourceUrl,
      tableCount: plan.orderedTables.length,
      orderedTables: plan.orderedTables,
      sourceCounts: plan.sourceCounts,
      copiedTables,
    };
    printResult(result, options.json);
  } finally {
    await sharedClient.$disconnect().catch(() => {});
  }
}

main()
  .catch((error) => {
    printResult({
      ok: false,
      error: trimText(error?.message || error, 4000),
    }, process.argv.includes('--json'));
    process.exitCode = 1;
  });
