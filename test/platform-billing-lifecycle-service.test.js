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
  createCheckoutSession,
  createInvoiceDraft,
  ensureBillingCustomer,
  ensurePlatformBillingLifecycleTables,
  finalizeCheckoutSession,
  getBillingProviderConfigSummary,
  getCheckoutSessionByToken,
  listBillingInvoices,
  listBillingPaymentAttempts,
  recordPaymentAttempt,
  recordSubscriptionEvent,
  updateInvoiceStatus,
  updatePaymentAttempt,
  updateSubscriptionBillingState,
} = require('../src/services/platformBillingLifecycleService');

async function cleanupBillingFixtures() {
  await ensurePlatformBillingLifecycleTables(prisma);
  await prisma.platformBillingPaymentAttempt.deleteMany({
    where: { tenantId: 'tenant-billing-test' },
  }).catch(() => null);
  await prisma.platformBillingInvoice.deleteMany({
    where: { tenantId: 'tenant-billing-test' },
  }).catch(() => null);
  await prisma.platformSubscriptionEvent.deleteMany({
    where: { tenantId: 'tenant-billing-test' },
  }).catch(() => null);
  await prisma.platformBillingCustomer.deleteMany({
    where: { tenantId: 'tenant-billing-test' },
  }).catch(() => null);
  await prisma.platformSubscription.deleteMany({
    where: { tenantId: 'tenant-billing-test' },
  }).catch(() => null);
  await prisma.platformTenant.deleteMany({
    where: { id: 'tenant-billing-test' },
  }).catch(() => null);
}

test('platform billing lifecycle service records customer, invoice, payment, and subscription events', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  const customer = await ensureBillingCustomer({
    tenantId: 'tenant-billing-test',
    email: 'billing@example.com',
    displayName: 'Billing Test',
  });
  assert.equal(customer.ok, true);
  assert.equal(String(customer.customer?.tenantId || ''), 'tenant-billing-test');

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-test',
    customerId: customer.customer.id,
    amountCents: 490000,
    currency: 'THB',
    status: 'open',
  });
  assert.equal(invoice.ok, true);
  assert.equal(String(invoice.invoice?.status || ''), 'open');

  const attempt = await recordPaymentAttempt({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    provider: 'manual',
    status: 'pending',
    amountCents: 490000,
    currency: 'THB',
  });
  assert.equal(attempt.ok, true);

  const event = await recordSubscriptionEvent({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-test',
    eventType: 'subscription.created',
    billingStatus: 'active',
    actor: 'test-suite',
    payload: { amountCents: 490000 },
  });
  assert.equal(event.ok, true);

  const invoices = await listBillingInvoices({
    tenantId: 'tenant-billing-test',
    limit: 10,
  });
  const attempts = await listBillingPaymentAttempts({
    tenantId: 'tenant-billing-test',
    limit: 10,
  });
  assert.equal(invoices.length, 1);
  assert.equal(attempts.length, 1);

  const previousProvider = process.env.PLATFORM_BILLING_PROVIDER;
  process.env.PLATFORM_BILLING_PROVIDER = 'platform_local';
  const providerSummary = getBillingProviderConfigSummary();
  process.env.PLATFORM_BILLING_PROVIDER = previousProvider;
  assert.equal(providerSummary.provider, 'platform_local');
});

test('platform billing lifecycle service creates and finalizes a checkout session', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Checkout Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-checkout',
      tenantId: 'tenant-billing-test',
      planId: 'trial-14d',
      billingCycle: 'trial',
      status: 'trialing',
      amountCents: 0,
      currency: 'THB',
    },
  });

  const customer = await ensureBillingCustomer({
    tenantId: 'tenant-billing-test',
    email: 'checkout@example.com',
    displayName: 'Checkout Test',
  });

  const session = await createCheckoutSession({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-checkout',
    customerId: customer.customer.id,
    planId: 'platform-starter',
    packageId: 'BOT_LOG_DELIVERY',
    billingCycle: 'monthly',
    amountCents: 490000,
    currency: 'THB',
  });

  assert.equal(session.ok, true);
  assert.equal(String(session.session?.status || ''), 'requires_action');
  assert.ok(String(session.session?.sessionToken || '').startsWith('chk_'));

  const fetched = await getCheckoutSessionByToken({
    sessionToken: session.session.sessionToken,
    tenantId: 'tenant-billing-test',
  });
  assert.equal(String(fetched?.invoiceId || ''), String(session.invoice?.id || ''));

  const finalized = await finalizeCheckoutSession({
    sessionToken: session.session.sessionToken,
    tenantId: 'tenant-billing-test',
    action: 'paid',
  });

  assert.equal(finalized.ok, true);
  assert.equal(String(finalized.invoice?.status || ''), 'paid');
  assert.equal(String(finalized.subscription?.status || ''), 'active');
  assert.equal(String(finalized.subscription?.planId || ''), 'platform-starter');
});

test('platform billing lifecycle service records cancel and reactivate subscription transitions', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Transition Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-transition',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'active',
      amountCents: 490000,
      currency: 'THB',
      renewsAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  });

  const canceled = await updateSubscriptionBillingState({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-transition',
    planId: 'platform-starter',
    billingCycle: 'monthly',
    status: 'canceled',
    amountCents: 490000,
    currency: 'THB',
    actor: 'owner-web:test',
  });

  assert.equal(canceled.ok, true);
  assert.equal(String(canceled.subscription?.status || ''), 'canceled');
  assert.ok(canceled.subscription?.canceledAt);
  assert.equal(String(canceled.event?.eventType || ''), 'subscription.canceled');

  const reactivated = await updateSubscriptionBillingState({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-transition',
    planId: 'platform-starter',
    billingCycle: 'monthly',
    status: 'active',
    amountCents: 490000,
    currency: 'THB',
    canceledAt: null,
    actor: 'owner-web:test',
  });

  assert.equal(reactivated.ok, true);
  assert.equal(String(reactivated.subscription?.status || ''), 'active');
  assert.equal(reactivated.subscription?.canceledAt, null);
  assert.ok(reactivated.subscription?.renewsAt);
  assert.equal(String(reactivated.event?.eventType || ''), 'subscription.reactivated');
});

test('platform billing lifecycle service propagates payment attempt failures and recoveries', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Attempt Lifecycle Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-attempt',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'active',
      amountCents: 490000,
      currency: 'THB',
      renewsAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  });

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-attempt',
    amountCents: 490000,
    currency: 'THB',
    status: 'open',
    metadata: {
      targetPlanId: 'platform-starter',
      targetPackageId: 'BOT_LOG_DELIVERY',
      targetBillingCycle: 'monthly',
    },
  });

  const attempt = await recordPaymentAttempt({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    provider: 'platform_local',
    status: 'pending',
    amountCents: 490000,
    currency: 'THB',
  });

  const failed = await updatePaymentAttempt({
    tenantId: 'tenant-billing-test',
    attemptId: attempt.attempt.id,
    status: 'failed',
    completedAt: '2026-04-01T10:00:00.000Z',
    errorCode: 'renewal_failed',
    errorDetail: 'Owner marked the renewal as failed',
    actor: 'owner-web:test',
  });

  assert.equal(failed.ok, true);
  assert.equal(String(failed.attempt?.status || ''), 'failed');
  assert.equal(String(failed.invoice?.status || ''), 'past_due');
  assert.equal(String(failed.subscription?.status || ''), 'past_due');
  assert.equal(String(failed.event?.eventType || ''), 'subscription.past_due');

  const recovered = await updatePaymentAttempt({
    tenantId: 'tenant-billing-test',
    attemptId: attempt.attempt.id,
    status: 'succeeded',
    completedAt: '2026-04-02T10:00:00.000Z',
    actor: 'owner-web:test',
  });

  assert.equal(recovered.ok, true);
  assert.equal(String(recovered.attempt?.status || ''), 'succeeded');
  assert.equal(String(recovered.invoice?.status || ''), 'paid');
  assert.equal(String(recovered.subscription?.status || ''), 'active');
  assert.ok(recovered.subscription?.renewsAt);
  assert.equal(String(recovered.event?.eventType || ''), 'subscription.recovered');
});

test('platform billing lifecycle service propagates invoice status transitions to subscriptions', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Invoice Lifecycle Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-invoice',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'active',
      amountCents: 490000,
      currency: 'THB',
      renewsAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  });

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-invoice',
    amountCents: 490000,
    currency: 'THB',
    status: 'open',
    metadata: {
      targetPlanId: 'platform-starter',
      targetPackageId: 'BOT_LOG_DELIVERY',
      targetBillingCycle: 'monthly',
    },
  });

  const overdue = await updateInvoiceStatus({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    status: 'past_due',
    actor: 'owner-web:test',
  });

  assert.equal(overdue.ok, true);
  assert.equal(String(overdue.invoice?.status || ''), 'past_due');
  assert.equal(String(overdue.subscription?.status || ''), 'past_due');
  assert.equal(String(overdue.event?.eventType || ''), 'subscription.past_due');

  const paid = await updateInvoiceStatus({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    status: 'paid',
    paidAt: '2026-04-03T08:00:00.000Z',
    actor: 'owner-web:test',
  });

  assert.equal(paid.ok, true);
  assert.equal(String(paid.invoice?.status || ''), 'paid');
  assert.equal(String(paid.subscription?.status || ''), 'active');
  assert.equal(String(paid.event?.eventType || ''), 'subscription.recovered');
});

test('platform billing lifecycle service voids pending subscriptions when invoice is voided', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Invoice Void Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-void',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'pending',
      amountCents: 490000,
      currency: 'THB',
    },
  });

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-void',
    amountCents: 490000,
    currency: 'THB',
    status: 'open',
  });

  const voided = await updateInvoiceStatus({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    status: 'void',
    actor: 'owner-web:test',
  });

  assert.equal(voided.ok, true);
  assert.equal(String(voided.invoice?.status || ''), 'void');
  assert.equal(String(voided.subscription?.status || ''), 'canceled');
  assert.equal(String(voided.event?.eventType || ''), 'subscription.canceled');
});

test('platform billing lifecycle service marks disputed invoices as past due on active subscriptions', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Invoice Dispute Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-dispute',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'active',
      amountCents: 490000,
      currency: 'THB',
    },
  });

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-dispute',
    amountCents: 490000,
    currency: 'THB',
    status: 'paid',
  });

  const disputed = await updateInvoiceStatus({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    status: 'disputed',
    actor: 'owner-web:test',
  });

  assert.equal(disputed.ok, true);
  assert.equal(String(disputed.invoice?.status || ''), 'disputed');
  assert.equal(String(disputed.subscription?.status || ''), 'past_due');
  assert.equal(String(disputed.event?.eventType || ''), 'subscription.past_due');
});

test('platform billing lifecycle service refunds pending subscriptions into canceled state', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Invoice Refund Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-refund',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'pending',
      amountCents: 490000,
      currency: 'THB',
    },
  });

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-refund',
    amountCents: 490000,
    currency: 'THB',
    status: 'paid',
  });

  const refunded = await updateInvoiceStatus({
    tenantId: 'tenant-billing-test',
    invoiceId: invoice.invoice.id,
    status: 'refunded',
    actor: 'owner-web:test',
  });

  assert.equal(refunded.ok, true);
  assert.equal(String(refunded.invoice?.status || ''), 'refunded');
  assert.equal(String(refunded.subscription?.status || ''), 'canceled');
  assert.equal(String(refunded.event?.eventType || ''), 'subscription.canceled');
});

test('platform billing lifecycle service records suspended subscriptions and reactivates them cleanly', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Suspension Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-suspended',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'active',
      amountCents: 490000,
      currency: 'THB',
      renewsAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  });

  const suspended = await updateSubscriptionBillingState({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-suspended',
    status: 'suspended',
    actor: 'owner-web:test',
    metadata: {
      suspendedBy: 'owner-web:test',
      suspensionReason: 'manual-review',
    },
  });

  assert.equal(suspended.ok, true);
  assert.equal(String(suspended.subscription?.status || ''), 'suspended');
  assert.equal(String(suspended.event?.eventType || ''), 'subscription.suspended');

  const reactivated = await updateSubscriptionBillingState({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-suspended',
    status: 'active',
    actor: 'owner-web:test',
    canceledAt: null,
  });

  assert.equal(reactivated.ok, true);
  assert.equal(String(reactivated.subscription?.status || ''), 'active');
  assert.ok(reactivated.subscription?.renewsAt);
  assert.equal(String(reactivated.event?.eventType || ''), 'subscription.reactivated');
});
