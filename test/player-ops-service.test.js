const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/playerOpsService.js');
const redeemStorePath = path.resolve(__dirname, '../src/store/redeemStore.js');
const bountyStorePath = path.resolve(__dirname, '../src/store/bountyStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
const rentBikeServicePath = path.resolve(__dirname, '../src/services/rentBikeService.js');
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
  installMock(redeemStorePath, mocks.redeemStore);
  installMock(bountyStorePath, mocks.bountyStore);
  installMock(coinServicePath, mocks.coinService);
  installMock(rentBikeServicePath, mocks.rentBikeService);
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
  clearModule(redeemStorePath);
  clearModule(bountyStorePath);
  clearModule(coinServicePath);
  clearModule(rentBikeServicePath);
  clearModule(prismaPath);
});

test('player ops service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    redeemStore: {
      getCode() {
        throw new Error('should-not-read-code-without-tenant');
      },
      markUsed() {},
      setCode() {
        return { ok: true };
      },
      deleteCode() {
        return true;
      },
      resetCodeUsage() {
        return {};
      },
    },
    bountyStore: {
      async createBounty() {
        return {};
      },
      cancelBounty() {
        return { ok: true };
      },
      listBounties() {
        return [];
      },
    },
    coinService: {
      async creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    rentBikeService: {
      async requestRentBike() {
        return { ok: true };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.redeemCodeForUser({
      userId: 'user-1',
      code: 'TEST',
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('player ops service uses resolved default tenant scope for admin redeem writes', () => {
  let receivedScope = null;
  const service = loadService({
    redeemStore: {
      getCode() {
        return null;
      },
      markUsed() {},
      setCode(code, data, options) {
        receivedScope = options;
        return { ok: true, code, ...data };
      },
      deleteCode() {
        return true;
      },
      resetCodeUsage() {
        return {};
      },
    },
    bountyStore: {
      async createBounty() {
        return {};
      },
      cancelBounty() {
        return { ok: true };
      },
      listBounties() {
        return [];
      },
    },
    coinService: {
      async creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    rentBikeService: {
      async requestRentBike() {
        return { ok: true };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-playerops-default';
      },
    },
  });

  const result = service.createRedeemCodeForAdmin({
    code: 'TEST',
    type: 'coins',
    amount: 10,
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(receivedScope.tenantId, 'tenant-playerops-default');
  assert.equal(receivedScope.defaultTenantId, 'tenant-playerops-default');
});
