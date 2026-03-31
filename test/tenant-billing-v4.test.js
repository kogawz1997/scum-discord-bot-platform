const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantBillingV4Model,
  buildTenantBillingV4Html,
} = require('../src/admin/assets/tenant-billing-v4.js');

test('tenant billing v4 model summarizes subscriptions and locks', () => {
  const model = createTenantBillingV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    overview: { tenantFeatureAccess: { package: { name: 'Pro' } } },
    subscriptions: [{ id: 'sub-1', planId: 'pro', status: 'active', amountCents: 1999, currency: 'usd', billingCycle: 'monthly' }],
    billingOverview: { summary: { collectedCents: 1999, openInvoiceCount: 1 } },
    billingInvoices: [{ id: 'inv-1', status: 'open', amountCents: 1999, currency: 'usd' }],
    billingPaymentAttempts: [{ id: 'att-1', provider: 'stripe', status: 'failed', amountCents: 1999, currency: 'usd', errorCode: 'card_declined' }],
    featureEntitlements: { actions: { can_manage_events: { locked: true, reason: 'Upgrade required' } } },
  });

  assert.equal(model.header.title, 'Billing');
  assert.equal(model.subscriptions.length, 1);
  assert.equal(model.lockedActions.length, 1);
});

test('tenant billing v4 html includes upgrade CTA and billing history', () => {
  const html = buildTenantBillingV4Html(createTenantBillingV4Model({}));

  assert.match(html, /Upgrade package/);
  assert.match(html, /Recent invoices/);
  assert.match(html, /data-tenant-billing-refresh/);
});
