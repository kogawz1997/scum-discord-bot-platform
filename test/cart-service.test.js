const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/cartService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const cartStorePath = path.resolve(__dirname, '../src/store/cartStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
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
  installMock(cartStorePath, mocks.cartStore);
  installMock(coinServicePath, mocks.coinService);
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
  clearModule(cartStorePath);
  clearModule(coinServicePath);
  clearModule(shopServicePath);
  clearModule(prismaPath);
});

test('cart service requires tenant scope in strict isolation mode', () => {
  const service = loadService({
    memoryStore: {
      getWallet() {
        return { balance: 0 };
      },
      getShopItemById() {
        return null;
      },
    },
    cartStore: {
      addCartItem() {
        throw new Error('should-not-add-cart-item');
      },
      removeCartItem() {
        return null;
      },
      listCartItems() {
        return [];
      },
      clearCart() {},
    },
    coinService: {
      debitCoins() {
        return { ok: true, balance: 0 };
      },
      creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    shopService: {
      normalizeShopKind(value) {
        return value || 'item';
      },
      buildBundleSummary() {
        return null;
      },
      getDeliveryStatusText() {
        return 'queued';
      },
      purchaseShopItemForUser() {
        return { ok: true };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  assert.throws(
    () => service.addItemToCartForUser({
      userId: 'user-1',
      itemId: 'item-1',
      quantity: 1,
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('cart service uses resolved default tenant scope for cart mutations', () => {
  let receivedScope = null;
  const service = loadService({
    memoryStore: {
      getWallet() {
        return { balance: 0 };
      },
      getShopItemById() {
        return null;
      },
    },
    cartStore: {
      addCartItem(userId, itemId, quantity, options) {
        receivedScope = options;
        return { userId, itemId, quantity };
      },
      removeCartItem() {
        return null;
      },
      listCartItems() {
        return [];
      },
      clearCart() {},
    },
    coinService: {
      debitCoins() {
        return { ok: true, balance: 0 };
      },
      creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    shopService: {
      normalizeShopKind(value) {
        return value || 'item';
      },
      buildBundleSummary() {
        return null;
      },
      getDeliveryStatusText() {
        return 'queued';
      },
      purchaseShopItemForUser() {
        return { ok: true };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-cart-default';
      },
    },
  });

  const result = service.addItemToCartForUser({
    userId: 'user-1',
    itemId: 'item-1',
    quantity: 1,
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(receivedScope.tenantId, 'tenant-cart-default');
  assert.equal(receivedScope.defaultTenantId, 'tenant-cart-default');
});
