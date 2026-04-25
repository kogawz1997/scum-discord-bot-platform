const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { assertTenantMutationScope } = require('../src/utils/tenantDbIsolation');

const memoryStorePath = path.resolve(__dirname, '../src/store/memoryStore.js');
const playerAccountStorePath = path.resolve(__dirname, '../src/store/playerAccountStore.js');
const raidServicePath = path.resolve(__dirname, '../src/services/raidService.js');
const eventStorePath = path.resolve(__dirname, '../src/store/eventStore.js');
const giveawayStorePath = path.resolve(__dirname, '../src/store/giveawayStore.js');
const ticketStorePath = path.resolve(__dirname, '../src/store/ticketStore.js');
const vipStorePath = path.resolve(__dirname, '../src/store/vipStore.js');
const moderationStorePath = path.resolve(__dirname, '../src/store/moderationStore.js');
const topPanelStorePath = path.resolve(__dirname, '../src/store/topPanelStore.js');
const welcomePackStorePath = path.resolve(__dirname, '../src/store/welcomePackStore.js');
const bountyStorePath = path.resolve(__dirname, '../src/store/bountyStore.js');
const luckyWheelStorePath = path.resolve(__dirname, '../src/store/luckyWheelStore.js');
const tenantStoreScopePath = path.resolve(__dirname, '../src/store/tenantStoreScope.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const configPath = path.resolve(__dirname, '../src/config.js');

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

function createPurchaseDbHarness() {
  const tx = {
    purchase: {
      async create({ data }) {
        return {
          ...data,
          createdAt: new Date('2026-04-22T00:00:00.000Z'),
        };
      },
    },
    purchaseStatusHistory: {
      async create({ data }) {
        return data;
      },
    },
  };

  return {
    prisma: {
      async $transaction(work) {
        return work(tx);
      },
    },
    resolveDefaultTenantId(options = {}) {
      return String(options.tenantId || options.defaultTenantId || '').trim() || null;
    },
    resolveTenantScopedDatasourceUrl() {
      return null;
    },
    getTenantScopedPrismaClient() {
      return this.prisma;
    },
  };
}

function createPlayerAccountDbHarness(tenantId = null) {
  const db = {
    playerAccount: {
      async upsert({ create }) {
        return create;
      },
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

function createRaidDbHarness(tenantId = null) {
  const db = {
    platformRaidRequest: {
      async create({ data }) {
        return {
          id: 1,
          createdAt: new Date('2026-04-22T00:00:00.000Z'),
          updatedAt: new Date('2026-04-22T00:00:00.000Z'),
          ...data,
        };
      },
      async findMany() {
        return [];
      },
      async findUnique() {
        return null;
      },
    },
    platformRaidWindow: {
      async findMany() {
        return [];
      },
    },
    platformRaidSummary: {
      async findMany() {
        return [];
      },
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

function createTenantStoreDbHarness(tenantId = null) {
  const db = {
    guildEvent: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async updateMany() {
        return { count: 0 };
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    guildEventParticipant: {
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    giveaway: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    giveawayEntrant: {
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    ticketRecord: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async updateMany() {
        return { count: 0 };
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    vipMembership: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    punishment: {
      async findMany() {
        return [];
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create({ data } = {}) {
        return data || null;
      },
    },
    topPanelMessage: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    welcomeClaim: {
      async findMany() {
        return [];
      },
      async upsert() {
        return null;
      },
      async deleteMany() {
        return { count: 0 };
      },
      async create() {
        return null;
      },
    },
    bounty: {
      async findMany() {
        return [];
      },
      async create({ data } = {}) {
        return {
          id: 1,
          ...data,
        };
      },
      async updateMany() {
        return { count: 0 };
      },
      async deleteMany() {
        return { count: 0 };
      },
      async upsert() {
        return null;
      },
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

function loadMemoryStore(prismaMock = createPurchaseDbHarness()) {
  clearModule(memoryStorePath);
  installMock(prismaPath, prismaMock);
  installMock(configPath, {
    economy: {
      dailyCooldownMs: 86_400_000,
      dailyReward: 100,
      weeklyCooldownMs: 604_800_000,
      weeklyReward: 500,
    },
    shop: {
      initialItems: [],
    },
  });
  return require(memoryStorePath);
}

function loadPlayerAccountStore(prismaMock = createPlayerAccountDbHarness()) {
  clearModule(playerAccountStorePath);
  installMock(prismaPath, prismaMock);
  return require(playerAccountStorePath);
}

function loadRaidService(prismaMock = createRaidDbHarness()) {
  clearModule(raidServicePath);
  clearModule(tenantStoreScopePath);
  installMock(prismaPath, prismaMock);
  return require(raidServicePath);
}

function loadTenantStore(storePath, prismaMock = createTenantStoreDbHarness()) {
  clearModule(storePath);
  clearModule(tenantStoreScopePath);
  installMock(prismaPath, prismaMock);
  return require(storePath);
}

test.afterEach(() => {
  clearModule(memoryStorePath);
  clearModule(playerAccountStorePath);
  clearModule(raidServicePath);
  clearModule(eventStorePath);
  clearModule(giveawayStorePath);
  clearModule(ticketStorePath);
  clearModule(vipStorePath);
  clearModule(moderationStorePath);
  clearModule(topPanelStorePath);
  clearModule(welcomePackStorePath);
  clearModule(bountyStorePath);
  clearModule(luckyWheelStorePath);
  clearModule(tenantStoreScopePath);
  clearModule(prismaPath);
  clearModule(configPath);
});

test('tenant mutation guard rejects tenant-owned writes without tenant scope', () => {
  assert.throws(
    () =>
      assertTenantMutationScope({
        operation: 'create purchase',
        entityType: 'purchase',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.statusCode, 400);
      assert.equal(error.tenantMutationScope.operation, 'create purchase');
      assert.equal(error.tenantMutationScope.entityType, 'purchase');
      return true;
    },
  );
});

test('tenant mutation guard rejects mismatched tenant payloads', () => {
  assert.throws(
    () =>
      assertTenantMutationScope({
        tenantId: 'tenant-a',
        dataTenantId: 'tenant-b',
        operation: 'create raid request',
        entityType: 'raid-request',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_MISMATCH');
      assert.equal(error.statusCode, 403);
      assert.equal(error.tenantMutationScope.tenantId, 'tenant-a');
      assert.equal(error.tenantMutationScope.dataTenantId, 'tenant-b');
      return true;
    },
  );
});

test('tenant mutation guard allows explicit platform-owned global mutations', () => {
  const scope = assertTenantMutationScope({
    allowGlobal: true,
    operation: 'platform package catalog write',
    entityType: 'platform-package',
  });

  assert.equal(scope.tenantId, null);
  assert.equal(scope.allowGlobal, true);
  assert.equal(scope.globalMutation, true);
});

test('purchase creation rejects missing tenant mutation scope before persistence', async () => {
  const { createPurchase } = loadMemoryStore();

  await assert.rejects(
    () =>
      createPurchase('12345678901234', {
        id: 'starter-pack',
        price: 100,
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create purchase');
      return true;
    },
  );
});

test('wallet credit rejects missing tenant mutation scope before persistence', async () => {
  const { addCoins } = loadMemoryStore();

  await assert.rejects(
    () => addCoins('wallet-user-1', 100),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'add wallet coins');
      assert.equal(error.tenantMutationScope.entityType, 'wallet');
      return true;
    },
  );
});

test('wallet balance set rejects missing tenant mutation scope before persistence', async () => {
  const { setCoins } = loadMemoryStore();

  await assert.rejects(
    () => setCoins('wallet-user-1', 1000),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'set wallet coins');
      assert.equal(error.tenantMutationScope.entityType, 'wallet');
      return true;
    },
  );
});

test('daily reward claim rejects missing tenant mutation scope before persistence', async () => {
  const { claimDaily } = loadMemoryStore();

  await assert.rejects(
    () => claimDaily('wallet-user-1'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'claim daily reward');
      assert.equal(error.tenantMutationScope.entityType, 'wallet');
      return true;
    },
  );
});

test('weekly reward claim rejects missing tenant mutation scope before persistence', async () => {
  const { claimWeekly } = loadMemoryStore();

  await assert.rejects(
    () => claimWeekly('wallet-user-1'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'claim weekly reward');
      assert.equal(error.tenantMutationScope.entityType, 'wallet');
      return true;
    },
  );
});

test('lucky wheel spin record rejects missing tenant mutation scope before persistence', async () => {
  const { recordWheelSpin } = loadTenantStore(luckyWheelStorePath);

  await assert.rejects(
    () =>
      recordWheelSpin('wheel-user-1', {
        id: 'coins-100',
        label: 'Coins x100',
        type: 'coins',
        amount: 100,
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'record lucky wheel spin');
      assert.equal(error.tenantMutationScope.entityType, 'lucky-wheel-state');
      return true;
    },
  );
});

test('player account upsert rejects missing tenant mutation scope before persistence', async () => {
  const { upsertPlayerAccount } = loadPlayerAccountStore();

  await assert.rejects(
    () =>
      upsertPlayerAccount({
        discordId: '12345678901234',
        username: 'tenantless-player',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'upsert player account');
      return true;
    },
  );
});

test('raid request creation rejects missing tenant mutation scope before persistence', async () => {
  const { createRaidRequest } = loadRaidService();

  await assert.rejects(
    () =>
      createRaidRequest({
        requesterUserId: 'discord-raid-1',
        requesterName: 'Mira',
        requestText: 'West compound push',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create raid request');
      return true;
    },
  );
});

test('raid window creation rejects missing tenant mutation scope before persistence', async () => {
  const { createRaidWindow } = loadRaidService();

  await assert.rejects(
    () =>
      createRaidWindow({
        requestId: 1,
        title: 'Friday raid window',
        startsAt: '2026-04-24T20:00:00.000Z',
        actor: 'tenant-admin',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create raid window');
      assert.equal(error.tenantMutationScope.entityType, 'raid-window');
      return true;
    },
  );
});

test('raid summary creation rejects missing tenant mutation scope before persistence', async () => {
  const { createRaidSummary } = loadRaidService();

  await assert.rejects(
    () =>
      createRaidSummary({
        requestId: 1,
        windowId: 1,
        outcome: 'Raid completed',
        notes: 'No loot disputes',
        createdBy: 'tenant-admin',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create raid summary');
      assert.equal(error.tenantMutationScope.entityType, 'raid-summary');
      return true;
    },
  );
});

test('event creation rejects missing tenant mutation scope before persistence', () => {
  const { createEvent } = loadTenantStore(eventStorePath);

  assert.throws(
    () =>
      createEvent({
        name: 'Air drop',
        time: '20:00',
        reward: '500 coins',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create guild event');
      return true;
    },
  );
});

test('giveaway creation rejects missing tenant mutation scope before persistence', () => {
  const { createGiveaway } = loadTenantStore(giveawayStorePath);

  assert.throws(
    () =>
      createGiveaway({
        messageId: 'giveaway-tenantless',
        channelId: 'channel-1',
        guildId: 'guild-1',
        prize: 'VIP 7 days',
        winnersCount: 1,
        endsAt: new Date(Date.now() + 60_000),
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create giveaway');
      return true;
    },
  );
});

test('ticket creation rejects missing tenant mutation scope before persistence', () => {
  const { createTicket } = loadTenantStore(ticketStorePath);

  assert.throws(
    () =>
      createTicket({
        guildId: 'guild-1',
        userId: 'user-1',
        channelId: 'ticket-tenantless',
        category: 'support',
        reason: 'Need help',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create support ticket');
      return true;
    },
  );
});

test('vip membership creation rejects missing tenant mutation scope before persistence', () => {
  const { setMembership } = loadTenantStore(vipStorePath);

  assert.throws(
    () => setMembership('user-1', 'vip-7d', new Date(Date.now() + 86_400_000)),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'set vip membership');
      return true;
    },
  );
});

test('moderation punishment creation rejects missing tenant mutation scope before persistence', () => {
  const { addPunishment } = loadTenantStore(moderationStorePath);

  assert.throws(
    () => addPunishment('user-1', 'warn', 'Tenantless moderation write', 'staff-1', null),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'add moderation punishment');
      return true;
    },
  );
});

test('top panel message write rejects missing tenant mutation scope before persistence', () => {
  const { setTopPanelMessage } = loadTenantStore(topPanelStorePath);

  assert.throws(
    () => setTopPanelMessage('guild-1', 'topKiller', 'channel-1', 'message-1'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'set top panel message');
      return true;
    },
  );
});

test('welcome pack claim rejects missing tenant mutation scope before persistence', () => {
  const { claim } = loadTenantStore(welcomePackStorePath);

  assert.throws(
    () => claim('user-1'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'claim welcome pack');
      return true;
    },
  );
});

test('bounty creation rejects missing tenant mutation scope before persistence', async () => {
  const { createBounty } = loadTenantStore(bountyStorePath);

  await assert.rejects(
    () =>
      createBounty({
        targetName: 'Tenantless Target',
        amount: 100,
        createdBy: 'user-1',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'create bounty');
      return true;
    },
  );
});

test('donation package creation rejects missing tenant mutation scope before persistence', async () => {
  const { addShopItem } = loadMemoryStore();

  await assert.rejects(
    () =>
      addShopItem('supporter-pack', 'Supporter Pack', 100, 'Supporter tier', {
        kind: 'vip',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'add shop item');
      assert.equal(error.tenantMutationScope.entityType, 'shop-item');
      return true;
    },
  );
});

test('donation package update rejects missing tenant mutation scope before persistence', async () => {
  const { updateShopItem } = loadMemoryStore();

  await assert.rejects(
    () =>
      updateShopItem('supporter-pack', {
        name: 'Supporter Pack',
        price: 150,
        description: 'Updated supporter tier',
        kind: 'vip',
      }),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'update shop item');
      assert.equal(error.tenantMutationScope.entityType, 'shop-item');
      return true;
    },
  );
});

test('donation package pricing rejects missing tenant mutation scope before persistence', async () => {
  const { setShopItemPrice } = loadMemoryStore();

  await assert.rejects(
    () => setShopItemPrice('supporter-pack', 200),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'set shop item price');
      assert.equal(error.tenantMutationScope.entityType, 'shop-item');
      return true;
    },
  );
});

test('donation package visibility rejects missing tenant mutation scope before persistence', async () => {
  const { setShopItemStatus } = loadMemoryStore();

  await assert.rejects(
    () => setShopItemStatus('supporter-pack', 'disabled'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'set shop item status');
      assert.equal(error.tenantMutationScope.entityType, 'shop-item');
      return true;
    },
  );
});

test('donation package deletion rejects missing tenant mutation scope before persistence', async () => {
  const { deleteShopItem } = loadMemoryStore();

  await assert.rejects(
    () => deleteShopItem('supporter-pack'),
    (error) => {
      assert.equal(error.code, 'TENANT_MUTATION_SCOPE_REQUIRED');
      assert.equal(error.tenantMutationScope.operation, 'delete shop item');
      assert.equal(error.tenantMutationScope.entityType, 'shop-item');
      return true;
    },
  );
});
