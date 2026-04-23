const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/wheelService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const linkStorePath = path.resolve(__dirname, '../src/store/linkStore.js');
const wheelStorePath = path.resolve(__dirname, '../src/store/luckyWheelStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
const shopServicePath = path.resolve(__dirname, '../src/services/shopService.js');
const itemIconServicePath = path.resolve(__dirname, '../src/services/itemIconService.js');
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
  installMock(linkStorePath, mocks.linkStore);
  installMock(wheelStorePath, mocks.wheelStore);
  installMock(coinServicePath, mocks.coinService);
  installMock(shopServicePath, mocks.shopService);
  installMock(itemIconServicePath, mocks.itemIconService);
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
  clearModule(linkStorePath);
  clearModule(wheelStorePath);
  clearModule(coinServicePath);
  clearModule(shopServicePath);
  clearModule(itemIconServicePath);
  clearModule(prismaPath);
});

function createBaseMocks() {
  return {
    memoryStore: {
      async getWallet() {
        return { balance: 0 };
      },
    },
    linkStore: {
      getLinkByUserId() {
        return { steamId: '76561199012345678' };
      },
    },
    wheelStore: {
      async recordWheelSpin() {
        return { ok: true };
      },
      async rollbackWheelSpin() {
        return true;
      },
    },
    coinService: {
      async creditCoins() {
        return { ok: true, balance: 100 };
      },
    },
    shopService: {
      async createQueuedPurchase() {
        return {
          purchase: { code: 'P-1' },
          delivery: { queued: true, reason: 'queued' },
        };
      },
    },
    itemIconService: {
      resolveItemIconUrl() {
        return null;
      },
    },
  };
}

test('wheel service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.awardWheelRewardForUser({
      userId: 'user-1',
      reward: { id: 'coins', label: 'Coins', type: 'coins', amount: 10 },
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('wheel service uses resolved default tenant scope in strict isolation mode', async () => {
  let getWalletScope = null;
  const service = loadService({
    ...createBaseMocks(),
    memoryStore: {
      async getWallet(userId, options) {
        getWalletScope = options;
        return { balance: 0 };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-wheel-default';
      },
    },
  });

  const result = await service.awardWheelRewardForUser({
    userId: 'user-1',
    reward: { id: 'coins', label: 'Coins', type: 'coins', amount: 10 },
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(getWalletScope.tenantId, 'tenant-wheel-default');
});
