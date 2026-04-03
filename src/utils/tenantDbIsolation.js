'use strict';

const { resolveDatabaseRuntime } = require('./dbEngine');

const TENANT_DB_ISOLATION_TABLES = Object.freeze([
  Object.freeze({ tableName: 'PlatformTenant', tenantColumn: 'id' }),
  Object.freeze({ tableName: 'PlatformSubscription', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'PlatformLicense', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'PlatformApiKey', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'PlatformWebhookEndpoint', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'PlatformAgentRuntime', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'PlatformMarketplaceOffer', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'Purchase', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'DeliveryAudit', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'DeliveryQueueJob', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'DeliveryDeadLetter', tenantColumn: 'tenantId' }),
  Object.freeze({ tableName: 'platform_tenant_configs', tenantColumn: 'tenant_id' }),
]);

function trimText(value) {
  return String(value || '').trim();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function normalizeTenantDbIsolationMode(value, fallback = 'application') {
  const text = trimText(value).toLowerCase();
  if (!text) return fallback;
  if (['app', 'application', 'application-only'].includes(text)) return 'application';
  if (['postgres-rls', 'postgres-rls-foundation', 'foundation', 'rls-foundation'].includes(text)) {
    return 'postgres-rls-foundation';
  }
  if (['postgres-rls-strict', 'strict', 'rls-strict'].includes(text)) {
    return 'postgres-rls-strict';
  }
  return fallback;
}

function getTenantDbIsolationMode(env = process.env) {
  return normalizeTenantDbIsolationMode(env.TENANT_DB_ISOLATION_MODE, 'application');
}

function getTenantDbIsolationRuntime(env = process.env) {
  const database = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const mode = getTenantDbIsolationMode(env);
  const supported = database.engine === 'postgresql';
  return Object.freeze({
    mode,
    database,
    supported,
    active: supported && mode !== 'application',
    strict: supported && mode === 'postgres-rls-strict',
  });
}

function assertTenantDbIsolationScope(options = {}) {
  const runtime = getTenantDbIsolationRuntime(options.env || process.env);
  const tenantId = trimText(options.tenantId, 120) || null;
  const allowGlobal = options.allowGlobal === true;
  if (runtime.strict && !tenantId && !allowGlobal) {
    const operation = trimText(options.operation, 160) || 'tenant-scoped operation';
    const error = new Error(`${operation} requires tenantId when TENANT_DB_ISOLATION_MODE=${runtime.mode}`);
    error.code = 'TENANT_DB_SCOPE_REQUIRED';
    error.statusCode = 400;
    error.tenantDbIsolation = {
      mode: runtime.mode,
      strict: runtime.strict,
      tenantId,
      allowGlobal,
      operation,
    };
    throw error;
  }
  return Object.freeze({
    runtime,
    tenantId,
    allowGlobal,
  });
}

function quotePgIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function buildTenantDbPolicyName(tableName) {
  return `tenant_scope_${String(tableName || '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()}`;
}

function buildTenantDbPolicyExpression(columnName) {
  const tenantColumn = quotePgIdentifier(columnName);
  return [
    `COALESCE(NULLIF(current_setting('app.tenant_enforce', true), ''), 'off') <> 'on'`,
    `current_setting('app.tenant_bypass', true) = 'on'`,
    `NULLIF(current_setting('app.tenant_id', true), '') = ${tenantColumn}`,
  ].join(' OR ');
}

function buildTenantDbIsolationStatements(table) {
  const tableName = trimText(table?.tableName, 160);
  const tenantColumn = trimText(table?.tenantColumn, 160);
  if (!tableName || !tenantColumn) {
    throw new Error('tenant isolation table metadata is incomplete');
  }
  const policyName = buildTenantDbPolicyName(tableName);
  const tableIdentifier = quotePgIdentifier(tableName);
  const policyIdentifier = quotePgIdentifier(policyName);
  const expression = buildTenantDbPolicyExpression(tenantColumn);
  return Object.freeze({
    tableName,
    tenantColumn,
    policyName,
    enableSql: `ALTER TABLE ${tableIdentifier} ENABLE ROW LEVEL SECURITY;`,
    forceSql: `ALTER TABLE ${tableIdentifier} FORCE ROW LEVEL SECURITY;`,
    dropSql: `DROP POLICY IF EXISTS ${policyIdentifier} ON ${tableIdentifier};`,
    createSql: `CREATE POLICY ${policyIdentifier} ON ${tableIdentifier} USING (${expression}) WITH CHECK (${expression});`,
    disableSql: `ALTER TABLE ${tableIdentifier} NO FORCE ROW LEVEL SECURITY; ALTER TABLE ${tableIdentifier} DISABLE ROW LEVEL SECURITY;`,
  });
}

function listTenantDbIsolationTables() {
  return TENANT_DB_ISOLATION_TABLES.map((table) => Object.freeze({ ...table }));
}

async function ensureTenantDbIsolationTable(client, table) {
  const tableName = trimText(table?.tableName, 160);
  if (!tableName) {
    throw new Error('tenant isolation table metadata is incomplete');
  }
  const rows = await client.$queryRawUnsafe(
    `
    SELECT c.relname AS "tableName"
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = $1
    LIMIT 1
    `,
    tableName,
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (row?.tableName) {
    return;
  }
  const error = new Error(
    `Tenant DB isolation cannot be installed because required table "${tableName}" is missing. Run the schema migrations first.`,
  );
  error.code = 'TENANT_DB_ISOLATION_TABLE_REQUIRED';
  error.statusCode = 500;
  error.tenantDbIsolation = {
    tableName,
  };
  throw error;
}

async function configureTenantDbIsolationSession(client, options = {}) {
  const env = options.env || process.env;
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId = trimText(options.tenantId, 120);
  const bypass = options.bypass === true;
  const enforce = options.enforce === true;
  if (!runtime.active) {
    return {
      applied: false,
      tenantId,
      bypass,
      enforce,
      mode: runtime.mode,
      reason: runtime.supported ? 'mode-disabled' : 'database-not-postgresql',
    };
  }
  await client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  await client.$executeRaw`SELECT set_config('app.tenant_bypass', ${bypass ? 'on' : 'off'}, true)`;
  await client.$executeRaw`SELECT set_config('app.tenant_enforce', ${enforce ? 'on' : 'off'}, true)`;
  return {
    applied: true,
    tenantId,
    bypass,
    enforce,
    mode: runtime.mode,
    strict: runtime.strict,
  };
}

async function withTenantDbIsolation(client, options = {}, work) {
  if (typeof work !== 'function') {
    throw new TypeError('withTenantDbIsolation requires a callback');
  }
  const env = options.env || process.env;
  const runtime = getTenantDbIsolationRuntime(env);
  if (!runtime.active) {
    return work(client, {
      applied: false,
      tenantId: trimText(options.tenantId, 120),
      bypass: options.bypass === true,
      enforce: options.enforce === true,
      mode: runtime.mode,
      reason: runtime.supported ? 'mode-disabled' : 'database-not-postgresql',
    });
  }
  const transactionMaxWaitMs = parsePositiveInt(
    options.transactionMaxWaitMs ?? env.TENANT_DB_ISOLATION_MAX_WAIT_MS,
    10_000,
  );
  const transactionTimeoutMs = parsePositiveInt(
    options.transactionTimeoutMs ?? env.TENANT_DB_ISOLATION_TIMEOUT_MS,
    15_000,
  );
  return client.$transaction(async (tx) => {
    const context = await configureTenantDbIsolationSession(tx, options);
    return work(tx, context);
  }, {
    maxWait: transactionMaxWaitMs,
    timeout: transactionTimeoutMs,
  });
}

async function installTenantDbIsolation(client, options = {}) {
  const env = options.env || process.env;
  const runtime = getTenantDbIsolationRuntime(env);
  if (!runtime.supported) {
    return {
      ok: false,
      reason: 'database-not-postgresql',
      mode: runtime.mode,
      applied: [],
    };
  }
  const applied = [];
  for (const table of listTenantDbIsolationTables()) {
    const statements = buildTenantDbIsolationStatements(table);
    await ensureTenantDbIsolationTable(client, table);
    await client.$executeRawUnsafe(statements.enableSql);
    await client.$executeRawUnsafe(statements.forceSql);
    await client.$executeRawUnsafe(statements.dropSql);
    await client.$executeRawUnsafe(statements.createSql);
    applied.push({
      tableName: statements.tableName,
      policyName: statements.policyName,
      tenantColumn: statements.tenantColumn,
    });
  }
  return {
    ok: true,
    mode: runtime.mode,
    strict: runtime.strict,
    applied,
  };
}

async function disableTenantDbIsolation(client, options = {}) {
  const env = options.env || process.env;
  const runtime = getTenantDbIsolationRuntime(env);
  if (!runtime.supported) {
    return {
      ok: false,
      reason: 'database-not-postgresql',
      mode: runtime.mode,
      removed: [],
    };
  }
  const removed = [];
  for (const table of listTenantDbIsolationTables()) {
    const statements = buildTenantDbIsolationStatements(table);
    await client.$executeRawUnsafe(statements.dropSql);
    await client.$executeRawUnsafe(statements.disableSql);
    removed.push({
      tableName: statements.tableName,
      policyName: statements.policyName,
    });
  }
  return {
    ok: true,
    mode: runtime.mode,
    removed,
  };
}

async function getTenantDbIsolationStatus(client, options = {}) {
  const env = options.env || process.env;
  const runtime = getTenantDbIsolationRuntime(env);
  if (!runtime.supported) {
    return {
      ok: true,
      mode: runtime.mode,
      supported: false,
      active: false,
      tables: listTenantDbIsolationTables().map((table) => ({
        tableName: table.tableName,
        tenantColumn: table.tenantColumn,
        policyName: buildTenantDbPolicyName(table.tableName),
        present: false,
        rlsEnabled: false,
        rlsForced: false,
      })),
    };
  }

  const rows = [];
  for (const table of listTenantDbIsolationTables()) {
    const policyName = buildTenantDbPolicyName(table.tableName);
    const result = await client.$queryRawUnsafe(
      `
      SELECT
        c.relname AS "tableName",
        c.relrowsecurity AS "rlsEnabled",
        c.relforcerowsecurity AS "rlsForced",
        EXISTS (
          SELECT 1
          FROM pg_policies p
          WHERE p.schemaname = current_schema()
            AND p.tablename = c.relname
            AND p.policyname = $1
        ) AS "present"
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema()
        AND c.relname = $2
      LIMIT 1
      `,
      policyName,
      table.tableName,
    );
    const row = Array.isArray(result) && result.length > 0 ? result[0] : null;
    rows.push({
      tableName: table.tableName,
      tenantColumn: table.tenantColumn,
      policyName,
      present: Boolean(row?.present),
      rlsEnabled: Boolean(row?.rlsEnabled),
      rlsForced: Boolean(row?.rlsForced),
    });
  }

  return {
    ok: true,
    mode: runtime.mode,
    supported: true,
    active: runtime.active,
    strict: runtime.strict,
    tables: rows,
  };
}

module.exports = {
  buildTenantDbIsolationStatements,
  buildTenantDbPolicyExpression,
  buildTenantDbPolicyName,
  configureTenantDbIsolationSession,
  disableTenantDbIsolation,
  getTenantDbIsolationMode,
  getTenantDbIsolationRuntime,
  getTenantDbIsolationStatus,
  installTenantDbIsolation,
  listTenantDbIsolationTables,
  normalizeTenantDbIsolationMode,
  assertTenantDbIsolationScope,
  withTenantDbIsolation,
};
