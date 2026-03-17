const { prisma } = require('../prisma');

const { getDefaultTenantScopedPrismaClient } = require('../prisma');

// steamId -> { userId, inGameName, linkedAt }
const links = new Map();

let mutationVersion = 0;
let dbWriteQueue = Promise.resolve();
let initPromise = null;

function getLinkDb() {
  if (!prisma) {
    return getDefaultTenantScopedPrismaClient();
  }
  return getDefaultTenantScopedPrismaClient();
}

function normalizeSteamId(steamId) {
  const s = String(steamId || '').trim();
  if (!/^\d{15,25}$/.test(s)) return null;
  return s;
}

function normalizeInGameName(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.slice(0, 64);
}

function normalizeLinkRow(row) {
  const steamId = normalizeSteamId(row?.steamId);
  const userId = String(row?.userId || '').trim();
  if (!steamId || !userId) return null;
  return {
    steamId,
    userId,
    inGameName: normalizeInGameName(row?.inGameName),
    linkedAt: row?.linkedAt ? new Date(row.linkedAt) : new Date(),
  };
}

function queueDbWrite(work, label) {
  dbWriteQueue = dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[linkStore] prisma ${label} failed:`, error.message);
    });
  return dbWriteQueue;
}

async function hydrateFromPrisma() {
  const startVersion = mutationVersion;
  try {
    const rows = await getLinkDb().link.findMany({
      orderBy: { linkedAt: 'desc' },
    });

    if (rows.length === 0) {
      if (links.size > 0) {
        await queueDbWrite(
          async () => {
            for (const [steamId, value] of links.entries()) {
              await getLinkDb().link.upsert({
                where: { steamId },
                update: {
                  userId: value.userId,
                  inGameName: value.inGameName || null,
                  linkedAt: value.linkedAt || new Date(),
                },
                create: {
                  steamId,
                  userId: value.userId,
                  inGameName: value.inGameName || null,
                  linkedAt: value.linkedAt || new Date(),
                },
              });
            }
          },
          'backfill',
        );
      }
      return;
    }

    const currentUserIndex = new Set(
      Array.from(links.values()).map((entry) => String(entry.userId || '')),
    );
    const hydrated = new Map();
    const seenUsers = new Set();

    for (const raw of rows) {
      const row = normalizeLinkRow(raw);
      if (!row) continue;
      if (seenUsers.has(row.userId)) continue;
      seenUsers.add(row.userId);
      hydrated.set(row.steamId, {
        userId: row.userId,
        inGameName: row.inGameName,
        linkedAt: row.linkedAt,
      });
    }

    if (startVersion === mutationVersion) {
      links.clear();
      for (const [steamId, value] of hydrated.entries()) {
        links.set(steamId, value);
      }
      return;
    }

    // There were local updates during hydration; only merge missing keys.
    for (const [steamId, value] of hydrated.entries()) {
      if (links.has(steamId)) continue;
      if (currentUserIndex.has(value.userId)) continue;
      links.set(steamId, value);
    }
  } catch (error) {
    console.error('[linkStore] failed to hydrate from prisma:', error.message);
  }
}

function initLinkStore() {
  if (!initPromise) {
    initPromise = hydrateFromPrisma();
  }
  return initPromise;
}

async function flushLinkStoreWrites() {
  if (initPromise) {
    await initPromise.catch(() => null);
  }
  await dbWriteQueue;
}

function getLinkBySteamId(steamId) {
  const s = normalizeSteamId(steamId);
  if (!s) return null;
  return links.get(s) || null;
}

function getLinkByUserId(userId) {
  const u = String(userId || '').trim();
  for (const [steamId, value] of links.entries()) {
    if (value.userId === u) return { steamId, ...value };
  }
  return null;
}

function setLink({ steamId, userId, inGameName }) {
  const s = normalizeSteamId(steamId);
  if (!s) return { ok: false, reason: 'invalid-steamid' };
  const u = String(userId || '').trim();
  if (!u) return { ok: false, reason: 'invalid-userid' };
  const normalizedInGameName = normalizeInGameName(inGameName);

  mutationVersion += 1;

  // 1 user ต่อ 1 steamId: ลบลิงก์เดิมของ user ก่อน
  const removedSteamIds = [];
  for (const [sid, value] of links.entries()) {
    if (value.userId === u && sid !== s) {
      links.delete(sid);
      removedSteamIds.push(sid);
    }
  }

  const linkedAt = new Date();
  links.set(s, {
    userId: u,
    inGameName: normalizedInGameName,
    linkedAt,
  });

  queueDbWrite(
    async () => {
      for (const sid of removedSteamIds) {
        await getLinkDb().link.deleteMany({ where: { steamId: sid } });
      }
      await getLinkDb().link.upsert({
        where: { steamId: s },
        update: {
          userId: u,
          inGameName: normalizedInGameName,
          linkedAt,
        },
        create: {
          steamId: s,
          userId: u,
          inGameName: normalizedInGameName,
          linkedAt,
        },
      });
      await getLinkDb().playerAccount.upsert({
        where: { discordId: u },
        update: {
          steamId: s,
          isActive: true,
        },
        create: {
          discordId: u,
          steamId: s,
          isActive: true,
        },
      });
    },
    'set-link',
  );

  return { ok: true, steamId: s, userId: u };
}

function updateInGameNameBySteamId(steamId, inGameName) {
  const s = normalizeSteamId(steamId);
  const normalizedInGameName = normalizeInGameName(inGameName);
  if (!s || !normalizedInGameName) {
    return { ok: false, reason: 'invalid-input' };
  }

  const existing = links.get(s);
  if (!existing) {
    return { ok: false, reason: 'link-not-found' };
  }

  if (existing.inGameName === normalizedInGameName) {
    return {
      ok: true,
      steamId: s,
      inGameName: normalizedInGameName,
      changed: false,
    };
  }

  mutationVersion += 1;
  links.set(s, {
    ...existing,
    inGameName: normalizedInGameName,
  });

  queueDbWrite(
    async () => {
      await getLinkDb().link.updateMany({
        where: { steamId: s },
        data: {
          inGameName: normalizedInGameName,
        },
      });
    },
    'update-in-game-name',
  );

  return {
    ok: true,
    steamId: s,
    inGameName: normalizedInGameName,
    changed: true,
  };
}

function unlinkByUserId(userId) {
  const u = String(userId || '').trim();
  let removed = null;
  const removedSteamIds = [];
  for (const [sid, value] of links.entries()) {
    if (value.userId === u) {
      if (!removed) {
        removed = { steamId: sid, ...value };
      }
      removedSteamIds.push(sid);
      links.delete(sid);
    }
  }
  if (!removed) return null;

  mutationVersion += 1;
  queueDbWrite(
    async () => {
      await getLinkDb().link.deleteMany({ where: { userId: removed.userId } });
      await getLinkDb().playerAccount.upsert({
        where: { discordId: removed.userId },
        update: {
          steamId: null,
          isActive: true,
        },
        create: {
          discordId: removed.userId,
          steamId: null,
          isActive: true,
        },
      });
    },
    'unlink-user',
  );
  return {
    ...removed,
    removedSteamIds,
  };
}

function unlinkBySteamId(steamId) {
  const s = normalizeSteamId(steamId);
  if (!s) return null;
  const value = links.get(s);
  if (!value) return null;

  mutationVersion += 1;
  links.delete(s);
  queueDbWrite(
    async () => {
      await getLinkDb().link.deleteMany({ where: { steamId: s } });
      await getLinkDb().playerAccount.upsert({
        where: { discordId: value.userId },
        update: {
          steamId: null,
          isActive: true,
        },
        create: {
          discordId: value.userId,
          steamId: null,
          isActive: true,
        },
      });
    },
    'unlink-steam',
  );
  return { steamId: s, ...value };
}

function listLinks() {
  return Array.from(links.entries()).map(([steamId, value]) => ({
    steamId,
    ...value,
  }));
}

function replaceLinks(nextLinks = []) {
  mutationVersion += 1;
  links.clear();

  for (const rowRaw of Array.isArray(nextLinks) ? nextLinks : []) {
    const row = normalizeLinkRow(rowRaw);
    if (!row) continue;
    links.set(row.steamId, {
      userId: row.userId,
      inGameName: row.inGameName,
      linkedAt: row.linkedAt,
    });
  }

  queueDbWrite(
    async () => {
      await getLinkDb().link.deleteMany();
      await getLinkDb().playerAccount.updateMany({
        data: {
          steamId: null,
        },
      });
      for (const [steamId, value] of links.entries()) {
        await getLinkDb().link.create({
          data: {
            steamId,
            userId: value.userId,
            inGameName: value.inGameName || null,
            linkedAt: value.linkedAt || new Date(),
          },
        });
        await getLinkDb().playerAccount.upsert({
          where: { discordId: value.userId },
          update: {
            steamId,
            isActive: true,
          },
          create: {
            discordId: value.userId,
            steamId,
            isActive: true,
          },
        });
      }
    },
    'replace-all',
  );
  return links.size;
}

initLinkStore();

module.exports = {
  normalizeSteamId,
  getLinkBySteamId,
  getLinkByUserId,
  setLink,
  updateInGameNameBySteamId,
  unlinkByUserId,
  unlinkBySteamId,
  listLinks,
  replaceLinks,
  initLinkStore,
  flushLinkStoreWrites,
};
