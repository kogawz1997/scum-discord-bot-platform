const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantServerStatusV4Html,
  createTenantServerStatusV4Model,
} = require('../src/admin/assets/tenant-server-status-v4.js');

test('tenant server status v4 model summarizes runtime, sync, queue, and restart history', () => {
  const model = createTenantServerStatusV4Model({
    me: { tenantId: 'tenant-prod-001' },
    tenantConfig: { name: 'SCUM TH Production' },
    overview: {
      serverStatus: 'online',
      analytics: { delivery: { purchaseCount30d: 44, successRate: 94, lastSyncAt: '2026-03-26T08:00:00+07:00' } },
    },
    agents: [{ role: 'execute', status: 'online' }, { role: 'sync', status: 'warning' }],
    queueItems: [{}, {}, {}],
    deadLetters: [{}],
    reconcile: { lastRunAt: '2026-03-26T08:15:00+07:00', summary: { anomalies: 2, abuseFindings: 0 } },
    notifications: [{ severity: 'warning', title: 'Sync delayed', createdAt: '2026-03-26T08:20:00+07:00' }],
    deliveryRuntime: { status: 'degraded', mode: 'managed', updatedAt: '2026-03-26T08:22:00+07:00' },
    restartHistory: [{ at: '2026-03-26T08:00:00+07:00', mode: 'safe_restart', result: 'success', actor: 'owner' }],
  });

  assert.equal(model.header.title, 'สถานะเซิร์ฟเวอร์');
  assert.equal(model.statusStrip.length, 5);
  assert.equal(model.runtimePanels.length, 2);
  assert.equal(model.restartHistory.length, 1);
  assert.equal(model.controlReadiness.restartConfigured, false);
  assert.ok(model.incidentRows.some((item) => item.title.includes('dead-letter') || item.title.includes('ปกติ') || item.title.includes('ผิดปกติ')));
});

test('tenant server status v4 html includes server actions and restart history', () => {
  const html = buildTenantServerStatusV4Html(createTenantServerStatusV4Model({
    me: { tenantId: 'tenant-demo' },
    tenantConfig: { name: 'Tenant Demo' },
  }));

  assert.match(html, /สถานะเซิร์ฟเวอร์/);
  assert.match(html, /Server actions/);
  assert.match(html, /Control readiness/);
  assert.match(html, /Restart history/);
  assert.match(html, /data-server-restart-button/);
  assert.match(html, /data-server-control-button/);
});

test('tenant server status preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-server-status-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-server-status-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-server-status-v4\.js/);
  assert.match(html, /tenantServerStatusV4PreviewRoot/);
});
