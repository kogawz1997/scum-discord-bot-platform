const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const tenantStoreScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');

const storeModules = {
  bounty: path.resolve(__dirname, '../src/store/bountyStore.js'),
  redeem: path.resolve(__dirname, '../src/store/redeemStore.js'),
  partyChat: path.resolve(__dirname, '../src/store/partyChatStore.js'),
  topPanel: path.resolve(__dirname, '../src/store/topPanelStore.js'),
  weaponStats: path.resolve(__dirname, '../src/store/weaponStatsStore.js'),
  luckyWheel: path.resolve(__dirname, '../src/store/luckyWheelStore.js'),
  scum: path.resolve(__dirname, '../src/store/scumStore.js'),
};

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

function clearAllStores() {
  Object.values(storeModules).forEach(clearModule);
  clearModule(tenantStoreScopePath);
  clearModule(prismaPath);
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
  const db = {
    bounty: {
      async findMany() { return []; },
      async create({ data }) { return { id: 1, ...data }; },
      async upsert() { return null; },
      async updateMany() { return { count: 1 }; },
      async deleteMany() { return { count: 0 }; },
    },
    redeemCode: {
      async findMany() { return []; },
      async upsert() { return null; },
    },
    partyChatMessage: {
      async findMany() { return []; },
      async create({ data }) { return data; },
      async deleteMany() { return { count: 0 }; },
    },
    topPanelMessage: {
      async findMany() { return []; },
      async upsert() { return null; },
      async create() { return null; },
      async deleteMany() { return { count: 0 }; },
    },
    weaponStat: {
      async findMany() { return []; },
      async upsert() { return null; },
      async deleteMany() { return { count: 0 }; },
      async create() { return null; },
    },
    luckyWheelState: {
      async findUnique() { return null; },
      async findMany() { return []; },
      async upsert({ create, update }) { return create || update || null; },
      async update({ data }) { return data; },
      async deleteMany() { return { count: 0 }; },
      async delete() { return null; },
      async create({ data }) { return data; },
    },
    scumStatus: {
      async findUnique() { return null; },
      async upsert() { return null; },
    },
    async $transaction(work) {
      return work(db);
    },
  };

  return {
    prisma: db,
    resolveDefaultTenantId() {
      return tenantId;
    },
    resolveTenantScopedDatasourceUrl() {
      return tenantId;
    },
    getTenantScopedPrismaClient() {
      return db;
    },
  };
}

function loadStore(modulePath, tenantId) {
  clearAllStores();
  installMock(prismaPath, createScopedPrisma(tenantId));
  return require(modulePath);
}

test.afterEach(() => {
  clearAllStores();
});

test('batch2 stores require tenant scope in strict isolation mode', async () => {
  const env = createStrictEnv();

  assert.throws(() => loadStore(storeModules.bounty, null).listBounties({ env }), /requires tenantId/i);
  assert.throws(() => loadStore(storeModules.redeem, null).getCode('WELCOME1000', { env }), /requires tenantId/i);
  await assert.rejects(
    () => loadStore(storeModules.partyChat, null).listPartyMessages('alpha-party', 20, { env }),
    /requires tenantId/i,
  );
  assert.throws(() => loadStore(storeModules.topPanel, null).listTopPanels({ env }), /requires tenantId/i);
  assert.throws(() => loadStore(storeModules.weaponStats, null).listWeaponStats({ env }), /requires tenantId/i);
  await assert.rejects(
    () => loadStore(storeModules.luckyWheel, null).canSpinWheel('player-1', 60000, Date.now(), { env }),
    /requires tenantId/i,
  );
  assert.throws(() => loadStore(storeModules.scum, null).getStatus({ env }), /requires tenantId/i);
});

test('batch2 stores use resolved default tenant scope in strict isolation mode', async () => {
  const env = createStrictEnv();

  assert.deepEqual(loadStore(storeModules.bounty, 'tenant-bounty').listBounties({ env }), []);
  assert.equal(loadStore(storeModules.redeem, 'tenant-redeem').getCode('WELCOME1000', { env })?.type, 'coins');

  const partyMessages = await loadStore(storeModules.partyChat, 'tenant-party').listPartyMessages('alpha-party', 20, { env });
  assert.deepEqual(partyMessages, []);

  assert.deepEqual(loadStore(storeModules.topPanel, 'tenant-panel').listTopPanels({ env }), []);
  assert.deepEqual(loadStore(storeModules.weaponStats, 'tenant-weapon').listWeaponStats({ env }), []);

  const wheelState = await loadStore(storeModules.luckyWheel, 'tenant-wheel').canSpinWheel('player-1', 60000, Date.now(), { env });
  assert.equal(wheelState.ok, true);

  const scumStatus = loadStore(storeModules.scum, 'tenant-scum').getStatus({ env });
  assert.equal(scumStatus.onlinePlayers, 0);
});
