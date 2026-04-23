const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/playerQueryService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const statsStorePath = path.resolve(__dirname, '../src/store/statsStore.js');
const moderationStorePath = path.resolve(__dirname, '../src/store/moderationStore.js');
const scumStorePath = path.resolve(__dirname, '../src/store/scumStore.js');
const itemIconServicePath = path.resolve(__dirname, '../src/services/itemIconService.js');
const shopServicePath = path.resolve(__dirname, '../src/services/shopService.js');
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
  installMock(statsStorePath, mocks.statsStore);
  installMock(moderationStorePath, mocks.moderationStore);
  installMock(scumStorePath, mocks.scumStore);
  installMock(itemIconServicePath, mocks.itemIconService);
  installMock(shopServicePath, mocks.shopService);
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
  clearModule(statsStorePath);
  clearModule(moderationStorePath);
  clearModule(scumStorePath);
  clearModule(itemIconServicePath);
  clearModule(shopServicePath);
  clearModule(prismaPath);
});

function createBaseMocks() {
  return {
    memoryStore: {
      async getWallet(userId, options) {
        return { userId, tenantId: options?.tenantId || null, balance: 50 };
      },
      async listTopWallets() {
        return [];
      },
      async listUserPurchases() {
        return [];
      },
      async getShopItemById() {
        return null;
      },
      async getShopItemByName() {
        return null;
      },
      async listShopItems() {
        return [];
      },
    },
    statsStore: {
      getStats() {
        return null;
      },
      listAllStats() {
        return [];
      },
    },
    moderationStore: {
      getPunishments() {
        return [];
      },
    },
    scumStore: {
      getStatus() {
        return { ok: true };
      },
    },
    itemIconService: {
      resolveItemIconUrl() {
        return null;
      },
    },
    shopService: {
      normalizeShopKind(value) {
        return value || 'item';
      },
      buildBundleSummary() {
        return null;
      },
    },
  };
}

test('player query service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.getWalletSnapshot('user-1', {
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('player query service uses resolved default tenant scope when strict isolation is enabled', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-player-default';
      },
    },
  });

  const result = await service.getWalletSnapshot('user-1', {
    env: createStrictEnv(),
  });

  assert.equal(result.tenantId, 'tenant-player-default');
});
