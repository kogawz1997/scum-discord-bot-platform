const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

function installMock(modulePathToMock, exportsValue) {
  delete require.cache[modulePathToMock];
  require.cache[modulePathToMock] = {
    id: modulePathToMock,
    filename: modulePathToMock,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePathToClear) {
  delete require.cache[modulePathToClear];
}

function loadScopeModule(prismaMock) {
  clearModule(modulePath);
  installMock(prismaPath, prismaMock);
  return require(modulePath);
}

function createStrictEnv(extra = {}) {
  return {
    DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    ...extra,
  };
}

test.afterEach(() => {
  clearModule(modulePath);
  clearModule(prismaPath);
});

test('tenant store scope ignores env default tenant outside strict mode', () => {
  const defaultDb = { name: 'default-db' };
  const scopedDb = { name: 'scoped-db' };
  const scopeModule = loadScopeModule({
    prisma: defaultDb,
    getTenantScopedPrismaClient() {
      return scopedDb;
    },
    resolveDefaultTenantId() {
      return 'tenant-env-default';
    },
    resolveTenantScopedDatasourceUrl() {
      return 'tenant-env-default';
    },
  });

  const result = scopeModule.resolveTenantStoreScope({
    env: {
      DATABASE_URL: 'file:test.db',
      DATABASE_PROVIDER: 'sqlite',
      PRISMA_SCHEMA_PROVIDER: 'sqlite',
      PLATFORM_DEFAULT_TENANT_ID: 'tenant-env-default',
    },
  });

  assert.equal(result.tenantId, null);
  assert.equal(result.db, defaultDb);
  assert.equal(result.datasourceKey, '__default__');
});

test('tenant store scope requires tenant in strict mode when none is available', () => {
  const scopeModule = loadScopeModule({
    prisma: {},
    getTenantScopedPrismaClient() {
      return {};
    },
    resolveDefaultTenantId() {
      return null;
    },
    resolveTenantScopedDatasourceUrl() {
      return null;
    },
  });

  assert.throws(
    () => scopeModule.resolveTenantStoreScope({
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('tenant store scope uses env default tenant in strict mode', () => {
  const scopedDb = { name: 'scoped-db' };
  const scopeModule = loadScopeModule({
    prisma: {},
    getTenantScopedPrismaClient() {
      return scopedDb;
    },
    resolveDefaultTenantId() {
      return 'tenant-strict-default';
    },
    resolveTenantScopedDatasourceUrl() {
      return 'tenant-strict-default';
    },
  });

  const result = scopeModule.resolveTenantStoreScope({
    env: createStrictEnv(),
  });

  assert.equal(result.tenantId, 'tenant-strict-default');
  assert.equal(result.db, scopedDb);
  assert.equal(result.datasourceKey, 'tenant-strict-default');
});
