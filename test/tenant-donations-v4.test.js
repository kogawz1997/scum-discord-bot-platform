const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantDonationsV4Model,
  buildTenantDonationsV4Html,
} = require('../src/admin/assets/tenant-donations-v4.js');

test('tenant donations v4 model maps shop items into editable donation packages', () => {
  const model = createTenantDonationsV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    shopItems: [
      { id: 'starter-crate', name: 'Starter Crate', kind: 'item', price: 1000, description: 'Starter gear', gameItemId: 'crate_a', quantity: 1 },
      { id: 'vip-month', name: 'VIP Month', kind: 'vip', price: 5000, description: '30 days VIP' },
    ],
    donationsOverview: {
      summary: {
        recentPurchases30d: 4,
        supporterRevenueCoins30d: 12000,
        deliveryPending30d: 1,
        activeSupporters30d: 2,
        lastPurchaseAt: '2026-04-01T10:00:00Z',
      },
      readiness: {
        percent: 75,
        completed: 3,
        total: 4,
        steps: [
          { key: 'packages', label: 'Create first package', done: true, detail: 'ok', href: '#tenant-donation-create', actionLabel: 'Create package' },
          { key: 'supporter', label: 'Add supporter tier', done: true, detail: 'ok', href: '#tenant-donation-create', actionLabel: 'Add supporter tier' },
          { key: 'first-purchase', label: 'Receive first supporter purchase', done: false, detail: 'needs activity', href: '/tenant/orders', actionLabel: 'Open orders' },
        ],
        nextRequiredStep: { key: 'first-purchase', label: 'Receive first supporter purchase' },
      },
      issues: [
        { key: 'pending-delivery', tone: 'warning', title: 'Pending delivery work needs review', detail: '1 pending', href: '/tenant/orders', actionLabel: 'Open orders' },
      ],
      topPackages: [
        { id: 'vip-month', name: 'VIP Month', kind: 'vip', purchases30d: 3, revenueCoins30d: 12000, latestStatus: 'delivered', lastPurchaseAt: '2026-04-01T10:00:00Z', isSupporter: true },
      ],
      recentActivity: [
        { code: 'PUR-1', userId: 'user-1', itemName: 'VIP Month', kind: 'vip', price: 5000, status: 'delivered', createdAt: '2026-04-01T10:00:00Z' },
      ],
    },
  });

  assert.equal(model.header.title, 'Donations');
  assert.equal(model.items.length, 2);
  assert.equal(model.summaryStrip[2].value, '4');
  assert.equal(model.readiness.percent, 75);
  assert.equal(model.topPackages.length, 1);
  assert.equal(model.recentActivity.length, 1);
});

test('tenant donations v4 html exposes reporting, readiness, and package actions', () => {
  const html = buildTenantDonationsV4Html(createTenantDonationsV4Model({
    shopItems: [
      { id: 'starter-crate', name: 'Starter Crate', kind: 'item', price: 1000, description: 'Starter gear', gameItemId: 'crate_a', quantity: 1 },
    ],
    donationsOverview: {
      summary: {
        recentPurchases30d: 1,
        supporterRevenueCoins30d: 1000,
        deliveryPending30d: 0,
        activeSupporters30d: 0,
      },
      readiness: {
        percent: 50,
        completed: 2,
        total: 4,
        steps: [
          { key: 'packages', label: 'Create first package', done: true, detail: 'ok', href: '#tenant-donation-create', actionLabel: 'Create package' },
          { key: 'active', label: 'Enable at least one package', done: true, detail: 'ok', href: '#tenant-donation-packages', actionLabel: 'Review package status' },
        ],
      },
      issues: [],
      topPackages: [
        { id: 'starter-crate', name: 'Starter Crate', kind: 'item', purchases30d: 1, revenueCoins30d: 1000, latestStatus: 'pending', lastPurchaseAt: '2026-04-01T10:00:00Z', isSupporter: false },
      ],
      recentActivity: [
        { code: 'PUR-2', userId: 'user-2', itemName: 'Starter Crate', kind: 'item', price: 1000, status: 'pending', createdAt: '2026-04-01T10:00:00Z' },
      ],
    },
  }));

  assert.match(html, /Create donation package/);
  assert.match(html, /data-tenant-donation-create-form/);
  assert.match(html, /data-tenant-donation-save/);
  assert.match(html, /Supporter readiness and next actions/);
  assert.match(html, /data-tenant-donation-readiness/);
  assert.match(html, /data-tenant-donation-top-packages/);
  assert.match(html, /data-tenant-donation-activity/);
  assert.match(html, /data-tenant-donation-toggle-status/);
});
