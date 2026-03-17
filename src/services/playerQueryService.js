const {
  getWallet,
  listTopWallets,
  listUserPurchases,
  getShopItemById,
  getShopItemByName,
  listShopItems,
} = require('../store/memoryStore');
const { getStats, listAllStats } = require('../store/statsStore');
const { getPunishments } = require('../store/moderationStore');
const { getStatus } = require('../store/scumStore');
const { resolveItemIconUrl } = require('./itemIconService');
const { normalizeShopKind, buildBundleSummary } = require('./shopService');

async function getWalletSnapshot(userId, options = {}) {
  return getWallet(userId, options);
}

async function listTopWalletSnapshots(limit = 10, options = {}) {
  return listTopWallets(limit, options);
}

function getStatsSnapshot(userId) {
  return getStats(userId);
}

function listStatsSnapshots() {
  return listAllStats();
}

function getPunishmentHistory(userId) {
  return getPunishments(userId);
}

function getScumStatusSnapshot() {
  return getStatus();
}

async function getShopItemViewById(itemId, options = {}) {
  return getShopItemById(itemId, options);
}

async function findShopItemView(query, options = {}) {
  const text = String(query || '').trim();
  if (!text) return null;
  return (await getShopItemById(text, options)) || (await getShopItemByName(text, options));
}

async function listShopItemViews(options = {}) {
  return listShopItems(options);
}

async function listResolvedPurchasesForUser(userId, options = {}) {
  const tenantId = String(options.tenantId || '').trim() || null;
  const purchases = await listUserPurchases(userId, { tenantId });
  return Promise.all(
    purchases.map(async (purchase) => {
      const item = await getShopItemById(purchase.itemId, {
        tenantId: purchase?.tenantId || tenantId,
      });
      return {
        purchase,
        item,
        kind: normalizeShopKind(item?.kind),
        iconUrl: resolveItemIconUrl(item || purchase.itemId),
        bundle: item ? buildBundleSummary(item) : null,
      };
    }),
  );
}

module.exports = {
  getWalletSnapshot,
  listTopWalletSnapshots,
  getStatsSnapshot,
  listStatsSnapshots,
  getPunishmentHistory,
  getScumStatusSnapshot,
  getShopItemViewById,
  findShopItemView,
  listShopItemViews,
  listResolvedPurchasesForUser,
};
