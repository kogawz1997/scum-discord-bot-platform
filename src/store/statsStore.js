const {
  resolveTenantServerStoreScope,
  buildServerScopedUserKey,
  parseServerScopedUserKey,
  matchesServerScope,
} = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    stats: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureStatsScope(options = {}) {
  const scope = resolveTenantServerStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

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

function buildEmptyStat() {
  return {
    kills: 0,
    deaths: 0,
    playtimeMinutes: 0,
    squad: null,
  };
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      if (state.initPromise && !state.isHydrating) {
        await state.initPromise.catch(() => null);
      }
      await work();
    })
    .catch((error) => {
      console.error(`[statsStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.stats.findMany();

    if (rows.length === 0) {
      if (state.stats.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [userId, value] of state.stats.entries()) {
              await db.stats.upsert({
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

    if (startVersion === state.mutationVersion) {
      state.stats.clear();
      for (const [userId, value] of hydrated.entries()) {
        state.stats.set(userId, value);
      }
      return;
    }

    for (const [userId, value] of hydrated.entries()) {
      if (!state.stats.has(userId)) {
        state.stats.set(userId, value);
      }
    }
  } catch (error) {
    console.error('[statsStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initStatsStore(options = {}) {
  const scope = ensureStatsScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushStatsStoreWrites(options = {}) {
  const scope = ensureStatsScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function queueUpsertStat(scope, userId, value, label) {
  if (!String(userId || '').trim()) return;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.stats.upsert({
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

function getOrCreateStats(userIdRaw, options = {}) {
  const scope = ensureStatsScope(options);
  void initStatsStore(options);
  const userId = buildServerScopedUserKey(userIdRaw, options);
  if (!userId) {
    return buildEmptyStat();
  }

  let value = scope.state.stats.get(userId);
  if (!value) {
    scope.state.mutationVersion += 1;
    value = buildEmptyStat();
    scope.state.stats.set(userId, value);
    queueUpsertStat(scope, userId, value, 'create-default');
  }
  return value;
}

function getStats(userId, options = {}) {
  const scope = ensureStatsScope(options);
  void initStatsStore(options);
  const normalizedUserId = buildServerScopedUserKey(userId, options);
  if (!normalizedUserId) {
    return buildEmptyStat();
  }
  const value = scope.state.stats.get(normalizedUserId);
  return value ? { ...value } : buildEmptyStat();
}

function listAllStats(options = {}) {
  const scope = ensureStatsScope(options);
  void initStatsStore(options);
  return Array.from(scope.state.stats.entries())
    .filter(([userId]) => matchesServerScope(userId, options))
    .map(([userId, value]) => {
      const parsed = parseServerScopedUserKey(userId);
      return {
        userId: parsed.userId,
        serverId: parsed.serverId,
        ...value,
      };
    });
}

function addKill(userId, amount = 1, options = {}) {
  const scope = ensureStatsScope(options);
  const normalizedUserId = buildServerScopedUserKey(userId, options);
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId, options);
  const value = getOrCreateStats(normalizedUserId, options);
  const add = Number(amount || 0);

  scope.state.mutationVersion += 1;
  value.kills += add;
  queueUpsertStat(scope, normalizedUserId, value, 'add-kill');
  return value;
}

function addDeath(userId, amount = 1, options = {}) {
  const scope = ensureStatsScope(options);
  const normalizedUserId = buildServerScopedUserKey(userId, options);
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId, options);
  const value = getOrCreateStats(normalizedUserId, options);
  const add = Number(amount || 0);

  scope.state.mutationVersion += 1;
  value.deaths += add;
  queueUpsertStat(scope, normalizedUserId, value, 'add-death');
  return value;
}

function addPlaytimeMinutes(userId, minutes, options = {}) {
  const scope = ensureStatsScope(options);
  const normalizedUserId = buildServerScopedUserKey(userId, options);
  if (!normalizedUserId) return getOrCreateStats(normalizedUserId, options);
  const value = getOrCreateStats(normalizedUserId, options);
  const add = Math.max(0, Number(minutes || 0));

  scope.state.mutationVersion += 1;
  value.playtimeMinutes += add;
  queueUpsertStat(scope, normalizedUserId, value, 'add-playtime');
  return value;
}

function replaceStats(nextStats = [], options = {}) {
  const scope = ensureStatsScope(options);
  void initStatsStore(options);
  scope.state.mutationVersion += 1;
  if (options.serverId) {
    for (const userId of Array.from(scope.state.stats.keys())) {
      if (matchesServerScope(userId, options)) {
        scope.state.stats.delete(userId);
      }
    }
  } else {
    scope.state.stats.clear();
  }

  for (const rowRaw of Array.isArray(nextStats) ? nextStats : []) {
    const row = normalizeStatRow(rowRaw);
    if (!row) continue;
    const userId = buildServerScopedUserKey(row.userId, {
      ...options,
      serverId: row.serverId || options.serverId,
    });
    if (!userId) continue;
    scope.state.stats.set(userId, {
      kills: row.kills,
      deaths: row.deaths,
      playtimeMinutes: row.playtimeMinutes,
      squad: row.squad,
    });
  }

  queueDbWrite(
    scope,
    async () => {
      if (options.serverId) {
        const existingRows = await scope.db.stats.findMany();
        for (const row of existingRows) {
          if (!matchesServerScope(row.userId, options)) continue;
          await scope.db.stats.deleteMany({ where: { userId: row.userId } });
        }
      } else {
        await scope.db.stats.deleteMany();
      }
      for (const [userId, value] of scope.state.stats.entries()) {
        if (!matchesServerScope(userId, options)) continue;
        await scope.db.stats.create({
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

  return scope.state.stats.size;
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
