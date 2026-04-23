const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/vipService.js');
const storePath = path.resolve(__dirname, '../src/store/vipStore.js');
const tenantStoreScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function createStrictEnv() {
  return {
    DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
  };
}

function createScopedPrisma(tenantId) {
  return {
    prisma: {},
    resolveDefaultTenantId() {
      return tenantId;
    },
    resolveTenantScopedDatasourceUrl() {
      return tenantId;
    },
    getTenantScopedPrismaClient() {
      return {
        vipMembership: {
          async findMany() {
            return [];
          },
          async upsert() {
            return null;
          },
          async deleteMany() {
            return { count: 0 };
          },
        },
      };
    },
  };
}

function loadService(prismaMock) {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(tenantStoreScopePath);
  installMock(prismaPath, prismaMock);
  installMock(coinServicePath, {
    async debitCoins() {
      return { ok: true, balance: 100 };
    },
    async creditCoins() {
      return { ok: true, balance: 100 };
    },
  });
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(tenantStoreScopePath);
  clearModule(prismaPath);
  clearModule(coinServicePath);
});

test('vip service requires tenant scope in strict isolation mode', () => {
  const service = loadService(createScopedPrisma(null));

  assert.throws(
    () => service.listMemberships({
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('vip service uses resolved default tenant scope in strict isolation mode', () => {
  const service = loadService(createScopedPrisma('tenant-vip-default'));

  const memberships = service.listMemberships({
    env: createStrictEnv(),
  });

  assert.deepEqual(memberships, []);
});
