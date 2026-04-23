const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/coinService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
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

function loadService(mocks) {
  clearModule(servicePath);
  installMock(memoryStorePath, mocks.memoryStore);
  installMock(prismaPath, mocks.prisma);
  return require(servicePath);
}

function createStrictEnv() {
  return {
    DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(memoryStorePath);
  clearModule(prismaPath);
});

test('coin service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    memoryStore: {
      async addCoins() {
        throw new Error('should-not-credit-without-tenant');
      },
      async removeCoins() {
        return 0;
      },
      async setCoins() {
        return 0;
      },
      async getWallet() {
        return { balance: 0 };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.creditCoins({
      userId: 'user-1',
      amount: 50,
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('coin service uses resolved default tenant scope in strict isolation mode', async () => {
  let receivedScope = null;
  const service = loadService({
    memoryStore: {
      async addCoins(userId, amount, options) {
        receivedScope = options;
        return amount;
      },
      async removeCoins() {
        return 0;
      },
      async setCoins() {
        return 0;
      },
      async getWallet() {
        return { balance: 100 };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-coin-default';
      },
    },
  });

  const result = await service.creditCoins({
    userId: 'user-1',
    amount: 50,
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(receivedScope.tenantId, 'tenant-coin-default');
  assert.equal(receivedScope.defaultTenantId, 'tenant-coin-default');
});
