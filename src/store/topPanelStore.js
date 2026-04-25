const {
  assertTenantStoreMutationScope,
  resolveTenantStoreScope,
} = require('./tenantStoreScope');

const PANEL_TYPES = new Set([
  'topKiller',
  'topGunKill',
  'topKd',
  'topPlaytime',
  'topEconomy',
]);
const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    panelsByGuild: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureTopPanelScope(options = {}) {
  const scope = resolveTenantStoreScope({
    ...options,
    operation: String(options.operation || '').trim() || 'top panel store operation',
  });
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizePanelType(panelType) {
  const raw = String(panelType || '').trim();
  if (!raw) return null;
  if (raw === 'top-killer') return 'topKiller';
  if (raw === 'top-gun-kill' || raw === 'top-gun') return 'topGunKill';
  if (raw === 'top-kd') return 'topKd';
  if (raw === 'top-playtime') return 'topPlaytime';
  if (raw === 'top-economy') return 'topEconomy';
  if (PANEL_TYPES.has(raw)) return raw;
  return null;
}

function normalizeRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const channelId = String(ref.channelId || '').trim();
  const messageId = String(ref.messageId || '').trim();
  if (!channelId || !messageId) return null;
  return {
    channelId,
    messageId,
    updatedAt: ref.updatedAt ? new Date(ref.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function normalizeState(input) {
  const state = {
    topKiller: null,
    topGunKill: null,
    topKd: null,
    topPlaytime: null,
    topEconomy: null,
  };
  if (!input || typeof input !== 'object') return state;

  state.topKiller = normalizeRef(input.topKiller);
  state.topGunKill = normalizeRef(input.topGunKill);
  state.topKd = normalizeRef(input.topKd);
  state.topPlaytime = normalizeRef(input.topPlaytime);
  state.topEconomy = normalizeRef(input.topEconomy);
  return state;
}

function queueDbWrite(scope, work, label) {
  const { state } = scope;
  state.dbWriteQueue = state.dbWriteQueue
    .then(async () => {
      if (state.initPromise && !state.isHydrating) {
        await state.initPromise;
      }
      await work();
    })
    .catch((error) => {
      console.error(`[topPanelStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.topPanelMessage.findMany({
      orderBy: [{ guildId: 'asc' }, { panelType: 'asc' }],
    });
    if (rows.length === 0) {
      if (state.panelsByGuild.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [guildId, panelState] of state.panelsByGuild.entries()) {
              for (const panelType of PANEL_TYPES.values()) {
                const ref = panelState?.[panelType];
                if (!ref) continue;
                await db.topPanelMessage.upsert({
                  where: {
                    guildId_panelType: {
                      guildId,
                      panelType,
                    },
                  },
                  update: {
                    channelId: ref.channelId,
                    messageId: ref.messageId,
                    updatedAt: new Date(ref.updatedAt),
                  },
                  create: {
                    guildId,
                    panelType,
                    channelId: ref.channelId,
                    messageId: ref.messageId,
                    updatedAt: new Date(ref.updatedAt),
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

    const hydrated = new Map();
    for (const row of rows) {
      const guildId = String(row.guildId || '').trim();
      const panelType = normalizePanelType(row.panelType);
      if (!guildId || !panelType) continue;
      const panelState = hydrated.get(guildId) || normalizeState(null);
      panelState[panelType] = normalizeRef({
        channelId: row.channelId,
        messageId: row.messageId,
        updatedAt: row.updatedAt,
      });
      hydrated.set(guildId, panelState);
    }

    if (startVersion === state.mutationVersion) {
      state.panelsByGuild.clear();
      for (const [guildId, panelState] of hydrated.entries()) {
        state.panelsByGuild.set(guildId, panelState);
      }
      return;
    }

    for (const [guildId, panelState] of hydrated.entries()) {
      if (!state.panelsByGuild.has(guildId)) {
        state.panelsByGuild.set(guildId, panelState);
      }
    }
  } catch (error) {
    console.error('[topPanelStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initTopPanelStore(options = {}) {
  const scope = ensureTopPanelScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushTopPanelStoreWrites(options = {}) {
  const scope = ensureTopPanelScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function getGuildState(guildId, createIfMissing = false, options = {}) {
  const scope = ensureTopPanelScope(options);
  void initTopPanelStore(options);
  const key = String(guildId || '').trim();
  if (!key) return null;
  let state = scope.state.panelsByGuild.get(key) || null;
  if (!state && createIfMissing) {
    state = normalizeState(null);
    scope.state.panelsByGuild.set(key, state);
  }
  return state;
}

function setTopPanelMessage(guildId, panelType, channelId, messageId, options = {}) {
  const scope = ensureTopPanelScope(options);
  assertTenantStoreMutationScope(scope, options, 'set top panel message', 'top-panel-message');
  void initTopPanelStore(options);
  const key = normalizePanelType(panelType);
  if (!key) return null;
  const state = getGuildState(guildId, true, options);
  if (!state) return null;
  state[key] = normalizeRef({ channelId, messageId, updatedAt: new Date().toISOString() });
  scope.state.mutationVersion += 1;

  const guildKey = String(guildId || '').trim();
  const ref = state[key];
  queueDbWrite(
    scope,
    async () => {
      if (!ref) return;
      await scope.db.topPanelMessage.upsert({
        where: {
          guildId_panelType: {
            guildId: guildKey,
            panelType: key,
          },
        },
        update: {
          channelId: ref.channelId,
          messageId: ref.messageId,
          updatedAt: new Date(ref.updatedAt),
        },
        create: {
          guildId: guildKey,
          panelType: key,
          channelId: ref.channelId,
          messageId: ref.messageId,
          updatedAt: new Date(ref.updatedAt),
        },
      });
    },
    'set-top-panel',
  );
  return state[key];
}

function getTopPanelMessage(guildId, panelType, options = {}) {
  const key = normalizePanelType(panelType);
  if (!key) return null;
  const state = getGuildState(guildId, false, options);
  if (!state) return null;
  return state[key] || null;
}

function removeTopPanelMessage(guildId, panelType, options = {}) {
  const scope = ensureTopPanelScope(options);
  assertTenantStoreMutationScope(scope, options, 'remove top panel message', 'top-panel-message');
  void initTopPanelStore(options);
  const key = normalizePanelType(panelType);
  if (!key) return false;
  const state = getGuildState(guildId, false, options);
  if (!state || !state[key]) return false;
  state[key] = null;
  scope.state.mutationVersion += 1;

  const guildKey = String(guildId || '').trim();
  queueDbWrite(
    scope,
    async () => {
      await scope.db.topPanelMessage.deleteMany({
        where: {
          guildId: guildKey,
          panelType: key,
        },
      });
    },
    'remove-top-panel',
  );
  return true;
}

function getTopPanelsForGuild(guildId, options = {}) {
  const state = getGuildState(guildId, false, options);
  if (!state) {
    return {
      topKiller: null,
      topGunKill: null,
      topKd: null,
      topPlaytime: null,
      topEconomy: null,
    };
  }
  return {
    topKiller: state.topKiller || null,
    topGunKill: state.topGunKill || null,
    topKd: state.topKd || null,
    topPlaytime: state.topPlaytime || null,
    topEconomy: state.topEconomy || null,
  };
}

function listTopPanels(options = {}) {
  const scope = ensureTopPanelScope(options);
  void initTopPanelStore(options);
  return Array.from(scope.state.panelsByGuild.entries()).map(([guildId, panelState]) => ({
    guildId,
    topKiller: panelState?.topKiller || null,
    topGunKill: panelState?.topGunKill || null,
    topKd: panelState?.topKd || null,
    topPlaytime: panelState?.topPlaytime || null,
    topEconomy: panelState?.topEconomy || null,
  }));
}

function replaceTopPanels(nextPanels = [], options = {}) {
  const scope = ensureTopPanelScope(options);
  assertTenantStoreMutationScope(scope, options, 'replace top panel messages', 'top-panel-message');
  void initTopPanelStore(options);
  scope.state.mutationVersion += 1;
  scope.state.panelsByGuild.clear();
  for (const row of Array.isArray(nextPanels) ? nextPanels : []) {
    if (!row || typeof row !== 'object') continue;
    const guildId = String(row.guildId || '').trim();
    if (!guildId) continue;
    scope.state.panelsByGuild.set(guildId, normalizeState(row));
  }

  queueDbWrite(
    scope,
    async () => {
      await scope.db.topPanelMessage.deleteMany({});
      for (const [guildId, panelState] of scope.state.panelsByGuild.entries()) {
        for (const panelType of PANEL_TYPES.values()) {
          const ref = panelState?.[panelType];
          if (!ref) continue;
          await scope.db.topPanelMessage.create({
            data: {
              guildId,
              panelType,
              channelId: ref.channelId,
              messageId: ref.messageId,
              updatedAt: new Date(ref.updatedAt),
            },
          });
        }
      }
    },
    'replace-top-panels',
  );
  return scope.state.panelsByGuild.size;
}

initTopPanelStore();

module.exports = {
  normalizePanelType,
  setTopPanelMessage,
  getTopPanelMessage,
  removeTopPanelMessage,
  getTopPanelsForGuild,
  listTopPanels,
  replaceTopPanels,
  initTopPanelStore,
  flushTopPanelStoreWrites,
};
