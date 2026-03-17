const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const { resolveTenantDatabaseTarget } = require('../src/utils/tenantDatabaseTopology');

const repoRoot = path.resolve(__dirname, '..');
const prismaModulePath = require.resolve('../src/prisma');
const memoryStoreModulePath = require.resolve('../src/store/memoryStore');
const playerAccountStoreModulePath = require.resolve('../src/store/playerAccountStore');
const rentBikeStoreModulePath = require.resolve('../src/store/rentBikeStore');
const luckyWheelStoreModulePath = require.resolve('../src/store/luckyWheelStore');
const cartStoreModulePath = require.resolve('../src/store/cartStore');
const linkStoreModulePath = require.resolve('../src/store/linkStore');
const redeemStoreModulePath = require.resolve('../src/store/redeemStore');
const partyChatStoreModulePath = require.resolve('../src/store/partyChatStore');
const statsStoreModulePath = require.resolve('../src/store/statsStore');
const bountyStoreModulePath = require.resolve('../src/store/bountyStore');
const eventStoreModulePath = require.resolve('../src/store/eventStore');
const giveawayStoreModulePath = require.resolve('../src/store/giveawayStore');
const moderationStoreModulePath = require.resolve('../src/store/moderationStore');
const ticketStoreModulePath = require.resolve('../src/store/ticketStore');
const topPanelStoreModulePath = require.resolve('../src/store/topPanelStore');
const vipStoreModulePath = require.resolve('../src/store/vipStore');
const welcomePackStoreModulePath = require.resolve('../src/store/welcomePackStore');
const weaponStatsStoreModulePath = require.resolve('../src/store/weaponStatsStore');
const scumStoreModulePath = require.resolve('../src/store/scumStore');

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

function clearTenantTopologyModules() {
  delete require.cache[prismaModulePath];
  delete require.cache[memoryStoreModulePath];
  delete require.cache[playerAccountStoreModulePath];
  delete require.cache[rentBikeStoreModulePath];
  delete require.cache[luckyWheelStoreModulePath];
  delete require.cache[cartStoreModulePath];
  delete require.cache[linkStoreModulePath];
  delete require.cache[redeemStoreModulePath];
  delete require.cache[partyChatStoreModulePath];
  delete require.cache[statsStoreModulePath];
  delete require.cache[bountyStoreModulePath];
  delete require.cache[eventStoreModulePath];
  delete require.cache[giveawayStoreModulePath];
  delete require.cache[moderationStoreModulePath];
  delete require.cache[ticketStoreModulePath];
  delete require.cache[topPanelStoreModulePath];
  delete require.cache[vipStoreModulePath];
  delete require.cache[welcomePackStoreModulePath];
  delete require.cache[weaponStatsStoreModulePath];
  delete require.cache[scumStoreModulePath];
}

function loadTenantTopologyModules() {
  clearTenantTopologyModules();
  return {
    prismaModule: require('../src/prisma'),
    memoryStore: require('../src/store/memoryStore'),
    playerAccountStore: require('../src/store/playerAccountStore'),
    rentBikeStore: require('../src/store/rentBikeStore'),
    luckyWheelStore: require('../src/store/luckyWheelStore'),
    cartStore: require('../src/store/cartStore'),
    linkStore: require('../src/store/linkStore'),
    redeemStore: require('../src/store/redeemStore'),
    partyChatStore: require('../src/store/partyChatStore'),
    statsStore: require('../src/store/statsStore'),
    bountyStore: require('../src/store/bountyStore'),
    eventStore: require('../src/store/eventStore'),
    giveawayStore: require('../src/store/giveawayStore'),
    moderationStore: require('../src/store/moderationStore'),
    ticketStore: require('../src/store/ticketStore'),
    topPanelStore: require('../src/store/topPanelStore'),
    vipStore: require('../src/store/vipStore'),
    welcomePackStore: require('../src/store/welcomePackStore'),
    weaponStatsStore: require('../src/store/weaponStatsStore'),
    scumStore: require('../src/store/scumStore'),
  };
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

test('schema-per-tenant topology isolates player-facing stores when PLATFORM_DEFAULT_TENANT_ID is set', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for tenant topology integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const previousDefaultTenantId = process.env.PLATFORM_DEFAULT_TENANT_ID;
  const tenantId = `tenant-player-${Date.now()}`;
  const discordId = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  const steamId = `7656119${String(Date.now()).slice(-10)}${Math.floor(Math.random() * 10)}`;
  const rentDate = '2026-03-17';
  const redeemCode = `TENANT-${Date.now()}`;
  const partyKey = `squad:tenant-${Date.now()}`;
  const bountyTarget = `tenant-target-${Date.now()}`;
  const eventName = `tenant-event-${Date.now()}`;
  const giveawayMessageId = `giveaway-${Date.now()}`;
  const ticketChannelId = `ticket-${Date.now()}`;
  const ticketGuildId = `guild-${Date.now()}`;
  const panelGuildId = `panel-guild-${Date.now()}`;
  const vipExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const weaponName = `TenantWeapon_${Date.now()}`;
  const scumStatusUpdate = {
    onlinePlayers: 21,
    maxPlayers: 80,
    pingMs: 34,
    uptimeMinutes: 123,
  };
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

  const cleanupSharedPrisma = createPrismaClient(process.env.DATABASE_URL);

  t.after(async () => {
    clearTenantTopologyModules();
    delete process.env.TENANT_DB_TOPOLOGY_MODE;
    delete process.env.PLATFORM_DEFAULT_TENANT_ID;
    if (previousMode) process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    if (previousDefaultTenantId) {
      process.env.PLATFORM_DEFAULT_TENANT_ID = previousDefaultTenantId;
    }
    await cleanupSharedPrisma.playerAccount
      .deleteMany({ where: { discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.userWallet
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.dailyRent
      .deleteMany({ where: { userKey: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.luckyWheelState
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.cartEntry
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.link
      .deleteMany({ where: { OR: [{ userId: discordId }, { steamId }] } })
      .catch(() => null);
    await cleanupSharedPrisma.redeemCode
      .deleteMany({ where: { code: redeemCode } })
      .catch(() => null);
    await cleanupSharedPrisma.partyChatMessage
      .deleteMany({ where: { partyKey } })
      .catch(() => null);
    await cleanupSharedPrisma.stats
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.bounty
      .deleteMany({ where: { OR: [{ createdBy: discordId }, { targetName: bountyTarget }] } })
      .catch(() => null);
    await cleanupSharedPrisma.guildEvent
      .deleteMany({ where: { name: eventName } })
      .catch(() => null);
    await cleanupSharedPrisma.giveaway
      .deleteMany({ where: { messageId: giveawayMessageId } })
      .catch(() => null);
    await cleanupSharedPrisma.punishment
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.ticketRecord
      .deleteMany({ where: { channelId: ticketChannelId } })
      .catch(() => null);
    await cleanupSharedPrisma.topPanelMessage
      .deleteMany({ where: { guildId: panelGuildId } })
      .catch(() => null);
    await cleanupSharedPrisma.vipMembership
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.welcomeClaim
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.weaponStat
      .deleteMany({ where: { weapon: weaponName } })
      .catch(() => null);
    await cleanupSharedPrisma.$disconnect().catch(() => {});
    await dropTenantSchema(target).catch(() => null);
  });

  const {
    prismaModule,
    memoryStore,
    playerAccountStore,
    rentBikeStore,
    luckyWheelStore,
    cartStore,
    linkStore,
    redeemStore,
    partyChatStore,
    statsStore,
    bountyStore,
    eventStore,
    giveawayStore,
    moderationStore,
    ticketStore,
    topPanelStore,
    vipStore,
    welcomePackStore,
    weaponStatsStore,
    scumStore,
  } = loadTenantTopologyModules();
  const {
    prisma,
    getTenantScopedPrismaClient,
    disconnectAllPrismaClients,
  } = prismaModule;
  const { addCoins, getWallet } = memoryStore;
  const {
    upsertPlayerAccount,
    listPlayerAccounts,
    getPlayerDashboard,
  } = playerAccountStore;
  const { markDailyRentUsed, getDailyRent } = rentBikeStore;
  const { recordWheelSpin, getUserWheelState } = luckyWheelStore;
  const { addCartItem, listCartItems, flushCartStoreWrites } = cartStore;
  const { setLink, getLinkByUserId, flushLinkStoreWrites } = linkStore;
  const { setCode, getCode, flushRedeemStoreWrites } = redeemStore;
  const { addPartyMessage, listPartyMessages } = partyChatStore;
  const { addKill, getStats, flushStatsStoreWrites } = statsStore;
  const { createBounty, listBounties } = bountyStore;
  const {
    createEvent,
    joinEvent,
    startEvent,
    endEvent,
    listEvents,
    getParticipants,
    flushEventStoreWrites,
  } = eventStore;
  const {
    createGiveaway,
    addEntrant,
    listGiveaways,
    flushGiveawayStoreWrites,
  } = giveawayStore;
  const {
    addPunishment,
    listAllPunishments,
    flushModerationStoreWrites,
  } = moderationStore;
  const {
    createTicket,
    claimTicket,
    closeTicket,
    listTickets,
    flushTicketStoreWrites,
  } = ticketStore;
  const {
    setTopPanelMessage,
    getTopPanelsForGuild,
    flushTopPanelStoreWrites,
  } = topPanelStore;
  const {
    setMembership,
    getMembership,
    flushVipStoreWrites,
  } = vipStore;
  const {
    claim,
    hasClaimed,
    flushWelcomePackStoreWrites,
  } = welcomePackStore;
  const {
    recordWeaponKill,
    listWeaponStats,
    flushWeaponStatsStoreWrites,
  } = weaponStatsStore;
  const {
    updateStatus,
    getStatus,
    flushScumStoreWrites,
  } = scumStore;

  try {
    const upserted = await upsertPlayerAccount({
      discordId,
      username: 'tenant-player',
      displayName: 'Tenant Player',
      isActive: true,
    });
    assert.equal(upserted.ok, true);

    const balance = await addCoins(discordId, 250, {
      reason: 'tenant-topology-proof',
      actor: 'test-suite',
    });
    assert.equal(balance, 250);

    const dashboard = await getPlayerDashboard(discordId);
    assert.equal(dashboard.ok, true);
    assert.equal(Number(dashboard.data?.wallet?.balance || 0), 250);

    const accounts = await listPlayerAccounts(50, { tenantId });
    assert.ok(accounts.some((row) => String(row?.discordId || '') === discordId));

    await markDailyRentUsed(discordId, rentDate);
    const rent = await getDailyRent(discordId, rentDate);
    assert.equal(rent?.used, true);

    const wheelResult = await recordWheelSpin(discordId, {
      id: 'tenant-proof-coins',
      label: 'Tenant Proof Coins',
      type: 'coins',
      amount: 100,
      at: new Date().toISOString(),
    });
    assert.equal(wheelResult.ok, true);
    const wheelState = await getUserWheelState(discordId);
    assert.equal(Number(wheelState?.totalSpins || 0), 1);

    const sharedAccount = await prisma.playerAccount.findUnique({
      where: { discordId },
    });
    const sharedWallet = await prisma.userWallet.findUnique({
      where: { userId: discordId },
    });
    const sharedRent = await prisma.dailyRent.findUnique({
      where: {
        userKey_date: {
          userKey: discordId,
          date: rentDate,
        },
      },
    });
    const sharedWheel = await prisma.luckyWheelState.findUnique({
      where: { userId: discordId },
    });

    assert.equal(sharedAccount, null);
    assert.equal(sharedWallet, null);
    assert.equal(sharedRent, null);
    assert.equal(sharedWheel, null);

    const scopedPrisma = getTenantScopedPrismaClient(tenantId);
    const scopedAccount = await scopedPrisma.playerAccount.findUnique({
      where: { discordId },
    });
    const scopedWallet = await scopedPrisma.userWallet.findUnique({
      where: { userId: discordId },
    });
    const scopedRent = await scopedPrisma.dailyRent.findUnique({
      where: {
        userKey_date: {
          userKey: discordId,
          date: rentDate,
        },
      },
    });
    const scopedWheel = await scopedPrisma.luckyWheelState.findUnique({
      where: { userId: discordId },
    });

    assert.equal(String(scopedAccount?.discordId || ''), discordId);
    assert.equal(Number(scopedWallet?.balance || 0), 250);
    assert.equal(Boolean(scopedRent?.used), true);
    assert.equal(Number(scopedWheel?.totalSpins || 0), 1);

    const scopedWalletView = await getWallet(discordId, { tenantId });
    assert.equal(Number(scopedWalletView?.balance || 0), 250);

    addCartItem(discordId, 'tenant-item', 2, { tenantId });
    await flushCartStoreWrites({ tenantId });
    const cartRows = listCartItems(discordId, { tenantId });
    assert.equal(cartRows.length, 1);
    assert.equal(cartRows[0].itemId, 'tenant-item');
    assert.equal(Number(cartRows[0].quantity || 0), 2);

    const linkResult = setLink({
      steamId,
      userId: discordId,
      inGameName: 'Tenant Hero',
    }, { tenantId });
    assert.equal(linkResult?.ok, true);
    await flushLinkStoreWrites({ tenantId });
    const scopedLink = getLinkByUserId(discordId, { tenantId });
    assert.equal(String(scopedLink?.steamId || ''), steamId);

    const redeemResult = setCode(redeemCode, {
      type: 'coins',
      amount: 50,
    }, { tenantId });
    assert.equal(redeemResult?.ok, true);
    await flushRedeemStoreWrites({ tenantId });
    assert.equal(Number(getCode(redeemCode, { tenantId })?.amount || 0), 50);

    const partyMessage = await addPartyMessage(partyKey, {
      userId: discordId,
      displayName: 'Tenant Player',
      message: 'tenant scoped hello',
    }, { tenantId });
    assert.equal(partyMessage?.ok, true);
    const partyMessages = await listPartyMessages(partyKey, 20, { tenantId });
    assert.equal(partyMessages.length, 1);
    assert.equal(String(partyMessages[0]?.userId || ''), discordId);

    addKill(discordId, 3, { tenantId });
    await flushStatsStoreWrites({ tenantId });
    assert.equal(Number(getStats(discordId, { tenantId })?.kills || 0), 3);

    const bounty = await createBounty({
      targetName: bountyTarget,
      amount: 77,
      createdBy: discordId,
    }, { tenantId });
    assert.equal(Number(bounty?.amount || 0), 77);
    assert.ok(listBounties({ tenantId }).some((row) => row.targetName === bountyTarget));

    const createdEvent = createEvent({
      name: eventName,
      time: '2026-03-17 12:00',
      reward: 'tenant reward',
    }, { tenantId });
    assert.equal(String(createdEvent?.name || ''), eventName);
    const joinedEvent = joinEvent(createdEvent.id, discordId, { tenantId });
    assert.equal(Number(joinedEvent?.participants?.size || 0), 1);
    startEvent(createdEvent.id, { tenantId });
    const endedEvent = endEvent(createdEvent.id, { tenantId });
    assert.equal(String(endedEvent?.status || ''), 'ended');
    await flushEventStoreWrites({ tenantId });
    assert.ok(listEvents({ tenantId }).some((row) => row.name === eventName));
    assert.deepEqual(getParticipants(createdEvent.id, { tenantId }), [discordId]);

    const createdGiveaway = createGiveaway({
      messageId: giveawayMessageId,
      channelId: 'channel-tenant',
      guildId: ticketGuildId,
      prize: 'Tenant Prize',
      winnersCount: 1,
      endsAt: new Date(Date.now() + 60 * 1000),
    }, { tenantId });
    assert.equal(String(createdGiveaway?.messageId || ''), giveawayMessageId);
    addEntrant(giveawayMessageId, discordId, { tenantId });
    await flushGiveawayStoreWrites({ tenantId });
    const tenantGiveaway = listGiveaways({ tenantId }).find((row) => row.messageId === giveawayMessageId);
    assert.equal(Boolean(tenantGiveaway?.entrants?.has(discordId)), true);

    const punishment = addPunishment(
      discordId,
      'warn',
      'tenant moderation proof',
      'test-suite',
      null,
      { tenantId },
    );
    assert.equal(String(punishment?.reason || ''), 'tenant moderation proof');
    await flushModerationStoreWrites({ tenantId });
    assert.ok(
      listAllPunishments({ tenantId }).some(
        (row) => row.userId === discordId && row.entries.some((entry) => entry.reason === 'tenant moderation proof'),
      ),
    );

    const ticket = createTicket({
      guildId: ticketGuildId,
      userId: discordId,
      channelId: ticketChannelId,
      category: 'support',
      reason: 'tenant ticket proof',
    }, { tenantId });
    assert.equal(String(ticket?.channelId || ''), ticketChannelId);
    claimTicket(ticketChannelId, 'staff-tenant', { tenantId });
    closeTicket(ticketChannelId, { tenantId });
    await flushTicketStoreWrites({ tenantId });
    const scopedTicket = listTickets({ tenantId }).find((row) => row.channelId === ticketChannelId);
    assert.equal(String(scopedTicket?.status || ''), 'closed');

    const scopedMembership = setMembership(discordId, 'vip-7d', vipExpiresAt, { tenantId });
    assert.equal(String(scopedMembership?.planId || ''), 'vip-7d');
    await flushVipStoreWrites({ tenantId });
    assert.equal(String(getMembership(discordId, { tenantId })?.planId || ''), 'vip-7d');

    const welcomeClaimed = claim(discordId, { tenantId });
    assert.equal(welcomeClaimed, true);
    await flushWelcomePackStoreWrites({ tenantId });
    assert.equal(hasClaimed(discordId, { tenantId }), true);

    const weaponStat = recordWeaponKill({
      weapon: weaponName,
      distance: 245,
      killer: 'Tenant Shooter',
    }, { tenantId });
    assert.equal(Number(weaponStat?.kills || 0), 1);
    await flushWeaponStatsStoreWrites({ tenantId });
    assert.ok(listWeaponStats({ tenantId }).some((row) => row.weapon === weaponName));

    const sharedStatusBefore = await prisma.scumStatus.findUnique({ where: { id: 1 } });
    updateStatus(scumStatusUpdate, { tenantId });
    await flushScumStoreWrites({ tenantId });
    const statusSnapshot = getStatus({ tenantId });
    assert.equal(Number(statusSnapshot.onlinePlayers || 0), scumStatusUpdate.onlinePlayers);
    assert.equal(Number(statusSnapshot.maxPlayers || 0), scumStatusUpdate.maxPlayers);
    assert.equal(Number(statusSnapshot.pingMs || 0), scumStatusUpdate.pingMs);
    assert.equal(Number(statusSnapshot.uptimeMinutes || 0), scumStatusUpdate.uptimeMinutes);

    const savedPanel = setTopPanelMessage(
      panelGuildId,
      'topKiller',
      'channel-panel',
      'message-panel',
      { tenantId },
    );
    assert.equal(String(savedPanel?.messageId || ''), 'message-panel');
    await flushTopPanelStoreWrites({ tenantId });
    assert.equal(
      String(getTopPanelsForGuild(panelGuildId, { tenantId })?.topKiller?.messageId || ''),
      'message-panel',
    );

    const sharedCartRows = await prisma.cartEntry.findMany({
      where: { userId: discordId },
    });
    const sharedLinks = await prisma.link.findMany({
      where: { OR: [{ userId: discordId }, { steamId }] },
    });
    const sharedRedeem = await prisma.redeemCode.findUnique({
      where: { code: redeemCode },
    });
    const sharedPartyRows = await prisma.partyChatMessage.findMany({
      where: { partyKey },
    });
    const sharedStats = await prisma.stats.findUnique({
      where: { userId: discordId },
    });
    const sharedBounties = await prisma.bounty.findMany({
      where: { OR: [{ createdBy: discordId }, { targetName: bountyTarget }] },
    });
    const sharedEvents = await prisma.guildEvent.findMany({
      where: { name: eventName },
    });
    const sharedGiveaways = await prisma.giveaway.findMany({
      where: { messageId: giveawayMessageId },
    });
    const sharedPunishments = await prisma.punishment.findMany({
      where: { userId: discordId },
    });
    const sharedTickets = await prisma.ticketRecord.findMany({
      where: { channelId: ticketChannelId },
    });
    const sharedVip = await prisma.vipMembership.findUnique({
      where: { userId: discordId },
    });
    const sharedWelcome = await prisma.welcomeClaim.findUnique({
      where: { userId: discordId },
    });
    const sharedWeaponStats = await prisma.weaponStat.findMany({
      where: { weapon: weaponName },
    });
    const sharedStatusAfter = await prisma.scumStatus.findUnique({ where: { id: 1 } });
    const sharedPanels = await prisma.topPanelMessage.findMany({
      where: { guildId: panelGuildId },
    });

    assert.equal(sharedCartRows.length, 0);
    assert.equal(sharedLinks.length, 0);
    assert.equal(sharedRedeem, null);
    assert.equal(sharedPartyRows.length, 0);
    assert.equal(sharedStats, null);
    assert.equal(sharedBounties.length, 0);
    assert.equal(sharedEvents.length, 0);
    assert.equal(sharedGiveaways.length, 0);
    assert.equal(sharedPunishments.length, 0);
    assert.equal(sharedTickets.length, 0);
    assert.equal(sharedVip, null);
    assert.equal(sharedWelcome, null);
    assert.equal(sharedWeaponStats.length, 0);
    assert.deepEqual(sharedStatusAfter, sharedStatusBefore);
    assert.equal(sharedPanels.length, 0);

    const scopedCartRows = await scopedPrisma.cartEntry.findMany({
      where: { userId: discordId },
    });
    const scopedLinkRow = await scopedPrisma.link.findUnique({
      where: { steamId },
    });
    const scopedRedeem = await scopedPrisma.redeemCode.findUnique({
      where: { code: redeemCode },
    });
    const scopedPartyRows = await scopedPrisma.partyChatMessage.findMany({
      where: { partyKey },
    });
    const scopedStats = await scopedPrisma.stats.findUnique({
      where: { userId: discordId },
    });
    const scopedBounties = await scopedPrisma.bounty.findMany({
      where: { OR: [{ createdBy: discordId }, { targetName: bountyTarget }] },
    });
    const scopedEvents = await scopedPrisma.guildEvent.findMany({
      where: { name: eventName },
      include: { participants: true },
    });
    const scopedGiveaways = await scopedPrisma.giveaway.findMany({
      where: { messageId: giveawayMessageId },
      include: { entrants: true },
    });
    const scopedPunishments = await scopedPrisma.punishment.findMany({
      where: { userId: discordId },
    });
    const scopedTickets = await scopedPrisma.ticketRecord.findMany({
      where: { channelId: ticketChannelId },
    });
    const scopedVip = await scopedPrisma.vipMembership.findUnique({
      where: { userId: discordId },
    });
    const scopedWelcome = await scopedPrisma.welcomeClaim.findUnique({
      where: { userId: discordId },
    });
    const scopedWeaponStats = await scopedPrisma.weaponStat.findMany({
      where: { weapon: weaponName },
    });
    const scopedStatus = await scopedPrisma.scumStatus.findUnique({ where: { id: 1 } });
    const scopedPanels = await scopedPrisma.topPanelMessage.findMany({
      where: { guildId: panelGuildId },
    });

    assert.equal(scopedCartRows.length, 1);
    assert.equal(String(scopedCartRows[0]?.itemId || ''), 'tenant-item');
    assert.equal(String(scopedLinkRow?.userId || ''), discordId);
    assert.equal(Number(scopedRedeem?.amount || 0), 50);
    assert.equal(scopedPartyRows.length, 1);
    assert.equal(Number(scopedStats?.kills || 0), 3);
    assert.equal(scopedBounties.length, 1);
    assert.equal(String(scopedBounties[0]?.targetName || ''), bountyTarget);
    assert.equal(scopedEvents.length, 1);
    assert.equal(scopedEvents[0].participants.length, 1);
    assert.equal(scopedGiveaways.length, 1);
    assert.equal(scopedGiveaways[0].entrants.length, 1);
    assert.equal(scopedPunishments.length, 1);
    assert.equal(scopedTickets.length, 1);
    assert.equal(String(scopedTickets[0]?.status || ''), 'closed');
    assert.equal(String(scopedVip?.planId || ''), 'vip-7d');
    assert.equal(String(scopedWelcome?.userId || ''), discordId);
    assert.equal(scopedWeaponStats.length, 1);
    assert.equal(Number(scopedStatus?.onlinePlayers || 0), scumStatusUpdate.onlinePlayers);
    assert.equal(scopedPanels.length, 1);
  } finally {
    await disconnectAllPrismaClients().catch(() => {});
  }
});
