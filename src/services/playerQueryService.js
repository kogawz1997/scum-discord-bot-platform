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
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizePlayerScopeOptions(options = {}, operation = 'player query') {
  const env = options.env;
  const explicitTenantId = String(options.tenantId || '').trim()
    || String(options.defaultTenantId || '').trim()
    || null;
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId = explicitTenantId || (runtime.strict ? (resolveDefaultTenantId({ env }) || null) : null);
  const scope = assertTenantDbIsolationScope({
    tenantId,
    operation,
    env,
  });
  return {
    tenantId: scope.tenantId,
    defaultTenantId: scope.tenantId,
    serverId: String(options.serverId || '').trim() || null,
    env,
  };
}

async function getWalletSnapshot(userId, options = {}) {
  return getWallet(userId, normalizePlayerScopeOptions(options, 'player wallet snapshot'));
}

async function listTopWalletSnapshots(limit = 10, options = {}) {
  return listTopWallets(limit, normalizePlayerScopeOptions(options, 'player wallet leaderboard'));
}

function getStatsSnapshot(userId, options = {}) {
  return getStats(userId, normalizePlayerScopeOptions(options, 'player stats snapshot'));
}

function listStatsSnapshots(options = {}) {
  return listAllStats(normalizePlayerScopeOptions(options, 'player stats leaderboard'));
}

function getPunishmentHistory(userId, options = {}) {
  return getPunishments(userId, normalizePlayerScopeOptions(options, 'player punishment history'));
}

function getScumStatusSnapshot(options = {}) {
  return getStatus(normalizePlayerScopeOptions(options, 'player scum status snapshot'));
}

async function getShopItemViewById(itemId, options = {}) {
  return getShopItemById(itemId, normalizePlayerScopeOptions(options, 'player shop item lookup'));
}

async function findShopItemView(query, options = {}) {
  const text = String(query || '').trim();
  if (!text) return null;
  const scopeOptions = normalizePlayerScopeOptions(options, 'player shop item search');
  return (await getShopItemById(text, scopeOptions)) || (await getShopItemByName(text, scopeOptions));
}

async function listShopItemViews(options = {}) {
  return listShopItems(normalizePlayerScopeOptions(options, 'player shop catalog'));
}

async function listResolvedPurchasesForUser(userId, options = {}) {
  const scopeOptions = normalizePlayerScopeOptions(options, 'player purchase history');
  const tenantId = scopeOptions.tenantId;
  const purchases = await listUserPurchases(userId, { tenantId });
  return Promise.all(
    purchases.map(async (purchase) => {
      const item = await getShopItemById(purchase.itemId, {
        tenantId: purchase?.tenantId || tenantId,
        defaultTenantId: scopeOptions.defaultTenantId,
        env: scopeOptions.env,
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
