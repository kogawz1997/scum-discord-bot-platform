const crypto = require('node:crypto');
const {
  assertTenantStoreMutationScope,
  resolveTenantStoreScope,
} = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    giveaways: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureGiveawayScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
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
      console.error(`[giveawayStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.giveaway.findMany({
      include: {
        entrants: true,
      },
      orderBy: { endsAt: 'asc' },
    });

    if (rows.length === 0) {
      if (state.giveaways.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const g of state.giveaways.values()) {
              await db.giveaway.upsert({
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
                await db.giveawayEntrant.upsert({
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

    if (startVersion === state.mutationVersion) {
      state.giveaways.clear();
      for (const [messageId, value] of hydrated.entries()) {
        state.giveaways.set(messageId, value);
      }
      return;
    }

    for (const [messageId, value] of hydrated.entries()) {
      if (!state.giveaways.has(messageId)) {
        state.giveaways.set(messageId, value);
      }
    }
  } catch (error) {
    console.error('[giveawayStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initGiveawayStore(options = {}) {
  const scope = ensureGiveawayScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushGiveawayStoreWrites(options = {}) {
  const scope = ensureGiveawayScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function createGiveaway(payload = {}, options = {}) {
  const scope = ensureGiveawayScope(options);
  assertTenantStoreMutationScope(scope, options, 'create giveaway', 'giveaway');
  void initGiveawayStore(options);
  const g = normalizeGiveaway({
    messageId: payload.messageId,
    channelId: payload.channelId,
    guildId: payload.guildId,
    prize: payload.prize,
    winnersCount: payload.winnersCount,
    endsAt: payload.endsAt,
    entrants: [],
  });
  if (!g) return null;

  scope.state.giveaways.set(g.messageId, g);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.giveaway.upsert({
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

function getGiveaway(messageId, options = {}) {
  const scope = ensureGiveawayScope(options);
  void initGiveawayStore(options);
  return scope.state.giveaways.get(messageId) || null;
}

function listGiveaways(options = {}) {
  const scope = ensureGiveawayScope(options);
  void initGiveawayStore(options);
  return Array.from(scope.state.giveaways.values()).map((row) => ({
    ...row,
    entrants: new Set(row.entrants),
  }));
}

function addEntrant(messageId, userId, options = {}) {
  const scope = ensureGiveawayScope(options);
  assertTenantStoreMutationScope(scope, options, 'join giveaway', 'giveaway-entrant');
  void initGiveawayStore(options);
  const g = scope.state.giveaways.get(messageId);
  if (!g) return null;
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return null;
  g.entrants.add(normalizedUserId);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.giveawayEntrant.upsert({
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

function removeGiveaway(messageId, options = {}) {
  const scope = ensureGiveawayScope(options);
  assertTenantStoreMutationScope(scope, options, 'remove giveaway', 'giveaway');
  void initGiveawayStore(options);
  const removed = scope.state.giveaways.delete(messageId);
  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.giveaway.deleteMany({
        where: { messageId },
      });
    },
    'remove-giveaway',
  );
  return removed;
}

function replaceGiveaways(nextGiveaways = [], options = {}) {
  const scope = ensureGiveawayScope(options);
  assertTenantStoreMutationScope(scope, options, 'replace giveaways', 'giveaway');
  void initGiveawayStore(options);
  scope.state.mutationVersion += 1;
  scope.state.giveaways.clear();
  for (const row of Array.isArray(nextGiveaways) ? nextGiveaways : []) {
    const parsed = normalizeGiveaway(row);
    if (!parsed) continue;
    scope.state.giveaways.set(parsed.messageId, parsed);
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.giveawayEntrant.deleteMany({});
      await scope.db.giveaway.deleteMany({});
      for (const g of scope.state.giveaways.values()) {
        await scope.db.giveaway.create({
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
      for (const g of scope.state.giveaways.values()) {
        for (const userId of g.entrants) {
          await scope.db.giveawayEntrant.create({
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
  return scope.state.giveaways.size;
}

function createGiveawayId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createScopedGiveawaySnapshot(options = {}) {
  return listGiveaways(options).map((giveaway) => ({
    ...giveaway,
    snapshotId: createGiveawayId(),
    entrants: Array.from(giveaway.entrants || []),
  }));
}

initGiveawayStore();

module.exports = {
  createGiveaway,
  getGiveaway,
  listGiveaways,
  addEntrant,
  removeGiveaway,
  replaceGiveaways,
  createScopedGiveawaySnapshot,
  initGiveawayStore,
  flushGiveawayStoreWrites,
};
