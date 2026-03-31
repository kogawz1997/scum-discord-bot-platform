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
  });

  assert.equal(model.header.title, 'Donations');
  assert.equal(model.items.length, 2);
  assert.equal(model.summaryStrip[2].value, '1');
});

test('tenant donations v4 html exposes create and save actions', () => {
  const html = buildTenantDonationsV4Html(createTenantDonationsV4Model({
    shopItems: [
      { id: 'starter-crate', name: 'Starter Crate', kind: 'item', price: 1000, description: 'Starter gear', gameItemId: 'crate_a', quantity: 1 },
    ],
  }));

  assert.match(html, /Create donation package/);
  assert.match(html, /data-tenant-donation-create-form/);
  assert.match(html, /data-tenant-donation-save/);
  assert.match(html, /enable \/ disable/i);
  assert.match(html, /data-tenant-donation-toggle-status/);
});
