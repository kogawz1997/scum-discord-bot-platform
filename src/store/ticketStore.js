const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    tickets: new Map(),
    ticketCounter: 1,
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureTicketScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
}

function normalizeTicket(row = {}) {
  const channelId = String(row.channelId || '').trim();
  if (!channelId) return null;
  return {
    id: Number.isFinite(Number(row.id)) ? Math.max(0, Math.trunc(Number(row.id))) : 0,
    guildId: row.guildId ? String(row.guildId) : null,
    userId: row.userId ? String(row.userId) : null,
    channelId,
    category: row.category ? String(row.category) : null,
    reason: row.reason ? String(row.reason) : null,
    status: String(row.status || 'open'),
    claimedBy: row.claimedBy ? String(row.claimedBy) : null,
    createdAt: normalizeDate(row.createdAt, new Date()),
    closedAt: normalizeDate(row.closedAt, null),
  };
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[ticketStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const rows = await db.ticketRecord.findMany({
      orderBy: [{ createdAt: 'desc' }],
    });

    if (rows.length === 0) {
      if (state.tickets.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const value of state.tickets.values()) {
              await db.ticketRecord.upsert({
                where: { channelId: value.channelId },
                update: {
                  id: value.id,
                  guildId: value.guildId,
                  userId: value.userId,
                  category: value.category,
                  reason: value.reason,
                  status: value.status,
                  claimedBy: value.claimedBy,
                  createdAt: value.createdAt,
                  closedAt: value.closedAt,
                },
                create: {
                  channelId: value.channelId,
                  id: value.id,
                  guildId: value.guildId,
                  userId: value.userId,
                  category: value.category,
                  reason: value.reason,
                  status: value.status,
                  claimedBy: value.claimedBy,
                  createdAt: value.createdAt,
                  closedAt: value.closedAt,
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
      const parsed = normalizeTicket(row);
      if (!parsed) continue;
      hydrated.set(parsed.channelId, parsed);
    }

    if (startVersion === state.mutationVersion) {
      state.tickets.clear();
      for (const [channelId, value] of hydrated.entries()) {
        state.tickets.set(channelId, value);
      }
      const maxId = Math.max(0, ...Array.from(state.tickets.values()).map((t) => Number(t.id || 0)));
      state.ticketCounter = Math.max(1, maxId + 1);
      return;
    }

    for (const [channelId, value] of hydrated.entries()) {
      if (!state.tickets.has(channelId)) {
        state.tickets.set(channelId, value);
      }
    }
    const maxId = Math.max(0, ...Array.from(state.tickets.values()).map((t) => Number(t.id || 0)));
    state.ticketCounter = Math.max(state.ticketCounter, maxId + 1);
  } catch (error) {
    console.error('[ticketStore] failed to hydrate from prisma:', error.message);
  }
}

function initTicketStore(options = {}) {
  const scope = ensureTicketScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushTicketStoreWrites(options = {}) {
  const scope = ensureTicketScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function createTicket(payload = {}, options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  const id = scope.state.ticketCounter++;
  const t = normalizeTicket({
    id,
    guildId: payload.guildId,
    userId: payload.userId,
    channelId: payload.channelId,
    category: payload.category,
    reason: payload.reason,
    status: 'open',
    claimedBy: null,
    createdAt: new Date(),
    closedAt: null,
  });
  if (!t) return null;
  scope.state.tickets.set(t.channelId, t);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.ticketRecord.upsert({
        where: { channelId: t.channelId },
        update: {
          id: t.id,
          guildId: t.guildId,
          userId: t.userId,
          category: t.category,
          reason: t.reason,
          status: t.status,
          claimedBy: t.claimedBy,
          createdAt: t.createdAt,
          closedAt: t.closedAt,
        },
        create: {
          channelId: t.channelId,
          id: t.id,
          guildId: t.guildId,
          userId: t.userId,
          category: t.category,
          reason: t.reason,
          status: t.status,
          claimedBy: t.claimedBy,
          createdAt: t.createdAt,
          closedAt: t.closedAt,
        },
      });
    },
    'create-ticket',
  );
  return t;
}

function getTicketByChannel(channelId, options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  return scope.state.tickets.get(channelId) || null;
}

function listTickets(options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  return Array.from(scope.state.tickets.values());
}

function claimTicket(channelId, staffId, options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  const t = scope.state.tickets.get(channelId);
  if (!t) return null;
  t.status = 'claimed';
  t.claimedBy = String(staffId || '');
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.ticketRecord.updateMany({
        where: { channelId },
        data: {
          status: t.status,
          claimedBy: t.claimedBy,
        },
      });
    },
    'claim-ticket',
  );
  return t;
}

function closeTicket(channelId, options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  const t = scope.state.tickets.get(channelId);
  if (!t) return null;
  t.status = 'closed';
  t.closedAt = new Date();
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.ticketRecord.updateMany({
        where: { channelId },
        data: {
          status: t.status,
          closedAt: t.closedAt,
        },
      });
    },
    'close-ticket',
  );
  return t;
}

function replaceTickets(nextTickets = [], nextCounter = null, options = {}) {
  const scope = ensureTicketScope(options);
  void initTicketStore(options);
  scope.state.mutationVersion += 1;
  scope.state.tickets.clear();
  for (const row of Array.isArray(nextTickets) ? nextTickets : []) {
    const parsed = normalizeTicket(row);
    if (!parsed) continue;
    scope.state.tickets.set(parsed.channelId, parsed);
  }

  if (Number.isFinite(Number(nextCounter)) && Number(nextCounter) > 0) {
    scope.state.ticketCounter = Math.max(1, Math.trunc(Number(nextCounter)));
  } else {
    const maxId = Math.max(0, ...Array.from(scope.state.tickets.values()).map((t) => Number(t.id || 0)));
    scope.state.ticketCounter = maxId + 1;
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.ticketRecord.deleteMany({});
      for (const value of scope.state.tickets.values()) {
        await scope.db.ticketRecord.create({
          data: {
            channelId: value.channelId,
            id: value.id,
            guildId: value.guildId,
            userId: value.userId,
            category: value.category,
            reason: value.reason,
            status: value.status,
            claimedBy: value.claimedBy,
            createdAt: value.createdAt,
            closedAt: value.closedAt,
          },
        });
      }
    },
    'replace-tickets',
  );
  return scope.state.tickets.size;
}

initTicketStore();

module.exports = {
  createTicket,
  getTicketByChannel,
  listTickets,
  claimTicket,
  closeTicket,
  replaceTickets,
  initTicketStore,
  flushTicketStoreWrites,
};
