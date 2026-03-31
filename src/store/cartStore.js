const {
  resolveTenantServerStoreScope,
  buildServerScopedUserKey,
  parseServerScopedUserKey,
  matchesServerScope,
} = require('./tenantStoreScope');

const scopeStateByDatasource = new Map();

function createScopeState() {
  return {
    carts: new Map(),
    mutationVersion: 0,
    dbWriteQueue: Promise.resolve(),
    initPromise: null,
    isHydrating: false,
  };
}

function ensureCartScope(options = {}) {
  const scope = resolveTenantServerStoreScope(options);
  if (!scopeStateByDatasource.has(scope.datasourceKey)) {
    scopeStateByDatasource.set(scope.datasourceKey, createScopeState());
  }
  return {
    ...scope,
    state: scopeStateByDatasource.get(scope.datasourceKey),
  };
}

function normalizeUserId(value) {
  return String(value || '').trim();
}

function normalizeItemId(value) {
  return String(value || '').trim();
}

function normalizeQuantity(value, fallback = 1, min = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.trunc(n));
}

function normalizeIsoDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function toSerializableCart(userId, cart) {
  const parsed = parseServerScopedUserKey(userId);
  return {
    userId: parsed.userId,
    serverId: parsed.serverId,
    updatedAt: cart.updatedAt || new Date().toISOString(),
    items: Array.from(cart.items.entries()).map(([itemId, quantity]) => ({
      itemId,
      quantity: normalizeQuantity(quantity, 1, 1),
    })),
  };
}

function fromSerializableCart(row, options = {}) {
  if (!row || typeof row !== 'object') return null;
  const userId = buildServerScopedUserKey(row.userId, {
    ...options,
    serverId: row.serverId || options.serverId,
  });
  if (!userId) return null;

  const items = new Map();
  for (const item of Array.isArray(row.items) ? row.items : []) {
    const itemId = normalizeItemId(item?.itemId);
    if (!itemId) continue;
    items.set(itemId, normalizeQuantity(item?.quantity, 1, 1));
  }

  return {
    userId,
    cart: {
      items,
      updatedAt: normalizeIsoDate(row.updatedAt).toISOString(),
    },
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
      console.error(`[cartStore] prisma ${label} failed:`, error.message);
    });
  return state.dbWriteQueue;
}

async function hydrateFromPrisma(scope) {
  const { db, state } = scope;
  const startVersion = state.mutationVersion;
  state.isHydrating = true;
  try {
    const rows = await db.cartEntry.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (rows.length === 0) {
      if (state.carts.size > 0) {
        await queueDbWrite(
          scope,
          async () => {
            for (const [userId, cart] of state.carts.entries()) {
              for (const [itemId, quantity] of cart.items.entries()) {
                await db.cartEntry.upsert({
                  where: {
                    userId_itemId: {
                      userId,
                      itemId,
                    },
                  },
                  update: {
                    quantity,
                    updatedAt: normalizeIsoDate(cart.updatedAt),
                  },
                  create: {
                    userId,
                    itemId,
                    quantity,
                    updatedAt: normalizeIsoDate(cart.updatedAt),
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
      const userId = normalizeUserId(row.userId);
      const itemId = normalizeItemId(row.itemId);
      const quantity = normalizeQuantity(row.quantity, 1, 1);
      if (!userId || !itemId) continue;

      let cart = hydrated.get(userId);
      if (!cart) {
        cart = {
          items: new Map(),
          updatedAt: normalizeIsoDate(row.updatedAt).toISOString(),
        };
        hydrated.set(userId, cart);
      }
      cart.items.set(itemId, quantity);

      const rowUpdatedAt = normalizeIsoDate(row.updatedAt).toISOString();
      if (rowUpdatedAt > cart.updatedAt) {
        cart.updatedAt = rowUpdatedAt;
      }
    }

    if (startVersion === state.mutationVersion) {
      state.carts.clear();
      for (const [userId, cart] of hydrated.entries()) {
        state.carts.set(userId, cart);
      }
      return;
    }

    for (const [userId, cart] of hydrated.entries()) {
      if (!state.carts.has(userId)) {
        state.carts.set(userId, cart);
        continue;
      }
      const current = state.carts.get(userId);
      for (const [itemId, qty] of cart.items.entries()) {
        if (!current.items.has(itemId)) {
          current.items.set(itemId, qty);
        }
      }
      if (cart.updatedAt > current.updatedAt) {
        current.updatedAt = cart.updatedAt;
      }
    }
  } catch (error) {
    console.error('[cartStore] failed to hydrate from prisma:', error.message);
  } finally {
    state.isHydrating = false;
  }
}

function initCartStore(options = {}) {
  const scope = ensureCartScope(options);
  if (!scope.state.initPromise) {
    scope.state.initPromise = hydrateFromPrisma(scope);
  }
  return scope.state.initPromise;
}

async function flushCartStoreWrites(options = {}) {
  const scope = ensureCartScope(options);
  if (scope.state.initPromise) {
    await scope.state.initPromise.catch(() => null);
  }
  await scope.state.dbWriteQueue;
}

function getOrCreateCart(userId, options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  const key = buildServerScopedUserKey(userId, options);
  if (!key) return null;

  let cart = scope.state.carts.get(key);
  if (!cart) {
    cart = {
      items: new Map(),
      updatedAt: new Date().toISOString(),
    };
    scope.state.carts.set(key, cart);
  }
  return cart;
}

function touchCart(cart) {
  if (!cart) return;
  cart.updatedAt = new Date().toISOString();
}

function listCartItems(userId, options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  const key = buildServerScopedUserKey(userId, options);
  if (!key) return [];
  const cart = scope.state.carts.get(key);
  if (!cart) return [];
  return Array.from(cart.items.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity: normalizeQuantity(quantity, 1, 1),
  }));
}

function getCartUnits(userId, options = {}) {
  return listCartItems(userId, options).reduce((sum, row) => sum + row.quantity, 0);
}

function addCartItem(userId, itemId, quantity = 1, options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  const key = buildServerScopedUserKey(userId, options);
  const itemKey = normalizeItemId(itemId);
  if (!key || !itemKey) return null;

  scope.state.mutationVersion += 1;
  const cart = getOrCreateCart(key, options);
  const nextQty = normalizeQuantity(quantity, 1, 1);
  const prev = normalizeQuantity(cart.items.get(itemKey) || 0, 0, 0);
  const updatedQty = Math.max(1, prev + nextQty);
  cart.items.set(itemKey, updatedQty);
  touchCart(cart);

  const updatedAt = normalizeIsoDate(cart.updatedAt);
  queueDbWrite(
    scope,
    async () => {
      await scope.db.cartEntry.upsert({
        where: {
          userId_itemId: {
            userId: key,
            itemId: itemKey,
          },
        },
        update: {
          quantity: updatedQty,
          updatedAt,
        },
        create: {
          userId: key,
          itemId: itemKey,
          quantity: updatedQty,
          updatedAt,
        },
      });
    },
    'add-item',
  );

  return {
    itemId: itemKey,
    quantity: updatedQty,
    units: getCartUnits(key, options),
  };
}

function removeCartItem(userId, itemId, quantity = 1, options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  const key = buildServerScopedUserKey(userId, options);
  const itemKey = normalizeItemId(itemId);
  if (!key || !itemKey) return null;

  const cart = scope.state.carts.get(key);
  if (!cart || !cart.items.has(itemKey)) return null;

  scope.state.mutationVersion += 1;
  const dec = normalizeQuantity(quantity, 1, 1);
  const current = normalizeQuantity(cart.items.get(itemKey) || 0, 0, 0);
  const next = current - dec;
  if (next <= 0) {
    cart.items.delete(itemKey);
  } else {
    cart.items.set(itemKey, next);
  }

  if (cart.items.size === 0) {
    scope.state.carts.delete(key);
  } else {
    touchCart(cart);
  }

  if (next <= 0) {
    queueDbWrite(
      scope,
      async () => {
        await scope.db.cartEntry.deleteMany({
          where: {
            userId: key,
            itemId: itemKey,
          },
        });
      },
      'remove-item-delete',
    );
  } else {
    const updatedAt = normalizeIsoDate(cart.updatedAt);
    queueDbWrite(
      scope,
      async () => {
        await scope.db.cartEntry.upsert({
          where: {
            userId_itemId: {
              userId: key,
              itemId: itemKey,
            },
          },
          update: {
            quantity: next,
            updatedAt,
          },
          create: {
            userId: key,
            itemId: itemKey,
            quantity: next,
            updatedAt,
          },
        });
      },
      'remove-item-upsert',
    );
  }

  return {
    itemId: itemKey,
    quantity: next > 0 ? next : 0,
    units: getCartUnits(key, options),
  };
}

function clearCart(userId, options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  const key = buildServerScopedUserKey(userId, options);
  if (!key) return false;

  const existed = scope.state.carts.delete(key);
  if (!existed) return false;

  scope.state.mutationVersion += 1;
  queueDbWrite(
    scope,
    async () => {
      await scope.db.cartEntry.deleteMany({
        where: {
          userId: key,
        },
      });
    },
    'clear-cart',
  );
  return true;
}

function listAllCarts(options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  return Array.from(scope.state.carts.entries())
    .filter(([userId]) => matchesServerScope(userId, options))
    .map(([userId, cart]) => toSerializableCart(userId, cart));
}

function replaceCarts(nextCarts = [], options = {}) {
  const scope = ensureCartScope(options);
  void initCartStore(options);
  scope.state.mutationVersion += 1;
  if (options.serverId) {
    for (const userId of Array.from(scope.state.carts.keys())) {
      if (matchesServerScope(userId, options)) {
        scope.state.carts.delete(userId);
      }
    }
  } else {
    scope.state.carts.clear();
  }
  for (const row of Array.isArray(nextCarts) ? nextCarts : []) {
    const parsed = fromSerializableCart(row, options);
    if (!parsed) continue;
    scope.state.carts.set(parsed.userId, parsed.cart);
  }

  queueDbWrite(
    scope,
    async () => {
      if (options.serverId) {
        const existingRows = await scope.db.cartEntry.findMany();
        for (const row of existingRows) {
          if (!matchesServerScope(row.userId, options)) continue;
          await scope.db.cartEntry.deleteMany({
            where: {
              userId: row.userId,
            },
          });
        }
      } else {
        await scope.db.cartEntry.deleteMany({});
      }
      for (const [userId, cart] of scope.state.carts.entries()) {
        if (!matchesServerScope(userId, options)) continue;
        const updatedAt = normalizeIsoDate(cart.updatedAt);
        for (const [itemId, quantity] of cart.items.entries()) {
          await scope.db.cartEntry.create({
            data: {
              userId,
              itemId,
              quantity: normalizeQuantity(quantity, 1, 1),
              updatedAt,
            },
          });
        }
      }
    },
    'replace-carts',
  );

  return scope.state.carts.size;
}

initCartStore();

module.exports = {
  addCartItem,
  removeCartItem,
  clearCart,
  listCartItems,
  getCartUnits,
  listAllCarts,
  replaceCarts,
  initCartStore,
  flushCartStoreWrites,
};
