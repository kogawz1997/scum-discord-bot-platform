const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildOwnerDashboardV4Html,
  createOwnerDashboardV4Model,
} = require('../src/admin/assets/owner-dashboard-v4.js');

test('owner dashboard v4 model maps current owner state into command-center content', () => {
  const model = createOwnerDashboardV4Model({
    overview: {
      analytics: {
        tenants: { total: 14, active: 11, trialing: 2, reseller: 1 },
        delivery: { successRate: 97, purchaseCount30d: 486 },
        subscriptions: { mrr: 184500 },
      },
    },
    tenants: [
      { id: 'tenant-1', name: 'Prime' },
      { id: 'tenant-2', name: 'East' },
    ],
    subscriptions: [
      { tenantId: 'tenant-1', packageName: 'FULL_OPTION', status: 'active', renewsAt: '2026-04-02T09:00:00+07:00' },
    ],
    tenantQuotaSnapshots: [
      { tenantId: 'tenant-1', quotas: { apiKeys: { used: 4, limit: 5 } } },
    ],
    runtimeSupervisor: {
      services: [
        { name: 'bot', status: 'ready' },
        { name: 'worker', status: 'degraded' },
      ],
    },
    agents: [
      { name: 'execute-alpha', status: 'online' },
      { name: 'sync-alpha', status: 'degraded' },
    ],
    notifications: [
      { severity: 'warning', title: 'Watcher sync is behind', createdAt: '2026-03-26T11:18:00+07:00' },
    ],
    requestLogs: {
      items: [
        { method: 'GET', path: '/admin/api/platform/overview', statusCode: 503, error: 'timeout', at: '2026-03-26T11:12:00+07:00' },
      ],
      metrics: {
        routeHotspots: [
          { routeGroup: 'admin.platform', requests: 164, errors: 3, p95LatencyMs: 842 },
        ],
      },
    },
    supportCase: { signals: { total: 3 } },
  });

  assert.equal(model.header.title, 'ภาพรวมเจ้าของระบบ');
  assert.equal(model.kpis.length, 6);
  assert.equal(model.actionGroups.length, 3);
  assert.equal(model.shell.activeClass, 'commercial');
  assert.equal(model.classSections.length, 2);
  assert.ok(model.attentionRows.length >= 1);
  assert.ok(model.decisionPanel);
  assert.ok(model.incidentFeed.some((item) => item.title.includes('/admin/api/platform/overview')));
});

test('owner dashboard v4 html includes class lanes and grouped menu shell', () => {
  const html = buildOwnerDashboardV4Html(createOwnerDashboardV4Model({}, { currentRoute: 'settings' }));
  assert.match(html, /odv4-topbar/);
  assert.match(html, /odv4-priority-panel/);
  assert.match(html, /data-odv4-class-section="operations"/);
  assert.match(html, /id="overview"/);
  assert.match(html, /id="settings"/);
  assert.doesNotMatch(html, /odv4-class-choice-grid/);
  assert.doesNotMatch(html, /data-odv4-class-toggle="commercial"/);
});

test('owner dashboard preview references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'owner-dashboard-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /\.\.\/assets\/owner-dashboard-v4\.css/);
  assert.match(html, /\.\.\/assets\/owner-dashboard-v4\.js/);
  assert.match(html, /ownerDashboardV4PreviewRoot/);
});
