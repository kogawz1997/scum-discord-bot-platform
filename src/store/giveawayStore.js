const { prisma } = require('../prisma');

const { getDefaultTenantScopedPrismaClient } = require('../prisma');

const giveaways = new Map(); // messageId -> { prize, winnersCount, endsAt, channelId, guildId, entrants: Set<userId> }

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;
let isHydrating = false;

function getGiveawayDb() {
  if (!prisma) {
    return getDefaultTenantScopedPrismaClient();
  }
  return getDefaultTenantScopedPrismaClient();
}

function normalizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeGiveaway(row = {}) {
  const messageId = String(row.messageId || '').trim();
  if (!messageId) return null;
  const endsAt = normalizeDate(row.endsAt);
  if (!endsAt) return null;
  return {
    messageId,
    channelId: String(row.channelId || '').trim(),
    guildId: String(row.guildId || '').trim(),
    prize: String(row.prize || '').trim(),
    winnersCount: Math.max(1, Math.trunc(Number(row.winnersCount || 1))),
    endsAt,
    entrants: new Set(
      Array.isArray(row.entrants)
        ? row.entrants.map((v) => String(v || '').trim()).filter(Boolean)
        : [],
    ),
  };
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      if (initPromise && !isHydrating) {
        await initPromise;
      }
      await work();
    })
    .catch((error) => {
      console.error(`[giveawayStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  isHydrating = true;
  try {
    const rows = await getGiveawayDb().giveaway.findMany({
      include: {
        entrants: true,
      },
      orderBy: { endsAt: 'asc' },
    });

    if (rows.length === 0) {
      if (giveaways.size > 0) {
        await queueDbWrite(
          async () => {
            for (const g of giveaways.values()) {
              await getGiveawayDb().giveaway.upsert({
                where: { messageId: g.messageId },
                update: {
                  channelId: g.channelId,
                  guildId: g.guildId,
                  prize: g.prize,
                  winnersCount: g.winnersCount,
                  endsAt: g.endsAt,
                },
                create: {
                  messageId: g.messageId,
                  channelId: g.channelId,
                  guildId: g.guildId,
                  prize: g.prize,
                  winnersCount: g.winnersCount,
                  endsAt: g.endsAt,
                },
              });
              for (const userId of g.entrants) {
                await getGiveawayDb().giveawayEntrant.upsert({
                  where: {
                    messageId_userId: {
                      messageId: g.messageId,
                      userId,
                    },
                  },
                  update: {},
                  create: {
                    messageId: g.messageId,
                    userId,
                  },
                });
              }
            }
          },
          'backfill',
        );
      }
      return;
    }

    const hydrated = new Map();
    for (const row of rows) {
      const parsed = normalizeGiveaway({
        ...row,
        entrants: (row.entrants || []).map((entry) => entry.userId),
      });
      if (!parsed) continue;
      hydrated.set(parsed.messageId, parsed);
    }

    if (startVersion === mutationVersion) {
      giveaways.clear();
      for (const [messageId, value] of hydrated.entries()) {
        giveaways.set(messageId, value);
      }
      return;
    }

    for (const [messageId, value] of hydrated.entries()) {
      if (!giveaways.has(messageId)) {
        giveaways.set(messageId, value);
      }
    }
  } catch (error) {
    console.error('[giveawayStore] failed to hydrate from prisma:', error.message);
  } finally {
    isHydrating = false;
  }
}

function initGiveawayStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

function flushGiveawayStoreWrites() {
  return dbWriteQueue;
}

function createGiveaway({ messageId, channelId, guildId, prize, winnersCount, endsAt }) {
  const g = normalizeGiveaway({
    messageId,
    channelId,
    guildId,
    prize,
    winnersCount,
    endsAt,
    entrants: [],
  });
  if (!g) return null;

  giveaways.set(g.messageId, g);
  mutationVersion += 1;

  queueDbWrite(
    async () => {
      await getGiveawayDb().giveaway.upsert({
        where: { messageId: g.messageId },
        update: {
          channelId: g.channelId,
          guildId: g.guildId,
          prize: g.prize,
          winnersCount: g.winnersCount,
          endsAt: g.endsAt,
        },
        create: {
          messageId: g.messageId,
          channelId: g.channelId,
          guildId: g.guildId,
          prize: g.prize,
          winnersCount: g.winnersCount,
          endsAt: g.endsAt,
        },
      });
    },
    'create-giveaway',
  );
  return g;
}

function getGiveaway(messageId) {
  return giveaways.get(messageId) || null;
}

function addEntrant(messageId, userId) {
  const g = giveaways.get(messageId);
  if (!g) return null;
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return null;
  g.entrants.add(normalizedUserId);
  mutationVersion += 1;

  queueDbWrite(
    async () => {
      await getGiveawayDb().giveawayEntrant.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId: normalizedUserId,
          },
        },
        update: {},
        create: {
          messageId,
          userId: normalizedUserId,
        },
      });
    },
    'add-entrant',
  );
  return g;
}

function removeGiveaway(messageId) {
  const removed = giveaways.delete(messageId);
  mutationVersion += 1;
  queueDbWrite(
    async () => {
      await getGiveawayDb().giveaway.deleteMany({
        where: { messageId },
      });
    },
    'remove-giveaway',
  );
  return removed;
}

function replaceGiveaways(nextGiveaways = []) {
  mutationVersion += 1;
  giveaways.clear();
  for (const row of Array.isArray(nextGiveaways) ? nextGiveaways : []) {
    const parsed = normalizeGiveaway(row);
    if (!parsed) continue;
    giveaways.set(parsed.messageId, parsed);
  }

  queueDbWrite(
    async () => {
      await getGiveawayDb().giveawayEntrant.deleteMany({});
      await getGiveawayDb().giveaway.deleteMany({});
      for (const g of giveaways.values()) {
        await getGiveawayDb().giveaway.create({
          data: {
            messageId: g.messageId,
            channelId: g.channelId,
            guildId: g.guildId,
            prize: g.prize,
            winnersCount: g.winnersCount,
            endsAt: g.endsAt,
          },
        });
      }
      for (const g of giveaways.values()) {
        for (const userId of g.entrants) {
          await getGiveawayDb().giveawayEntrant.create({
            data: {
              messageId: g.messageId,
              userId,
            },
          });
        }
      }
    },
    'replace-giveaways',
  );
  return giveaways.size;
}

initGiveawayStore();

module.exports = {
  giveaways,
  createGiveaway,
  getGiveaway,
  addEntrant,
  removeGiveaway,
  replaceGiveaways,
  initGiveawayStore,
  flushGiveawayStoreWrites,
};
