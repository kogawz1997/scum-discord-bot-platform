const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    weaponStats: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureWeaponStatsScope(options = {}) {
  const scope = resolveTenantStoreScope({
    ...options,
    operation: String(options.operation || '').trim() || 'weapon stats store operation',
  });
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
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

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[weaponStatsStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const rows = await db.weaponStat.findMany({
      orderBy: [{ kills: 'desc' }, { updatedAt: 'desc' }],
    });

    if (rows.length === 0) {
      if (state.weaponStats.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [weapon, stat] of state.weaponStats.entries()) {
              await db.weaponStat.upsert({
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

    if (startVersion === state.mutationVersion) {
      state.weaponStats.clear();
      for (const [weapon, value] of hydrated.entries()) {
        state.weaponStats.set(weapon, value);
      }
      return;
    }

    for (const [weapon, value] of hydrated.entries()) {
      if (!state.weaponStats.has(weapon)) {
        state.weaponStats.set(weapon, value);
      }
    }
  } catch (error) {
    console.error('[weaponStatsStore] failed to hydrate from prisma:', error.message);
  }
}

function initWeaponStatsStore(options = {}) {
  const scope = ensureWeaponStatsScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushWeaponStatsStoreWrites(options = {}) {
  const scope = ensureWeaponStatsScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function recordWeaponKill(payload = {}, options = {}) {
  const scope = ensureWeaponStatsScope(options);
  void initWeaponStatsStore(options);
  const key = String(payload.weapon || 'อาวุธไม่ทราบชนิด').trim();
  const current = scope.state.weaponStats.get(key) || {
    kills: 0,
    longestDistance: 0,
    recordHolder: null,
  };

  current.kills += 1;

  const distanceNumber = Number(payload.distance || 0);
  if (distanceNumber > current.longestDistance) {
    current.longestDistance = distanceNumber;
    current.recordHolder = payload.killer || null;
  }

  scope.state.weaponStats.set(key, current);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.weaponStat.upsert({
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

function listWeaponStats(options = {}) {
  const scope = ensureWeaponStatsScope(options);
  void initWeaponStatsStore(options);
  return Array.from(scope.state.weaponStats.entries()).map(([weapon, stat]) => ({
    weapon,
    ...stat,
  }));
}

function replaceWeaponStats(nextStats = [], options = {}) {
  const scope = ensureWeaponStatsScope(options);
  void initWeaponStatsStore(options);
  scope.state.mutationVersion += 1;
  scope.state.weaponStats.clear();
  for (const row of Array.isArray(nextStats) ? nextStats : []) {
    const parsed = normalizeStat(row);
    if (!parsed) continue;
    scope.state.weaponStats.set(parsed.weapon, {
      kills: parsed.kills,
      longestDistance: parsed.longestDistance,
      recordHolder: parsed.recordHolder,
    });
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.weaponStat.deleteMany({});
      for (const [weapon, stat] of scope.state.weaponStats.entries()) {
        await scope.db.weaponStat.create({
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

  return scope.state.weaponStats.size;
}

initWeaponStatsStore();

module.exports = {
  recordWeaponKill,
  listWeaponStats,
  replaceWeaponStats,
  initWeaponStatsStore,
  flushWeaponStatsStoreWrites,
};
