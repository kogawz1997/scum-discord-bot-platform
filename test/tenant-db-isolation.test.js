const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertTenantDbIsolationScope,
  buildTenantDbIsolationStatements,
  getTenantDbIsolationRuntime,
  installTenantDbIsolation,
  normalizeTenantDbIsolationMode,
  withTenantDbIsolation,
} = require('../src/utils/tenantDbIsolation');

test('tenant db isolation mode normalization maps aliases to supported modes', () => {
  assert.equal(normalizeTenantDbIsolationMode(''), 'application');
  assert.equal(normalizeTenantDbIsolationMode('app'), 'application');
  assert.equal(normalizeTenantDbIsolationMode('foundation'), 'postgres-rls-foundation');
  assert.equal(normalizeTenantDbIsolationMode('postgres-rls'), 'postgres-rls-foundation');
  assert.equal(normalizeTenantDbIsolationMode('strict'), 'postgres-rls-strict');
});

test('tenant db isolation runtime is active only for postgresql runtime', () => {
  const runtime = getTenantDbIsolationRuntime({
    DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_ISOLATION_MODE: 'postgres-rls-foundation',
  });

  assert.equal(runtime.supported, true);
  assert.equal(runtime.active, true);
  assert.equal(runtime.strict, false);
});

test('tenant db isolation statement bundle targets mixed-case prisma tables and raw tables', () => {
  const prismaTable = buildTenantDbIsolationStatements({
    tableName: 'PlatformSubscription',
    tenantColumn: 'tenantId',
  });
  assert.match(prismaTable.enableSql, /ALTER TABLE "PlatformSubscription" ENABLE ROW LEVEL SECURITY/i);
  assert.match(prismaTable.createSql, /current_setting\('app\.tenant_enforce'/i);
  assert.match(prismaTable.createSql, /"tenantId"/);

  const rawTable = buildTenantDbIsolationStatements({
    tableName: 'platform_tenant_configs',
    tenantColumn: 'tenant_id',
  });
  assert.match(rawTable.policyName, /^tenant_scope_platform_tenant_configs$/);
  assert.match(rawTable.createSql, /"platform_tenant_configs"/);
  assert.match(rawTable.createSql, /"tenant_id"/);
});

test('withTenantDbIsolation configures tenant session state in transaction when postgres foundation mode is active', async () => {
  const calls = [];
  const fakeTx = {
    $executeRaw: async (parts, value) => {
      calls.push({
        sql: Array.isArray(parts?.raw) ? parts.raw.join('?') : String(parts),
        value,
      });
      return 1;
    },
  };
  const fakeClient = {
    $transaction: async (work) => work(fakeTx),
  };

  const result = await withTenantDbIsolation(
    fakeClient,
    {
      tenantId: 'tenant-a',
      enforce: true,
      env: {
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-foundation',
      },
    },
    async (_db, context) => context,
  );

  assert.equal(result.applied, true);
  assert.equal(result.tenantId, 'tenant-a');
  assert.equal(result.enforce, true);
  assert.equal(calls.length, 3);
  assert.ok(calls.some((entry) => entry.sql.includes("set_config('app.tenant_id'")));
  assert.ok(calls.some((entry) => entry.sql.includes("set_config('app.tenant_enforce'")));
  assert.ok(calls.some((entry) => entry.sql.includes("set_config('app.tenant_bypass'")));
});

test('installTenantDbIsolation applies policies only after required tables are present', async () => {
  const executed = [];
  const fakeClient = {
    async $queryRawUnsafe(sql, value) {
      if (String(sql).includes('FROM pg_class')) {
        return [{ tableName: value }];
      }
      return [];
    },
    async $executeRawUnsafe(sql) {
      executed.push(String(sql).trim());
      return 1;
    },
  };

  const result = await installTenantDbIsolation(fakeClient, {
    env: {
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
      DATABASE_PROVIDER: 'postgresql',
      PRISMA_SCHEMA_PROVIDER: 'postgresql',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-foundation',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(Array.isArray(result.applied), true);
  assert.ok(result.applied.length > 0);
  assert.ok(executed.some((sql) => sql.includes('ENABLE ROW LEVEL SECURITY')));
  assert.ok(executed.some((sql) => sql.includes('CREATE POLICY')));
});

test('installTenantDbIsolation fails clearly when a required table is missing', async () => {
  const executed = [];
  const fakeClient = {
    async $queryRawUnsafe(sql, value) {
      if (String(value) === 'platform_tenant_configs') {
        return [];
      }
      return [{ tableName: value }];
    },
    async $executeRawUnsafe(sql) {
      executed.push(String(sql).trim());
      return 1;
    },
  };

  await assert.rejects(
    () => installTenantDbIsolation(fakeClient, {
      env: {
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-foundation',
      },
    }),
    (error) => {
      assert.equal(error.code, 'TENANT_DB_ISOLATION_TABLE_REQUIRED');
      assert.match(String(error.message || ''), /platform_tenant_configs/i);
      assert.ok(executed.length > 0);
      return true;
    },
  );
});

test('assertTenantDbIsolationScope requires tenantId in strict mode unless global access is explicit', () => {
  assert.throws(
    () =>
      assertTenantDbIsolationScope({
        tenantId: null,
        env: {
          DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
          DATABASE_PROVIDER: 'postgresql',
          PRISMA_SCHEMA_PROVIDER: 'postgresql',
          TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
        },
        operation: 'platform analytics overview',
      }),
    /requires tenantId/i,
  );

  const allowed = assertTenantDbIsolationScope({
    tenantId: null,
    allowGlobal: true,
    env: {
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
      DATABASE_PROVIDER: 'postgresql',
      PRISMA_SCHEMA_PROVIDER: 'postgresql',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    },
    operation: 'platform analytics overview',
  });
  assert.equal(allowed.allowGlobal, true);
  assert.equal(allowed.tenantId, null);
  assert.equal(allowed.runtime.strict, true);
});
