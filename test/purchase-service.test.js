const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/purchaseService.js');
const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
const stateMachinePath = path.resolve(__dirname, '../src/services/purchaseStateMachine.js');
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
  installMock(coinServicePath, mocks.coinService);
  installMock(stateMachinePath, mocks.purchaseStateMachine);
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

function createStateMachineMock() {
  return {
    normalizePurchaseStatus(value) {
      return String(value || '').trim().toLowerCase() || null;
    },
    validatePurchaseStatusTransition() {
      return { ok: true };
    },
    listAllowedPurchaseTransitions() {
      return ['queued', 'delivered', 'refunded'];
    },
    listKnownPurchaseStatuses() {
      return ['queued', 'delivered', 'refunded'];
    },
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(memoryStorePath);
  clearModule(coinServicePath);
  clearModule(stateMachinePath);
  clearModule(prismaPath);
});

test('purchase service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    memoryStore: {
      async findPurchaseByCode() {
        throw new Error('should-not-query-purchase');
      },
      async setPurchaseStatusByCode() {
        return null;
      },
      async listPurchaseStatusHistory() {
        return [];
      },
    },
    coinService: {
      async creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    purchaseStateMachine: createStateMachineMock(),
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.updatePurchaseStatusForActor({
      code: 'purchase-1',
      status: 'delivered',
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('purchase service uses resolved default tenant scope for purchase updates', async () => {
  let findPurchaseScope = null;
  let refundScope = null;
  const service = loadService({
    memoryStore: {
      async findPurchaseByCode(code, options) {
        findPurchaseScope = options;
        return {
          code,
          tenantId: options?.tenantId || null,
          userId: 'user-1',
          price: 25,
          status: 'queued',
        };
      },
      async setPurchaseStatusByCode(code, status, options) {
        return {
          code,
          tenantId: options?.tenantId || null,
          userId: 'user-1',
          price: 25,
          status,
        };
      },
      async listPurchaseStatusHistory() {
        return [];
      },
    },
    coinService: {
      async creditCoins(params) {
        refundScope = params;
        return { ok: true, balance: 75 };
      },
    },
    purchaseStateMachine: createStateMachineMock(),
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-purchase-default';
      },
    },
  });

  const result = await service.refundPurchaseForActor({
    code: 'purchase-1',
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(findPurchaseScope.tenantId, 'tenant-purchase-default');
  assert.equal(refundScope.tenantId, 'tenant-purchase-default');
});
