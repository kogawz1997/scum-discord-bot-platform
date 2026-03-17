const { prisma } = require('../prisma');

const { getDefaultTenantScopedPrismaClient } = require('../prisma');

const bounties = new Map(); // id -> bounty

let bountyCounter = 1;
let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;

function getBountyDb() {
  if (!prisma) {
    return getDefaultTenantScopedPrismaClient();
  }
  return getDefaultTenantScopedPrismaClient();
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

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[bountyStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  try {
    const rows = await getBountyDb().bounty.findMany({
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      if (bounties.size > 0) {
        await queueDbWrite(
          async () => {
            for (const bounty of bounties.values()) {
              await getBountyDb().bounty.upsert({
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

    if (startVersion === mutationVersion) {
      bounties.clear();
      for (const [id, bounty] of hydrated.entries()) {
        bounties.set(id, bounty);
      }
      const maxId = Math.max(0, ...Array.from(bounties.keys()));
      bountyCounter = maxId + 1;
      return;
    }

    // There were local updates during hydration; merge only missing IDs.
    for (const [id, bounty] of hydrated.entries()) {
      if (bounties.has(id)) continue;
      bounties.set(id, bounty);
    }
    const maxId = Math.max(0, ...Array.from(bounties.keys()));
    bountyCounter = Math.max(bountyCounter, maxId + 1);
  } catch (error) {
    console.error('[bountyStore] failed to hydrate from prisma:', error.message);
  }
}


function initBountyStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

async function flushBountyStoreWrites() {
  if (initPromise) {
    await initPromise.catch(() => null);
  }
  await dbWriteQueue;
}

async function createBounty({ targetName, amount, createdBy }) {
  if (initPromise) {
    await initPromise.catch(() => null);
  }

  mutationVersion += 1;
  const created = await getBountyDb().bounty.create({
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

  bounties.set(bounty.id, bounty);
  bountyCounter = Math.max(bountyCounter, bounty.id + 1);
  return bounty;
}

function listBounties() {
  return Array.from(bounties.values());
}

function cancelBounty(id, requesterId, isStaff) {
  const bounty = bounties.get(Number(id));
  if (!bounty) return { ok: false, reason: 'not-found' };

  if (!isStaff && bounty.createdBy !== requesterId) {
    return { ok: false, reason: 'forbidden' };
  }

  mutationVersion += 1;
  bounty.status = 'cancelled';

  queueDbWrite(
    async () => {
      await getBountyDb().bounty.updateMany({
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

function claimBounty(id, killerName) {
  const bounty = bounties.get(Number(id));
  if (!bounty) return { ok: false, reason: 'not-found' };
  if (bounty.status !== 'active') return { ok: false, reason: 'not-active' };

  mutationVersion += 1;
  bounty.status = 'claimed';
  bounty.claimedBy = killerName ? String(killerName) : null;

  queueDbWrite(
    async () => {
      await getBountyDb().bounty.updateMany({
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

function replaceBounties(nextBounties = [], nextCounter = null) {
  mutationVersion += 1;
  bounties.clear();

  for (const rowRaw of Array.isArray(nextBounties) ? nextBounties : []) {
    const bounty = normalizeBountyRow(rowRaw);
    if (!bounty) continue;
    bounties.set(bounty.id, bounty);
  }

  if (Number.isFinite(Number(nextCounter)) && Number(nextCounter) > 0) {
    bountyCounter = Math.max(1, Math.trunc(Number(nextCounter)));
  } else {
    const maxId = Math.max(0, ...Array.from(bounties.keys()));
    bountyCounter = maxId + 1;
  }

  queueDbWrite(
    async () => {
      await getBountyDb().bounty.deleteMany();
      for (const bounty of bounties.values()) {
        await getBountyDb().bounty.create({
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

  return bounties.size;
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
