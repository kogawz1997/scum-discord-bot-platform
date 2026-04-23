// Redeem code store:
// - in-memory map for fast reads
// - Prisma write-through for persistent source of truth
// - legacy JSON snapshot retained as fallback/backup

const { resolveTenantStoreScope } = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    codes: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureRedeemScope(options = {}) {
  const scope = resolveTenantStoreScope({
    ...options,
    operation: String(options.operation || '').trim() || 'redeem store operation',
  });
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function ensureDefaultCodes(state) {
  if (!state.codes.has('WELCOME1000')) {
    state.codes.set('WELCOME1000', {
      type: 'coins',
      amount: 1000,
      itemId: null,
      usedBy: null,
      usedAt: null,
    });
  }
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (!['coins', 'item'].includes(type)) return null;
  return type;
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.trunc(amount));
}

function normalizeItemId(value) {
  const itemId = String(value || '').trim();
  return itemId || null;
}

function normalizeUsedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeRecord(input = {}) {
  const type = normalizeType(input.type);
  if (!type) return null;

  const data = {
    type,
    amount: null,
    itemId: null,
    usedBy: input.usedBy ? String(input.usedBy) : null,
    usedAt: normalizeUsedAt(input.usedAt),
  };

  if (type === 'coins') {
    data.amount = normalizeAmount(input.amount);
    data.itemId = null;
  } else {
    data.itemId = normalizeItemId(input.itemId);
    data.amount = null;
  }

  return data;
}

function toSerializableCode(code, value) {
  return {
    code,
    type: value.type,
    amount: value.amount == null ? null : Number(value.amount),
    itemId: value.itemId || null,
    usedBy: value.usedBy || null,
    usedAt: value.usedAt ? new Date(value.usedAt).toISOString() : null,
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
      console.error(`[redeemStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.redeemCode.findMany({
      orderBy: [{ code: 'asc' }],
    });

    if (rows.length === 0) {
      ensureDefaultCodes(state);
      if (state.codes.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [code, value] of state.codes.entries()) {
              await db.redeemCode.upsert({
                where: { code },
                update: {
                  type: value.type,
                  amount: value.amount,
                  itemId: value.itemId,
                  usedBy: value.usedBy,
                  usedAt: value.usedAt,
                },
                create: {
                  code,
                  type: value.type,
                  amount: value.amount,
                  itemId: value.itemId,
                  usedBy: value.usedBy,
                  usedAt: value.usedAt,
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
      const code = normalizeCode(row.code);
      const value = normalizeRecord(row);
      if (!code || !value) continue;
      hydrated.set(code, value);
    }
    ensureDefaultCodes({ codes: hydrated });

    if (startVersion === state.mutationVersion) {
      state.codes.clear();
      for (const [code, value] of hydrated.entries()) {
        state.codes.set(code, value);
      }
      return;
    }

    for (const [code, value] of hydrated.entries()) {
      if (!state.codes.has(code)) {
        state.codes.set(code, value);
      }
    }
    ensureDefaultCodes(state);
  } catch (error) {
    console.error('[redeemStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initRedeemStore(options = {}) {
  const scope = ensureRedeemScope(options);
  ensureDefaultCodes(scope.state);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushRedeemStoreWrites(options = {}) {
  const scope = ensureRedeemScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function getCode(code, options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const value = scope.state.codes.get(normalized);
  if (!value) return null;
  return {
    ...value,
    usedAt: value.usedAt ? new Date(value.usedAt) : null,
  };
}

function markUsed(code, userId, options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const value = scope.state.codes.get(normalized);
  if (!value) return null;

  scope.state.mutationVersion += 1;
  const usedAt = new Date();
  value.usedBy = String(userId || '');
  value.usedAt = usedAt;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.redeemCode.upsert({
        where: { code: normalized },
        update: {
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: value.usedBy,
          usedAt,
        },
        create: {
          code: normalized,
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: value.usedBy,
          usedAt,
        },
      });
    },
    'mark-used',
  );

  return getCode(normalized, options);
}

function setCode(code, payload, options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, reason: 'invalid-code' };

  const value = normalizeRecord({
    type: payload?.type,
    amount: payload?.amount,
    itemId: payload?.itemId,
    usedBy: null,
    usedAt: null,
  });
  if (!value) {
    return { ok: false, reason: 'invalid-type' };
  }

  scope.state.mutationVersion += 1;
  scope.state.codes.set(normalized, value);

  queueDbWrite(
    scope,
    async () => {
      await scope.db.redeemCode.upsert({
        where: { code: normalized },
        update: {
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: null,
          usedAt: null,
        },
        create: {
          code: normalized,
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: null,
          usedAt: null,
        },
      });
    },
    'set-code',
  );

  return { ok: true, code: normalized, value: getCode(normalized, options) };
}

function deleteCode(code, options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  const existed = scope.state.codes.delete(normalized);
  if (!existed) return false;

  scope.state.mutationVersion += 1;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.redeemCode.deleteMany({
        where: { code: normalized },
      });
    },
    'delete-code',
  );
  return true;
}

function resetCodeUsage(code, options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const value = scope.state.codes.get(normalized);
  if (!value) return null;

  scope.state.mutationVersion += 1;
  value.usedBy = null;
  value.usedAt = null;

  queueDbWrite(
    scope,
    async () => {
      await scope.db.redeemCode.upsert({
        where: { code: normalized },
        update: {
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: null,
          usedAt: null,
        },
        create: {
          code: normalized,
          type: value.type,
          amount: value.amount,
          itemId: value.itemId,
          usedBy: null,
          usedAt: null,
        },
      });
    },
    'reset-code-usage',
  );

  return getCode(normalized, options);
}

function listCodes(options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  return Array.from(scope.state.codes.entries()).map(([code, value]) =>
    toSerializableCode(code, value));
}

function replaceCodes(nextCodes = [], options = {}) {
  const scope = ensureRedeemScope(options);
  void initRedeemStore(options);
  scope.state.mutationVersion += 1;
  scope.state.codes.clear();

  for (const row of Array.isArray(nextCodes) ? nextCodes : []) {
    if (!row || typeof row !== 'object') continue;
    const code = normalizeCode(row.code);
    const value = normalizeRecord(row);
    if (!code || !value) continue;
    scope.state.codes.set(code, value);
  }

  ensureDefaultCodes(scope.state);

  queueDbWrite(
    scope,
    async () => {
      await scope.db.redeemCode.deleteMany({});
      for (const [code, value] of scope.state.codes.entries()) {
        await scope.db.redeemCode.create({
          data: {
            code,
            type: value.type,
            amount: value.amount,
            itemId: value.itemId,
            usedBy: value.usedBy,
            usedAt: value.usedAt,
          },
        });
      }
    },
    'replace-codes',
  );

  return scope.state.codes.size;
}

initRedeemStore();

module.exports = {
  getCode,
  markUsed,
  setCode,
  deleteCode,
  resetCodeUsage,
  listCodes,
  replaceCodes,
  initRedeemStore,
  flushRedeemStoreWrites,
};
