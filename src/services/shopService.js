const {
  getWallet,
  getShopItemById,
  getShopItemByName,
  createPurchase,
  addShopItem,
  deleteShopItem,
  setShopItemPrice,
} = require('../store/memoryStore');
const { getLinkByUserId } = require('../store/linkStore');
const { debitCoins, creditCoins } = require('./coinService');
const { enqueuePurchaseDelivery } = require('./rconDelivery');

function normalizeShopKind(value) {
  return String(value || 'item').trim().toLowerCase() === 'vip' ? 'vip' : 'item';
}

function normalizeQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.trunc(n));
}

function normalizeDeliveryProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'spawn_only') return 'spawn_only';
  if (raw === 'teleport_spawn') return 'teleport_spawn';
  if (raw === 'announce_teleport_spawn') return 'announce_teleport_spawn';
  return null;
}

function normalizeDeliveryTeleportMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'player') return 'player';
  if (raw === 'vehicle') return 'vehicle';
  return null;
}

function normalizeCommandList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  return raw
    .split(/\r?\n/)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function normalizeDeliveryItems(item) {
  const direct = Array.isArray(item?.deliveryItems) ? item.deliveryItems : [];
  const normalized = direct
    .map((entry) => {
      const gameItemId = String(entry?.gameItemId || '').trim();
      if (!gameItemId) return null;
      return {
        gameItemId,
        quantity: normalizeQty(entry?.quantity),
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const fallbackId = String(item?.gameItemId || '').trim();
  if (!fallbackId) return [];
  return [{ gameItemId: fallbackId, quantity: normalizeQty(item?.quantity) }];
}

function buildBundleSummary(item, maxRows = 4) {
  const entries = normalizeDeliveryItems(item);
  if (entries.length === 0) {
    return {
      entries: [],
      totalQty: 0,
      short: '-',
      long: 'รายการส่งของ: `-`',
      lines: ['**รายการส่งของ:** `-`'],
    };
  }

  const totalQty = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const short = entries
    .slice(0, 2)
    .map((entry) => `${entry.gameItemId} x${entry.quantity}`)
    .join(', ');
  const shortText = entries.length > 2 ? `${short} (+${entries.length - 2})` : short;
  const lines = [
    `**รายการส่งของ:** **${entries.length}** รายการ (รวม **${totalQty}** ชิ้น)`,
    ...entries
      .slice(0, maxRows)
      .map((entry) => `- \`${entry.gameItemId}\` x**${entry.quantity}**`),
  ];
  if (entries.length > maxRows) {
    lines.push(`- และอีก **${entries.length - maxRows}** รายการ`);
  }

  return {
    entries,
    totalQty,
    short: shortText,
    long: [`รายการส่งของ: **${entries.length}** รายการ (รวม **${totalQty}** ชิ้น)`, ...lines.slice(1)]
      .join('\n'),
    lines,
  };
}

function getDeliveryStatusText(result) {
  if (result?.queued) {
    return 'เข้าคิวแล้ว';
  }
  if (result?.reason === 'item-not-configured') {
    return 'ยังไม่ตั้งค่าคำสั่งส่งของอัตโนมัติ';
  }
  if (result?.reason === 'delivery-disabled') {
    return 'ปิดระบบส่งของอัตโนมัติอยู่';
  }
  return result?.reason || 'ไม่ทราบสถานะ';
}

async function findShopItemByQuery(query) {
  const text = String(query || '').trim();
  if (!text) return null;
  return (await getShopItemById(text)) || (await getShopItemByName(text));
}

async function createQueuedPurchase(params = {}) {
  const userId = String(params.userId || '').trim();
  const item = params.item;
  if (!userId || !item?.id) {
    throw new Error('invalid-purchase-input');
  }

  const createPurchaseFn = params.createPurchaseFn || createPurchase;
  const enqueuePurchaseDeliveryFn =
    params.enqueuePurchaseDeliveryFn || enqueuePurchaseDelivery;

  const purchase = await createPurchaseFn(userId, item);
  const delivery = await enqueuePurchaseDeliveryFn(purchase, {
    guildId: params.guildId || null,
    ...(params.deliveryOptions && typeof params.deliveryOptions === 'object'
      ? params.deliveryOptions
      : {}),
  });

  return {
    item,
    kind: normalizeShopKind(item.kind),
    bundle: buildBundleSummary(item),
    purchase,
    delivery,
  };
}

async function purchaseShopItemForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const actor = String(params.actor || '').trim() || 'system';
  const source = String(params.source || '').trim() || 'shop-service';
  if (!userId) {
    return { ok: false, reason: 'invalid-user-id' };
  }

  const item = params.item || (await findShopItemByQuery(params.query));
  if (!item) {
    return { ok: false, reason: 'item-not-found' };
  }

  const kind = normalizeShopKind(item.kind);
  if (kind === 'item' && params.requireSteamLink !== false) {
    const resolveSteamLink = params.resolveSteamLink
      || (async (targetUserId) => getLinkByUserId(targetUserId));
    const link = await resolveSteamLink(userId);
    if (!link?.steamId) {
      return {
        ok: false,
        reason: 'steam-link-required',
        item,
        kind,
      };
    }
  }

  const price = Math.max(0, Number(item.price || 0));
  const debitCoinsFn = params.debitCoinsFn || debitCoins;
  const creditCoinsFn = params.creditCoinsFn || creditCoins;
  const createQueuedPurchaseFn = params.createQueuedPurchaseFn || createQueuedPurchase;

  let balance = null;
  let debitApplied = 0;
  if (price > 0) {
    const debit = await debitCoinsFn({
      userId,
      amount: price,
      reason: params.debitReason || 'purchase_debit',
      actor,
      reference: params.reference || null,
      meta: {
        source,
        itemId: item.id,
        itemName: item.name,
        ...(params.meta && typeof params.meta === 'object' ? params.meta : {}),
      },
    });
    if (!debit.ok) {
      return {
        ok: false,
        reason: debit.reason || 'purchase-debit-failed',
        item,
        kind,
        price,
        balance: Number(debit.balance || 0),
      };
    }
    balance = Number(debit.balance || 0);
    debitApplied = price;
  } else {
    balance = Number((await getWallet(userId))?.balance || 0);
  }

  try {
    const result = await createQueuedPurchaseFn({
      userId,
      item,
      guildId: params.guildId || null,
      deliveryOptions: params.deliveryOptions,
      createPurchaseFn: params.createPurchaseFn,
      enqueuePurchaseDeliveryFn: params.enqueuePurchaseDeliveryFn,
    });
    return {
      ok: true,
      ...result,
      price,
      balance,
    };
  } catch (error) {
    if (debitApplied > 0) {
      await creditCoinsFn({
        userId,
        amount: debitApplied,
        reason: params.rollbackReason || 'purchase_rollback',
        actor,
        reference: params.reference || null,
        meta: {
          source,
          itemId: item.id,
          itemName: item.name,
          rollbackReason: String(error?.message || error),
        },
      }).catch(() => null);
    }
    return {
      ok: false,
      reason: 'purchase-create-failed',
      item,
      kind,
      price,
      error: String(error?.message || error),
      rolledBack: debitApplied > 0,
    };
  }
}

async function addShopItemForAdmin(params = {}) {
  const id = String(params.id || '').trim();
  const name = String(params.name || '').trim();
  const price = Number(params.price);
  const description = String(params.description || '').trim();
  const kind = normalizeShopKind(params.kind);
  const quantity = normalizeQty(params.quantity);
  const gameItemId = String(params.gameItemId || '').trim() || null;
  const iconUrl = String(params.iconUrl || '').trim() || null;
  const deliveryItems = Array.isArray(params.deliveryItems) ? params.deliveryItems : [];
  const deliveryProfile = normalizeDeliveryProfile(params.deliveryProfile);
  const deliveryTeleportMode = normalizeDeliveryTeleportMode(
    params.deliveryTeleportMode,
  );
  const deliveryTeleportTarget = String(
    params.deliveryTeleportTarget || '',
  ).trim() || null;
  const deliveryPreCommands = normalizeCommandList(params.deliveryPreCommands);
  const deliveryPostCommands = normalizeCommandList(params.deliveryPostCommands);
  const deliveryReturnTarget = String(params.deliveryReturnTarget || '').trim() || null;

  if (!id || !name || !Number.isFinite(price) || price <= 0 || !description) {
    return { ok: false, reason: 'invalid-input' };
  }
  if (kind === 'item' && !gameItemId && deliveryItems.length === 0) {
    return { ok: false, reason: 'game-item-required' };
  }

  try {
    const item = await addShopItem(id, name, Math.trunc(price), description, {
      kind,
      gameItemId: kind === 'item' ? gameItemId : null,
      quantity: kind === 'item' ? quantity : 1,
      iconUrl,
      deliveryItems,
      deliveryProfile: kind === 'item' ? deliveryProfile : null,
      deliveryTeleportMode: kind === 'item' ? deliveryTeleportMode : null,
      deliveryTeleportTarget: kind === 'item' ? deliveryTeleportTarget : null,
      deliveryPreCommands: kind === 'item' ? deliveryPreCommands : [],
      deliveryPostCommands: kind === 'item' ? deliveryPostCommands : [],
      deliveryReturnTarget: kind === 'item' ? deliveryReturnTarget : null,
    });
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      reason: 'create-failed',
      error: String(error?.message || error),
    };
  }
}

async function setShopItemPriceForAdmin(params = {}) {
  const idOrName = String(params.idOrName || '').trim();
  const price = Number(params.price);
  if (!idOrName || !Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  const item = await setShopItemPrice(idOrName, Math.trunc(price));
  if (!item) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, item };
}

async function deleteShopItemForAdmin(params = {}) {
  const idOrName = String(params.idOrName || '').trim();
  if (!idOrName) {
    return { ok: false, reason: 'invalid-input' };
  }
  const item = await deleteShopItem(idOrName);
  if (!item) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, item };
}

module.exports = {
  normalizeShopKind,
  normalizeDeliveryItems,
  buildBundleSummary,
  getDeliveryStatusText,
  findShopItemByQuery,
  createQueuedPurchase,
  purchaseShopItemForUser,
  addShopItemForAdmin,
  setShopItemPriceForAdmin,
  deleteShopItemForAdmin,
};
