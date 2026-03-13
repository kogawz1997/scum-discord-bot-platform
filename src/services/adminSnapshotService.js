const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const config = require('../config');
const { prisma } = require('../prisma');
const { listShopItems } = require('../store/memoryStore');
const {
  tickets,
  replaceTickets,
} = require('../store/ticketStore');
const { listAllStats, replaceStats } = require('../store/statsStore');
const { listWeaponStats, replaceWeaponStats } = require('../store/weaponStatsStore');
const { listBounties, replaceBounties } = require('../store/bountyStore');
const { listEvents, getParticipants, replaceEvents } = require('../store/eventStore');
const { giveaways, replaceGiveaways } = require('../store/giveawayStore');
const { listLinks, replaceLinks } = require('../store/linkStore');
const { getStatus, replaceStatus } = require('../store/scumStore');
const { listMemberships, replaceMemberships } = require('../store/vipStore');
const { listAllPunishments, replacePunishments } = require('../store/moderationStore');
const { listCodes, replaceCodes } = require('../store/redeemStore');
const { listClaimed, replaceClaims } = require('../store/welcomePackStore');
const {
  listDailyRents,
  listRentalVehicles,
  replaceRentBikeData,
} = require('../store/rentBikeStore');
const {
  listLuckyWheelStates,
  replaceLuckyWheelStates,
} = require('../store/luckyWheelStore');
const {
  listAllPartyMessages,
  replacePartyMessages,
} = require('../store/partyChatStore');
const { listTopPanels, replaceTopPanels } = require('../store/topPanelStore');
const { listAllCarts, replaceCarts } = require('../store/cartStore');
const { getRentBikeRuntime } = require('./rentBikeService');
const {
  listDeliveryQueue,
  listDeliveryDeadLetters,
  listDeliveryAudit,
  getDeliveryRuntimeStatus,
  replaceDeliveryQueue,
  replaceDeliveryDeadLetters,
} = require('./rconDelivery');
const { replaceDeliveryAudit } = require('../store/deliveryAuditStore');
const { resolveItemIconUrl } = require('./itemIconService');
const { DATA_DIR, getPersistenceStatus } = require('../store/_persist');

const BACKUP_DIR = path.resolve(
  String(process.env.ADMIN_WEB_BACKUP_DIR || path.join(DATA_DIR, 'backups')).trim()
    || path.join(DATA_DIR, 'backups'),
);

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeWallet(wallet) {
  return {
    ...wallet,
    lastDaily: wallet.lastDaily == null ? null : Number(wallet.lastDaily),
    lastWeekly: wallet.lastWeekly == null ? null : Number(wallet.lastWeekly),
  };
}

function normalizeTickets() {
  return Array.from(tickets.values())
    .map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt ? new Date(ticket.createdAt) : null,
      closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
    }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function normalizeEvents() {
  return listEvents().map((eventRow) => {
    const participants = getParticipants(eventRow.id);
    return {
      ...eventRow,
      participants,
      participantsCount: participants.length,
    };
  });
}

function normalizeGiveaways() {
  return Array.from(giveaways.values()).map((giveaway) => {
    const entrants = Array.from(giveaway.entrants || []);
    return {
      ...giveaway,
      entrants,
      entrantsCount: entrants.length,
    };
  });
}

function normalizeConfig() {
  if (typeof config.getConfigSnapshot === 'function') {
    return config.getConfigSnapshot();
  }
  return {
    economy: config.economy,
    channels: config.channels,
    roles: config.roles,
    restartSchedule: config.restartSchedule,
    raidTimes: config.raidTimes,
    vipPlans: config.vip?.plans || [],
    killFeed: config.killFeed || {},
  };
}

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function makeBackupId() {
  const datePart = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const randPart = crypto.randomBytes(3).toString('hex');
  return `backup-${datePart}-${randPart}`;
}

function sanitizeBackupName(input) {
  const value = String(input || '').trim();
  if (!value) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) return null;
  if (value.includes('..')) return null;
  return value;
}

function listAdminBackupFiles() {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const absolute = path.join(BACKUP_DIR, entry.name);
      const stat = fs.statSync(absolute);
      return {
        id: entry.name.replace(/\.json$/i, ''),
        file: entry.name,
        sizeBytes: stat.size,
        createdAt: stat.birthtime?.toISOString?.() || stat.ctime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function saveBackupPayload(payload, backupId = null) {
  ensureBackupDir();
  const id = backupId || makeBackupId();
  const file = `${id}.json`;
  const absolute = path.join(BACKUP_DIR, file);
  fs.writeFileSync(absolute, JSON.stringify(payload, jsonReplacer, 2), 'utf8');
  const stat = fs.statSync(absolute);
  return {
    id,
    file,
    absolutePath: absolute,
    sizeBytes: stat.size,
    createdAt: stat.birthtime?.toISOString?.() || stat.ctime.toISOString(),
  };
}

function readBackupPayloadByName(inputName) {
  const safeName = sanitizeBackupName(inputName);
  if (!safeName) {
    throw new Error('Invalid backup name');
  }
  const file = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
  const absolute = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(absolute)) {
    throw new Error('Backup file not found');
  }
  const raw = fs.readFileSync(absolute, 'utf8');
  return {
    file,
    absolutePath: absolute,
    payload: JSON.parse(raw),
  };
}

async function replacePrismaTablesFromSnapshot(snapshot = {}) {
  const wallets = Array.isArray(snapshot.wallets) ? snapshot.wallets : [];
  const shopItems = Array.isArray(snapshot.shopItems) ? snapshot.shopItems : [];
  const purchases = Array.isArray(snapshot.purchases) ? snapshot.purchases : [];
  const walletLedgers = Array.isArray(snapshot.walletLedgers)
    ? snapshot.walletLedgers
    : [];
  const purchaseStatusHistory = Array.isArray(snapshot.purchaseStatusHistory)
    ? snapshot.purchaseStatusHistory
    : [];
  const playerAccounts = Array.isArray(snapshot.playerAccounts)
    ? snapshot.playerAccounts
    : [];

  await prisma.$transaction([
    prisma.walletLedger.deleteMany({}),
    prisma.purchaseStatusHistory.deleteMany({}),
    prisma.playerAccount.deleteMany({}),
    prisma.userWallet.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.shopItem.deleteMany({}),
  ]);

  for (const row of wallets) {
    if (!row || typeof row !== 'object') continue;
    const userId = String(row.userId || '').trim();
    if (!userId) continue;
    await prisma.userWallet.create({
      data: {
        userId,
        balance: Number(row.balance || 0),
        lastDaily:
          row.lastDaily == null || row.lastDaily === ''
            ? null
            : BigInt(Math.trunc(Number(row.lastDaily))),
        lastWeekly:
          row.lastWeekly == null || row.lastWeekly === ''
            ? null
            : BigInt(Math.trunc(Number(row.lastWeekly))),
      },
    });
  }

  for (const row of shopItems) {
    if (!row || typeof row !== 'object') continue;
    const id = String(row.id || '').trim();
    if (!id) continue;
    const deliveryItems = Array.isArray(row.deliveryItems)
      ? row.deliveryItems
          .map((entry) => ({
            gameItemId: String(entry?.gameItemId || '').trim(),
            quantity: Math.max(1, Number(entry?.quantity || 1)),
            iconUrl: entry?.iconUrl ? String(entry.iconUrl) : null,
          }))
          .filter((entry) => entry.gameItemId)
      : [];
    const primary = deliveryItems[0] || null;
    const kind = String(row.kind || 'item').toLowerCase() === 'vip' ? 'vip' : 'item';
    await prisma.shopItem.create({
      data: {
        id,
        name: String(row.name || id),
        price: Number(row.price || 0),
        description: String(row.description || ''),
        kind,
        gameItemId: kind === 'item'
          ? String(primary?.gameItemId || row.gameItemId || '').trim() || null
          : null,
        quantity: kind === 'item'
          ? Math.max(1, Number(primary?.quantity || row.quantity || 1))
          : 1,
        iconUrl: kind === 'item'
          ? (primary?.iconUrl || (row.iconUrl ? String(row.iconUrl) : null))
          : null,
        deliveryItemsJson:
          kind === 'item' && deliveryItems.length > 0
            ? JSON.stringify(deliveryItems)
            : null,
      },
    });
  }

  for (const row of purchases) {
    if (!row || typeof row !== 'object') continue;
    const code = String(row.code || '').trim();
    const userId = String(row.userId || '').trim();
    const itemId = String(row.itemId || '').trim();
    if (!code || !userId || !itemId) continue;
    await prisma.purchase.create({
      data: {
        code,
        userId,
        itemId,
        price: Number(row.price || 0),
        status: String(row.status || 'pending'),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        statusUpdatedAt: row.statusUpdatedAt
          ? new Date(row.statusUpdatedAt)
          : row.createdAt
            ? new Date(row.createdAt)
            : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      },
    });
  }

  for (const row of walletLedgers) {
    if (!row || typeof row !== 'object') continue;
    const userId = String(row.userId || '').trim();
    if (!userId) continue;
    await prisma.walletLedger.create({
      data: {
        userId,
        delta: Number(row.delta || 0),
        balanceBefore: Number(row.balanceBefore || 0),
        balanceAfter: Number(row.balanceAfter || 0),
        reason: String(row.reason || 'restore'),
        reference: row.reference ? String(row.reference) : null,
        actor: row.actor ? String(row.actor) : null,
        metaJson: row.metaJson ? String(row.metaJson) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      },
    });
  }

  for (const row of purchaseStatusHistory) {
    if (!row || typeof row !== 'object') continue;
    const purchaseCode = String(row.purchaseCode || '').trim();
    if (!purchaseCode) continue;
    await prisma.purchaseStatusHistory.create({
      data: {
        purchaseCode,
        fromStatus: row.fromStatus ? String(row.fromStatus) : null,
        toStatus: String(row.toStatus || 'pending'),
        reason: row.reason ? String(row.reason) : null,
        actor: row.actor ? String(row.actor) : null,
        metaJson: row.metaJson ? String(row.metaJson) : null,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      },
    });
  }

  for (const row of playerAccounts) {
    if (!row || typeof row !== 'object') continue;
    const discordId = String(row.discordId || '').trim();
    if (!discordId) continue;
    await prisma.playerAccount.create({
      data: {
        discordId,
        username: row.username ? String(row.username) : null,
        displayName: row.displayName ? String(row.displayName) : null,
        avatarUrl: row.avatarUrl ? String(row.avatarUrl) : null,
        steamId: row.steamId ? String(row.steamId) : null,
        isActive: row.isActive !== false,
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      },
    });
  }
}

async function restoreAdminSnapshotData(snapshot = {}) {
  await replacePrismaTablesFromSnapshot(snapshot);

  replaceTickets(
    Array.isArray(snapshot.tickets) ? snapshot.tickets : [],
    Number(snapshot.ticketCounter || 0) || null,
  );
  replaceBounties(Array.isArray(snapshot.bounties) ? snapshot.bounties : []);
  replaceEvents(
    Array.isArray(snapshot.events) ? snapshot.events : [],
    Array.isArray(snapshot.events)
      ? snapshot.events.map((eventRow) => ({
          eventId: eventRow?.id,
          participants: Array.isArray(eventRow?.participants)
            ? eventRow.participants
            : [],
        }))
      : [],
    Number(snapshot.eventCounter || 0) || null,
  );
  replaceLinks(Array.isArray(snapshot.links) ? snapshot.links : []);
  replaceMemberships(Array.isArray(snapshot.memberships) ? snapshot.memberships : []);
  replaceWeaponStats(Array.isArray(snapshot.weaponStats) ? snapshot.weaponStats : []);
  replaceStats(Array.isArray(snapshot.stats) ? snapshot.stats : []);
  replaceGiveaways(Array.isArray(snapshot.giveaways) ? snapshot.giveaways : []);
  replacePunishments(Array.isArray(snapshot.punishments) ? snapshot.punishments : []);
  replaceCodes(Array.isArray(snapshot.redeemCodes) ? snapshot.redeemCodes : []);
  replaceClaims(Array.isArray(snapshot.welcomeClaims) ? snapshot.welcomeClaims : []);
  replaceTopPanels(Array.isArray(snapshot.topPanels) ? snapshot.topPanels : []);
  replaceCarts(Array.isArray(snapshot.carts) ? snapshot.carts : []);
  replaceStatus(snapshot.status || {});
  replaceDeliveryAudit(Array.isArray(snapshot.deliveryAudit) ? snapshot.deliveryAudit : []);
  replaceDeliveryQueue(Array.isArray(snapshot.deliveryQueue) ? snapshot.deliveryQueue : []);
  replaceDeliveryDeadLetters(
    Array.isArray(snapshot.deliveryDeadLetters) ? snapshot.deliveryDeadLetters : [],
  );
  await replaceRentBikeData(
    Array.isArray(snapshot.dailyRents) ? snapshot.dailyRents : [],
    Array.isArray(snapshot.rentalVehicles) ? snapshot.rentalVehicles : [],
  );
  await replaceLuckyWheelStates(
    Array.isArray(snapshot.luckyWheelStates) ? snapshot.luckyWheelStates : [],
  );
  await replacePartyMessages(
    Array.isArray(snapshot.partyChatMessages) ? snapshot.partyChatMessages : [],
  );

  if (snapshot.config && typeof config.setFullConfig === 'function') {
    config.setFullConfig(snapshot.config);
  }
}

function buildRestoreCounts(snapshot = {}) {
  return {
    wallets: Array.isArray(snapshot.wallets) ? snapshot.wallets.length : 0,
    walletLedgers: Array.isArray(snapshot.walletLedgers)
      ? snapshot.walletLedgers.length
      : 0,
    shopItems: Array.isArray(snapshot.shopItems) ? snapshot.shopItems.length : 0,
    purchases: Array.isArray(snapshot.purchases) ? snapshot.purchases.length : 0,
    purchaseStatusHistory: Array.isArray(snapshot.purchaseStatusHistory)
      ? snapshot.purchaseStatusHistory.length
      : 0,
    playerAccounts: Array.isArray(snapshot.playerAccounts)
      ? snapshot.playerAccounts.length
      : 0,
    tickets: Array.isArray(snapshot.tickets) ? snapshot.tickets.length : 0,
    bounties: Array.isArray(snapshot.bounties) ? snapshot.bounties.length : 0,
    events: Array.isArray(snapshot.events) ? snapshot.events.length : 0,
    carts: Array.isArray(snapshot.carts) ? snapshot.carts.length : 0,
    luckyWheelStates: Array.isArray(snapshot.luckyWheelStates)
      ? snapshot.luckyWheelStates.length
      : 0,
    partyChatMessages: Array.isArray(snapshot.partyChatMessages)
      ? snapshot.partyChatMessages.length
      : 0,
  };
}

async function buildAdminSnapshot({ client = null, observabilitySnapshot = null } = {}) {
  const [
    shopItems,
    wallets,
    purchases,
    walletLedgers,
    purchaseStatusHistory,
    playerAccounts,
    dailyRents,
    rentalVehicles,
    luckyWheelStates,
    partyChatMessages,
    deliveryRuntime,
  ] = await Promise.all([
    listShopItems(),
    prisma.userWallet.findMany({
      orderBy: { balance: 'desc' },
      take: 500,
    }),
    prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.walletLedger.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.purchaseStatusHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.playerAccount.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 1000,
    }),
    listDailyRents(1000),
    listRentalVehicles(1000),
    listLuckyWheelStates(2000),
    listAllPartyMessages(5000),
    getDeliveryRuntimeStatus().catch(() => null),
  ]);

  const shopItemsWithIcon = shopItems.map((item) => ({
    ...item,
    resolvedIconUrl: resolveItemIconUrl(item),
  }));

  const guildCache = client?.guilds?.cache;
  const guilds = guildCache
    ? Array.from(guildCache.values()).map((guild) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        channelsCount: guild.channels?.cache?.size || 0,
        rolesCount: guild.roles?.cache?.size || 0,
      }))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    guilds,
    status: getStatus(),
    persistence: getPersistenceStatus(),
    wallets: wallets.map(normalizeWallet),
    walletLedgers,
    shopItems: shopItemsWithIcon,
    purchases,
    purchaseStatusHistory,
    playerAccounts,
    tickets: normalizeTickets(),
    bounties: listBounties(),
    events: normalizeEvents(),
    links: listLinks(),
    memberships: listMemberships(),
    weaponStats: listWeaponStats(),
    stats: listAllStats(),
    giveaways: normalizeGiveaways(),
    punishments: listAllPunishments(),
    redeemCodes: listCodes(),
    welcomeClaims: listClaimed(),
    dailyRents,
    rentalVehicles,
    luckyWheelStates,
    partyChatMessages,
    rentBikeRuntime: getRentBikeRuntime(),
    deliveryRuntime,
    deliveryQueue: listDeliveryQueue(500),
    deliveryDeadLetters: listDeliveryDeadLetters(1000),
    deliveryAudit: listDeliveryAudit(1000),
    observability: observabilitySnapshot || {},
    backups: listAdminBackupFiles().slice(0, 50),
    topPanels: listTopPanels(),
    carts: listAllCarts(),
    config: normalizeConfig(),
  };
}

async function createAdminBackup({
  client = null,
  actor = 'unknown',
  role = 'unknown',
  note = null,
  includeSnapshot = true,
  observabilitySnapshot = null,
} = {}) {
  const snapshot = includeSnapshot
    ? await buildAdminSnapshot({ client, observabilitySnapshot })
    : {};
  const payload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    createdBy: actor,
    role,
    note,
    snapshot,
  };
  const saved = saveBackupPayload(payload);
  return {
    ...saved,
    note,
  };
}

function previewAdminBackupRestore(backupName) {
  const loaded = readBackupPayloadByName(backupName);
  const snapshot = loaded?.payload?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Backup payload is invalid');
  }
  return {
    dryRun: true,
    backup: loaded.file,
    counts: buildRestoreCounts(snapshot),
  };
}

async function restoreAdminBackup(backupName) {
  const loaded = readBackupPayloadByName(backupName);
  const snapshot = loaded?.payload?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Backup payload is invalid');
  }
  await restoreAdminSnapshotData(snapshot);
  return {
    restored: true,
    backup: loaded.file,
  };
}

module.exports = {
  buildAdminSnapshot,
  createAdminBackup,
  jsonReplacer,
  listAdminBackupFiles,
  previewAdminBackupRestore,
  restoreAdminBackup,
  restoreAdminSnapshotData,
};
