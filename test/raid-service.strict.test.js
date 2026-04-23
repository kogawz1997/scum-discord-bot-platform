const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/raidService.js');
const tenantScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

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
        platformRaidRequest: {
          async findMany() {
            return [];
          },
          async findUnique() {
            return null;
          },
        },
        platformRaidWindow: {
          async findMany() {
            return [];
          },
        },
        platformRaidSummary: {
          async findMany() {
            return [];
          },
        },
      };
    },
  };
}

function loadService(prismaMock) {
  clearModule(servicePath);
  clearModule(tenantScopePath);
  installMock(prismaPath, prismaMock);
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(tenantScopePath);
  clearModule(prismaPath);
});

test('raid service requires tenant scope in strict isolation mode', async () => {
  const service = loadService(createScopedPrisma(null));

  await assert.rejects(
    () => service.listRaidRequests({
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('raid service uses resolved default tenant scope in strict isolation mode', async () => {
  const service = loadService(createScopedPrisma('tenant-raid-default'));

  const snapshot = await service.listRaidActivitySnapshot({
    env: createStrictEnv(),
    serverId: 'server-1',
  });

  assert.deepEqual(snapshot, {
    requests: [],
    windows: [],
    summaries: [],
  });
});
