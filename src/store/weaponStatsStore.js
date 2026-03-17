const { prisma } = require('../prisma');

const { getDefaultTenantScopedPrismaClient } = require('../prisma');

const weaponStats = new Map(); // weapon -> { kills, longestDistance, recordHolder }

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;

function getWeaponStatsDb() {
  if (!prisma) {
    return getDefaultTenantScopedPrismaClient();
  }
  return getDefaultTenantScopedPrismaClient();
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function normalizeStat(row = {}) {
  const weapon = String(row.weapon || '').trim();
  if (!weapon) return null;
  return {
    weapon,
    kills: Math.max(0, Math.trunc(normalizeNumber(row.kills, 0))),
    longestDistance: Math.max(0, normalizeNumber(row.longestDistance, 0)),
    recordHolder: row.recordHolder ? String(row.recordHolder) : null,
  };
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[weaponStatsStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  try {
    const rows = await getWeaponStatsDb().weaponStat.findMany({
      orderBy: [{ kills: 'desc' }, { updatedAt: 'desc' }],
    });

    if (rows.length === 0) {
      if (weaponStats.size > 0) {
        await queueDbWrite(
          async () => {
            for (const [weapon, stat] of weaponStats.entries()) {
              await getWeaponStatsDb().weaponStat.upsert({
                where: { weapon },
                update: {
                  kills: stat.kills,
                  longestDistance: stat.longestDistance,
                  recordHolder: stat.recordHolder,
                },
                create: {
                  weapon,
                  kills: stat.kills,
                  longestDistance: stat.longestDistance,
                  recordHolder: stat.recordHolder,
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
    for (const row of rows) {
      const parsed = normalizeStat(row);
      if (!parsed) continue;
      hydrated.set(parsed.weapon, {
        kills: parsed.kills,
        longestDistance: parsed.longestDistance,
        recordHolder: parsed.recordHolder,
      });
    }

    if (startVersion === mutationVersion) {
      weaponStats.clear();
      for (const [weapon, value] of hydrated.entries()) {
        weaponStats.set(weapon, value);
      }
      return;
    }

    for (const [weapon, value] of hydrated.entries()) {
      if (!weaponStats.has(weapon)) {
        weaponStats.set(weapon, value);
      }
    }
  } catch (error) {
    console.error('[weaponStatsStore] failed to hydrate from prisma:', error.message);
  }
}

function initWeaponStatsStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

function flushWeaponStatsStoreWrites() {
  return dbWriteQueue;
}

function recordWeaponKill({ weapon, distance, killer }) {
  const key = String(weapon || 'อาวุธไม่ทราบชนิด').trim();
  const current = weaponStats.get(key) || {
    kills: 0,
    longestDistance: 0,
    recordHolder: null,
  };

  current.kills += 1;

  const distanceNumber = Number(distance || 0);
  if (distanceNumber > current.longestDistance) {
    current.longestDistance = distanceNumber;
    current.recordHolder = killer || null;
  }

  weaponStats.set(key, current);
  mutationVersion += 1;

  queueDbWrite(
    async () => {
      await getWeaponStatsDb().weaponStat.upsert({
        where: { weapon: key },
        update: {
          kills: current.kills,
          longestDistance: current.longestDistance,
          recordHolder: current.recordHolder,
        },
        create: {
          weapon: key,
          kills: current.kills,
          longestDistance: current.longestDistance,
          recordHolder: current.recordHolder,
        },
      });
    },
    'record-weapon-kill',
  );

  return current;
}

function listWeaponStats() {
  return Array.from(weaponStats.entries()).map(([weapon, stat]) => ({
    weapon,
    ...stat,
  }));
}

function replaceWeaponStats(nextStats = []) {
  mutationVersion += 1;
  weaponStats.clear();
  for (const row of Array.isArray(nextStats) ? nextStats : []) {
    const parsed = normalizeStat(row);
    if (!parsed) continue;
    weaponStats.set(parsed.weapon, {
      kills: parsed.kills,
      longestDistance: parsed.longestDistance,
      recordHolder: parsed.recordHolder,
    });
  }

  queueDbWrite(
    async () => {
      await getWeaponStatsDb().weaponStat.deleteMany({});
      for (const [weapon, stat] of weaponStats.entries()) {
        await getWeaponStatsDb().weaponStat.create({
          data: {
            weapon,
            kills: stat.kills,
            longestDistance: stat.longestDistance,
            recordHolder: stat.recordHolder,
          },
        });
      }
    },
    'replace-weapon-stats',
  );

  return weaponStats.size;
}

initWeaponStatsStore();

module.exports = {
  recordWeaponKill,
  listWeaponStats,
  replaceWeaponStats,
  initWeaponStatsStore,
  flushWeaponStatsStoreWrites,
};
