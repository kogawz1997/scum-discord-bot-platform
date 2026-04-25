const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = 'file:C:/new/prisma/prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';

const { prisma } = require('../src/prisma');
const {
  createSubscription,
  createTenant,
  getTenantFeatureAccess,
} = require('../src/services/platformService');
const {
  createCheckoutSession,
  ensureBillingCustomer,
  ensurePlatformBillingLifecycleTables,
  finalizeCheckoutSession,
  updateSubscriptionBillingState,
} = require('../src/services/platformBillingLifecycleService');
const {
  buildPlayerProductEntitlements,
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');

const TENANT_ID = 'tenant-commercial-lifecycle-test';
const SUBSCRIPTION_ID = 'sub-commercial-lifecycle-test';

async function cleanupCommercialLifecycleFixtures() {
  await ensurePlatformBillingLifecycleTables(prisma);
  await prisma.platformBillingPaymentAttempt.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformBillingInvoice.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformSubscriptionEvent.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformBillingCustomer.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformSubscription.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformLicense.deleteMany({ where: { tenantId: TENANT_ID } }).catch(() => null);
  await prisma.platformTenant.deleteMany({ where: { id: TENANT_ID } }).catch(() => null);
}

test('commercial lifecycle drives preview, trial, paid, and cancelled entitlement states', { concurrency: false }, async (t) => {
  await cleanupCommercialLifecycleFixtures();
  t.after(cleanupCommercialLifecycleFixtures);

  const tenantResult = await createTenant({
    id: TENANT_ID,
    slug: TENANT_ID,
    name: 'Commercial Lifecycle Test',
    type: 'trial',
    status: 'trialing',
    locale: 'th',
    ownerEmail: 'owner-commercial-lifecycle@test.local',
    ownerName: 'Owner Commercial Lifecycle',
    metadata: {
      source: 'public-preview-signup',
      previewMode: true,
      packageId: 'BOT_LOG_DELIVERY',
    },
  }, 'public-preview-signup');

  assert.equal(tenantResult.ok, true);

  const previewEntitlements = buildTenantProductEntitlements({
    tenantId: TENANT_ID,
    subscriptionStatus: 'preview',
    package: { id: 'BOT_LOG_DELIVERY' },
    enabledFeatureKeys: ['bot_delivery', 'orders_module'],
  });
  assert.equal(previewEntitlements.subscriptionStatus, 'preview');
  assert.equal(previewEntitlements.actions.can_use_delivery.locked, true);
  assert.equal(previewEntitlements.actions.can_use_delivery.lockType, 'subscription');
  assert.match(String(previewEntitlements.actions.can_use_delivery.reason || ''), /preview/i);

  const trialResult = await createSubscription({
    id: SUBSCRIPTION_ID,
    tenantId: TENANT_ID,
    planId: 'trial-14d',
    packageId: 'BOT_LOG_DELIVERY',
    billingCycle: 'trial',
    status: 'trialing',
    amountCents: 0,
    currency: 'THB',
    metadata: {
      source: 'public-preview-signup',
      previewMode: true,
      packageId: 'BOT_LOG_DELIVERY',
    },
  }, 'public-preview-signup');

  assert.equal(trialResult.ok, true);
  assert.equal(trialResult.subscription.lifecycleStatus, 'trialing');

  const trialAccess = await getTenantFeatureAccess(TENANT_ID, { cache: false });
  const trialTenantEntitlements = buildTenantProductEntitlements(trialAccess);
  assert.equal(trialAccess.subscriptionStatus, 'trialing');
  assert.equal(trialTenantEntitlements.locks.subscriptionLocked, false);
  assert.equal(trialTenantEntitlements.actions.can_use_delivery.locked, false);

  const customer = await ensureBillingCustomer({
    tenantId: TENANT_ID,
    email: 'owner-commercial-lifecycle@test.local',
    displayName: 'Owner Commercial Lifecycle',
  });
  assert.equal(customer.ok, true);

  const checkout = await createCheckoutSession({
    tenantId: TENANT_ID,
    subscriptionId: SUBSCRIPTION_ID,
    customerId: customer.customer.id,
    planId: 'platform-growth',
    packageId: 'FULL_OPTION',
    billingCycle: 'monthly',
    amountCents: 1290000,
    currency: 'THB',
    actor: 'owner-web:test',
  });
  assert.equal(checkout.ok, true);

  const paid = await finalizeCheckoutSession({
    tenantId: TENANT_ID,
    sessionToken: checkout.session.sessionToken,
    action: 'paid',
    actor: 'owner-web:test',
  });
  assert.equal(paid.ok, true);

  const paidAccess = await getTenantFeatureAccess(TENANT_ID, { cache: false });
  const paidTenantEntitlements = buildTenantProductEntitlements(paidAccess);
  const paidPlayerEntitlements = buildPlayerProductEntitlements(paidAccess);
  assert.equal(paidAccess.subscriptionStatus, 'active');
  assert.equal(paidAccess.package.id, 'FULL_OPTION');
  assert.equal(paidTenantEntitlements.actions.can_restart_server.locked, false);
  assert.equal(paidPlayerEntitlements.actions.can_buy_items.locked, false);

  const cancelled = await updateSubscriptionBillingState({
    tenantId: TENANT_ID,
    subscriptionId: SUBSCRIPTION_ID,
    status: 'canceled',
    actor: 'owner-web:test',
  });
  assert.equal(cancelled.ok, true);

  const cancelledAccess = await getTenantFeatureAccess(TENANT_ID, { cache: false });
  const cancelledPlayerEntitlements = buildPlayerProductEntitlements(cancelledAccess);
  assert.equal(cancelledAccess.subscriptionStatus, 'cancelled');
  assert.equal(cancelledPlayerEntitlements.locks.subscriptionLocked, true);
  assert.equal(cancelledPlayerEntitlements.actions.can_buy_items.locked, true);
  assert.equal(cancelledPlayerEntitlements.actions.can_buy_items.lockType, 'subscription');
  assert.deepEqual(cancelledPlayerEntitlements.actions.can_buy_items.requiredFeatures, ['shop_module', 'orders_module']);
  assert.ok(cancelledPlayerEntitlements.actions.can_buy_items.upgradeCta);

  const events = await prisma.platformSubscriptionEvent.findMany({
    where: {
      tenantId: TENANT_ID,
      subscriptionId: SUBSCRIPTION_ID,
    },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
  });
  const eventTypes = new Set(events.map((entry) => String(entry.eventType || '').trim()));

  [
    'preview.created',
    'trial.started',
    'checkout.started',
    'payment.succeeded',
    'package.changed',
    'subscription.cancelled',
    'entitlement.unlocked',
    'entitlement.locked',
  ].forEach((eventType) => {
    assert.equal(eventTypes.has(eventType), true, `missing ${eventType} lifecycle event`);
  });
});
