const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildOwnerTenantsV4Html,
  createOwnerTenantsV4Model,
} = require('../src/admin/assets/owner-tenants-v4.js');

test('owner tenants v4 model builds registry rows from owner tenant state', () => {
  const model = createOwnerTenantsV4Model({
    tenants: [
      { id: 'tenant-1', name: 'Prime', ownerName: 'Ariya', updatedAt: '2026-03-26T11:20:00+07:00' },
      { id: 'tenant-2', name: 'East', ownerName: 'Natt', updatedAt: '2026-03-26T10:20:00+07:00' },
    ],
    subscriptions: [
      { tenantId: 'tenant-1', packageName: 'FULL_OPTION', status: 'active' },
      { tenantId: 'tenant-2', packageName: 'BOT_LOG_DELIVERY', status: 'expiring', renewsAt: '2026-03-30T09:00:00+07:00' },
    ],
    licenses: [{ tenantId: 'tenant-1', status: 'licensed' }],
    tenantQuotaSnapshots: [{ tenantId: 'tenant-1', quotas: { apiKeys: { used: 4, limit: 5 } } }],
    supportCase: { tenantId: 'tenant-1' },
  });

  assert.equal(model.header.title, 'ผู้เช่าและสถานะเชิงพาณิชย์');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.rows.length, 2);
  assert.equal(model.spotlight.name, 'Prime');
  assert.equal(model.nextActions.length, 3);
  assert.ok(model.rows.some((row) => row.packageName === 'FULL_OPTION'));
});

test('owner tenants v4 html includes registry and spotlight sections', () => {
  const html = buildOwnerTenantsV4Html(createOwnerTenantsV4Model({}));
  assert.match(html, /รายชื่อผู้เช่า/);
  assert.match(html, /ผู้เช่าที่ควรเปิดดูก่อน/);
  assert.match(html, /เริ่มจากเรื่องที่กระทบรายได้และบริการก่อน/);
  assert.match(html, /odv4-table/);
});

test('owner tenants preview references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'owner-tenants-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /\.\.\/assets\/owner-tenants-v4\.css/);
  assert.match(html, /\.\.\/assets\/owner-tenants-v4\.js/);
  assert.match(html, /ownerTenantsV4PreviewRoot/);
});
