const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertTenantDbIsolationScope,
  buildTenantDbIsolationStatements,
  getTenantDbIsolationRuntime,
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
