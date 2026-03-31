const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    events: new Map(),
    eventParticipants: new Map(),
    eventCounter: 1,
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
  };
}

function ensureEventScope(options = {}) {
  const scope = resolveTenantStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeEvent(row = {}) {
  const id = Number(row.id || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id: Math.trunc(id),
    name: String(row.name || ''),
    time: String(row.time || ''),
    reward: String(row.reward || ''),
    status: String(row.status || 'scheduled'),
  };
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[eventStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  try {
    const rows = await db.guildEvent.findMany({
      include: {
        participants: true,
      },
      orderBy: { id: 'asc' },
    });

    if (rows.length === 0) {
      if (state.events.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const ev of state.events.values()) {
              await db.guildEvent.upsert({
                where: { id: ev.id },
                update: {
                  name: ev.name,
                  time: ev.time,
                  reward: ev.reward,
                  status: ev.status,
                },
                create: {
                  id: ev.id,
                  name: ev.name,
                  time: ev.time,
                  reward: ev.reward,
                  status: ev.status,
                },
              });
              const participants = state.eventParticipants.get(ev.id) || new Set();
              for (const userId of participants) {
                await db.guildEventParticipant.upsert({
                  where: {
                    eventId_userId: {
                      eventId: ev.id,
                      userId,
                    },
                  },
                  update: {},
                  create: {
                    eventId: ev.id,
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

    const hydratedEvents = new Map();
    const hydratedParticipants = new Map();
    for (const row of rows) {
      const ev = normalizeEvent(row);
      if (!ev) continue;
      hydratedEvents.set(ev.id, ev);
      hydratedParticipants.set(
        ev.id,
        new Set(
          (Array.isArray(row.participants) ? row.participants : [])
            .map((p) => String(p.userId || '').trim())
            .filter(Boolean),
        ),
      );
    }

    if (startVersion === state.mutationVersion) {
      state.events.clear();
      state.eventParticipants.clear();
      for (const [id, ev] of hydratedEvents.entries()) {
        state.events.set(id, ev);
      }
      for (const [id, set] of hydratedParticipants.entries()) {
        state.eventParticipants.set(id, set);
      }
      const maxId = Math.max(0, ...Array.from(state.events.keys()).map((n) => Number(n)));
      state.eventCounter = Math.max(1, maxId + 1);
      return;
    }

    for (const [id, ev] of hydratedEvents.entries()) {
      if (!state.events.has(id)) {
        state.events.set(id, ev);
      }
      if (!state.eventParticipants.has(id)) {
        state.eventParticipants.set(id, hydratedParticipants.get(id) || new Set());
      }
    }
    const maxId = Math.max(0, ...Array.from(state.events.keys()).map((n) => Number(n)));
    state.eventCounter = Math.max(state.eventCounter, maxId + 1);
  } catch (error) {
    console.error('[eventStore] failed to hydrate from prisma:', error.message);
  }
}

function initEventStore(options = {}) {
  const scope = ensureEventScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushEventStoreWrites(options = {}) {
  const scope = ensureEventScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function createEvent(payload = {}, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const id = scope.state.eventCounter++;
  const ev = {
    id,
    name: String(payload.name || ''),
    time: String(payload.time || ''),
    reward: String(payload.reward || ''),
    status: 'scheduled',
  };
  scope.state.events.set(id, ev);
  scope.state.eventParticipants.set(id, new Set());
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEvent.upsert({
        where: { id },
        update: {
          name: ev.name,
          time: ev.time,
          reward: ev.reward,
          status: ev.status,
        },
        create: {
          id,
          name: ev.name,
          time: ev.time,
          reward: ev.reward,
          status: ev.status,
        },
      });
    },
    'create-event',
  );
  return ev;
}

function getEvent(id, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  return scope.state.events.get(id) || null;
}

function listEvents(options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  return Array.from(scope.state.events.values());
}

function joinEvent(id, userId, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const eventId = Number(id);
  const ev = scope.state.events.get(eventId);
  if (!ev) return null;
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return null;
  const set = scope.state.eventParticipants.get(eventId) || new Set();
  set.add(normalizedUserId);
  scope.state.eventParticipants.set(eventId, set);
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEventParticipant.upsert({
        where: {
          eventId_userId: {
            eventId,
            userId: normalizedUserId,
          },
        },
        update: {},
        create: {
          eventId,
          userId: normalizedUserId,
        },
      });
    },
    'join-event',
  );
  return { ev, participants: set };
}

function startEvent(id, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const eventId = Number(id);
  const ev = scope.state.events.get(eventId);
  if (!ev) return null;
  ev.status = 'started';
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEvent.updateMany({
        where: { id: eventId },
        data: {
          status: ev.status,
        },
      });
    },
    'start-event',
  );
  return ev;
}

function updateEvent(id, payload = {}, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const eventId = Number(id);
  const ev = scope.state.events.get(eventId);
  if (!ev) return null;

  const nextName = String(payload.name == null ? ev.name : payload.name).trim();
  const nextTime = String(payload.time == null ? ev.time : payload.time).trim();
  const nextReward = String(payload.reward == null ? ev.reward : payload.reward).trim();
  if (!nextName || !nextTime || !nextReward) return null;

  ev.name = nextName;
  ev.time = nextTime;
  ev.reward = nextReward;
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEvent.updateMany({
        where: { id: eventId },
        data: {
          name: ev.name,
          time: ev.time,
          reward: ev.reward,
        },
      });
    },
    'update-event',
  );
  return ev;
}

function endEvent(id, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const eventId = Number(id);
  const ev = scope.state.events.get(eventId);
  if (!ev) return null;
  ev.status = 'ended';
  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEvent.updateMany({
        where: { id: eventId },
        data: {
          status: ev.status,
        },
      });
    },
    'end-event',
  );
  return ev;
}

function getParticipants(id, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  const eventId = Number(id);
  const set = scope.state.eventParticipants.get(eventId);
  if (!set) return [];
  return Array.from(set);
}

function replaceEvents(nextEvents = [], nextParticipants = [], nextCounter = null, options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  scope.state.mutationVersion += 1;
  scope.state.events.clear();
  scope.state.eventParticipants.clear();

  for (const row of Array.isArray(nextEvents) ? nextEvents : []) {
    const parsed = normalizeEvent(row);
    if (!parsed) continue;
    scope.state.events.set(parsed.id, parsed);
    scope.state.eventParticipants.set(parsed.id, new Set());
  }

  if (Array.isArray(nextParticipants)) {
    for (const row of nextParticipants) {
      if (!row || typeof row !== 'object') continue;
      const eventId = Number(row.eventId || row.id || 0);
      if (!Number.isFinite(eventId) || eventId <= 0) continue;
      const set = scope.state.eventParticipants.get(eventId) || new Set();
      for (const userId of Array.isArray(row.participants) ? row.participants : []) {
        const normalized = String(userId || '').trim();
        if (normalized) set.add(normalized);
      }
      scope.state.eventParticipants.set(eventId, set);
    }
  }

  if (Number.isFinite(Number(nextCounter)) && Number(nextCounter) > 0) {
    scope.state.eventCounter = Math.max(1, Math.trunc(Number(nextCounter)));
  } else {
    const maxId = Math.max(0, ...Array.from(scope.state.events.keys()).map((n) => Number(n)));
    scope.state.eventCounter = maxId + 1;
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.guildEventParticipant.deleteMany({});
      await scope.db.guildEvent.deleteMany({});
      for (const ev of scope.state.events.values()) {
        await scope.db.guildEvent.create({
          data: {
            id: ev.id,
            name: ev.name,
            time: ev.time,
            reward: ev.reward,
            status: ev.status,
          },
        });
      }
      for (const [eventId, participants] of scope.state.eventParticipants.entries()) {
        for (const userId of participants) {
          await scope.db.guildEventParticipant.create({
            data: {
              eventId,
              userId,
            },
          });
        }
      }
    },
    'replace-events',
  );
  return scope.state.events.size;
}

function listAllEventsWithParticipants(options = {}) {
  const scope = ensureEventScope(options);
  void initEventStore(options);
  return Array.from(scope.state.events.values()).map((event) => ({
    ...event,
    participants: getParticipants(event.id, options),
  }));
}

initEventStore();

module.exports = {
  createEvent,
  getEvent,
  listEvents,
  joinEvent,
  updateEvent,
  startEvent,
  endEvent,
  getParticipants,
  listAllEventsWithParticipants,
  replaceEvents,
  initEventStore,
  flushEventStoreWrites,
};
