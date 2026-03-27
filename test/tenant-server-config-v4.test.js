const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantServerConfigV4Html,
  createTenantServerConfigV4Model,
} = require('../src/admin/assets/tenant-server-config-v4.js');

test('tenant server config v4 model exposes readable summaries for each editor', () => {
  const model = createTenantServerConfigV4Model({
    me: { tenantId: 'tenant-prod-001' },
    tenantConfig: {
      name: 'SCUM TH Production',
      updatedAt: '2026-03-26T08:00:00+07:00',
      featureFlags: { bot_log: true },
      configPatch: { maxPlayers: 50, restartGraceMinutes: 5 },
      portalEnvPatch: { publicTheme: 'scum-dark' },
    },
    draft: {
      featureFlags: { bot_log: true, shop_module: true },
      configPatch: { maxPlayers: 64, restartGraceMinutes: 10 },
      portalEnvPatch: { publicTheme: 'scum-dark' },
    },
  });

  assert.equal(model.header.title, 'ตั้งค่าเซิร์ฟเวอร์');
  assert.equal(model.sections.length, 4);
  assert.equal(model.editors.length, 3);
  assert.ok(model.editors.every((editor) => typeof editor.headline === 'string' && editor.headline.length > 0));
  assert.ok(model.editors.some((editor) => Array.isArray(editor.items) && editor.items.length > 0));
  assert.ok(model.summaryCards.some((item) => /การเปลี่ยนแปลง/.test(item.value)));
});

test('tenant server config v4 html includes readable summary and advanced editor', () => {
  const html = buildTenantServerConfigV4Html(createTenantServerConfigV4Model({
    me: { tenantId: 'tenant-demo' },
    tenantConfig: { name: 'Tenant Demo', featureFlags: {}, configPatch: {}, portalEnvPatch: {} },
  }));

  assert.match(html, /ตั้งค่าเซิร์ฟเวอร์/);
  assert.match(html, /ระบบจัดหมวดให้แล้ว/);
  assert.match(html, /ยังไม่มีการ override feature flags/);
  assert.match(html, /แก้แบบ JSON ขั้นสูง/);
  assert.match(html, /tdv4-readable-summary/);
  assert.match(html, /data-config-action="save"/);
  assert.match(html, /data-config-action="apply"/);
  assert.match(html, /data-config-action="restart"/);
});

test('tenant server config v4 exposes feature flags as editable controls', () => {
  const html = buildTenantServerConfigV4Html(createTenantServerConfigV4Model({
    me: { tenantId: 'tenant-demo' },
    overview: {
      tenantFeatureAccess: {
        package: {
          id: 'FULL_OPTION',
          features: ['server_settings', 'shop_module'],
        },
        enabledFeatureKeys: ['server_settings', 'shop_module', 'orders_module'],
        features: [
          { key: 'server_settings', title: 'Server Settings', category: 'server', enabled: true },
          { key: 'shop_module', title: 'Shop Module', category: 'commerce', enabled: true },
          { key: 'orders_module', title: 'Orders Module', category: 'commerce', enabled: true },
        ],
      },
    },
    tenantConfig: {
      name: 'Tenant Demo',
      featureFlags: {},
      configPatch: {},
      portalEnvPatch: {},
    },
    draft: {
      featureFlags: { orders_module: true },
      configPatch: {},
      portalEnvPatch: {},
    },
  }));

  assert.match(html, /tdv4-config-control-block/);
  assert.match(html, /data-feature-flag-toggle/);
  assert.match(html, /data-feature-flag-key="orders_module"/);
  assert.match(html, /data-config-patch-field="maxPlayers"/);
  assert.match(html, /ค่าพื้นฐานที่แก้ได้จากฟอร์ม/);
});

test('tenant server config preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-server-config-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-server-config-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-server-config-v4\.js/);
  assert.match(html, /tenantServerConfigV4PreviewRoot/);
});
