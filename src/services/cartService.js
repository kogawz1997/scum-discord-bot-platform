const { getWallet, getShopItemById } = require('../store/memoryStore');
const {
  addCartItem,
  removeCartItem,
  listCartItems,
  clearCart,
} = require('../store/cartStore');
const { debitCoins, creditCoins } = require('./coinService');
const {
  normalizeShopKind,
  buildBundleSummary,
  getDeliveryStatusText,
  createQueuedPurchase,
} = require('./shopService');

function normalizeQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

async function getResolvedCart(userId, options = {}) {
  const listCartItemsFn = options.listCartItemsFn || listCartItems;
  const getShopItemByIdFn = options.getShopItemByIdFn || getShopItemById;

  const rows = await Promise.resolve(listCartItemsFn(userId));
  const resolved = [];
  const missingItemIds = [];

  for (const row of rows) {
    const item = await getShopItemByIdFn(row.itemId);
    if (!item) {
      missingItemIds.push(row.itemId);
      continue;
    }
    const quantity = normalizeQty(row.quantity);
    resolved.push({
      itemId: row.itemId,
      quantity,
      item,
      lineTotal: Number(item.price || 0) * quantity,
    });
  }

  const totalPrice = resolved.reduce((sum, row) => sum + row.lineTotal, 0);
  const totalUnits = resolved.reduce((sum, row) => sum + row.quantity, 0);

  return {
    rows: resolved,
    missingItemIds,
    totalPrice,
    totalUnits,
  };
}

async function checkoutCart(userId, options = {}) {
  const guildId = options.guildId || null;
  const actor = options.actor || `discord:${userId}`;
  const source = options.source || 'cart-checkout';
  const resolved = await getResolvedCart(userId, options);

  if (resolved.rows.length === 0) {
    return {
      ok: false,
      reason: 'empty',
      ...resolved,
    };
  }

  const debitCoinsFn = options.debitCoinsFn || debitCoins;
  const creditCoinsFn = options.creditCoinsFn || creditCoins;
  const createQueuedPurchaseFn = options.createQueuedPurchaseFn || createQueuedPurchase;

  let walletBalance = Number((await getWallet(userId))?.balance || 0);
  if (resolved.totalPrice > 0) {
    const debit = await debitCoinsFn({
      userId,
      amount: resolved.totalPrice,
      reason: 'cart_checkout_debit',
      actor,
      meta: {
        source,
        units: resolved.totalUnits,
        rows: resolved.rows.length,
      },
    });
    if (!debit.ok) {
      return {
        ok: false,
        reason: debit.reason || 'insufficient',
        walletBalance: Number(debit.balance || 0),
        ...resolved,
      };
    }
    walletBalance = Number(debit.balance || 0);
  }

  const purchases = [];
  const failures = [];
  let refundedAmount = 0;
  for (const row of resolved.rows) {
    for (let i = 0; i < row.quantity; i += 1) {
      try {
        const result = await createQueuedPurchaseFn({
          userId,
          item: row.item,
          guildId,
        });
        purchases.push({
          itemId: row.item.id,
          itemName: row.item.name,
          itemKind: normalizeShopKind(row.item.kind),
          bundle: buildBundleSummary(row.item),
          purchase: result.purchase,
          delivery: result.delivery,
        });
      } catch (error) {
        refundedAmount += Number(row.item.price || 0);
        failures.push({
          itemId: row.item.id,
          itemName: row.item.name,
          message: error?.message || String(error),
        });
      }
    }
  }

  if (refundedAmount > 0) {
    const refund = await creditCoinsFn({
      userId,
      amount: refundedAmount,
      reason: 'cart_checkout_partial_refund',
      actor,
      meta: {
        source,
        failureCount: failures.length,
      },
    });
    if (refund?.ok) {
      walletBalance = Number(refund.balance || walletBalance);
    }
  }

  const clearCartFn = options.clearCartFn || clearCart;
  await Promise.resolve(clearCartFn(userId));

  return {
    ok: true,
    ...resolved,
    purchases,
    failures,
    refundedAmount,
    walletBalance,
  };
}

function addItemToCartForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const itemId = String(params.itemId || '').trim();
  const quantity = normalizeQty(params.quantity);
  if (!userId || !itemId) {
    return { ok: false, reason: 'invalid-input' };
  }
  addCartItem(userId, itemId, quantity);
  return { ok: true, userId, itemId, quantity };
}

function removeItemFromCartForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const itemId = String(params.itemId || '').trim();
  const quantity = normalizeQty(params.quantity);
  if (!userId || !itemId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const updated = removeCartItem(userId, itemId, quantity);
  if (!updated) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, userId, itemId, quantity, cart: updated };
}

function clearCartForUser(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return { ok: false, reason: 'invalid-input' };
  }
  clearCart(normalizedUserId);
  return { ok: true, userId: normalizedUserId };
}

function listCartItemsForUser(userId) {
  return listCartItems(String(userId || '').trim());
}

module.exports = {
  addItemToCartForUser,
  buildBundleSummary,
  clearCartForUser,
  getDeliveryStatusText,
  getResolvedCart,
  checkoutCart,
  listCartItemsForUser,
  normalizeShopKind,
  removeItemFromCartForUser,
};
