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
  processBillingWebhookEvent,
  recordPaymentAttempt,
  recordSubscriptionEvent,
  updateInvoiceStatus,
  updatePaymentAttempt,
  updateSubscriptionBillingState,
} = require('../src/services/platformBillingLifecycleService');

function createStrictSharedBillingPrisma(base = prisma) {
  return {
    _originalClient: base,
    platformBillingCustomer: base.platformBillingCustomer,
    platformBillingInvoice: base.platformBillingInvoice,
    platformBillingPaymentAttempt: base.platformBillingPaymentAttempt,
    platformSubscriptionEvent: base.platformSubscriptionEvent,
    async $queryRawUnsafe() {
      throw new Error('shared sqlite billing compatibility test unexpectedly used raw query path');
    },
    async $executeRawUnsafe() {
      throw new Error('shared sqlite billing compatibility test unexpectedly used raw execute path');
    },
    async $queryRaw() {
      throw new Error('shared sqlite billing compatibility test unexpectedly used raw query path');
    },
    async $executeRaw() {
      throw new Error('shared sqlite billing compatibility test unexpectedly used raw execute path');
    },
  };
}

function createMockBillingDelegatePrisma() {
  const customers = new Map();
  const invoices = new Map();
  const paymentAttempts = new Map();
  const subscriptionEvents = new Map();
  let rawQueryCalls = 0;
  let rawExecuteCalls = 0;

  function sortRows(rows = []) {
    return [...rows].sort((left, right) => {
      const leftUpdated = Number(new Date(left.updatedAt || left.createdAt || 0).getTime());
      const rightUpdated = Number(new Date(right.updatedAt || right.createdAt || 0).getTime());
      if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;
      const leftCreated = Number(new Date(left.createdAt || 0).getTime());
      const rightCreated = Number(new Date(right.createdAt || 0).getTime());
      return rightCreated - leftCreated;
    });
  }

  const prisma = {
    platformBillingCustomer: {
      async findUnique({ where } = {}) {
        if (where?.id) return customers.get(String(where.id || '').trim()) || null;
        if (where?.tenantId) {
          return [...customers.values()].find((row) => String(row.tenantId || '').trim() === String(where.tenantId || '').trim()) || null;
        }
        return null;
      },
      async create({ data }) {
        const row = { ...data };
        customers.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = customers.get(id);
        if (!current) throw new Error(`missing billing customer: ${id}`);
        const row = { ...current, ...data };
        customers.set(id, row);
        return row;
      },
    },
    platformBillingInvoice: {
      async findUnique({ where } = {}) {
        return invoices.get(String(where?.id || '').trim()) || null;
      },
      async create({ data }) {
        const row = { ...data };
        invoices.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = invoices.get(id);
        if (!current) throw new Error(`missing billing invoice: ${id}`);
        const row = { ...current, ...data };
        invoices.set(id, row);
        return row;
      },
      async findMany({ where, take } = {}) {
        const rows = sortRows(
          [...invoices.values()].filter((row) => {
            if (where?.tenantId && String(row.tenantId || '').trim() !== String(where.tenantId || '').trim()) return false;
            if (where?.status && String(row.status || '').trim() !== String(where.status || '').trim()) return false;
            return true;
          }),
        );
        return rows.slice(0, take || rows.length);
      },
    },
    platformBillingPaymentAttempt: {
      async findUnique({ where } = {}) {
        return paymentAttempts.get(String(where?.id || '').trim()) || null;
      },
      async findFirst({ where } = {}) {
        const rows = sortRows(
          [...paymentAttempts.values()].filter((row) => {
            if (where?.externalRef && String(row.externalRef || '').trim() !== String(where.externalRef || '').trim()) return false;
            return true;
          }),
        );
        return rows[0] || null;
      },
      async create({ data }) {
        const row = { ...data };
        paymentAttempts.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = paymentAttempts.get(id);
        if (!current) throw new Error(`missing billing payment attempt: ${id}`);
        const row = { ...current, ...data };
        paymentAttempts.set(id, row);
        return row;
      },
      async findMany({ where, take } = {}) {
        const rows = sortRows(
          [...paymentAttempts.values()].filter((row) => {
            if (where?.tenantId && String(row.tenantId || '').trim() !== String(where.tenantId || '').trim()) return false;
            if (where?.status && String(row.status || '').trim() !== String(where.status || '').trim()) return false;
            if (where?.provider && String(row.provider || '').trim() !== String(where.provider || '').trim()) return false;
            return true;
          }),
        );
        return rows.slice(0, take || rows.length);
      },
    },
    platformSubscriptionEvent: {
      async findUnique({ where } = {}) {
        return subscriptionEvents.get(String(where?.id || '').trim()) || null;
      },
      async create({ data }) {
        const row = { ...data };
        subscriptionEvents.set(row.id, row);
        return row;
      },
    },
    async $queryRaw() {
      rawQueryCalls += 1;
      return [];
    },
    async $executeRaw() {
      rawExecuteCalls += 1;
      return [];
    },
    async $transaction(work) {
      return work(this);
    },
    async $disconnect() {},
  };

  return {
    prisma,
    getSnapshot() {
      return {
        rawQueryCalls,
        rawExecuteCalls,
        customerCount: customers.size,
        invoiceCount: invoices.size,
        paymentAttemptCount: paymentAttempts.size,
        subscriptionEventCount: subscriptionEvents.size,
      };
    },
  };
}

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

test('platform billing lifecycle service prefers Prisma delegates when sqlite runtime has delegate-backed persistence', async () => {
  const mock = createMockBillingDelegatePrisma();

  await ensurePlatformBillingLifecycleTables(mock.prisma);

  const customer = await ensureBillingCustomer({
    tenantId: 'tenant-billing-delegate-test',
    email: 'delegate@example.com',
    displayName: 'Delegate Billing Test',
  }, mock.prisma);
  assert.equal(customer.ok, true);

  const invoice = await createInvoiceDraft({
    tenantId: 'tenant-billing-delegate-test',
    subscriptionId: 'sub-billing-delegate-test',
    customerId: customer.customer.id,
    amountCents: 490000,
    currency: 'THB',
    status: 'open',
  }, mock.prisma);
  assert.equal(invoice.ok, true);

  const attempt = await recordPaymentAttempt({
    tenantId: 'tenant-billing-delegate-test',
    invoiceId: invoice.invoice.id,
    provider: 'manual',
    status: 'pending',
    amountCents: 490000,
    currency: 'THB',
  }, mock.prisma);
  assert.equal(attempt.ok, true);

  const event = await recordSubscriptionEvent({
    tenantId: 'tenant-billing-delegate-test',
    subscriptionId: 'sub-billing-delegate-test',
    eventType: 'subscription.created',
    billingStatus: 'active',
    actor: 'test-suite',
    payload: { amountCents: 490000 },
  }, mock.prisma);
  assert.equal(event.ok, true);

  const invoices = await listBillingInvoices({
    tenantId: 'tenant-billing-delegate-test',
    limit: 10,
  }, mock.prisma);
  const attempts = await listBillingPaymentAttempts({
    tenantId: 'tenant-billing-delegate-test',
    limit: 10,
  }, mock.prisma);
  const snapshot = mock.getSnapshot();

  assert.equal(invoices.length, 1);
  assert.equal(attempts.length, 1);
  assert.equal(snapshot.rawQueryCalls, 0);
  assert.equal(snapshot.rawExecuteCalls, 0);
  assert.equal(snapshot.customerCount, 1);
  assert.equal(snapshot.invoiceCount, 1);
  assert.equal(snapshot.paymentAttemptCount, 1);
  assert.equal(snapshot.subscriptionEventCount, 1);
});

test('platform billing lifecycle service repairs shared sqlite DateTime rows before using Prisma delegates', { concurrency: false }, async (t) => {
  const invoiceId = 'inv-shared-sqlite-compat';
  const tenantId = 'tenant-billing-shared-sqlite-compat';
  const strictSharedPrisma = createStrictSharedBillingPrisma(prisma);

  const cleanup = async () => {
    await prisma.$executeRawUnsafe('DELETE FROM platform_billing_invoices WHERE id = ?', invoiceId).catch(() => null);
  };

  await cleanup();
  t.after(async () => {
    await cleanup();
  });

  await prisma.$executeRawUnsafe(
    `INSERT INTO platform_billing_invoices (
      id, tenantId, subscriptionId, customerId, status, currency, amountCents, dueAt, paidAt, externalRef, metadataJson, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    invoiceId,
    tenantId,
    'sub-shared-sqlite-compat',
    null,
    'open',
    'THB',
    490000,
    '1777278766803',
    null,
    null,
    '{"source":"compat-test"}',
    '1774686766820',
    '1774686766820',
  );

  const beforeRepair = await prisma.$queryRawUnsafe(
    'SELECT dueAt, createdAt, updatedAt FROM platform_billing_invoices WHERE id = ?',
    invoiceId,
  );
  assert.equal(Array.isArray(beforeRepair), true);
  assert.equal(Boolean(beforeRepair[0]?.dueAt), true);

  await ensurePlatformBillingLifecycleTables(prisma);

  const repaired = await prisma.platformBillingInvoice.findUnique({
    where: { id: invoiceId },
  });
  assert.equal(repaired.id, invoiceId);
  assert.ok(repaired.dueAt instanceof Date);
  assert.match(repaired.dueAt.toISOString(), /^\d{4}-\d{2}-\d{2}T/);

  const invoices = await listBillingInvoices({
    tenantId,
    limit: 10,
  }, strictSharedPrisma);

  assert.equal(invoices.some((entry) => entry.id === invoiceId), true);
  assert.equal(invoices.find((entry) => entry.id === invoiceId)?.dueAt, repaired.dueAt.toISOString());
});

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

test('platform billing lifecycle service requires explicit allowGlobal for global reads in strict postgres mode', async () => {
  const { prisma: mockPrisma } = createMockBillingDelegatePrisma();

  await assert.rejects(
    () => listBillingInvoices({
      limit: 10,
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }, mockPrisma),
    /billing invoice listing requires tenantId/i,
  );

  await assert.rejects(
    () => listBillingPaymentAttempts({
      limit: 10,
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }, mockPrisma),
    /billing payment attempt listing requires tenantId/i,
  );
});

test('platform billing lifecycle service allows explicit global billing reads in strict postgres mode', async () => {
  const { prisma: mockPrisma } = createMockBillingDelegatePrisma();
  const now = new Date('2026-04-04T10:00:00.000Z');

  await mockPrisma.platformBillingInvoice.create({
    data: {
      id: 'inv-global-1',
      tenantId: 'tenant-a',
      subscriptionId: 'sub-a',
      customerId: 'cust-a',
      status: 'open',
      currency: 'THB',
      amountCents: 1000,
      dueAt: now,
      paidAt: null,
      externalRef: 'inv-global-1',
      metadataJson: '{}',
      createdAt: now,
      updatedAt: now,
    },
  });
  await mockPrisma.platformBillingPaymentAttempt.create({
    data: {
      id: 'pay-global-1',
      invoiceId: 'inv-global-1',
      tenantId: 'tenant-a',
      provider: 'stripe',
      status: 'failed',
      amountCents: 1000,
      currency: 'THB',
      externalRef: 'pay-global-1',
      errorCode: 'retry_later',
      errorDetail: 'Retry later',
      attemptedAt: now,
      completedAt: null,
      metadataJson: '{}',
      createdAt: now,
      updatedAt: now,
    },
  });

  const invoices = await listBillingInvoices({
    allowGlobal: true,
    limit: 10,
    env: {
      DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    },
  }, mockPrisma);
  const attempts = await listBillingPaymentAttempts({
    allowGlobal: true,
    limit: 10,
    env: {
      DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    },
  }, mockPrisma);

  assert.equal(invoices.length, 1);
  assert.equal(String(invoices[0]?.id || ''), 'inv-global-1');
  assert.equal(attempts.length, 1);
  assert.equal(String(attempts[0]?.id || ''), 'pay-global-1');
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

test('platform billing lifecycle service dedupes replayed webhook events by provider event id', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Webhook Replay Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-webhook',
      tenantId: 'tenant-billing-test',
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'trialing',
      amountCents: 490000,
      currency: 'THB',
    },
  });

  const customer = await ensureBillingCustomer({
    tenantId: 'tenant-billing-test',
    email: 'webhook@example.com',
    displayName: 'Webhook Replay Test',
  });

  const session = await createCheckoutSession({
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-webhook',
    customerId: customer.customer.id,
    planId: 'platform-starter',
    packageId: 'BOT_LOG_DELIVERY',
    billingCycle: 'monthly',
    amountCents: 490000,
    currency: 'THB',
  });

  const webhookInput = {
    tenantId: 'tenant-billing-test',
    provider: 'platform_local',
    eventType: 'invoice.paid',
    invoiceId: session.invoice.id,
    subscriptionId: 'sub-billing-webhook',
    externalRef: session.session.sessionToken,
    payload: {
      id: 'evt_webhook_replay_1',
      invoiceId: session.invoice.id,
      subscriptionId: 'sub-billing-webhook',
      tenantId: 'tenant-billing-test',
      sessionToken: session.session.sessionToken,
      action: 'paid',
    },
  };

  const first = await processBillingWebhookEvent(webhookInput);
  const second = await processBillingWebhookEvent(webhookInput);

  const events = await prisma.platformSubscriptionEvent.findMany({
    where: {
      tenantId: 'tenant-billing-test',
      subscriptionId: 'sub-billing-webhook',
    },
    orderBy: { createdAt: 'asc' },
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(String(second.event?.id || ''), String(first.event?.id || ''));
  assert.equal(events.length, 2);
  assert.equal(String(events[0]?.eventType || ''), 'checkout.session_created');
  assert.equal(String(events[1]?.eventType || ''), 'invoice.paid');
});

test('platform billing lifecycle service reuses an open checkout session for duplicate requests', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Checkout Idempotency Test',
    },
  });

  await prisma.platformSubscription.create({
    data: {
      id: 'sub-billing-idempotent',
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
    email: 'checkout-idempotent@example.com',
    displayName: 'Checkout Idempotent Test',
  });

  const input = {
    tenantId: 'tenant-billing-test',
    subscriptionId: 'sub-billing-idempotent',
    customerId: customer.customer.id,
    planId: 'platform-starter',
    packageId: 'BOT_LOG_DELIVERY',
    billingCycle: 'monthly',
    amountCents: 490000,
    currency: 'THB',
  };

  const first = await createCheckoutSession(input);
  const second = await createCheckoutSession(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(String(second.session?.sessionToken || ''), String(first.session?.sessionToken || ''));
  assert.equal(String(second.invoice?.id || ''), String(first.invoice?.id || ''));

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

test('platform billing lifecycle service supports suspended subscription state', async (t) => {
  await cleanupBillingFixtures();
  t.after(cleanupBillingFixtures);

  await prisma.platformTenant.create({
    data: {
      id: 'tenant-billing-test',
      slug: 'tenant-billing-test',
      name: 'Billing Suspended State Test',
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
  });

  assert.equal(suspended.ok, true);
  assert.equal(String(suspended.subscription?.status || ''), 'suspended');
  assert.equal(String(suspended.event?.eventType || ''), 'subscription.suspended');
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
