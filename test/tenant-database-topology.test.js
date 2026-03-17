const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantDatabaseAdminUrl,
  buildTenantDatabaseName,
  buildTenantSchemaName,
  getTenantDatabaseTopologyMode,
  normalizeTenantDatabaseTopologyMode,
  resolveTenantDatabaseTarget,
} = require('../src/utils/tenantDatabaseTopology');

test('tenant database topology mode normalization maps aliases to supported modes', () => {
  assert.equal(normalizeTenantDatabaseTopologyMode(''), 'shared');
  assert.equal(normalizeTenantDatabaseTopologyMode('shared-db'), 'shared');
  assert.equal(normalizeTenantDatabaseTopologyMode('schema'), 'schema-per-tenant');
  assert.equal(normalizeTenantDatabaseTopologyMode('database'), 'database-per-tenant');
});

test('tenant database topology mode reads from env', () => {
  assert.equal(getTenantDatabaseTopologyMode({ TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant' }), 'schema-per-tenant');
  assert.equal(getTenantDatabaseTopologyMode({ TENANT_DB_TOPOLOGY_MODE: 'database-per-tenant' }), 'database-per-tenant');
});

test('tenant database topology builds schema and database names from tenant ids', () => {
  assert.equal(buildTenantSchemaName('tenant-a', {}), 'tenant_tenant_a');
  assert.equal(buildTenantDatabaseName('tenant-a', {}), 'tenant_tenant_a');
  assert.equal(
    buildTenantSchemaName('Tenant A', { TENANT_DB_SCHEMA_PREFIX: 'scum_' }),
    'scum_tenant_a',
  );
  assert.equal(
    buildTenantDatabaseName('Tenant A', { TENANT_DB_DATABASE_PREFIX: 'scum_' }),
    'scum_tenant_a',
  );
});

test('tenant database topology resolves schema-per-tenant datasource urls', () => {
  const target = resolveTenantDatabaseTarget({
    tenantId: 'tenant-a',
    mode: 'schema-per-tenant',
    env: {
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:55432/app?schema=public',
      DATABASE_PROVIDER: 'postgresql',
      PRISMA_SCHEMA_PROVIDER: 'postgresql',
      TENANT_DB_SCHEMA_PREFIX: 'scum_',
    },
  });

  assert.equal(target.supported, true);
  assert.equal(target.mode, 'schema-per-tenant');
  assert.equal(target.schemaName, 'scum_tenant_a');
  assert.match(String(target.datasourceUrl || ''), /schema=scum_tenant_a/);
});

test('tenant database topology resolves database-per-tenant datasource urls and admin urls', () => {
  const target = resolveTenantDatabaseTarget({
    tenantId: 'tenant-a',
    mode: 'database-per-tenant',
    env: {
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:55432/app?schema=public',
      DATABASE_PROVIDER: 'postgresql',
      PRISMA_SCHEMA_PROVIDER: 'postgresql',
      TENANT_DB_DATABASE_PREFIX: 'scum_',
      TENANT_DB_ADMIN_DATABASE: 'postgres',
    },
  });

  assert.equal(target.supported, true);
  assert.equal(target.mode, 'database-per-tenant');
  assert.equal(target.databaseName, 'scum_tenant_a');
  assert.match(String(target.datasourceUrl || ''), /\/scum_tenant_a$/);
  assert.equal(
    buildTenantDatabaseAdminUrl('postgresql://user:pass@127.0.0.1:55432/app?schema=public'),
    'postgresql://user:pass@127.0.0.1:55432/postgres',
  );
});
