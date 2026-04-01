const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = 'file:C:/new/prisma/prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';

const { prisma } = require('../src/prisma');
const { createSubscription } = require('../src/services/platformService');
const { ensurePlatformBillingLifecycleTables } = require('../src/services/platformBillingLifecycleService');

async function cleanupFixtures() {
  await ensurePlatformBillingLifecycleTables(prisma);
  await prisma.platformBillingPaymentAttempt.deleteMany({
    where: { tenantId: 'tenant-sub-billing-test' },
  }).catch(() => null);
  await prisma.platformBillingInvoice.deleteMany({
    where: { tenantId: 'tenant-sub-billing-test' },
  }).catch(() => null);
  await prisma.platformSubscriptionEvent.deleteMany({
    where: { tenantId: 'tenant-sub-billing-test' },
  }).catch(() => null);
  await prisma.platformBillingCustomer.deleteMany({
    where: { tenantId: 'tenant-sub-billing-test' },
  }).catch(() => null);
  await prisma.platformSubscription.deleteMany({
    where: { tenantId: 'tenant-sub-billing-test' },
  }).catch(() => null);
  await prisma.platformTenant.deleteMany({
    where: { id: 'tenant-sub-billing-test' },
  }).catch(() => null);
}

test('createSubscription provisions billing customer and invoice context', async (t) => {
  await cleanupFixtures();
  t.after(cleanupFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-sub-billing-test',
      slug: 'tenant-sub-billing-test',
      name: 'Tenant Subscription Billing Test',
      ownerEmail: 'owner-billing@test.local',
      ownerName: 'Owner Billing',
    },
  });

  const result = await createSubscription({
    tenantId: 'tenant-sub-billing-test',
    planId: 'platform-starter',
    billingCycle: 'monthly',
    status: 'active',
    amountCents: 490000,
    currency: 'THB',
  }, 'test-suite');

  assert.equal(result.ok, true);
  assert.equal(String(result.billing?.customer?.tenantId || ''), 'tenant-sub-billing-test');
  assert.equal(String(result.billing?.invoice?.status || ''), 'open');
});
