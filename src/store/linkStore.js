const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    links: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureLinkScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
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
      console.error(`[linkStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.link.findMany({
      orderBy: { linkedAt: 'desc' },
    });

    if (rows.length === 0) {
      if (state.links.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [steamId, value] of state.links.entries()) {
              await db.link.upsert({
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
      Array.from(state.links.values()).map((entry) => String(entry.userId || '')),
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

    if (startVersion === state.mutationVersion) {
      state.links.clear();
      for (const [steamId, value] of hydrated.entries()) {
        state.links.set(steamId, value);
      }
      return;
    }

    for (const [steamId, value] of hydrated.entries()) {
      if (state.links.has(steamId)) continue;
      if (currentUserIndex.has(value.userId)) continue;
      state.links.set(steamId, value);
    }
  } catch (error) {
    console.error('[linkStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initLinkStore(options = {}) {
  const scope = ensureLinkScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushLinkStoreWrites(options = {}) {
  const scope = ensureLinkScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function getLinkBySteamId(steamId, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const s = normalizeSteamId(steamId);
  if (!s) return null;
  return scope.state.links.get(s) || null;
}

function getLinkByUserId(userId, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const u = String(userId || '').trim();
  for (const [steamId, value] of scope.state.links.entries()) {
    if (value.userId === u) return { steamId, ...value };
  }
  return null;
}

function setLink({ steamId, userId, inGameName }, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const s = normalizeSteamId(steamId);
  if (!s) return { ok: false, reason: 'invalid-steamid' };
  const u = String(userId || '').trim();
  if (!u) return { ok: false, reason: 'invalid-userid' };
  const normalizedInGameName = normalizeInGameName(inGameName);

  scope.state.mutationVersion += 1;

  const removedSteamIds = [];
  for (const [sid, value] of scope.state.links.entries()) {
    if (value.userId === u && sid !== s) {
      scope.state.links.delete(sid);
      removedSteamIds.push(sid);
    }
  }

  const linkedAt = new Date();
  scope.state.links.set(s, {
    userId: u,
    inGameName: normalizedInGameName,
    linkedAt,
  });

  queueDbWrite(
    scope,
    async () => {
      for (const sid of removedSteamIds) {
        await scope.db.link.deleteMany({ where: { steamId: sid } });
      }
      await scope.db.link.upsert({
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
      await scope.db.playerAccount.upsert({
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

function updateInGameNameBySteamId(steamId, inGameName, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const s = normalizeSteamId(steamId);
  const normalizedInGameName = normalizeInGameName(inGameName);
  if (!s || !normalizedInGameName) {
    return { ok: false, reason: 'invalid-input' };
  }

  const existing = scope.state.links.get(s);
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

  scope.state.mutationVersion += 1;
  scope.state.links.set(s, {
    ...existing,
    inGameName: normalizedInGameName,
  });

  queueDbWrite(
    scope,
    async () => {
      await scope.db.link.updateMany({
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

function unlinkByUserId(userId, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const u = String(userId || '').trim();
  let removed = null;
  const removedSteamIds = [];
  for (const [sid, value] of scope.state.links.entries()) {
    if (value.userId === u) {
      if (!removed) {
        removed = { steamId: sid, ...value };
      }
      removedSteamIds.push(sid);
      scope.state.links.delete(sid);
    }
  }
  if (!removed) return null;

  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.link.deleteMany({ where: { userId: removed.userId } });
      await scope.db.playerAccount.upsert({
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

function unlinkBySteamId(steamId, options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  const s = normalizeSteamId(steamId);
  if (!s) return null;
  const value = scope.state.links.get(s);
  if (!value) return null;

  scope.state.mutationVersion += 1;
  scope.state.links.delete(s);
  queueDbWrite(
    scope,
    async () => {
      await scope.db.link.deleteMany({ where: { steamId: s } });
      await scope.db.playerAccount.upsert({
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

function listLinks(options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  return Array.from(scope.state.links.entries()).map(([steamId, value]) => ({
    steamId,
    ...value,
  }));
}

function replaceLinks(nextLinks = [], options = {}) {
  const scope = ensureLinkScope(options);
  void initLinkStore(options);
  scope.state.mutationVersion += 1;
  scope.state.links.clear();

  for (const rowRaw of Array.isArray(nextLinks) ? nextLinks : []) {
    const row = normalizeLinkRow(rowRaw);
    if (!row) continue;
    scope.state.links.set(row.steamId, {
      userId: row.userId,
      inGameName: row.inGameName,
      linkedAt: row.linkedAt,
    });
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.link.deleteMany({});
      await scope.db.playerAccount.updateMany({
        data: {
          steamId: null,
        },
      });
      for (const [steamId, value] of scope.state.links.entries()) {
        await scope.db.link.create({
          data: {
            steamId,
            userId: value.userId,
            inGameName: value.inGameName || null,
            linkedAt: value.linkedAt || new Date(),
          },
        });
        await scope.db.playerAccount.upsert({
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
  return scope.state.links.size;
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
