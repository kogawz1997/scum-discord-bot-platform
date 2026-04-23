const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/shopService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const linkStorePath = path.resolve(__dirname, '../src/store/linkStore.js');
const vipStorePath = path.resolve(__dirname, '../src/store/vipStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
const rconDeliveryPath = path.resolve(__dirname, '../src/services/rconDelivery.js');
const platformServicePath = path.resolve(__dirname, '../src/services/platformService.js');
const vipServicePath = path.resolve(__dirname, '../src/services/vipService.js');
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
  installMock(vipStorePath, mocks.vipStore);
  installMock(coinServicePath, mocks.coinService);
  installMock(rconDeliveryPath, mocks.rconDelivery);
  installMock(platformServicePath, mocks.platformService);
  installMock(vipServicePath, mocks.vipService);
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

function createBaseMocks() {
  return {
    memoryStore: {
      async getWallet() {
        return { balance: 100 };
      },
      async getShopItemById() {
        return null;
      },
      async getShopItemByName() {
        return null;
      },
      async createPurchase() {
        return { code: 'P-1', tenantId: 'tenant-shop-default' };
      },
      async setPurchaseStatusByCode(code, status, options) {
        return { code, status, tenantId: options?.tenantId || null };
      },
      async addShopItem(id, name, price, description, data, options) {
        return { id, name, price, description, ...data, tenantId: options?.tenantId || null };
      },
      async updateShopItem(idOrName, data, options) {
        return { id: idOrName, ...data, tenantId: options?.tenantId || null };
      },
      async deleteShopItem(idOrName, options) {
        return { id: idOrName, tenantId: options?.tenantId || null };
      },
      async setShopItemPrice(idOrName, price, options) {
        return { id: idOrName, price, tenantId: options?.tenantId || null };
      },
      async setShopItemStatus(idOrName, status, options) {
        return { id: idOrName, status, tenantId: options?.tenantId || null };
      },
    },
    linkStore: {
      async getLinkByUserId() {
        return { steamId: '76561199012345678' };
      },
    },
    vipStore: {
      getMembership() {
        return null;
      },
      setMembership(userId, planId, expiresAt, options) {
        return { userId, planId, expiresAt, tenantId: options?.tenantId || null };
      },
      removeMembership() {},
    },
    coinService: {
      async debitCoins() {
        return { ok: true, balance: 75 };
      },
      async creditCoins() {
        return { ok: true, balance: 100 };
      },
    },
    rconDelivery: {
      async enqueuePurchaseDelivery() {
        return { queued: true };
      },
    },
    platformService: {
      async assertTenantQuotaAvailable() {
        return { ok: true };
      },
    },
    vipService: {
      getVipPlan() {
        return { id: 'vip-basic', durationDays: 30 };
      },
    },
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(memoryStorePath);
  clearModule(linkStorePath);
  clearModule(vipStorePath);
  clearModule(coinServicePath);
  clearModule(rconDeliveryPath);
  clearModule(platformServicePath);
  clearModule(vipServicePath);
  clearModule(prismaPath);
});

test('shop service requires tenant scope in strict isolation mode for shop lookup', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.findShopItemByQuery('item-1', {
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('shop service uses resolved default tenant scope for admin item writes', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-shop-default';
      },
    },
  });

  const result = await service.addShopItemForAdmin({
    id: 'item-1',
    name: 'Demo item',
    price: 100,
    description: 'desc',
    kind: 'item',
    gameItemId: 'Weapon_M1911',
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.item.tenantId, 'tenant-shop-default');
});
