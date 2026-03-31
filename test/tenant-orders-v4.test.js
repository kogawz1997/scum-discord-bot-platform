const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantOrdersV4Html,
  createTenantOrdersV4Model,
} = require('../src/admin/assets/tenant-orders-v4.js');

test('tenant orders v4 model builds an action-driven case workspace', () => {
  const model = createTenantOrdersV4Model({
    me: { tenantId: 'tenant-prod-001' },
    tenantConfig: { name: 'SCUM TH Production' },
    overview: { analytics: { delivery: { purchaseCount30d: 54, successRate: 98 } } },
    purchaseStatusCatalog: { knownStatuses: ['queued', 'delivered'] },
    purchaseLookup: {
      userId: '123',
      status: 'queued',
      items: [{ code: 'PUR-1', itemName: 'Starter Kit', status: 'queued', totalPrice: 100, createdAt: '2026-03-26T08:00:00+07:00' }],
    },
    queueItems: [{}, {}],
    deadLetters: [{ purchaseCode: 'PUR-1' }],
    deliveryCase: { purchaseCode: 'PUR-1', purchase: { status: 'queued' }, timeline: [{}], auditRows: [{}], deadLetter: { reason: 'Runtime offline' } },
  });

  assert.equal(model.header.title, 'Orders and delivery');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.orders.length, 1);
  assert.equal(model.selectedOrder.code, 'PUR-1');
  assert.equal(model.selectedOrder.hasDeadLetter, true);
  assert.ok(model.deliveryCase.actions.length > 0);
});

test('tenant orders v4 html exposes order search and selected-case actions', () => {
  const html = buildTenantOrdersV4Html(createTenantOrdersV4Model({
    purchaseLookup: {
      userId: '123',
      items: [{ code: 'PUR-1', itemName: 'Starter Kit', status: 'failed', totalPrice: 100, createdAt: '2026-03-26T08:00:00+07:00' }],
    },
    deadLetters: [{ purchaseCode: 'PUR-1' }],
    deliveryCase: { purchaseCode: 'PUR-1', purchase: { status: 'failed' } },
  }));

  assert.match(html, /Orders and delivery/);
  assert.match(html, /Search orders/);
  assert.match(html, /Selected order actions/);
  assert.match(html, /Delivery case/);
  assert.match(html, /data-order-filter-form/);
  assert.match(html, /data-order-select/);
  assert.match(html, /data-order-action="inspect-order"/);
  assert.match(html, /data-order-action="inspect-delivery"/);
  assert.match(html, /data-order-action="retry"/);
  assert.match(html, /data-order-action="cancel"/);
  assert.match(html, /data-order-case-panel/);
});

test('tenant orders preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-orders-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-orders-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-orders-v4\.js/);
  assert.match(html, /tenantOrdersV4PreviewRoot/);
});
