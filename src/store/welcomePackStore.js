const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    claimed: new Set(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureWelcomePackScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeUserId(value) {
  return String(value || '').trim();
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[welcomePackStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const rows = await db.welcomeClaim.findMany({
      orderBy: { claimedAt: 'desc' },
    });
    if (rows.length === 0) {
      if (state.claimed.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const userId of state.claimed.values()) {
              await db.welcomeClaim.upsert({
                where: { userId },
                update: {},
                create: { userId },
              });
            }
          },
          'backfill',
        );
      }
      return;
    }

    const hydrated = new Set();
    for (const row of rows) {
      const userId = normalizeUserId(row.userId);
      if (!userId) continue;
      hydrated.add(userId);
    }

    if (startVersion === state.mutationVersion) {
      state.claimed.clear();
      for (const userId of hydrated.values()) {
        state.claimed.add(userId);
      }
      return;
    }

    for (const userId of hydrated.values()) {
      if (!state.claimed.has(userId)) {
        state.claimed.add(userId);
      }
    }
  } catch (error) {
    console.error('[welcomePackStore] failed to hydrate from prisma:', error.message);
  }
}

function initWelcomePackStore(options = {}) {
  const scope = ensureWelcomePackScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushWelcomePackStoreWrites(options = {}) {
  const scope = ensureWelcomePackScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function hasClaimed(userId, options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  return scope.state.claimed.has(normalizeUserId(userId));
}

function claim(userId, options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  const id = normalizeUserId(userId);
  if (!id) return false;
  if (scope.state.claimed.has(id)) return false;

  scope.state.claimed.add(id);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.welcomeClaim.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      });
    },
    'claim',
  );

  return true;
}

function listClaimed(options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  return Array.from(scope.state.claimed.values());
}

function revokeClaim(userId, options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  const id = normalizeUserId(userId);
  if (!id) return false;
  const removed = scope.state.claimed.delete(id);
  if (!removed) return false;

  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.welcomeClaim.deleteMany({
        where: { userId: id },
      });
    },
    'revoke-claim',
  );
  return true;
}

function clearClaims(options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  scope.state.claimed.clear();
  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.welcomeClaim.deleteMany({});
    },
    'clear-claims',
  );
}

function replaceClaims(nextClaims = [], options = {}) {
  const scope = ensureWelcomePackScope(options);
  void initWelcomePackStore(options);
  scope.state.claimed.clear();
  scope.state.mutationVersion += 1;
  for (const userIdRaw of Array.isArray(nextClaims) ? nextClaims : []) {
    const userId = normalizeUserId(userIdRaw);
    if (!userId) continue;
    scope.state.claimed.add(userId);
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.welcomeClaim.deleteMany({});
      for (const userId of scope.state.claimed.values()) {
        await scope.db.welcomeClaim.create({
          data: { userId },
        });
      }
    },
    'replace-claims',
  );
  return scope.state.claimed.size;
}

initWelcomePackStore();

module.exports = {
  hasClaimed,
  claim,
  listClaimed,
  revokeClaim,
  clearClaims,
  replaceClaims,
  initWelcomePackStore,
  flushWelcomePackStoreWrites,
};
