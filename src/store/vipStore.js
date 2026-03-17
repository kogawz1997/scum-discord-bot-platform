const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    memberships: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureVipScope(options = {}) {
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

function normalizePlanId(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeMembership(row) {
  const userId = normalizeUserId(row?.userId);
  const planId = normalizePlanId(row?.planId);
  const expiresAt = normalizeDate(row?.expiresAt);
  if (!userId || !planId || !expiresAt) return null;
  return { userId, planId, expiresAt };
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[vipStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const rows = await db.vipMembership.findMany();
    if (rows.length === 0) {
      if (state.memberships.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [userId, value] of state.memberships.entries()) {
              await db.vipMembership.upsert({
                where: { userId },
                update: {
                  planId: value.planId,
                  expiresAt: value.expiresAt,
                },
                create: {
                  userId,
                  planId: value.planId,
                  expiresAt: value.expiresAt,
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
      const parsed = normalizeMembership(row);
      if (!parsed) continue;
      hydrated.set(parsed.userId, {
        planId: parsed.planId,
        expiresAt: parsed.expiresAt,
      });
    }

    if (startVersion === state.mutationVersion) {
      state.memberships.clear();
      for (const [userId, value] of hydrated.entries()) {
        state.memberships.set(userId, value);
      }
      return;
    }

    for (const [userId, value] of hydrated.entries()) {
      if (!state.memberships.has(userId)) {
        state.memberships.set(userId, value);
      }
    }
  } catch (error) {
    console.error('[vipStore] failed to hydrate from prisma:', error.message);
  }
}

function initVipStore(options = {}) {
  const scope = ensureVipScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushVipStoreWrites(options = {}) {
  const scope = ensureVipScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function setMembership(userId, planId, expiresAt, options = {}) {
  const scope = ensureVipScope(options);
  void initVipStore(options);
  const parsed = normalizeMembership({ userId, planId, expiresAt });
  if (!parsed) return null;

  scope.state.mutationVersion += 1;
  scope.state.memberships.set(parsed.userId, {
    planId: parsed.planId,
    expiresAt: parsed.expiresAt,
  });

  queueDbWrite(
    scope,
    async () => {
      await scope.db.vipMembership.upsert({
        where: { userId: parsed.userId },
        update: {
          planId: parsed.planId,
          expiresAt: parsed.expiresAt,
        },
        create: {
          userId: parsed.userId,
          planId: parsed.planId,
          expiresAt: parsed.expiresAt,
        },
      });
    },
    'set-membership',
  );

  return getMembership(parsed.userId, options);
}

function getMembership(userId, options = {}) {
  const scope = ensureVipScope(options);
  void initVipStore(options);
  const key = normalizeUserId(userId);
  if (!key) return null;
  const value = scope.state.memberships.get(key);
  if (!value) return null;
  return {
    planId: value.planId,
    expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
  };
}

function listMemberships(options = {}) {
  const scope = ensureVipScope(options);
  void initVipStore(options);
  return Array.from(scope.state.memberships.entries()).map(([userId, m]) => ({
    userId,
    planId: m.planId,
    expiresAt: m.expiresAt ? new Date(m.expiresAt) : null,
  }));
}

function removeMembership(userId, options = {}) {
  const scope = ensureVipScope(options);
  void initVipStore(options);
  const key = normalizeUserId(userId);
  if (!key) return false;
  const existed = scope.state.memberships.delete(key);
  if (!existed) return false;

  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.vipMembership.deleteMany({
        where: { userId: key },
      });
    },
    'remove-membership',
  );
  return true;
}

function replaceMemberships(nextMemberships = [], options = {}) {
  const scope = ensureVipScope(options);
  void initVipStore(options);
  scope.state.mutationVersion += 1;
  scope.state.memberships.clear();
  for (const row of Array.isArray(nextMemberships) ? nextMemberships : []) {
    const parsed = normalizeMembership(row);
    if (!parsed) continue;
    scope.state.memberships.set(parsed.userId, {
      planId: parsed.planId,
      expiresAt: parsed.expiresAt,
    });
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.vipMembership.deleteMany({});
      for (const [userId, value] of scope.state.memberships.entries()) {
        await scope.db.vipMembership.create({
          data: {
            userId,
            planId: value.planId,
            expiresAt: value.expiresAt,
          },
        });
      }
    },
    'replace-memberships',
  );
  return scope.state.memberships.size;
}

initVipStore();

module.exports = {
  setMembership,
  getMembership,
  listMemberships,
  removeMembership,
  replaceMemberships,
  initVipStore,
  flushVipStoreWrites,
};
