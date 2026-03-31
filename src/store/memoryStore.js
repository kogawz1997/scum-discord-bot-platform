const crypto = require('node:crypto');
const { economy, shop } = require('../config');
const {
  prisma,
  getTenantScopedPrismaClient,
  resolveDefaultTenantId,
  resolveTenantScopedDatasourceUrl,
} = require('../prisma');
const {
  normalizePurchaseStatus,
  validatePurchaseStatusTransition,
  listKnownPurchaseStatuses,
} = require('../services/purchaseStateMachine');
const {
  buildServerScopedUserKey,
  parseServerScopedUserKey,
  matchesServerScope,
} = require('./tenantStoreScope');
const {
  resolveCanonicalItemId,
  resolveItemIconUrl,
} = require('../services/itemIconService');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');

function normalizeShopKind(value, fallback = 'item') {
  const raw = String(value || fallback)
    .trim()
    .toLowerCase();
  if (raw === 'vip') return 'vip';
  if (raw === 'item') return 'item';
  return raw || 'item';
}

function normalizeShopStatus(value, fallback = 'active') {
  const raw = String(value || fallback).trim().toLowerCase();
  if (raw === 'disabled') return 'disabled';
  return 'active';
}

function normalizeFixtureText(value) {
  return String(value || '').trim().toLowerCase();
}

function looksLikeFixtureIdentifier(value) {
  const normalized = normalizeFixtureText(value).replace(/[_\s]+/g, '-');
  if (!normalized) return false;
  return /(?:^|[-.])(test|fixture)(?:[-.]|$)/.test(normalized);
}

function looksLikeFixtureLabel(value) {
  const text = normalizeFixtureText(value);
  if (!text) return false;
  return /(?:\((test|fixture)\)|\[(test|fixture)\]|(?:^|[\s-])(test|fixture)(?:$|[\s-]))/.test(text);
}

function looksLikeFixtureDescription(value) {
  const text = normalizeFixtureText(value);
  if (!text) return false;
  return /\b(test item|fixture item|integration test|for delivery test)\b/.test(text);
}

function isShopItemFixture(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    looksLikeFixtureIdentifier(item.id)
    || looksLikeFixtureLabel(item.name)
    || looksLikeFixtureDescription(item.description)
  );
}

function normalizeShopQuantity(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.trunc(n));
}

function normalizeInteger(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function normalizeOptionalText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function escapeSqlText(value) {
  return String(value || '').replace(/'/g, "''");
}

function resolveTenantId(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return resolveDefaultTenantId(input);
  }
  return resolveDefaultTenantId({ tenantId: input });
}

function normalizeShopCommandList(value) {
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

const shopItemSchemaEnsurePromiseByDatasource = new Map();

function resolveStoreScope(options = {}) {
  const tenantId = resolveTenantId(options);
  if (!tenantId) {
    return {
      tenantId: null,
      datasourceKey: '__default__',
      db: prisma,
    };
  }
  return {
    tenantId,
    datasourceKey: resolveTenantScopedDatasourceUrl(tenantId, options) || tenantId,
    db: getTenantScopedPrismaClient(tenantId, options),
  };
}

async function ensureShopItemDeliveryProfileColumns(options = {}) {
  const scope = resolveStoreScope(options);
  if (shopItemSchemaEnsurePromiseByDatasource.has(scope.datasourceKey)) {
    return shopItemSchemaEnsurePromiseByDatasource.get(scope.datasourceKey);
  }
  const ensurePromise = (async () => {
    try {
      const runtime = resolveDatabaseRuntime();
      const db = scope.db;
      const rows = runtime.engine === 'postgresql'
        ? await db.$queryRaw`
          SELECT column_name AS name
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'ShopItem'
        `
        : await db.$queryRawUnsafe('PRAGMA table_info("ShopItem")');
      const columnNames = new Set(
        Array.isArray(rows) ? rows.map((row) => String(row?.name || '')) : [],
      );
      const statements = [];
      if (!columnNames.has('deliveryProfile')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryProfile" TEXT');
      }
      if (!columnNames.has('deliveryTeleportMode')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryTeleportMode" TEXT');
      }
      if (!columnNames.has('deliveryTeleportTarget')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryTeleportTarget" TEXT');
      }
      if (!columnNames.has('deliveryPreCommandsJson')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryPreCommandsJson" TEXT');
      }
      if (!columnNames.has('deliveryPostCommandsJson')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryPostCommandsJson" TEXT');
      }
      if (!columnNames.has('deliveryReturnTarget')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "deliveryReturnTarget" TEXT');
      }
      if (!columnNames.has('status')) {
        statements.push('ALTER TABLE "ShopItem" ADD COLUMN "status" TEXT DEFAULT \'active\'');
      }
      for (const sql of statements) {
        await db.$executeRawUnsafe(sql);
      }
    } catch (error) {
      shopItemSchemaEnsurePromiseByDatasource.delete(scope.datasourceKey);
      throw error;
    }
  })();
  shopItemSchemaEnsurePromiseByDatasource.set(scope.datasourceKey, ensurePromise);
  return ensurePromise;
}

function canonicalizeGameItemId(value, name = null) {
  const requested = normalizeOptionalText(value);
  if (!requested) return null;
  if (typeof resolveCanonicalItemId !== 'function') return requested;
  return (
    resolveCanonicalItemId({
      gameItemId: requested,
      id: requested,
      name,
    }) || requested
  );
}

function inferShopKindById(id) {
  const key = String(id || '').trim().toLowerCase();
  if (key.startsWith('vip')) return 'vip';
  return 'item';
}

function parseJsonArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return [];
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toMetaJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value) });
  }
}

function parseMetaJson(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function normalizeDeliveryItem(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const gameItemId = canonicalizeGameItemId(entry.gameItemId || entry.id, entry.name);
  if (!gameItemId) return null;
  const quantity = normalizeShopQuantity(entry.quantity, 1);
  const iconUrl =
    normalizeOptionalText(entry.iconUrl)
    || resolveItemIconUrl({
      gameItemId,
      id: gameItemId,
      name: entry.name,
    });
  return { gameItemId, quantity, iconUrl };
}

function compactDeliveryItems(entries) {
  const out = [];
  const byKey = new Map();
  for (const rawEntry of entries) {
    const normalized = normalizeDeliveryItem(rawEntry);
    if (!normalized) continue;

    const key = normalized.gameItemId.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, normalized);
      out.push(normalized);
      continue;
    }

    existing.quantity += normalized.quantity;
    if (!existing.iconUrl && normalized.iconUrl) {
      existing.iconUrl = normalized.iconUrl;
    }
  }
  return out;
}

function normalizeDeliveryItems(value, fallback = {}) {
  const fromValue = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? [value]
      : [];
  const fromJson = parseJsonArray(value);
  const fallbackItem = normalizeDeliveryItem({
    gameItemId: fallback.gameItemId,
    quantity: fallback.quantity,
    iconUrl: fallback.iconUrl,
  });

  const combined = compactDeliveryItems([...fromValue, ...fromJson]);
  if (combined.length > 0) return combined;
  return fallbackItem ? [fallbackItem] : [];
}

function resolveShopMetaForWrite(meta = {}, fallbackId = '') {
  const resolvedKind = normalizeShopKind(meta.kind, inferShopKindById(fallbackId));
  const deliveryItems = resolvedKind === 'item'
    ? normalizeDeliveryItems(meta.deliveryItems, {
        gameItemId: meta.gameItemId,
        quantity: meta.quantity,
        iconUrl: meta.iconUrl,
      })
    : [];
  const primary = deliveryItems[0] || null;
  return { resolvedKind, deliveryItems, primary };
}

function buildInitialShopItemRecord(initialItem) {
  const { resolvedKind, deliveryItems, primary } = resolveShopMetaForWrite(
    {
      kind: initialItem.kind,
      gameItemId: initialItem.gameItemId,
      quantity: initialItem.quantity,
      iconUrl: initialItem.iconUrl,
      deliveryItems: initialItem.deliveryItems,
    },
    initialItem.id,
  );

  return {
    id: initialItem.id,
    name: initialItem.name,
    price: initialItem.price,
    description: initialItem.description,
    kind: resolvedKind,
    gameItemId: primary?.gameItemId || null,
    quantity: primary?.quantity || 1,
    iconUrl: primary?.iconUrl || null,
    deliveryItemsJson:
      resolvedKind === 'item' && deliveryItems.length > 0
        ? JSON.stringify(deliveryItems)
        : null,
    deliveryProfile: normalizeDeliveryProfile(initialItem.deliveryProfile),
    deliveryTeleportMode: normalizeDeliveryTeleportMode(initialItem.deliveryTeleportMode),
    deliveryTeleportTarget: normalizeOptionalText(initialItem.deliveryTeleportTarget),
    deliveryPreCommandsJson:
      normalizeShopCommandList(initialItem.deliveryPreCommands).length > 0
        ? JSON.stringify(normalizeShopCommandList(initialItem.deliveryPreCommands))
        : null,
    deliveryPostCommandsJson:
      normalizeShopCommandList(initialItem.deliveryPostCommands).length > 0
        ? JSON.stringify(normalizeShopCommandList(initialItem.deliveryPostCommands))
        : null,
    deliveryReturnTarget: normalizeOptionalText(initialItem.deliveryReturnTarget),
  };
}

function shouldRepairInitialShopKind(existingItem, initialRecord) {
  const desiredKind = normalizeShopKind(initialRecord?.kind, inferShopKindById(initialRecord?.id));
  const currentKind = normalizeShopKind(existingItem?.kind, inferShopKindById(existingItem?.id));
  if (desiredKind === currentKind) return false;
  if (desiredKind === 'vip' || desiredKind === 'item') return false;

  const hasExistingDeliveryConfig =
    String(existingItem?.gameItemId || '').trim().length > 0
    || String(existingItem?.deliveryItemsJson || '').trim().length > 0;
  return currentKind === 'item' && !hasExistingDeliveryConfig;
}

function toShopItemView(rawItem) {
  if (!rawItem) return null;

  const kind = normalizeShopKind(rawItem.kind, inferShopKindById(rawItem.id));
  const status = normalizeShopStatus(rawItem.status);
  const deliveryItems = kind === 'item'
    ? normalizeDeliveryItems(rawItem.deliveryItemsJson, {
        gameItemId: rawItem.gameItemId,
        quantity: rawItem.quantity,
        iconUrl: rawItem.iconUrl,
      })
    : [];
  const primary = deliveryItems[0] || null;

  return {
    ...rawItem,
    kind,
    status,
    enabled: status !== 'disabled',
    gameItemId: kind === 'item'
      ? normalizeOptionalText(primary?.gameItemId || rawItem.gameItemId)
      : null,
    quantity: kind === 'item'
      ? normalizeShopQuantity(primary?.quantity || rawItem.quantity, 1)
      : 1,
    iconUrl: kind === 'item'
      ? normalizeOptionalText(primary?.iconUrl || rawItem.iconUrl)
      : null,
    deliveryItems,
    deliveryProfile: normalizeDeliveryProfile(rawItem.deliveryProfile),
    deliveryTeleportMode: normalizeDeliveryTeleportMode(rawItem.deliveryTeleportMode),
    deliveryTeleportTarget: normalizeOptionalText(rawItem.deliveryTeleportTarget),
    deliveryPreCommands: normalizeShopCommandList(rawItem.deliveryPreCommandsJson),
    deliveryPostCommands: normalizeShopCommandList(rawItem.deliveryPostCommandsJson),
    deliveryReturnTarget: normalizeOptionalText(rawItem.deliveryReturnTarget),
  };
}

async function loadShopItemStatusMap(db, itemIds = []) {
  const ids = Array.from(
    new Set(
      (Array.isArray(itemIds) ? itemIds : [itemIds])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db.$queryRawUnsafe(
    `SELECT "id" AS "id", COALESCE("status", 'active') AS "status"
     FROM "ShopItem"
     WHERE "id" IN (${ids.map((id) => `'${escapeSqlText(id)}'`).join(', ')})`,
  );
  const statusMap = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = String(row?.id || '').trim();
    if (!id) continue;
    statusMap.set(id, normalizeShopStatus(row?.status));
  }
  return statusMap;
}

function applyShopItemStatus(rawItem, statusMap) {
  if (!rawItem || typeof rawItem !== 'object') return rawItem;
  const id = String(rawItem.id || '').trim();
  if (!id || !statusMap?.has(id)) return rawItem;
  return {
    ...rawItem,
    status: statusMap.get(id),
  };
}

async function writeShopItemStatus(db, itemId, status) {
  const id = String(itemId || '').trim();
  if (!id) return;
  await db.$executeRawUnsafe(
    `UPDATE "ShopItem"
     SET "status" = '${escapeSqlText(normalizeShopStatus(status))}'
     WHERE "id" = '${escapeSqlText(id)}'`,
  );
}

function isShopItemVisible(item, options = {}) {
  if (!item) return false;
  if (normalizeShopStatus(item.status) === 'disabled' && options.includeDisabled !== true) {
    return false;
  }
  if (isShopItemFixture(item) && options.includeTestItems !== true) {
    return false;
  }
  return true;
}

function toWalletLedgerView(row) {
  if (!row) return null;
  const parsed = parseServerScopedUserKey(row.userId);
  return {
    ...row,
    userId: parsed.userId,
    serverId: parsed.serverId,
    meta: parseMetaJson(row.metaJson),
  };
}

function toPurchaseStatusHistoryView(row) {
  if (!row) return null;
  return {
    ...row,
    meta: parseMetaJson(row.metaJson),
  };
}

function toWalletView(row) {
  if (!row) return null;
  const parsed = parseServerScopedUserKey(row.userId);
  return {
    ...row,
    userId: parsed.userId,
    serverId: parsed.serverId,
  };
}

function buildPurchaseHistoryMeta(options = {}) {
  const meta =
    options.meta && typeof options.meta === 'object' && !Array.isArray(options.meta)
      ? { ...options.meta }
      : {};
  const serverId = normalizeOptionalText(options.serverId);
  if (serverId) {
    meta.serverId = serverId;
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

function extractPurchaseHistoryServerId(row) {
  const meta = parseMetaJson(row?.metaJson);
  return normalizeOptionalText(meta?.serverId);
}

async function filterPurchaseRowsByServer(db, rows, options = {}) {
  const serverId = normalizeOptionalText(options.serverId);
  if (!serverId) {
    return Array.isArray(rows) ? rows : [];
  }
  const purchaseRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (purchaseRows.length === 0) {
    return [];
  }
  const tenantId = normalizeOptionalText(options.tenantId);
  const purchaseCodes = purchaseRows
    .map((row) => String(row?.code || '').trim())
    .filter(Boolean);
  if (purchaseCodes.length === 0) {
    return [];
  }
  const historyRows = await db.purchaseStatusHistory.findMany({
    where: {
      purchaseCode: {
        in: purchaseCodes,
      },
      ...(tenantId ? { purchase: { tenantId } } : {}),
    },
  });
  const allowedCodes = new Set(
    historyRows
      .filter((row) => extractPurchaseHistoryServerId(row) === serverId)
      .map((row) => String(row.purchaseCode || '').trim())
      .filter(Boolean),
  );
  return purchaseRows.filter((row) => allowedCodes.has(String(row.code || '').trim()));
}

async function mutateWalletWithLedger(userId, updater, options = {}) {
  const id = buildServerScopedUserKey(userId, options);
  if (!id) {
    throw new Error('userId is required');
  }
  const { db } = resolveStoreScope(options);

  return db.$transaction(async (tx) => {
    let wallet = await tx.userWallet.findUnique({ where: { userId: id } });
    if (!wallet) {
      wallet = await tx.userWallet.create({
        data: { userId: id, balance: 0, lastDaily: null, lastWeekly: null },
      });
    }

    const before = Number(wallet.balance || 0);
    const mutation = updater(wallet) || {};
    const nextBalance = Math.max(0, normalizeInteger(mutation.balance, before));

    const data = {
      ...(mutation.data && typeof mutation.data === 'object' ? mutation.data : {}),
      balance: nextBalance,
    };

    const updated = await tx.userWallet.update({
      where: { userId: id },
      data,
    });

    const delta = nextBalance - before;
    if (delta !== 0 || options.recordZeroDelta === true) {
      await tx.walletLedger.create({
        data: {
          userId: id,
          delta,
          balanceBefore: before,
          balanceAfter: nextBalance,
          reason: String(options.reason || 'wallet_update'),
          reference: normalizeOptionalText(options.reference),
          actor: normalizeOptionalText(options.actor),
          metaJson: toMetaJson(options.meta),
        },
      });
    }

    return toWalletView(updated);
  });
}

async function getWallet(userId, options = {}) {
  const id = buildServerScopedUserKey(userId, options);
  const { db } = resolveStoreScope(options);
  let wallet = await db.userWallet.findUnique({ where: { userId: id } });
  if (!wallet) {
    wallet = await db.userWallet.create({
      data: { userId: id, balance: 0, lastDaily: null, lastWeekly: null },
    });
  }
  return toWalletView(wallet);
}

async function addCoins(userId, amount, options = {}) {
  const delta = Math.max(0, normalizeInteger(amount, 0));
  const updated = await mutateWalletWithLedger(
    userId,
    (wallet) => ({
      balance: Number(wallet.balance || 0) + delta,
    }),
    {
      reason: options.reason || 'wallet_add',
      reference: options.reference,
      actor: options.actor,
      meta: options.meta,
      recordZeroDelta: options.recordZeroDelta,
      serverId: options.serverId,
      tenantId: options.tenantId,
      defaultTenantId: options.defaultTenantId,
      env: options.env,
    },
  );
  return updated.balance;
}

async function removeCoins(userId, amount, options = {}) {
  const delta = Math.max(0, normalizeInteger(amount, 0));
  const updated = await mutateWalletWithLedger(
    userId,
    (wallet) => ({
      balance: Math.max(0, Number(wallet.balance || 0) - delta),
    }),
    {
      reason: options.reason || 'wallet_remove',
      reference: options.reference,
      actor: options.actor,
      meta: options.meta,
      recordZeroDelta: options.recordZeroDelta,
      serverId: options.serverId,
      tenantId: options.tenantId,
      defaultTenantId: options.defaultTenantId,
      env: options.env,
    },
  );
  return updated.balance;
}

async function setCoins(userId, amount, options = {}) {
  const targetBalance = Math.max(0, normalizeInteger(amount, 0));
  const updated = await mutateWalletWithLedger(
    userId,
    () => ({
      balance: targetBalance,
    }),
    {
      reason: options.reason || 'wallet_set',
      reference: options.reference,
      actor: options.actor,
      meta: options.meta,
      recordZeroDelta: options.recordZeroDelta,
      serverId: options.serverId,
      tenantId: options.tenantId,
      defaultTenantId: options.defaultTenantId,
      env: options.env,
    },
  );
  return updated.balance;
}

async function canClaimDaily(userId, options = {}) {
  const wallet = await getWallet(userId, options);
  const now = BigInt(Date.now());
  if (wallet.lastDaily == null) return { ok: true };
  const diff = now - wallet.lastDaily;
  if (diff >= BigInt(economy.dailyCooldownMs)) return { ok: true };
  const remaining = BigInt(economy.dailyCooldownMs) - diff;
  return { ok: false, remainingMs: Number(remaining) };
}

async function claimDaily(userId, options = {}) {
  const reward = Math.max(0, normalizeInteger(economy.dailyReward, 0));
  const now = BigInt(Date.now());
  const updated = await mutateWalletWithLedger(
    userId,
    (wallet) => ({
      balance: Number(wallet.balance || 0) + reward,
      data: {
        lastDaily: now,
      },
    }),
    {
      reason: 'daily_claim',
      actor: 'system',
      meta: { reward },
      recordZeroDelta: true,
      serverId: options.serverId,
      tenantId: options.tenantId,
      defaultTenantId: options.defaultTenantId,
      env: options.env,
    },
  );
  return updated.balance;
}

async function canClaimWeekly(userId, options = {}) {
  const wallet = await getWallet(userId, options);
  const now = BigInt(Date.now());
  if (wallet.lastWeekly == null) return { ok: true };
  const diff = now - wallet.lastWeekly;
  if (diff >= BigInt(economy.weeklyCooldownMs)) return { ok: true };
  const remaining = BigInt(economy.weeklyCooldownMs) - diff;
  return { ok: false, remainingMs: Number(remaining) };
}

async function claimWeekly(userId, options = {}) {
  const reward = Math.max(0, normalizeInteger(economy.weeklyReward, 0));
  const now = BigInt(Date.now());
  const updated = await mutateWalletWithLedger(
    userId,
    (wallet) => ({
      balance: Number(wallet.balance || 0) + reward,
      data: {
        lastWeekly: now,
      },
    }),
    {
      reason: 'weekly_claim',
      actor: 'system',
      meta: { reward },
      recordZeroDelta: true,
      serverId: options.serverId,
      tenantId: options.tenantId,
      defaultTenantId: options.defaultTenantId,
      env: options.env,
    },
  );
  return updated.balance;
}

async function listShopItems(options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  let items = await db.shopItem.findMany();
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const writes = [];

  for (const initialItem of shop.initialItems) {
    const record = buildInitialShopItemRecord(initialItem);
    const existing = byId.get(String(record.id));
    if (!existing) {
      writes.push(db.shopItem.create({ data: record }));
      continue;
    }

    if (shouldRepairInitialShopKind(existing, record)) {
      writes.push(
        db.shopItem.update({
          where: { id: record.id },
          data: {
            kind: record.kind,
          },
        }),
      );
    }
  }

  if (writes.length > 0) {
    await db.$transaction(writes);
    items = await db.shopItem.findMany();
  }

  const statusMap = await loadShopItemStatusMap(db, items.map((item) => item.id));

  return items
    .map((item) => toShopItemView(applyShopItemStatus(item, statusMap)))
    .filter((item) => isShopItemVisible(item, options));
}

async function getShopItemById(id, options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  const item = await db.shopItem.findUnique({ where: { id: String(id) } });
  const statusMap = await loadShopItemStatusMap(db, item ? [item.id] : []);
  const view = toShopItemView(applyShopItemStatus(item, statusMap));
  return isShopItemVisible(view, options) ? view : null;
}

async function getShopItemByName(name, options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  const lower = String(name).toLowerCase();
  const all = await db.shopItem.findMany();
  const found = all.find((i) => {
    if (i.name.toLowerCase() === lower) return true;
    if (i.id.toLowerCase() === lower) return true;
    if (String(i.gameItemId || '').toLowerCase() === lower) return true;

    const kind = normalizeShopKind(i.kind, inferShopKindById(i.id));
    if (kind !== 'item') return false;

    const deliveryItems = normalizeDeliveryItems(i.deliveryItemsJson, {
      gameItemId: i.gameItemId,
      quantity: i.quantity,
      iconUrl: i.iconUrl,
    });
    return deliveryItems.some(
      (entry) => String(entry.gameItemId || '').toLowerCase() === lower,
    );
  });
  const statusMap = await loadShopItemStatusMap(db, found ? [found.id] : []);
  const view = toShopItemView(applyShopItemStatus(found || null, statusMap));
  return isShopItemVisible(view, options) ? view : null;
}

async function addShopItem(id, name, price, description, meta = {}, options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  const existing = await db.shopItem.findUnique({
    where: { id: String(id) },
  });
  if (existing) {
    throw new Error('มี item id นี้อยู่แล้ว');
  }

  const { resolvedKind, deliveryItems, primary } = resolveShopMetaForWrite(
    meta,
    id,
  );

  if (resolvedKind === 'item' && deliveryItems.length === 0) {
    throw new Error('สินค้าประเภท item ต้องมี deliveryItems อย่างน้อย 1 รายการ');
  }

  const created = await db.shopItem.create({
    data: {
      id: String(id),
      name,
      price: Number(price || 0),
      description: description || '',
      kind: resolvedKind,
      gameItemId: primary?.gameItemId || null,
      quantity: primary?.quantity || 1,
      iconUrl: primary?.iconUrl || null,
      deliveryItemsJson:
        resolvedKind === 'item' && deliveryItems.length > 0
          ? JSON.stringify(deliveryItems)
          : null,
      deliveryProfile: normalizeDeliveryProfile(meta.deliveryProfile),
      deliveryTeleportMode: normalizeDeliveryTeleportMode(meta.deliveryTeleportMode),
      deliveryTeleportTarget: normalizeOptionalText(meta.deliveryTeleportTarget),
      deliveryPreCommandsJson:
        normalizeShopCommandList(meta.deliveryPreCommands).length > 0
          ? JSON.stringify(normalizeShopCommandList(meta.deliveryPreCommands))
          : null,
      deliveryPostCommandsJson:
        normalizeShopCommandList(meta.deliveryPostCommands).length > 0
          ? JSON.stringify(normalizeShopCommandList(meta.deliveryPostCommands))
          : null,
      deliveryReturnTarget: normalizeOptionalText(meta.deliveryReturnTarget),
    },
  });
  const status = normalizeShopStatus(meta.status);
  if (status !== 'active') {
    await writeShopItemStatus(db, created.id, status);
  }
  return toShopItemView({
    ...created,
    status,
  });
}

async function updateShopItem(idOrName, patch = {}, options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  const existing =
    (await getShopItemById(idOrName, { ...options, includeDisabled: true }))
    || (await getShopItemByName(idOrName, { ...options, includeDisabled: true }));
  if (!existing) return null;

  const nextName = String(patch.name || existing.name || '').trim();
  const nextDescription = String(patch.description || existing.description || '').trim();
  const nextPriceRaw = patch.price == null ? existing.price : Number(patch.price);
  const nextPrice = Number.isFinite(nextPriceRaw) ? Math.trunc(nextPriceRaw) : NaN;
  if (!nextName || !nextDescription || !Number.isFinite(nextPrice) || nextPrice <= 0) {
    throw new Error('invalid-shop-update');
  }

  const mergedMeta = {
    kind: patch.kind == null ? existing.kind : patch.kind,
    gameItemId: patch.gameItemId == null ? existing.gameItemId : patch.gameItemId,
    quantity: patch.quantity == null ? existing.quantity : patch.quantity,
    iconUrl: patch.iconUrl == null ? existing.iconUrl : patch.iconUrl,
    deliveryItems: patch.deliveryItems == null ? existing.deliveryItems : patch.deliveryItems,
    deliveryProfile: patch.deliveryProfile == null ? existing.deliveryProfile : patch.deliveryProfile,
    deliveryTeleportMode: patch.deliveryTeleportMode == null ? existing.deliveryTeleportMode : patch.deliveryTeleportMode,
    deliveryTeleportTarget: patch.deliveryTeleportTarget == null ? existing.deliveryTeleportTarget : patch.deliveryTeleportTarget,
    deliveryPreCommands: patch.deliveryPreCommands == null ? existing.deliveryPreCommands : patch.deliveryPreCommands,
    deliveryPostCommands: patch.deliveryPostCommands == null ? existing.deliveryPostCommands : patch.deliveryPostCommands,
    deliveryReturnTarget: patch.deliveryReturnTarget == null ? existing.deliveryReturnTarget : patch.deliveryReturnTarget,
  };
  const { resolvedKind, deliveryItems, primary } = resolveShopMetaForWrite(mergedMeta, existing.id);
  if (resolvedKind === 'item' && deliveryItems.length === 0) {
    throw new Error('shop-item-delivery-required');
  }

  const updated = await db.shopItem.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      price: nextPrice,
      description: nextDescription,
      kind: resolvedKind,
      gameItemId: resolvedKind === 'item' ? primary?.gameItemId || null : null,
      quantity: resolvedKind === 'item' ? primary?.quantity || 1 : 1,
      iconUrl: resolvedKind === 'item' ? primary?.iconUrl || null : null,
      deliveryItemsJson: resolvedKind === 'item' && deliveryItems.length > 0
        ? JSON.stringify(deliveryItems)
        : null,
      deliveryProfile: normalizeDeliveryProfile(mergedMeta.deliveryProfile),
      deliveryTeleportMode: normalizeDeliveryTeleportMode(mergedMeta.deliveryTeleportMode),
      deliveryTeleportTarget: normalizeOptionalText(mergedMeta.deliveryTeleportTarget),
      deliveryPreCommandsJson: normalizeShopCommandList(mergedMeta.deliveryPreCommands).length > 0
        ? JSON.stringify(normalizeShopCommandList(mergedMeta.deliveryPreCommands))
        : null,
      deliveryPostCommandsJson: normalizeShopCommandList(mergedMeta.deliveryPostCommands).length > 0
        ? JSON.stringify(normalizeShopCommandList(mergedMeta.deliveryPostCommands))
        : null,
      deliveryReturnTarget: normalizeOptionalText(mergedMeta.deliveryReturnTarget),
    },
  });
  const status = normalizeShopStatus(patch.status, existing.status);
  if (status !== normalizeShopStatus(existing.status)) {
    await writeShopItemStatus(db, existing.id, status);
  }
  return toShopItemView({
    ...updated,
    status,
  });
}

async function deleteShopItem(idOrName, options = {}) {
  const { db } = resolveStoreScope(options);
  const item =
    (await getShopItemById(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }))
    || (await getShopItemByName(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }));
  if (!item) return null;
  await db.shopItem.delete({ where: { id: item.id } });
  return item;
}

async function setShopItemPrice(idOrName, newPrice, options = {}) {
  const { db } = resolveStoreScope(options);
  const item =
    (await getShopItemById(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }))
    || (await getShopItemByName(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }));
  if (!item) return null;
  const updated = await db.shopItem.update({
    where: { id: item.id },
    data: { price: Number(newPrice || 0) },
  });
  return toShopItemView(updated);
}

async function setShopItemStatus(idOrName, nextStatus, options = {}) {
  const { db } = resolveStoreScope(options);
  await ensureShopItemDeliveryProfileColumns(options);
  const item =
    (await getShopItemById(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }))
    || (await getShopItemByName(idOrName, {
      ...options,
      includeDisabled: true,
      includeTestItems: true,
    }));
  if (!item) return null;
  const status = normalizeShopStatus(nextStatus, item.status);
  await writeShopItemStatus(db, item.id, status);
  return toShopItemView({
    ...item,
    status,
  });
}

async function createPurchase(userId, item, options = {}) {
  const tenantId = resolveTenantId(options.tenantId || item?.tenantId);
  const { db } = resolveStoreScope({ tenantId });
  const serverId = normalizeOptionalText(options.serverId);
  const payload = {
    tenantId,
    userId: String(userId),
    itemId: String(item.id),
    price: Number(item.price || 0),
    status: 'pending',
    statusUpdatedAt: new Date(),
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code =
      typeof crypto.randomUUID === 'function'
        ? `P${crypto.randomUUID()}`
        : `P${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    try {
      return await db.$transaction(async (tx) => {
        const created = await tx.purchase.create({
          data: {
            code,
            ...payload,
          },
        });

        await tx.purchaseStatusHistory.create({
          data: {
            purchaseCode: created.code,
            fromStatus: null,
            toStatus: 'pending',
            reason: 'purchase-created',
            actor: 'system',
            metaJson: toMetaJson(
              buildPurchaseHistoryMeta({
                serverId,
                meta: options.meta,
              }),
            ),
          },
        });

        return created;
      });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
    }
  }

  throw new Error('Failed to generate unique purchase code');
}

async function findPurchaseByCode(code, options = {}) {
  const { db, tenantId } = resolveStoreScope(options);
  const purchase = await db.purchase.findFirst({
    where: {
      code: String(code),
      ...(tenantId ? { tenantId } : {}),
    },
  });
  if (!purchase) {
    return null;
  }
  const filtered = await filterPurchaseRowsByServer(db, [purchase], {
    tenantId,
    serverId: options.serverId,
  });
  return filtered[0] || null;
}

async function setPurchaseStatusByCode(code, status, options = {}) {
  const p = await findPurchaseByCode(code, options);
  if (!p) return null;
  const { db } = resolveStoreScope({
    ...options,
    tenantId: normalizeOptionalText(options.tenantId) || normalizeOptionalText(p.tenantId),
  });

  const currentStatus = normalizePurchaseStatus(p.status);
  const nextStatus = normalizePurchaseStatus(status);
  const validation = validatePurchaseStatusTransition(currentStatus, nextStatus, {
    force: options.force === true,
  });

  if (!validation.ok) {
    const allowed = Array.isArray(validation.allowed)
      ? validation.allowed.join(', ')
      : 'n/a';
    throw new Error(
      `Invalid purchase status transition: ${currentStatus || '<empty>'} -> ${nextStatus || '<empty>'} (reason=${validation.reason}; allowed=${allowed})`,
    );
  }

  if (currentStatus === nextStatus && options.recordIfSame !== true) {
    return p;
  }

  const now = new Date();
  return db.$transaction(async (tx) => {
    const updated = await tx.purchase.update({
      where: { code: p.code },
      data: {
        status: nextStatus,
        statusUpdatedAt: now,
      },
    });

    await tx.purchaseStatusHistory.create({
      data: {
        purchaseCode: p.code,
        fromStatus: currentStatus || null,
        toStatus: nextStatus,
        reason: normalizeOptionalText(options.reason),
        actor: normalizeOptionalText(options.actor),
        metaJson: toMetaJson(
          buildPurchaseHistoryMeta({
            serverId: options.serverId,
            meta: options.meta,
          }),
        ),
      },
    });

    return updated;
  });
}

async function listUserPurchases(userId, options = {}) {
  const { db, tenantId } = resolveStoreScope(options);
  const rows = await db.purchase.findMany({
    where: {
      userId: String(userId),
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  return filterPurchaseRowsByServer(db, rows, {
    tenantId,
    serverId: options.serverId,
  });
}

async function listTopWallets(limitOrOptions = 10, maybeOptions = {}) {
  const options = typeof limitOrOptions === 'object' && limitOrOptions !== null
    ? limitOrOptions
    : maybeOptions;
  const limit = typeof limitOrOptions === 'object' && limitOrOptions !== null
    ? 10
    : limitOrOptions;
  const { db } = resolveStoreScope(options);
  const rows = await db.userWallet.findMany();
  return rows
    .filter((row) => matchesServerScope(row.userId, options))
    .sort((left, right) => Number(right.balance || 0) - Number(left.balance || 0))
    .slice(0, Math.max(1, Number(limit || 10)))
    .map((row) => toWalletView(row));
}

async function listWalletLedger(userId, limitOrOptions = 100, maybeOptions = {}) {
  const options = typeof limitOrOptions === 'object' && limitOrOptions !== null
    ? limitOrOptions
    : maybeOptions;
  const limit = typeof limitOrOptions === 'object' && limitOrOptions !== null
    ? 100
    : limitOrOptions;
  const { db } = resolveStoreScope(options);
  const max = Math.max(1, Math.min(1000, normalizeInteger(limit, 100)));
  const scopedUserId = buildServerScopedUserKey(userId, options);
  const rows = await db.walletLedger.findMany({
    where: { userId: scopedUserId },
    orderBy: { createdAt: 'desc' },
    take: max,
  });
  return rows.map((row) => toWalletLedgerView(row));
}

async function listPurchaseStatusHistory(code, limit = 100, options = {}) {
  const { db, tenantId } = resolveStoreScope(options);
  const max = Math.max(1, Math.min(1000, normalizeInteger(limit, 100)));
  const rows = await db.purchaseStatusHistory.findMany({
    where: {
      purchaseCode: String(code),
      ...(tenantId ? { purchase: { tenantId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: max,
  });
  const serverId = normalizeOptionalText(options.serverId);
  if (serverId) {
    const matchingServer = rows.some((row) => extractPurchaseHistoryServerId(row) === serverId);
    if (!matchingServer) {
      return [];
    }
  }
  return rows.map((row) => toPurchaseStatusHistoryView(row));
}

module.exports = {
  getWallet,
  addCoins,
  removeCoins,
  setCoins,
  canClaimDaily,
  claimDaily,
  canClaimWeekly,
  claimWeekly,
  listShopItems,
  getShopItemById,
  getShopItemByName,
  addShopItem,
  updateShopItem,
  deleteShopItem,
  setShopItemPrice,
  setShopItemStatus,
  isShopItemFixture,
  createPurchase,
  findPurchaseByCode,
  setPurchaseStatusByCode,
  listUserPurchases,
  listTopWallets,
  listWalletLedger,
  listPurchaseStatusHistory,
  listKnownPurchaseStatuses,
};
