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

async function getWalletSnapshot(userId) {
  return getWallet(userId);
}

async function listTopWalletSnapshots(limit = 10) {
  return listTopWallets(limit);
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

async function getShopItemViewById(itemId) {
  return getShopItemById(itemId);
}

async function findShopItemView(query) {
  const text = String(query || '').trim();
  if (!text) return null;
  return (await getShopItemById(text)) || (await getShopItemByName(text));
}

async function listShopItemViews() {
  return listShopItems();
}

async function listResolvedPurchasesForUser(userId) {
  const purchases = await listUserPurchases(userId);
  return Promise.all(
    purchases.map(async (purchase) => {
      const item = await getShopItemById(purchase.itemId);
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
