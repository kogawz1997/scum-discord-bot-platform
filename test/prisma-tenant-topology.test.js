const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/prisma');

function loadPrismaModule() {
  delete require.cache[prismaPath];
  return require(prismaPath);
}

test.afterEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_PROVIDER;
  delete process.env.PRISMA_SCHEMA_PROVIDER;
  delete process.env.PRISMA_TEST_DATABASE_URL;
  delete process.env.PRISMA_TEST_DATABASE_PROVIDER;
  delete process.env.TENANT_DB_TOPOLOGY_MODE;
  delete process.env.TENANT_DB_SCHEMA_PREFIX;
  delete process.env.TENANT_DB_DATABASE_PREFIX;
  delete require.cache[prismaPath];
});

test('resolveTenantScopedDatasourceUrl keeps shared topology on the base datasource', () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:55432/scum_th_platform?schema=public';
  process.env.PRISMA_TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.PRISMA_TEST_DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  process.env.TENANT_DB_TOPOLOGY_MODE = 'shared';

  const { resolveTenantScopedDatasourceUrl } = loadPrismaModule();
  const resolved = resolveTenantScopedDatasourceUrl('tenant-alpha');

  assert.match(resolved, /scum_th_platform/i);
  assert.match(resolved, /schema=public/i);
});

test('resolveTenantScopedDatasourceUrl rewrites schema for schema-per-tenant topology', () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:55432/scum_th_platform?schema=public';
  process.env.PRISMA_TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.PRISMA_TEST_DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  process.env.TENANT_DB_SCHEMA_PREFIX = 'tenant_';

  const { resolveTenantScopedDatasourceUrl } = loadPrismaModule();
  const resolved = resolveTenantScopedDatasourceUrl('Tenant Alpha');

  assert.match(resolved, /scum_th_platform/i);
  assert.match(resolved, /schema=tenant_tenant_alpha/i);
});

test('resolveTenantScopedDatasourceUrl rewrites database for database-per-tenant topology', () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:55432/scum_th_platform?schema=public';
  process.env.PRISMA_TEST_DATABASE_URL = process.env.DATABASE_URL;
  process.env.PRISMA_TEST_DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  process.env.TENANT_DB_TOPOLOGY_MODE = 'database-per-tenant';
  process.env.TENANT_DB_DATABASE_PREFIX = 'tenantdb_';

  const { resolveTenantScopedDatasourceUrl } = loadPrismaModule();
  const resolved = resolveTenantScopedDatasourceUrl('Tenant Alpha');

  assert.match(resolved, /tenantdb_tenant_alpha/i);
  assert.doesNotMatch(resolved, /schema=public/i);
});
