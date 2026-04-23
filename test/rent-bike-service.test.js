const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/rentBikeService.js');
const configPath = path.resolve(__dirname, '../src/config.js');
const linkStorePath = path.resolve(__dirname, '../src/store/linkStore.js');
const commandTemplatePath = path.resolve(__dirname, '../src/utils/commandTemplate.js');
const storePath = path.resolve(__dirname, '../src/store/rentBikeStore.js');
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
  installMock(configPath, mocks.config);
  installMock(linkStorePath, mocks.linkStore);
  installMock(commandTemplatePath, mocks.commandTemplate);
  installMock(storePath, mocks.rentBikeStore);
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
  clearModule(configPath);
  clearModule(linkStorePath);
  clearModule(commandTemplatePath);
  clearModule(storePath);
  clearModule(prismaPath);
});

function createBaseMocks() {
  return {
    config: {
      rentBike: {
        timezone: 'Asia/Bangkok',
        vehicle: {
          spawnId: 'bike-1',
        },
        rcon: {
          execTemplate: 'echo {command}',
        },
      },
      delivery: { auto: {} },
      channels: {},
    },
    linkStore: {
      getLinkByUserId() {
        return { steamId: '76561199012345678' };
      },
    },
    commandTemplate: {
      async executeCommandTemplate() {
        return { displayCommand: 'echo', stdout: '', stderr: '' };
      },
    },
    rentBikeStore: {
      async ensureRentBikeTables() {},
      async getDailyRent() {
        return null;
      },
      async markDailyRentUsed() {},
      async createRentalOrder() {},
      async getRentalOrder() {
        return null;
      },
      async setRentalOrderStatus() {},
      async listRentalVehiclesByStatuses() {
        return [];
      },
      async getLatestRentalByUser() {
        return null;
      },
    },
  };
}

test('rent bike service requires tenant scope in strict isolation mode', async () => {
  const service = loadService({
    ...createBaseMocks(),
    prisma: {
      resolveDefaultTenantId() {
        return null;
      },
    },
  });

  await assert.rejects(
    () => service.requestRentBike('user-1', null, {
      env: createStrictEnv(),
    }),
    /requires tenantId/i,
  );
});

test('rent bike service uses resolved default tenant scope in strict isolation mode', async () => {
  let latestScope = null;
  const service = loadService({
    ...createBaseMocks(),
    rentBikeStore: {
      async ensureRentBikeTables() {},
      async getDailyRent(userKey, today, options) {
        latestScope = options;
        return null;
      },
      async markDailyRentUsed() {},
      async createRentalOrder() {},
      async getRentalOrder() {
        return null;
      },
      async setRentalOrderStatus() {},
      async listRentalVehiclesByStatuses() {
        return [];
      },
      async getLatestRentalByUser() {
        return null;
      },
    },
    prisma: {
      resolveDefaultTenantId() {
        return 'tenant-rent-default';
      },
    },
  });

  const result = await service.requestRentBike('user-1', null, {
    env: createStrictEnv(),
  });

  assert.equal(result.ok, true);
  assert.equal(latestScope.tenantId, 'tenant-rent-default');
});
