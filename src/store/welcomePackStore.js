const { prisma } = require('../prisma');

const claimed = new Set();

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;

function normalizeUserId(value) {
  return String(value || '').trim();
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[welcomePackStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  try {
    const rows = await prisma.welcomeClaim.findMany({
      orderBy: { claimedAt: 'desc' },
    });
    if (rows.length === 0) {
      if (claimed.size > 0) {
        await queueDbWrite(
          async () => {
            for (const userId of claimed.values()) {
              await prisma.welcomeClaim.upsert({
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

    if (startVersion === mutationVersion) {
      claimed.clear();
      for (const userId of hydrated.values()) {
        claimed.add(userId);
      }
      return;
    }

    for (const userId of hydrated.values()) {
      if (!claimed.has(userId)) {
        claimed.add(userId);
      }
    }
  } catch (error) {
    console.error('[welcomePackStore] failed to hydrate from prisma:', error.message);
  }
}

function initWelcomePackStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

function flushWelcomePackStoreWrites() {
  return dbWriteQueue;
}

function hasClaimed(userId) {
  return claimed.has(normalizeUserId(userId));
}

function claim(userId) {
  const id = normalizeUserId(userId);
  if (!id) return false;
  if (claimed.has(id)) return false;

  claimed.add(id);
  mutationVersion += 1;

  queueDbWrite(
    async () => {
      await prisma.welcomeClaim.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      });
    },
    'claim',
  );

  return true;
}

function listClaimed() {
  return Array.from(claimed.values());
}

function revokeClaim(userId) {
  const id = normalizeUserId(userId);
  if (!id) return false;
  const removed = claimed.delete(id);
  if (!removed) return false;

  mutationVersion += 1;
  queueDbWrite(
    async () => {
      await prisma.welcomeClaim.deleteMany({
        where: { userId: id },
      });
    },
    'revoke-claim',
  );
  return true;
}

function clearClaims() {
  claimed.clear();
  mutationVersion += 1;
  queueDbWrite(
    async () => {
      await prisma.welcomeClaim.deleteMany({});
    },
    'clear-claims',
  );
}

function replaceClaims(nextClaims = []) {
  claimed.clear();
  mutationVersion += 1;
  for (const userIdRaw of Array.isArray(nextClaims) ? nextClaims : []) {
    const userId = normalizeUserId(userIdRaw);
    if (!userId) continue;
    claimed.add(userId);
  }

  queueDbWrite(
    async () => {
      await prisma.welcomeClaim.deleteMany({});
      for (const userId of claimed.values()) {
        await prisma.welcomeClaim.create({
          data: { userId },
        });
      }
    },
    'replace-claims',
  );
  return claimed.size;
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
