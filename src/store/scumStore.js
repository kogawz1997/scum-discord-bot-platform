const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    serverStatus: {
      onlinePlayers: 0,
      maxPlayers: 90,
      pingMs: null,
      uptimeMinutes: 0,
      lastUpdated: null,
    },
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureScumScope(options = {}) {
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
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeStatus(input = {}) {
  return {
    onlinePlayers: Number.isFinite(Number(input.onlinePlayers))
      ? Math.max(0, Math.trunc(Number(input.onlinePlayers)))
      : 0,
    maxPlayers: Number.isFinite(Number(input.maxPlayers))
      ? Math.max(0, Math.trunc(Number(input.maxPlayers)))
      : 90,
    pingMs:
      input.pingMs == null || !Number.isFinite(Number(input.pingMs))
        ? null
        : Math.max(0, Math.trunc(Number(input.pingMs))),
    uptimeMinutes: Number.isFinite(Number(input.uptimeMinutes))
      ? Math.max(0, Math.trunc(Number(input.uptimeMinutes)))
      : 0,
    lastUpdated: normalizeDate(input.lastUpdated),
  };
}

function applyStatus(scope, next = {}) {
  const current = scope.state.serverStatus;
  if (typeof next.onlinePlayers === 'number') {
    current.onlinePlayers = next.onlinePlayers;
  }
  if (typeof next.maxPlayers === 'number') {
    current.maxPlayers = next.maxPlayers;
  }
  if (typeof next.pingMs === 'number' || next.pingMs == null) {
    current.pingMs = next.pingMs == null ? null : next.pingMs;
  }
  if (typeof next.uptimeMinutes === 'number') {
    current.uptimeMinutes = next.uptimeMinutes;
  }
  if (next.lastUpdated === null || next.lastUpdated instanceof Date) {
    current.lastUpdated = next.lastUpdated;
  }
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[scumStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const row = await db.scumStatus.findUnique({
      where: { id: 1 },
    });
    if (!row) {
      const current = state.serverStatus;
      const hasLegacy =
        current.onlinePlayers !== 0 ||
        current.maxPlayers !== 90 ||
        current.pingMs != null ||
        current.uptimeMinutes !== 0 ||
        current.lastUpdated != null;
      if (hasLegacy) {
        await queueDbWrite(
          scope,
          async () => {
            await db.scumStatus.upsert({
              where: { id: 1 },
              update: {
                onlinePlayers: current.onlinePlayers,
                maxPlayers: current.maxPlayers,
                pingMs: current.pingMs,
                uptimeMinutes: current.uptimeMinutes,
                lastUpdated: current.lastUpdated,
              },
              create: {
                id: 1,
                onlinePlayers: current.onlinePlayers,
                maxPlayers: current.maxPlayers,
                pingMs: current.pingMs,
                uptimeMinutes: current.uptimeMinutes,
                lastUpdated: current.lastUpdated,
              },
            });
          },
          'backfill',
        );
      }
      return;
    }

    const parsed = normalizeStatus(row);
    if (startVersion === state.mutationVersion) {
      applyStatus(scope, parsed);
    }
  } catch (error) {
    console.error('[scumStore] failed to hydrate from prisma:', error.message);
  }
}

function initScumStore(options = {}) {
  const scope = ensureScumScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushScumStoreWrites(options = {}) {
  const scope = ensureScumScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function updateStatus(payload = {}, options = {}) {
  const scope = ensureScumScope(options);
  void initScumStore(options);
  scope.state.mutationVersion += 1;
  if (typeof payload.onlinePlayers === 'number') scope.state.serverStatus.onlinePlayers = payload.onlinePlayers;
  if (typeof payload.maxPlayers === 'number') scope.state.serverStatus.maxPlayers = payload.maxPlayers;
  if (typeof payload.pingMs === 'number') scope.state.serverStatus.pingMs = payload.pingMs;
  if (typeof payload.uptimeMinutes === 'number') scope.state.serverStatus.uptimeMinutes = payload.uptimeMinutes;
  scope.state.serverStatus.lastUpdated = new Date();

  const snapshot = getStatus(options);
  queueDbWrite(
    scope,
    async () => {
      await scope.db.scumStatus.upsert({
        where: { id: 1 },
        update: {
          onlinePlayers: snapshot.onlinePlayers,
          maxPlayers: snapshot.maxPlayers,
          pingMs: snapshot.pingMs,
          uptimeMinutes: snapshot.uptimeMinutes,
          lastUpdated: snapshot.lastUpdated,
        },
        create: {
          id: 1,
          onlinePlayers: snapshot.onlinePlayers,
          maxPlayers: snapshot.maxPlayers,
          pingMs: snapshot.pingMs,
          uptimeMinutes: snapshot.uptimeMinutes,
          lastUpdated: snapshot.lastUpdated,
        },
      });
    },
    'update-status',
  );
}

function getStatus(options = {}) {
  const scope = ensureScumScope(options);
  void initScumStore(options);
  return {
    ...scope.state.serverStatus,
    lastUpdated: scope.state.serverStatus.lastUpdated
      ? new Date(scope.state.serverStatus.lastUpdated)
      : null,
  };
}

function replaceStatus(nextStatus = {}, options = {}) {
  const scope = ensureScumScope(options);
  void initScumStore(options);
  if (!nextStatus || typeof nextStatus !== 'object') return getStatus(options);

  scope.state.mutationVersion += 1;
  const parsed = normalizeStatus(nextStatus);
  applyStatus(scope, {
    ...parsed,
    lastUpdated: parsed.lastUpdated || new Date(),
  });

  const snapshot = getStatus(options);
  queueDbWrite(
    scope,
    async () => {
      await scope.db.scumStatus.upsert({
        where: { id: 1 },
        update: {
          onlinePlayers: snapshot.onlinePlayers,
          maxPlayers: snapshot.maxPlayers,
          pingMs: snapshot.pingMs,
          uptimeMinutes: snapshot.uptimeMinutes,
          lastUpdated: snapshot.lastUpdated,
        },
        create: {
          id: 1,
          onlinePlayers: snapshot.onlinePlayers,
          maxPlayers: snapshot.maxPlayers,
          pingMs: snapshot.pingMs,
          uptimeMinutes: snapshot.uptimeMinutes,
          lastUpdated: snapshot.lastUpdated,
        },
      });
    },
    'replace-status',
  );
  return getStatus(options);
}

initScumStore();

module.exports = {
  updateStatus,
  getStatus,
  replaceStatus,
  initScumStore,
  flushScumStoreWrites,
};
