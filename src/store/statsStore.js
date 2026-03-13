const { prisma } = require('../prisma');

const stats = new Map(); // userId -> stat

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;

function normalizeStatRow(row) {
  const userId = String(row?.userId || '').trim();
  if (!userId) return null;

  return {
    userId,
    kills: Number(row?.kills || 0),
    deaths: Number(row?.deaths || 0),
    playtimeMinutes: Number(row?.playtimeMinutes || 0),
    squad: row?.squad ? String(row.squad) : null,
  };
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[statsStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  try {
    const rows = await prisma.stats.findMany();

    if (rows.length === 0) {
      if (stats.size > 0) {
        await queueDbWrite(
          async () => {
            for (const [userId, value] of stats.entries()) {
              await prisma.stats.upsert({
                where: { userId },
                update: {
                  kills: value.kills,
                  deaths: value.deaths,
                  playtimeMinutes: value.playtimeMinutes,
                  squad: value.squad || null,
                },
                create: {
                  userId,
                  kills: value.kills,
                  deaths: value.deaths,
                  playtimeMinutes: value.playtimeMinutes,
                  squad: value.squad || null,
                },
              });
            }
          },
          'backfill',
        );
      }
      return;
    }

    const hydrated = new Map();
    for (const raw of rows) {
      const row = normalizeStatRow(raw);
      if (!row) continue;
      hydrated.set(row.userId, {
        kills: row.kills,
        deaths: row.deaths,
        playtimeMinutes: row.playtimeMinutes,
        squad: row.squad,
      });
    }

    if (startVersion === mutationVersion) {
      stats.clear();
      for (const [userId, value] of hydrated.entries()) {
        stats.set(userId, value);
      }
      return;
    }

    // There were local updates during hydration; merge missing users only.
    for (const [userId, value] of hydrated.entries()) {
      if (stats.has(userId)) continue;
      stats.set(userId, value);
    }
  } catch (error) {
    console.error('[statsStore] failed to hydrate from prisma:', error.message);
  }
}

function initStatsStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

function flushStatsStoreWrites() {
  return dbWriteQueue;
}

function queueUpsertStat(userId, value, label) {
  if (!String(userId || '').trim()) return;
  queueDbWrite(
    async () => {
      await prisma.stats.upsert({
        where: { userId },
        update: {
          kills: value.kills,
          deaths: value.deaths,
          playtimeMinutes: value.playtimeMinutes,
          squad: value.squad || null,
        },
        create: {
          userId,
          kills: value.kills,
          deaths: value.deaths,
          playtimeMinutes: value.playtimeMinutes,
          squad: value.squad || null,
        },
      });
    },
    label,
  );
}

function getOrCreateStats(userIdRaw) {
  const userId = String(userIdRaw || '').trim();
  if (!userId) {
    return {
      kills: 0,
      deaths: 0,
      playtimeMinutes: 0,
      squad: null,
    };
  }

  let value = stats.get(userId);
  if (!value) {
    mutationVersion += 1;
    value = {
      kills: 0,
      deaths: 0,
      playtimeMinutes: 0,
      squad: null,
    };
    stats.set(userId, value);
    queueUpsertStat(userId, value, 'create-default');
  }
  return value;
}

function getStats(userId) {
  return getOrCreateStats(userId);
}

function listAllStats() {
  return Array.from(stats.entries()).map(([userId, value]) => ({
    userId,
    ...value,
  }));
}

function addKill(userId, amount = 1) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId);
  const value = getOrCreateStats(normalizedUserId);
  const add = Number(amount || 0);

  mutationVersion += 1;
  value.kills += add;
  queueUpsertStat(normalizedUserId, value, 'add-kill');
  return value;
}

function addDeath(userId, amount = 1) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId);
  const value = getOrCreateStats(normalizedUserId);
  const add = Number(amount || 0);

  mutationVersion += 1;
  value.deaths += add;
  queueUpsertStat(normalizedUserId, value, 'add-death');
  return value;
}

function addPlaytimeMinutes(userId, minutes) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId);
  const value = getOrCreateStats(normalizedUserId);
  const add = Math.max(0, Number(minutes || 0));

  mutationVersion += 1;
  value.playtimeMinutes += add;
  queueUpsertStat(normalizedUserId, value, 'add-playtime');
  return value;
}

function replaceStats(nextStats = []) {
  mutationVersion += 1;
  stats.clear();

  for (const rowRaw of Array.isArray(nextStats) ? nextStats : []) {
    const row = normalizeStatRow(rowRaw);
    if (!row) continue;
    stats.set(row.userId, {
      kills: row.kills,
      deaths: row.deaths,
      playtimeMinutes: row.playtimeMinutes,
      squad: row.squad,
    });
  }

  queueDbWrite(
    async () => {
      await prisma.stats.deleteMany();
      for (const [userId, value] of stats.entries()) {
        await prisma.stats.create({
          data: {
            userId,
            kills: value.kills,
            deaths: value.deaths,
            playtimeMinutes: value.playtimeMinutes,
            squad: value.squad || null,
          },
        });
      }
    },
    'replace-all',
  );

  return stats.size;
}

initStatsStore();

module.exports = {
  getStats,
  listAllStats,
  addKill,
  addDeath,
  addPlaytimeMinutes,
  replaceStats,
  initStatsStore,
  flushStatsStoreWrites,
};
