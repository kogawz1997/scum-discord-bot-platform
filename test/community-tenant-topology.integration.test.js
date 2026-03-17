const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const { resolveTenantDatabaseTarget } = require('../src/utils/tenantDatabaseTopology');

const repoRoot = path.resolve(__dirname, '..');
const prismaModulePath = require.resolve('../src/prisma');
const bountyStoreModulePath = require.resolve('../src/store/bountyStore');
const eventStoreModulePath = require.resolve('../src/store/eventStore');
const moderationStoreModulePath = require.resolve('../src/store/moderationStore');
const giveawayStoreModulePath = require.resolve('../src/store/giveawayStore');
const ticketStoreModulePath = require.resolve('../src/store/ticketStore');
const topPanelStoreModulePath = require.resolve('../src/store/topPanelStore');
const welcomePackStoreModulePath = require.resolve('../src/store/welcomePackStore');
const weaponStatsStoreModulePath = require.resolve('../src/store/weaponStatsStore');

function isPostgresRuntime() {
  return /^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || '').trim());
}

function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function runDbPush(databaseUrl) {
  const scriptPath = path.resolve(repoRoot, 'scripts', 'prisma-with-provider.js');
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--provider', 'postgresql', 'db', 'push', '--skip-generate'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
    },
  );
  if (Number(result.status || 0) !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'prisma db push failed').trim());
  }
}

async function provisionTenantSchema(target) {
  if (!target?.schemaName || !target?.datasourceUrl) {
    throw new Error('schema-per-tenant target is required');
  }
  const adminClient = createPrismaClient(process.env.DATABASE_URL);
  try {
    await adminClient.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(target.schemaName)};`,
    );
  } finally {
    await adminClient.$disconnect().catch(() => {});
  }
  runDbPush(target.datasourceUrl);
}

async function dropTenantSchema(target) {
  if (!target?.schemaName) return;
  const adminClient = createPrismaClient(process.env.DATABASE_URL);
  try {
    await adminClient.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS ${quoteIdentifier(target.schemaName)} CASCADE;`,
    );
  } finally {
    await adminClient.$disconnect().catch(() => {});
  }
}

function clearTenantTopologyModules() {
  delete require.cache[prismaModulePath];
  delete require.cache[bountyStoreModulePath];
  delete require.cache[eventStoreModulePath];
  delete require.cache[moderationStoreModulePath];
  delete require.cache[giveawayStoreModulePath];
  delete require.cache[ticketStoreModulePath];
  delete require.cache[topPanelStoreModulePath];
  delete require.cache[welcomePackStoreModulePath];
  delete require.cache[weaponStatsStoreModulePath];
}

function loadTenantTopologyModules() {
  clearTenantTopologyModules();
  return {
    prismaModule: require('../src/prisma'),
    bountyStore: require('../src/store/bountyStore'),
    eventStore: require('../src/store/eventStore'),
    moderationStore: require('../src/store/moderationStore'),
    giveawayStore: require('../src/store/giveawayStore'),
    ticketStore: require('../src/store/ticketStore'),
    topPanelStore: require('../src/store/topPanelStore'),
    welcomePackStore: require('../src/store/welcomePackStore'),
    weaponStatsStore: require('../src/store/weaponStatsStore'),
  };
}

test('schema-per-tenant topology isolates community/admin stores when PLATFORM_DEFAULT_TENANT_ID is set', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for tenant topology integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const previousDefaultTenantId = process.env.PLATFORM_DEFAULT_TENANT_ID;
  const tenantId = `tenant-community-${Date.now()}`;
  const baseId = String(Date.now());
  const guildId = `guild-${baseId}`;
  const userId = `user-${baseId}`;
  const eventName = `event-${baseId}`;
  const messageId = `message-${baseId}`;
  const ticketChannelId = `ticket-${baseId}`;
  const topPanelChannelId = `panel-ch-${baseId}`;
  const topPanelMessageId = `panel-msg-${baseId}`;
  const weaponName = `WeaponTenant${baseId}`;
  const target = resolveTenantDatabaseTarget({
    tenantId,
    env: {
      ...process.env,
      TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
    },
    mode: 'schema-per-tenant',
  });

  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  process.env.PLATFORM_DEFAULT_TENANT_ID = tenantId;
  await provisionTenantSchema(target);

  t.after(async () => {
    clearTenantTopologyModules();
    delete process.env.TENANT_DB_TOPOLOGY_MODE;
    delete process.env.PLATFORM_DEFAULT_TENANT_ID;
    if (previousMode) process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    if (previousDefaultTenantId) process.env.PLATFORM_DEFAULT_TENANT_ID = previousDefaultTenantId;
    await dropTenantSchema(target).catch(() => null);
  });

  const {
    prismaModule,
    bountyStore,
    eventStore,
    moderationStore,
    giveawayStore,
    ticketStore,
    topPanelStore,
    welcomePackStore,
    weaponStatsStore,
  } = loadTenantTopologyModules();
  const { prisma, getTenantScopedPrismaClient, disconnectAllPrismaClients } = prismaModule;
  const scopedPrisma = getTenantScopedPrismaClient(tenantId);

  try {
    const previousStatusRows = await scopedPrisma.scumStatus.findMany().catch(() => []);

    const bounty = await bountyStore.createBounty({
      targetName: `target-${baseId}`,
      amount: 500,
      createdBy: userId,
    });
    const eventRecord = eventStore.createEvent({
      name: eventName,
      time: '21:00',
      reward: 'reward-box',
    });
    eventStore.joinEvent(eventRecord.id, userId);
    moderationStore.addPunishment(userId, 'warn', 'tenant topology test', 'staff-1', 15);
    const giveaway = giveawayStore.createGiveaway({
      messageId,
      channelId: `channel-${baseId}`,
      guildId,
      prize: 'tenant-prize',
      winnersCount: 1,
      endsAt: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    giveawayStore.addEntrant(messageId, userId);
    const ticket = ticketStore.createTicket({
      guildId,
      userId,
      channelId: ticketChannelId,
      category: 'support',
      reason: 'tenant-test',
    });
    ticketStore.claimTicket(ticketChannelId, 'staff-1');
    topPanelStore.setTopPanelMessage(guildId, 'topKiller', topPanelChannelId, topPanelMessageId);
    assert.equal(welcomePackStore.claim(userId), true);
    weaponStatsStore.recordWeaponKill({
      weapon: weaponName,
      distance: 123.45,
      killer: userId,
    });

    await Promise.all([
      bountyStore.flushBountyStoreWrites(),
      eventStore.flushEventStoreWrites(),
      moderationStore.flushModerationStoreWrites(),
      giveawayStore.flushGiveawayStoreWrites(),
      ticketStore.flushTicketStoreWrites(),
      topPanelStore.flushTopPanelStoreWrites(),
      welcomePackStore.flushWelcomePackStoreWrites(),
      weaponStatsStore.flushWeaponStatsStoreWrites(),
    ]);

    assert.equal(
      await prisma.bounty.count({ where: { targetName: `target-${baseId}` } }),
      0,
    );
    assert.equal(
      await prisma.guildEvent.count({ where: { name: eventName } }),
      0,
    );
    assert.equal(
      await prisma.punishment.count({ where: { userId } }),
      0,
    );
    assert.equal(
      await prisma.giveaway.count({ where: { messageId } }),
      0,
    );
    assert.equal(
      await prisma.ticketRecord.count({ where: { channelId: ticketChannelId } }),
      0,
    );
    assert.equal(
      await prisma.topPanelMessage.count({ where: { guildId } }),
      0,
    );
    assert.equal(
      await prisma.welcomeClaim.count({ where: { userId } }),
      0,
    );
    assert.equal(
      await prisma.weaponStat.count({ where: { weapon: weaponName } }),
      0,
    );

    assert.equal(
      await scopedPrisma.bounty.count({ where: { targetName: `target-${baseId}` } }),
      1,
    );
    assert.equal(
      await scopedPrisma.guildEvent.count({ where: { name: eventName } }),
      1,
    );
    assert.equal(
      await scopedPrisma.guildEventParticipant.count({ where: { eventId: eventRecord.id, userId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.punishment.count({ where: { userId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.giveaway.count({ where: { messageId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.giveawayEntrant.count({ where: { messageId, userId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.ticketRecord.count({ where: { channelId: ticketChannelId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.topPanelMessage.count({ where: { guildId, panelType: 'topKiller' } }),
      1,
    );
    assert.equal(
      await scopedPrisma.welcomeClaim.count({ where: { userId } }),
      1,
    );
    assert.equal(
      await scopedPrisma.weaponStat.count({ where: { weapon: weaponName } }),
      1,
    );

    eventStore.replaceEvents([], []);
    moderationStore.replacePunishments([]);
    giveawayStore.replaceGiveaways([]);
    ticketStore.replaceTickets([]);
    topPanelStore.replaceTopPanels([]);
    welcomePackStore.replaceClaims([]);
    weaponStatsStore.replaceWeaponStats([]);
    bountyStore.replaceBounties([]);

    await Promise.all([
      bountyStore.flushBountyStoreWrites(),
      eventStore.flushEventStoreWrites(),
      moderationStore.flushModerationStoreWrites(),
      giveawayStore.flushGiveawayStoreWrites(),
      ticketStore.flushTicketStoreWrites(),
      topPanelStore.flushTopPanelStoreWrites(),
      welcomePackStore.flushWelcomePackStoreWrites(),
      weaponStatsStore.flushWeaponStatsStoreWrites(),
    ]);

    await scopedPrisma.bounty.deleteMany({ where: { targetName: `target-${baseId}` } });
    await scopedPrisma.guildEventParticipant.deleteMany({ where: { eventId: eventRecord.id } });
    await scopedPrisma.guildEvent.deleteMany({ where: { id: eventRecord.id } });
    await scopedPrisma.punishment.deleteMany({ where: { userId } });
    await scopedPrisma.giveawayEntrant.deleteMany({ where: { messageId, userId } });
    await scopedPrisma.giveaway.deleteMany({ where: { messageId } });
    await scopedPrisma.ticketRecord.deleteMany({ where: { channelId: ticketChannelId } });
    await scopedPrisma.topPanelMessage.deleteMany({ where: { guildId } });
    await scopedPrisma.welcomeClaim.deleteMany({ where: { userId } });
    await scopedPrisma.weaponStat.deleteMany({ where: { weapon: weaponName } });
    await scopedPrisma.scumStatus.deleteMany({});
    for (const row of previousStatusRows) {
      await scopedPrisma.scumStatus.create({
        data: {
          id: row.id,
          onlinePlayers: row.onlinePlayers,
          maxPlayers: row.maxPlayers,
          pingMs: row.pingMs,
          uptimeMinutes: row.uptimeMinutes,
          lastUpdated: row.lastUpdated,
        },
      });
    }
  } finally {
    await disconnectAllPrismaClients().catch(() => {});
  }
});
