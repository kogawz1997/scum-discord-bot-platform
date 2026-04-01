'use strict';

const { withTenantScopedPrismaClient } = require('../prisma');
const { listShopItems } = require('../store/memoryStore');

function normalizeText(value) {
  return String(value || '').trim();
}

function asPositiveInt(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSupporterLikeItem(item) {
  const kind = normalizeText(item?.kind || item?.itemKind).toLowerCase();
  const haystack = `${item?.name || item?.itemName || ''} ${item?.description || ''}`.toLowerCase();
  return kind === 'vip' || kind === 'supporter' || /support|donation|member|vip/.test(haystack);
}

function normalizeShopStatus(value) {
  return normalizeText(value).toLowerCase() === 'disabled' ? 'disabled' : 'active';
}

function normalizePurchaseStatus(value) {
  return normalizeText(value).toLowerCase() || 'unknown';
}

function toneForPurchaseStatus(status) {
  const normalized = normalizePurchaseStatus(status);
  if (['delivered', 'completed', 'success'].includes(normalized)) return 'success';
  if (['pending', 'delivering', 'queued', 'processing'].includes(normalized)) return 'warning';
  if (['delivery_failed', 'failed', 'refunded', 'canceled', 'cancelled'].includes(normalized)) return 'danger';
  return 'muted';
}

function buildReadiness(summary) {
  const steps = [
    {
      key: 'packages',
      label: 'Create first package',
      done: summary.totalPackages > 0,
      detail: summary.totalPackages > 0
        ? 'At least one donation-facing package is already configured.'
        : 'Create the first package so players can see something in the supporter flow.',
      href: '#tenant-donation-create',
      actionLabel: 'Create package',
    },
    {
      key: 'active',
      label: 'Enable at least one package',
      done: summary.activePackages > 0,
      detail: summary.activePackages > 0
        ? 'At least one package is live for players right now.'
        : 'All packages are disabled, so the donation flow is effectively offline.',
      href: '#tenant-donation-create',
      actionLabel: 'Review package status',
    },
    {
      key: 'supporter',
      label: 'Add supporter tier',
      done: summary.supporterPackages > 0,
      detail: summary.supporterPackages > 0
        ? 'Supporter or VIP packages are available for recurring-style community support.'
        : 'Add a VIP or supporter package so the server has a clear supporter tier.',
      href: '#tenant-donation-create',
      actionLabel: 'Add supporter tier',
    },
    {
      key: 'first-purchase',
      label: 'Receive first supporter purchase',
      done: summary.recentPurchases30d > 0,
      detail: summary.recentPurchases30d > 0
        ? 'The tenant already has recent donation activity to monitor.'
        : 'No donation purchases were recorded in the current reporting window yet.',
      href: '/tenant/orders',
      actionLabel: 'Open orders',
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  const percent = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const nextRequiredStep = steps.find((step) => !step.done) || null;

  return {
    percent,
    completed,
    total: steps.length,
    steps,
    nextRequiredStep,
  };
}

function buildIssues(summary) {
  const issues = [];
  if (summary.totalPackages === 0) {
    issues.push({
      key: 'no-packages',
      tone: 'warning',
      title: 'No donation packages yet',
      detail: 'Players cannot support the server until at least one package exists.',
      href: '#tenant-donation-create',
      actionLabel: 'Create package',
    });
  }
  if (summary.totalPackages > 0 && summary.activePackages === 0) {
    issues.push({
      key: 'all-disabled',
      tone: 'warning',
      title: 'All packages are disabled',
      detail: 'The donation workspace has packages configured, but none of them are live.',
      href: '#tenant-donation-packages',
      actionLabel: 'Enable package',
    });
  }
  if (summary.deliveryPending30d > 0) {
    issues.push({
      key: 'pending-delivery',
      tone: 'warning',
      title: 'Pending delivery work needs review',
      detail: `${summary.deliveryPending30d} donation orders are still waiting on delivery progress.`,
      href: '/tenant/orders',
      actionLabel: 'Open orders',
    });
  }
  if (summary.failedOrders30d > 0) {
    issues.push({
      key: 'failed-orders',
      tone: 'danger',
      title: 'Failed donation orders need operator attention',
      detail: `${summary.failedOrders30d} donation orders landed in a failed state during the reporting window.`,
      href: '/tenant/orders',
      actionLabel: 'Review failures',
    });
  }
  if (summary.refundedOrders30d > 0) {
    issues.push({
      key: 'refunded-orders',
      tone: 'warning',
      title: 'Refunded supporter orders should be reviewed',
      detail: `${summary.refundedOrders30d} refunds were recorded recently and may need a community follow-up.`,
      href: '/tenant/billing',
      actionLabel: 'Open billing',
    });
  }
  return issues;
}

async function buildTenantDonationOverview(options = {}) {
  const tenantId = normalizeText(options.tenantId);
  if (!tenantId) {
    throw new Error('tenantId is required');
  }

  const now = parseDate(options.now) || new Date();
  const windowDays = Math.max(1, Math.min(365, asPositiveInt(options.windowDays, 30)));
  const limit = Math.max(1, Math.min(100, asPositiveInt(options.limit, 8)));
  const since = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
  const listShopItemsFn = options.listShopItemsFn || listShopItems;
  const withTenantScopedPrismaClientFn = options.withTenantScopedPrismaClientFn || withTenantScopedPrismaClient;

  const packageRowsRaw = await listShopItemsFn({
    tenantId,
    includeDisabled: true,
    includeTestItems: true,
  });
  const packageRows = Array.isArray(packageRowsRaw) ? packageRowsRaw : [];

  const packageMap = new Map();
  for (const row of Array.isArray(packageRows) ? packageRows : []) {
    const id = normalizeText(row?.id);
    if (!id) continue;
    packageMap.set(id, row);
  }

  const { purchases, historyRows } = await withTenantScopedPrismaClientFn(tenantId, async (db) => {
    const [purchaseRows, purchaseHistoryRows] = await Promise.all([
      db.purchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.max(200, limit * 20),
      }),
      db.purchaseStatusHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.max(400, limit * 40),
      }),
    ]);
    return {
      purchases: Array.isArray(purchaseRows) ? purchaseRows : [],
      historyRows: Array.isArray(purchaseHistoryRows) ? purchaseHistoryRows : [],
    };
  });

  const historyByCode = new Map();
  for (const row of Array.isArray(historyRows) ? historyRows : []) {
    const code = normalizeText(row?.purchaseCode);
    if (!code) continue;
    if (!historyByCode.has(code)) historyByCode.set(code, []);
    historyByCode.get(code).push(row);
  }

  const recentPurchases = [];
  const topPackages = new Map();
  let supporterPurchases30d = 0;
  let supporterRevenueCoins30d = 0;
  let deliveredOrders30d = 0;
  let deliveryPending30d = 0;
  let failedOrders30d = 0;
  let refundedOrders30d = 0;
  let activeSupporterUsers = new Set();
  let lastPurchaseAt = null;

  for (const purchase of Array.isArray(purchases) ? purchases : []) {
    const itemId = normalizeText(purchase?.itemId);
    const item = packageMap.get(itemId) || null;
    const status = normalizePurchaseStatus(purchase?.status);
    const createdAt = parseDate(purchase?.createdAt || purchase?.updatedAt);
    if (!lastPurchaseAt && createdAt) {
      lastPurchaseAt = createdAt.toISOString();
    }

    if (!createdAt || createdAt < since) continue;

    const isSupporter = isSupporterLikeItem(item || purchase);
    const code = normalizeText(purchase?.code);
    const history = historyByCode.get(code) || [];
    const latestHistory = history[0] || null;
    recentPurchases.push({
      code,
      userId: normalizeText(purchase?.userId) || '-',
      itemId: itemId || '-',
      itemName: normalizeText(item?.name || purchase?.itemName) || itemId || 'Package',
      kind: normalizeText(item?.kind || purchase?.kind) || 'item',
      price: Number(purchase?.price || item?.price || 0) || 0,
      status,
      statusTone: toneForPurchaseStatus(status),
      createdAt: createdAt.toISOString(),
      latestTransition: normalizeText(latestHistory?.toStatus || status) || status,
      latestTransitionAt: latestHistory?.createdAt || null,
      isSupporter,
    });

    if (status === 'delivered') deliveredOrders30d += 1;
    if (['pending', 'delivering'].includes(status)) deliveryPending30d += 1;
    if (status === 'delivery_failed') failedOrders30d += 1;
    if (status === 'refunded') refundedOrders30d += 1;

    if (isSupporter) {
      supporterPurchases30d += 1;
      supporterRevenueCoins30d += Number(purchase?.price || item?.price || 0) || 0;
      if (status === 'delivered') {
        activeSupporterUsers.add(normalizeText(purchase?.userId));
      }
    }

    const topKey = itemId || code || `purchase-${recentPurchases.length}`;
    if (!topPackages.has(topKey)) {
      topPackages.set(topKey, {
        id: itemId || topKey,
        name: normalizeText(item?.name || purchase?.itemName) || itemId || 'Package',
        kind: normalizeText(item?.kind || purchase?.kind) || 'item',
        purchases30d: 0,
        revenueCoins30d: 0,
        delivered30d: 0,
        pending30d: 0,
        refunded30d: 0,
        latestStatus: status,
        lastPurchaseAt: createdAt.toISOString(),
        isSupporter,
      });
    }
    const bucket = topPackages.get(topKey);
    bucket.purchases30d += 1;
    bucket.revenueCoins30d += Number(purchase?.price || item?.price || 0) || 0;
    if (status === 'delivered') bucket.delivered30d += 1;
    if (['pending', 'delivering'].includes(status)) bucket.pending30d += 1;
    if (status === 'refunded') bucket.refunded30d += 1;
    bucket.latestStatus = status;
    if (!bucket.lastPurchaseAt || new Date(bucket.lastPurchaseAt).getTime() < createdAt.getTime()) {
      bucket.lastPurchaseAt = createdAt.toISOString();
    }
  }

  const packageList = Array.isArray(packageRows) ? packageRows : [];
  const totalPackages = packageList.length;
  const activePackages = packageList.filter((row) => normalizeShopStatus(row?.status) !== 'disabled').length;
  const supporterPackages = packageList.filter((row) => isSupporterLikeItem(row)).length;
  const deliveryPackages = packageList.filter((row) => !isSupporterLikeItem(row)).length;
  const disabledPackages = Math.max(0, totalPackages - activePackages);

  const summary = {
    totalPackages,
    activePackages,
    disabledPackages,
    supporterPackages,
    deliveryPackages,
    recentPurchases30d: recentPurchases.length,
    supporterPurchases30d,
    deliveredOrders30d,
    deliveryPending30d,
    failedOrders30d,
    refundedOrders30d,
    supporterRevenueCoins30d,
    activeSupporters30d: Array.from(activeSupporterUsers).filter(Boolean).length,
    lastPurchaseAt,
  };

  const readiness = buildReadiness(summary);

  return {
    tenantId,
    generatedAt: now.toISOString(),
    windowDays,
    summary,
    readiness,
    issues: buildIssues(summary),
    topPackages: Array.from(topPackages.values())
      .sort((left, right) => {
        if (right.purchases30d !== left.purchases30d) return right.purchases30d - left.purchases30d;
        return right.revenueCoins30d - left.revenueCoins30d;
      })
      .slice(0, limit),
    recentActivity: recentPurchases.slice(0, limit),
  };
}

module.exports = {
  buildTenantDonationOverview,
};
