const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/moderationService.js');
const storePath = path.resolve(__dirname, '../src/store/moderationStore.js');
const tenantStoreScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
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
        punishment: {
          async findMany() {
            return [];
          },
          async create() {
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
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
  clearModule(tenantStoreScopePath);
  clearModule(prismaPath);
});

test('moderation service requires tenant scope in strict isolation mode', () => {
  const service = loadService(createScopedPrisma(null));

  assert.throws(
    () => service.createPunishmentEntry({
      userId: 'player-1',
      type: 'ban',
      reason: 'abuse',
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('moderation service uses resolved default tenant scope in strict isolation mode', () => {
  const service = loadService(createScopedPrisma('tenant-moderation-default'));

  const result = service.createPunishmentEntry({
    userId: 'player-1',
    type: 'ban',
    reason: 'abuse',
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.entry.type, 'ban');
});
