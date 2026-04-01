const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantDashboardV4Html,
  createTenantDashboardV4Model,
} = require('../src/admin/assets/tenant-dashboard-v4.js');

test('tenant dashboard v4 model maps legacy tenant state into operator-first content', () => {
  const model = createTenantDashboardV4Model({
    me: { tenantId: 'tenant-prod-001', role: 'tenant_admin' },
    tenantConfig: { name: 'SCUM TH Production' },
    overview: {
      serverStatus: 'online',
      analytics: { delivery: { purchaseCount30d: 54, successRate: 98, lastSyncAt: '2026-03-26T08:00:00+07:00' } },
    },
    subscriptions: [{ packageName: 'FULL_OPTION', status: 'active' }],
    agents: [{ role: 'execute', status: 'online' }, { role: 'sync', status: 'warning' }],
    queueItems: [{ id: 'queue-1' }, { id: 'queue-2' }],
    deadLetters: [{ id: 'dead-1' }],
    reconcile: { summary: { anomalies: 3, abuseFindings: 1 } },
    notifications: [{ severity: 'warning', title: 'Sync delayed', createdAt: '2026-03-26T08:30:00+07:00' }],
    quota: { quotas: { apiKeys: { used: 1, limit: 5 }, webhooks: { used: 2, limit: 10 }, agentRuntimes: { used: 2, limit: 3 } } },
    players: [{ steamId: '1' }, {}],
    shopItems: [{ id: '1' }, { id: '2' }],
  });

  assert.equal(model.header.title, 'SCUM TH Production');
  assert.equal(model.kpis.length, 7);
  assert.equal(model.setupFlow.steps.length, 7);
  assert.equal(model.setupFlow.completedSteps, 4);
  assert.equal(model.readiness.percent, 57);
  assert.equal(model.readiness.nextRequiredStep.title, 'ติดตั้ง Server Bot');
  assert.equal(model.quickActions.length, 4);
  assert.equal(model.taskGroups.length, 3);
  assert.ok(model.issues.some((item) => item.title.includes('ล้มเหลว')));
  assert.ok(model.contextBlocks.some((item) => item.label === 'สถานะแพ็กเกจ'));
  assert.ok(model.railCards.length >= 3);
  assert.ok(model.decisionPanel);
});

test('tenant dashboard v4 html includes shell, decision panel, and issue center', () => {
  const html = buildTenantDashboardV4Html(createTenantDashboardV4Model({
    me: { tenantId: 'tenant-demo' },
    tenantConfig: { name: 'Tenant Demo' },
  }));

  assert.match(html, /tdv4-topbar/);
  assert.match(html, /tdv4-priority-panel/);
  assert.match(html, /dashboard-issues/);
  assert.match(html, /tdv4-details-panel/);
  assert.match(html, /System readiness/);
  assert.match(html, /ตอนนี้พร้อมแค่ไหน และต้องทำอะไรต่อ/);
  assert.match(html, /งานหลักที่ควรเปิดบ่อย/);
  assert.match(html, /สร้าง Server Bot/);
  assert.match(html, /สร้าง Delivery Agent/);
  assert.match(html, /เปิดหน้าตั้งค่าเซิร์ฟเวอร์/);
  assert.match(html, /เปิดหน้าควบคุมการรีสตาร์ต/);
  assert.match(html, /ทำแล้ว 0\/7 ขั้น/);
  assert.match(html, /ไปทำขั้นนี้/);
});

test('tenant dashboard v4 preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-dashboard-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-dashboard-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-dashboard-v4\.js/);
  assert.match(html, /tenantDashboardV4PreviewRoot/);
  assert.match(html, /__TENANT_DASHBOARD_V4_SAMPLE__/);
});

test('tenant dashboard v4 humanizes operational alert payloads for operators', () => {
  const model = createTenantDashboardV4Model({
    me: { tenantId: 'tenant-preview-52771e8d-e432-4849-8ee4-ff585d2d7a31', role: 'tenant_admin' },
    tenantConfig: { name: 'SCUM Preview Ops' },
    notifications: [{
      severity: 'warning',
      title: 'Operational Alert',
      detail: JSON.stringify({
        source: 'platform-monitor',
        kind: 'tenant-quota-near-limit',
        tenantId: 'tenant-preview-52771e8d-e432-4849-8ee4-ff585d2d7a31',
        tenantSlug: 'scum-preview-ops',
        quotaKey: 'agentRuntimes',
        used: 0,
        limit: 1,
        remaining: 1,
      }),
      createdAt: '2026-03-27T10:00:00+07:00',
    }],
  });

  assert.ok(model.issues.some((item) => item.title.includes('โควตา')));
  assert.ok(model.issues.some((item) => item.detail.includes('รันไทม์')));
  assert.ok(model.issues.every((item) => !item.detail.includes('"tenantSlug"')));
  assert.ok(model.railCards.some((item) => String(item.meta || '').includes('โควตา')));
  assert.ok(model.activity.some((item) => item.detail.includes('scum-preview-ops')));
});

test('tenant dashboard v4 humanizes admin security notifications', () => {
  const model = createTenantDashboardV4Model({
    me: { tenantId: 'tenant-preview-security', role: 'tenant_admin' },
    tenantConfig: { name: 'SCUM Preview Security' },
    notifications: [{
      severity: 'danger',
      title: 'Admin Security Event',
      detail: 'Admin login failed | actor=admin | target=admin | ip=127.0.0.1 | reason=invalid-credentials',
      createdAt: '2026-03-27T10:05:00+07:00',
    }],
  });

  assert.ok(model.issues.some((item) => item.title.includes('เข้าสู่ระบบ')));
  assert.ok(model.issues.some((item) => item.detail.includes('รหัสผ่านหรือข้อมูลเข้าสู่ระบบไม่ถูกต้อง')));
  assert.ok(model.activity.some((item) => item.detail.includes('IP 127.0.0.1')));
  assert.ok(model.activity.every((item) => !item.detail.includes('reason=invalid-credentials')));
});
