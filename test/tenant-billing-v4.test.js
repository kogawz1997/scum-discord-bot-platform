const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantBillingV4Model,
  buildTenantBillingV4Html,
} = require('../src/admin/assets/tenant-billing-v4.js');

test('tenant billing v4 model summarizes subscriptions and locks', () => {
  const model = createTenantBillingV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    overview: { tenantFeatureAccess: { package: { name: 'Pro', features: ['restart_server'] } } },
    subscriptions: [{ id: 'sub-1', planId: 'pro', status: 'active', amountCents: 1999, currency: 'usd', billingCycle: 'monthly' }],
    billingOverview: { summary: { collectedCents: 1999, openInvoiceCount: 1 } },
    billingInvoices: [{ id: 'inv-1', status: 'open', amountCents: 1999, currency: 'usd' }],
    billingPaymentAttempts: [{ id: 'att-1', provider: 'stripe', status: 'failed', amountCents: 1999, currency: 'usd', errorCode: 'card_declined' }],
    featureEntitlements: { actions: { can_manage_events: { locked: true, reason: 'Upgrade required' } } },
    quota: {
      enabledFeatureKeys: ['restart_server', 'server_bot'],
      quotas: {
        agentRuntimes: { used: 2, limit: 3, remaining: 1 },
      },
    },
  });

  assert.equal(model.header.title, 'การเงินและแพ็กเกจ');
  assert.equal(model.subscriptions.length, 1);
  assert.equal(model.lockedActions.length, 1);
  assert.equal(model.features.length, 2);
  assert.equal(model.quotaRows.length, 1);
});

test('tenant billing v4 html includes upgrade CTA and billing history', () => {
  const html = buildTenantBillingV4Html(createTenantBillingV4Model({}));

  assert.match(html, /ดูแพ็กเกจที่สูงขึ้น/);
  assert.match(html, /ใบแจ้งหนี้ล่าสุด/);
  assert.match(html, /data-tenant-billing-refresh/);
});

test('tenant billing v4 html exposes enabled features and package limits', () => {
  const html = buildTenantBillingV4Html(createTenantBillingV4Model({
    quota: {
      enabledFeatureKeys: ['delivery_agent', 'server_bot'],
      quotas: {
        agentRuntimes: { used: 1, limit: 2, remaining: 1 },
      },
    },
  }));

  assert.match(html, /ฟีเจอร์ที่เปิดอยู่/);
  assert.match(html, /ขีดจำกัดของแพ็กเกจตอนนี้/);
  assert.match(html, /ตัวส่งของ/);
  assert.match(html, /ใช้แล้ว 1/);
});
