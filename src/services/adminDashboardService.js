const { getTenantScopedPrismaClient } = require('../prisma');
const { getTenantDatabaseTopologyMode } = require('../utils/tenantDatabaseTopology');
const {
  buildScopedRowKey,
  dedupeScopedRows,
  normalizeTenantId,
  readAcrossDeliveryPersistenceScopes,
} = require('./deliveryPersistenceDb');

const DEFAULT_CACHE_WINDOW_MS = 15 * 1000;

const dashboardCardsCache = new Map();

const DASHBOARD_ROW_KEY_FIELDS = Object.freeze({
  userWallet: ['userId'],
  shopItem: ['id'],
  purchase: ['code'],
  ticketRecord: ['channelId'],
  guildEvent: ['id'],
  bounty: ['id'],
  link: ['steamId'],
  vipMembership: ['userId'],
  redeemCode: ['code'],
  stats: ['userId'],
  weaponStat: ['weapon'],
  dailyRent: ['userKey', 'date'],
  rentalVehicle: ['orderId'],
  deliveryQueueJob: ['purchaseCode'],
  deliveryDeadLetter: ['purchaseCode'],
  deliveryAudit: ['id'],
});

const DASHBOARD_TENANT_ID_MODELS = new Set([
  'purchase',
  'deliveryQueueJob',
  'deliveryDeadLetter',
  'deliveryAudit',
]);

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
    ['จำนวนทิกเก็ต', metrics.ticketCount || 0],
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

function buildScopeSelect(modelName, fallbackField) {
  const fields = DASHBOARD_ROW_KEY_FIELDS[modelName] || [fallbackField];
  const select = Object.fromEntries(fields.map((field) => [field, true]));
  if (DASHBOARD_TENANT_ID_MODELS.has(modelName)) {
    select.tenantId = true;
  }
  return { fields, select };
}

async function queryAdminDashboardMetrics(options = {}) {
  const { prisma, client } = options;
  if (!prisma || typeof prisma.userWallet?.count !== 'function') {
    throw new Error('prisma dependency is required');
  }

  const tenantId = normalizeTenantId(options.tenantId);
  const guildCount = client?.guilds?.cache?.size || 0;
  const tenantTopologyMode = getTenantDatabaseTopologyMode();
  const usesTenantTopology = tenantTopologyMode !== 'shared';
  const scopedPrisma = tenantId ? getTenantScopedPrismaClient(tenantId) : prisma;

  async function countRowsAcrossScopes(selectKey, modelName) {
    const { fields, select } = buildScopeSelect(modelName, selectKey);
    const rows = await readAcrossDeliveryPersistenceScopes(
      (db) => db?.[modelName]?.findMany({ select }),
      tenantId ? { tenantId } : {},
    );
    return dedupeScopedRows(
      rows,
      (row) => buildScopedRowKey(row, fields, { mapSharedScopeToDefaultTenant: true }),
    ).length;
  }

  if (tenantId || !usesTenantTopology) {
    const activePrisma = scopedPrisma;
    const tenantScopedSharedWhere = tenantId && tenantTopologyMode === 'shared'
      ? { tenantId }
      : undefined;
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
      activePrisma.userWallet.count(),
      activePrisma.shopItem.count(),
      activePrisma.purchase.count(
        tenantScopedSharedWhere ? { where: tenantScopedSharedWhere } : undefined,
      ),
      activePrisma.ticketRecord.count(),
      activePrisma.guildEvent.count(),
      activePrisma.bounty.count(),
      activePrisma.link.count(),
      activePrisma.vipMembership.count(),
      activePrisma.redeemCode.count(),
      activePrisma.stats.count(),
      activePrisma.weaponStat.count(),
      activePrisma.dailyRent.count(),
      activePrisma.rentalVehicle.count(),
      activePrisma.deliveryQueueJob.count(
        tenantScopedSharedWhere ? { where: tenantScopedSharedWhere } : undefined,
      ),
      activePrisma.deliveryDeadLetter.count(
        tenantScopedSharedWhere ? { where: tenantScopedSharedWhere } : undefined,
      ),
      activePrisma.deliveryAudit.count(
        tenantScopedSharedWhere ? { where: tenantScopedSharedWhere } : undefined,
      ),
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
    countRowsAcrossScopes('userId', 'userWallet'),
    countRowsAcrossScopes('id', 'shopItem'),
    countRowsAcrossScopes('code', 'purchase'),
    countRowsAcrossScopes('channelId', 'ticketRecord'),
    countRowsAcrossScopes('id', 'guildEvent'),
    countRowsAcrossScopes('id', 'bounty'),
    countRowsAcrossScopes('steamId', 'link'),
    countRowsAcrossScopes('userId', 'vipMembership'),
    countRowsAcrossScopes('code', 'redeemCode'),
    countRowsAcrossScopes('userId', 'stats'),
    countRowsAcrossScopes('weapon', 'weaponStat'),
    countRowsAcrossScopes('userKey', 'dailyRent'),
    countRowsAcrossScopes('orderId', 'rentalVehicle'),
    countRowsAcrossScopes('purchaseCode', 'deliveryQueueJob'),
    countRowsAcrossScopes('purchaseCode', 'deliveryDeadLetter'),
    countRowsAcrossScopes('id', 'deliveryAudit'),
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
  const tenantId = normalizeTenantId(options.tenantId);
  const cacheKey = tenantId || '__global__';
  const cached = dashboardCardsCache.get(cacheKey);

  if (
    !forceRefresh
    && cached?.value
    && now - cached.ts <= windowMs
  ) {
    return {
      ...cached.value,
      cache: {
        cached: true,
        ageMs: now - cached.ts,
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

  dashboardCardsCache.set(cacheKey, {
    value: payload,
    ts: now,
  });

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
  dashboardCardsCache.clear();
}

module.exports = {
  buildAdminDashboardCards,
  clearAdminDashboardCardsCache,
  getDashboardCardsCacheWindowMs,
};
