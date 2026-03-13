const DEFAULT_CACHE_WINDOW_MS = 15 * 1000;

const dashboardCardsCache = {
  value: null,
  ts: 0,
};

function getDashboardCardsCacheWindowMs() {
  const raw = Number(process.env.ADMIN_DASHBOARD_CARDS_CACHE_WINDOW_MS || DEFAULT_CACHE_WINDOW_MS);
  if (!Number.isFinite(raw) || raw < 1000) {
    return DEFAULT_CACHE_WINDOW_MS;
  }
  return Math.trunc(raw);
}

function buildDashboardCards(metrics = {}) {
  return [
    ['จำนวนกิลด์', metrics.guildCount || 0],
    ['จำนวนกระเป๋าเหรียญ', metrics.walletCount || 0],
    ['จำนวนสินค้า', metrics.shopItemCount || 0],
    ['จำนวนคำสั่งซื้อ', metrics.purchaseCount || 0],
    ['จำนวนทิคเก็ต', metrics.ticketCount || 0],
    ['จำนวนกิจกรรม', metrics.eventCount || 0],
    ['จำนวนค่าหัว', metrics.bountyCount || 0],
    ['จำนวนลิงก์ Steam/Discord', metrics.linkCount || 0],
    ['จำนวน VIP', metrics.membershipCount || 0],
    ['จำนวนโค้ดแลกรางวัล', metrics.redeemCodeCount || 0],
    ['จำนวนสถิติรวม', metrics.statsCount || 0],
    ['จำนวนสถิติอาวุธ', metrics.weaponStatCount || 0],
    ['จำนวนโควต้าเช่ารายวัน', metrics.dailyRentCount || 0],
    ['จำนวนรถเช่า', metrics.rentalVehicleCount || 0],
    ['จำนวนคิวส่งของ', metrics.deliveryQueueCount || 0],
    ['จำนวน dead-letter ส่งของ', metrics.deliveryDeadLetterCount || 0],
    ['จำนวนบันทึกส่งของ', metrics.deliveryAuditCount || 0],
  ];
}

async function queryAdminDashboardMetrics(options = {}) {
  const { prisma, client } = options;
  if (!prisma || typeof prisma.userWallet?.count !== 'function') {
    throw new Error('prisma dependency is required');
  }

  const guildCount = client?.guilds?.cache?.size || 0;
  const [
    walletCount,
    shopItemCount,
    purchaseCount,
    ticketCount,
    eventCount,
    bountyCount,
    linkCount,
    membershipCount,
    redeemCodeCount,
    statsCount,
    weaponStatCount,
    dailyRentCount,
    rentalVehicleCount,
    deliveryQueueCount,
    deliveryDeadLetterCount,
    deliveryAuditCount,
  ] = await Promise.all([
    prisma.userWallet.count(),
    prisma.shopItem.count(),
    prisma.purchase.count(),
    prisma.ticketRecord.count(),
    prisma.guildEvent.count(),
    prisma.bounty.count(),
    prisma.link.count(),
    prisma.vipMembership.count(),
    prisma.redeemCode.count(),
    prisma.stats.count(),
    prisma.weaponStat.count(),
    prisma.dailyRent.count(),
    prisma.rentalVehicle.count(),
    prisma.deliveryQueueJob.count(),
    prisma.deliveryDeadLetter.count(),
    prisma.deliveryAudit.count(),
  ]);

  return {
    guildCount,
    walletCount,
    shopItemCount,
    purchaseCount,
    ticketCount,
    eventCount,
    bountyCount,
    linkCount,
    membershipCount,
    redeemCodeCount,
    statsCount,
    weaponStatCount,
    dailyRentCount,
    rentalVehicleCount,
    deliveryQueueCount,
    deliveryDeadLetterCount,
    deliveryAuditCount,
  };
}

async function buildAdminDashboardCards(options = {}) {
  const { forceRefresh = false } = options;
  const windowMs = getDashboardCardsCacheWindowMs();
  const now = Date.now();

  if (
    !forceRefresh
    && dashboardCardsCache.value
    && now - dashboardCardsCache.ts <= windowMs
  ) {
    return {
      ...dashboardCardsCache.value,
      cache: {
        cached: true,
        ageMs: now - dashboardCardsCache.ts,
        windowMs,
      },
    };
  }

  const metrics = await queryAdminDashboardMetrics(options);
  const payload = {
    generatedAt: new Date(now).toISOString(),
    metrics,
    cards: buildDashboardCards(metrics),
  };

  dashboardCardsCache.value = payload;
  dashboardCardsCache.ts = now;

  return {
    ...payload,
    cache: {
      cached: false,
      ageMs: 0,
      windowMs,
    },
  };
}

function clearAdminDashboardCardsCache() {
  dashboardCardsCache.value = null;
  dashboardCardsCache.ts = 0;
}

module.exports = {
  buildAdminDashboardCards,
  clearAdminDashboardCardsCache,
  getDashboardCardsCacheWindowMs,
};
