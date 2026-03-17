const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    bounties: new Map(),
    bountyCounter: 1,
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureBountyScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeBountyRow(row) {
  const id = Number(row?.id || 0);
  if (!Number.isFinite(id) || id <= 0) return null;

  return {
    id,
    targetName: String(row?.targetName || ''),
    amount: Number(row?.amount || 0),
    createdBy: String(row?.createdBy || ''),
    status: String(row?.status || 'active'),
    claimedBy: row?.claimedBy ? String(row.claimedBy) : null,
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
      console.error(`[bountyStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.bounty.findMany({
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      if (state.bounties.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const bounty of state.bounties.values()) {
              await db.bounty.upsert({
                where: { id: bounty.id },
                update: {
                  targetName: bounty.targetName,
                  amount: bounty.amount,
                  createdBy: bounty.createdBy,
                  status: bounty.status,
                  claimedBy: bounty.claimedBy,
                },
                create: {
                  id: bounty.id,
                  targetName: bounty.targetName,
                  amount: bounty.amount,
                  createdBy: bounty.createdBy,
                  status: bounty.status,
                  claimedBy: bounty.claimedBy,
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
      const bounty = normalizeBountyRow(raw);
      if (!bounty) continue;
      hydrated.set(bounty.id, bounty);
    }

    if (startVersion === state.mutationVersion) {
      state.bounties.clear();
      for (const [id, bounty] of hydrated.entries()) {
        state.bounties.set(id, bounty);
      }
      const maxId = Math.max(0, ...Array.from(state.bounties.keys()));
      state.bountyCounter = maxId + 1;
      return;
    }

    for (const [id, bounty] of hydrated.entries()) {
      if (!state.bounties.has(id)) {
        state.bounties.set(id, bounty);
      }
    }
    const maxId = Math.max(0, ...Array.from(state.bounties.keys()));
    state.bountyCounter = Math.max(state.bountyCounter, maxId + 1);
  } catch (error) {
    console.error('[bountyStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initBountyStore(options = {}) {
  const scope = ensureBountyScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushBountyStoreWrites(options = {}) {
  const scope = ensureBountyScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

async function createBounty({ targetName, amount, createdBy }, options = {}) {
  const scope = ensureBountyScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }

  scope.state.mutationVersion += 1;
  const created = await scope.db.bounty.create({
    data: {
      targetName: String(targetName || ''),
      amount: Number(amount || 0),
      createdBy: String(createdBy || ''),
      status: 'active',
      claimedBy: null,
    },
  });

  const bounty = normalizeBountyRow(created);
  if (!bounty) {
    throw new Error('failed-to-normalize-bounty');
  }

  scope.state.bounties.set(bounty.id, bounty);
  scope.state.bountyCounter = Math.max(scope.state.bountyCounter, bounty.id + 1);
  return bounty;
}

function listBounties(options = {}) {
  const scope = ensureBountyScope(options);
  void initBountyStore(options);
  return Array.from(scope.state.bounties.values());
}

function cancelBounty(id, requesterId, isStaff, options = {}) {
  const scope = ensureBountyScope(options);
  void initBountyStore(options);
  const bounty = scope.state.bounties.get(Number(id));
  if (!bounty) return { ok: false, reason: 'not-found' };

  if (!isStaff && bounty.createdBy !== requesterId) {
    return { ok: false, reason: 'forbidden' };
  }

  scope.state.mutationVersion += 1;
  bounty.status = 'cancelled';

  queueDbWrite(
    scope,
    async () => {
      await scope.db.bounty.updateMany({
        where: { id: bounty.id },
        data: {
          status: bounty.status,
        },
      });
    },
    'cancel',
  );

  return { ok: true, bounty };
}

function claimBounty(id, killerName, options = {}) {
  const scope = ensureBountyScope(options);
  void initBountyStore(options);
  const bounty = scope.state.bounties.get(Number(id));
  if (!bounty) return { ok: false, reason: 'not-found' };
  if (bounty.status !== 'active') return { ok: false, reason: 'not-active' };

  scope.state.mutationVersion += 1;
  bounty.status = 'claimed';
  bounty.claimedBy = killerName ? String(killerName) : null;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.bounty.updateMany({
        where: { id: bounty.id },
        data: {
          status: bounty.status,
          claimedBy: bounty.claimedBy,
        },
      });
    },
    'claim',
  );

  return { ok: true, bounty };
}

function replaceBounties(nextBounties = [], nextCounter = null, options = {}) {
  const scope = ensureBountyScope(options);
  void initBountyStore(options);
  scope.state.mutationVersion += 1;
  scope.state.bounties.clear();

  for (const rowRaw of Array.isArray(nextBounties) ? nextBounties : []) {
    const bounty = normalizeBountyRow(rowRaw);
    if (!bounty) continue;
    scope.state.bounties.set(bounty.id, bounty);
  }

  if (Number.isFinite(Number(nextCounter)) && Number(nextCounter) > 0) {
    scope.state.bountyCounter = Math.max(1, Math.trunc(Number(nextCounter)));
  } else {
    const maxId = Math.max(0, ...Array.from(scope.state.bounties.keys()));
    scope.state.bountyCounter = maxId + 1;
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.bounty.deleteMany();
      for (const bounty of scope.state.bounties.values()) {
        await scope.db.bounty.create({
          data: {
            id: bounty.id,
            targetName: bounty.targetName,
            amount: bounty.amount,
            createdBy: bounty.createdBy,
            status: bounty.status,
            claimedBy: bounty.claimedBy,
          },
        });
      }
    },
    'replace-all',
  );

  return scope.state.bounties.size;
}

initBountyStore();

module.exports = {
  createBounty,
  listBounties,
  cancelBounty,
  claimBounty,
  replaceBounties,
  initBountyStore,
  flushBountyStoreWrites,
};
