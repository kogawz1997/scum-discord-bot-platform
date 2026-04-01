const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantDonationOverview,
} = require('../src/services/tenantDonationOverviewService');

test('tenant donation overview summarizes supporter packages, recent orders, and readiness', async () => {
  const overview = await buildTenantDonationOverview({
    tenantId: 'tenant-demo',
    now: '2026-04-01T12:00:00Z',
    limit: 4,
    listShopItemsFn: async () => ([
      {
        id: 'starter-crate',
        name: 'Starter Crate',
        kind: 'item',
        price: 1000,
        description: 'Starter gear',
        status: 'active',
      },
      {
        id: 'supporter-vip',
        name: 'Supporter VIP',
        kind: 'vip',
        price: 5000,
        description: 'Support the server',
        status: 'active',
      },
      {
        id: 'legacy-pack',
        name: 'Legacy Pack',
        kind: 'item',
        price: 1500,
        description: 'Old package',
        status: 'disabled',
      },
    ]),
    withTenantScopedPrismaClientFn: async (_tenantId, work) => work({
      purchase: {
        findMany: async () => ([
          {
            code: 'PUR-1',
            userId: 'user-1',
            itemId: 'supporter-vip',
            price: 5000,
            status: 'delivered',
            createdAt: '2026-03-31T10:00:00Z',
          },
          {
            code: 'PUR-2',
            userId: 'user-2',
            itemId: 'starter-crate',
            price: 1000,
            status: 'pending',
            createdAt: '2026-03-30T10:00:00Z',
          },
          {
            code: 'PUR-3',
            userId: 'user-3',
            itemId: 'starter-crate',
            price: 1000,
            status: 'delivery_failed',
            createdAt: '2026-03-29T10:00:00Z',
          },
        ]),
      },
      purchaseStatusHistory: {
        findMany: async () => ([
          {
            purchaseCode: 'PUR-2',
            toStatus: 'pending',
            createdAt: '2026-03-30T10:05:00Z',
          },
          {
            purchaseCode: 'PUR-1',
            toStatus: 'delivered',
            createdAt: '2026-03-31T10:05:00Z',
          },
        ]),
      },
    }),
  });

  assert.equal(overview.summary.totalPackages, 3);
  assert.equal(overview.summary.activePackages, 2);
  assert.equal(overview.summary.supporterPackages, 1);
  assert.equal(overview.summary.recentPurchases30d, 3);
  assert.equal(overview.summary.supporterPurchases30d, 1);
  assert.equal(overview.summary.deliveryPending30d, 1);
  assert.equal(overview.summary.failedOrders30d, 1);
  assert.equal(overview.summary.activeSupporters30d, 1);
  assert.equal(overview.readiness.percent, 100);
  assert.equal(overview.topPackages.length, 2);
  assert.equal(overview.recentActivity.length, 3);
  assert.equal(overview.issues.some((row) => row.key === 'pending-delivery'), true);
  assert.equal(overview.issues.some((row) => row.key === 'failed-orders'), true);
});

test('tenant donation overview exposes missing setup as readiness gaps', async () => {
  const overview = await buildTenantDonationOverview({
    tenantId: 'tenant-empty',
    listShopItemsFn: async () => ([]),
    withTenantScopedPrismaClientFn: async (_tenantId, work) => work({
      purchase: {
        findMany: async () => ([]),
      },
      purchaseStatusHistory: {
        findMany: async () => ([]),
      },
    }),
  });

  assert.equal(overview.readiness.percent, 0);
  assert.equal(overview.readiness.nextRequiredStep.key, 'packages');
  assert.equal(overview.issues.some((row) => row.key === 'no-packages'), true);
});
