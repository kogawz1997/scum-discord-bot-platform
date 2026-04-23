const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/welcomePackService.js');
const storePath = path.resolve(__dirname, '../src/store/welcomePackStore.js');
const coinServicePath = path.resolve(__dirname, '../src/services/coinService.js');
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
  installMock(storePath, mocks.welcomePackStore);
  installMock(coinServicePath, mocks.coinService);
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
  clearModule(storePath);
  clearModule(coinServicePath);
  clearModule(prismaPath);
});

test('welcome pack service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    welcomePackStore: {
      hasClaimed() {
        throw new Error('should-not-check-claim-without-tenant');
      },
      claim() {
        return true;
      },
      revokeClaim() {
        return true;
      },
      clearClaims() {},
      listClaimed() {
        return [];
      },
    },
    coinService: {
      async creditCoins() {
        return { ok: true, balance: 0 };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.claimWelcomePackForUser({
      userId: 'user-1',
      amount: 100,
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('welcome pack service uses resolved default tenant scope in strict isolation mode', async () => {
  let creditParams = null;
  const service = loadService({
    welcomePackStore: {
      hasClaimed() {
        return false;
      },
      claim() {
        return true;
      },
      revokeClaim() {
        return true;
      },
      clearClaims() {},
      listClaimed() {
        return [];
      },
    },
    coinService: {
      async creditCoins(params) {
        creditParams = params;
        return { ok: true, balance: 100 };
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-welcome-default';
      },
    },
  });

  const result = await service.claimWelcomePackForUser({
    userId: 'user-1',
    amount: 100,
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(creditParams.tenantId, 'tenant-welcome-default');
  assert.equal(creditParams.defaultTenantId, 'tenant-welcome-default');
});
