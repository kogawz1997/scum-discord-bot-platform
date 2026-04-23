const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminDashboardCards,
  clearAdminDashboardCardsCache,
} = require('../src/services/adminDashboardService');

function createCountTracker() {
  let count = 0;
  return {
    fn: async () => {
      count += 1;
      return 1;
    },
    getCount: () => count,
  };
}

test('admin dashboard cards uses cache window and refresh override', async () => {
  const previousTopologyMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const previousCacheWindow = process.env.ADMIN_DASHBOARD_CARDS_CACHE_WINDOW_MS;
  process.env.ADMIN_DASHBOARD_CARDS_CACHE_WINDOW_MS = '60000';
  process.env.TENANT_DB_TOPOLOGY_MODE = 'shared';
  try {
  clearAdminDashboardCardsCache();

  const trackers = Array.from({ length: 15 }, () => createCountTracker());
  const prisma = {
    userWallet: { count: trackers[0].fn },
    shopItem: { count: trackers[1].fn },
    purchase: { count: trackers[2].fn },
    ticketRecord: { count: trackers[3].fn },
    guildEvent: { count: trackers[4].fn },
    bounty: { count: trackers[5].fn },
    link: { count: trackers[6].fn },
    vipMembership: { count: trackers[7].fn },
    redeemCode: { count: trackers[8].fn },
    stats: { count: trackers[9].fn },
    weaponStat: { count: trackers[10].fn },
    dailyRent: { count: trackers[11].fn },
    rentalVehicle: { count: trackers[12].fn },
    deliveryQueueJob: { count: trackers[13].fn },
    deliveryDeadLetter: { count: trackers[14].fn },
    deliveryAudit: { count: async () => 1 },
  };
  let deliveryAuditCountCalls = 0;
  prisma.deliveryAudit.count = async () => {
    deliveryAuditCountCalls += 1;
    return 1;
  };

  const client = {
    guilds: {
      cache: new Map([['a', {}], ['b', {}]]),
    },
  };

  const first = await buildAdminDashboardCards({ prisma, client, allowGlobal: true });
  const second = await buildAdminDashboardCards({ prisma, client, allowGlobal: true });
  const refreshed = await buildAdminDashboardCards({ prisma, client, allowGlobal: true, forceRefresh: true });

  assert.equal(first.cache.cached, false);
  assert.equal(second.cache.cached, true);
  assert.equal(refreshed.cache.cached, false);
  trackers.forEach((tracker) => {
    assert.equal(tracker.getCount(), 2);
  });
  assert.equal(deliveryAuditCountCalls, 2);
  clearAdminDashboardCardsCache();
  } finally {
    if (previousTopologyMode) {
      process.env.TENANT_DB_TOPOLOGY_MODE = previousTopologyMode;
    } else {
      delete process.env.TENANT_DB_TOPOLOGY_MODE;
    }
    if (previousCacheWindow) {
      process.env.ADMIN_DASHBOARD_CARDS_CACHE_WINDOW_MS = previousCacheWindow;
    } else {
      delete process.env.ADMIN_DASHBOARD_CARDS_CACHE_WINDOW_MS;
    }
  }
});

test('admin dashboard cards rejects global reads without explicit allowGlobal', async () => {
  const previousTopologyMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  process.env.TENANT_DB_TOPOLOGY_MODE = 'shared';
  try {
    clearAdminDashboardCardsCache();
    await assert.rejects(
      () => buildAdminDashboardCards({
        prisma: {
          userWallet: { count: async () => 0 },
        },
        client: { guilds: { cache: new Map() } },
      }),
      /admin-dashboard-global-scope-required/,
    );
  } finally {
    clearAdminDashboardCardsCache();
    if (previousTopologyMode) {
      process.env.TENANT_DB_TOPOLOGY_MODE = previousTopologyMode;
    } else {
      delete process.env.TENANT_DB_TOPOLOGY_MODE;
    }
  }
});
