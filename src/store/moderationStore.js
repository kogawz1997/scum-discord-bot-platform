const {
  assertTenantStoreMutationScope,
  resolveTenantStoreScope,
} = require('./tenantStoreScope');

const recentMessages = new Map();
const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    punishments: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureModerationScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeDate(value, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
}

function normalizeEntry(entry = {}) {
  return {
    type: String(entry.type || 'note'),
    reason: String(entry.reason || ''),
    staffId: String(entry.staffId || ''),
    durationMinutes:
      entry.durationMinutes == null ? null : Number(entry.durationMinutes),
    createdAt: normalizeDate(entry.createdAt),
  };
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      if (state.initPromise && !state.isHydrating) {
        await state.initPromise;
      }
      await work();
    })
    .catch((error) => {
      console.error(`[moderationStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.punishment.findMany({
      orderBy: [{ createdAt: 'asc' }],
    });
    if (rows.length === 0) {
      if (state.punishments.size > 0 && startVersion === state.mutationVersion) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [userId, entries] of state.punishments.entries()) {
              for (const entry of entries) {
                await db.punishment.create({
                  data: {
                    userId,
                    type: entry.type,
                    reason: entry.reason,
                    staffId: entry.staffId,
                    durationMinutes: entry.durationMinutes,
                    createdAt: normalizeDate(entry.createdAt),
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
      const userId = String(row.userId || '').trim();
      if (!userId) continue;
      const arr = hydrated.get(userId) || [];
      arr.push(normalizeEntry(row));
      hydrated.set(userId, arr);
    }

    if (startVersion === state.mutationVersion) {
      state.punishments.clear();
      for (const [userId, entries] of hydrated.entries()) {
        state.punishments.set(userId, entries);
      }
      return;
    }

    for (const [userId, entries] of hydrated.entries()) {
      if (!state.punishments.has(userId)) {
        state.punishments.set(userId, entries);
      }
    }
  } catch (error) {
    console.error('[moderationStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initModerationStore(options = {}) {
  const scope = ensureModerationScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushModerationStoreWrites(options = {}) {
  const scope = ensureModerationScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function pushMessage(userId, timestamp) {
  const arr = recentMessages.get(userId) || [];
  arr.push(timestamp);
  recentMessages.set(userId, arr);
}

function getRecentMessages(userId, sinceMs) {
  const arr = recentMessages.get(userId) || [];
  const filtered = arr.filter((t) => Date.now() - t <= sinceMs);
  recentMessages.set(userId, filtered);
  return filtered;
}

function addPunishment(userId, type, reason, staffId, durationMinutes, options = {}) {
  const scope = ensureModerationScope(options);
  assertTenantStoreMutationScope(scope, options, 'add moderation punishment', 'moderation-punishment');
  void initModerationStore(options);
  const key = String(userId || '').trim();
  if (!key) return null;
  const arr = scope.state.punishments.get(key) || [];
  const entry = normalizeEntry({
    type,
    reason,
    staffId,
    durationMinutes,
    createdAt: new Date(),
  });
  arr.push(entry);
  scope.state.punishments.set(key, arr);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.punishment.create({
        data: {
          userId: key,
          type: entry.type,
          reason: entry.reason,
          staffId: entry.staffId,
          durationMinutes: entry.durationMinutes,
          createdAt: entry.createdAt,
        },
      });
    },
    'add-punishment',
  );
  return entry;
}

function getPunishments(userId, options = {}) {
  const scope = ensureModerationScope(options);
  void initModerationStore(options);
  return scope.state.punishments.get(userId) || [];
}

function listAllPunishments(options = {}) {
  const scope = ensureModerationScope(options);
  void initModerationStore(options);
  return Array.from(scope.state.punishments.entries()).map(([userId, entries]) => ({
    userId,
    entries: entries || [],
  }));
}

function replacePunishments(nextRows = [], options = {}) {
  const scope = ensureModerationScope(options);
  assertTenantStoreMutationScope(scope, options, 'replace moderation punishments', 'moderation-punishment');
  void initModerationStore(options);
  scope.state.mutationVersion += 1;
  scope.state.punishments.clear();
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    if (!row || typeof row !== 'object') continue;
    const userId = String(row.userId || '').trim();
    if (!userId) continue;
    const entries = Array.isArray(row.entries) ? row.entries : [];
    scope.state.punishments.set(userId, entries.map((entry) => normalizeEntry(entry)));
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.punishment.deleteMany({});
      for (const [userId, entries] of scope.state.punishments.entries()) {
        for (const entry of entries) {
          await scope.db.punishment.create({
            data: {
              userId,
              type: entry.type,
              reason: entry.reason,
              staffId: entry.staffId,
              durationMinutes: entry.durationMinutes,
              createdAt: entry.createdAt,
            },
          });
        }
      }
    },
    'replace-punishments',
  );
  return scope.state.punishments.size;
}

initModerationStore();

module.exports = {
  pushMessage,
  getRecentMessages,
  addPunishment,
  getPunishments,
  listAllPunishments,
  replacePunishments,
  initModerationStore,
  flushModerationStoreWrites,
};
