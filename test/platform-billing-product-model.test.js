const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = 'file:C:/new/prisma/prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';

const { getPackageCatalog } = require('../src/domain/billing/packageCatalogService');
const {
  getSubscriptionLifecycleStatus,
  sanitizeSubscriptionRow,
} = require('../src/services/platformService');

test('package catalog exposes monetization metadata for mapped plans', () => {
  const starter = getPackageCatalog({ includeInactive: true }).find((entry) => entry.id === 'BOT_LOG_DELIVERY');
  const growth = getPackageCatalog({ includeInactive: true }).find((entry) => entry.id === 'FULL_OPTION');

  assert.ok(starter);
  assert.equal(starter.price, 490000);
  assert.equal(starter.currency, 'THB');
  assert.equal(starter.billingCycle, 'monthly');
  assert.ok(starter.limits);

  assert.ok(growth);
  assert.equal(growth.price, 1290000);
  assert.equal(growth.currency, 'THB');
});

test('subscription lifecycle status expires by date and exposes canonical billing fields', () => {
  const row = sanitizeSubscriptionRow({
    id: 'sub-1',
    tenantId: 'tenant-1',
    planId: 'trial-14d',
    billingCycle: 'trial',
    status: 'trialing',
    startedAt: new Date('2026-03-01T00:00:00.000Z'),
    renewsAt: new Date('2026-03-15T00:00:00.000Z'),
    metadataJson: JSON.stringify({
      packageId: 'BOT_LOG_DELIVERY',
      currentPeriodStart: '2026-03-01T00:00:00.000Z',
      currentPeriodEnd: '2026-03-15T00:00:00.000Z',
      trialEndsAt: '2026-03-15T00:00:00.000Z',
    }),
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  });

  assert.equal(row.packageId, 'BOT_LOG_DELIVERY');
  assert.equal(row.currentPeriodStart, '2026-03-01T00:00:00.000Z');
  assert.equal(row.currentPeriodEnd, '2026-03-15T00:00:00.000Z');
  assert.equal(row.trialEndsAt, '2026-03-15T00:00:00.000Z');
  assert.equal(row.lifecycleStatus, 'expired');
});

test('subscription lifecycle status maps raw suspension states to canonical past due', () => {
  const status = getSubscriptionLifecycleStatus({
    status: 'past_due',
    billingCycle: 'monthly',
    renewsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  assert.equal(status, 'past_due');
});
