const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildOwnerRuntimeHealthV4Html,
  createOwnerRuntimeHealthV4Model,
} = require('../src/admin/assets/owner-runtime-health-v4.js');

test('owner runtime health v4 model maps runtime, incident, and hotspot state', () => {
  const model = createOwnerRuntimeHealthV4Model({
    runtimeSupervisor: {
      services: [
        { name: 'bot', status: 'ready' },
        { name: 'watcher', status: 'degraded' },
      ],
    },
    agents: [
      { runtimeKey: 'execute-alpha', status: 'online', lastSeenAt: '2026-03-26T11:29:00+07:00' },
      { runtimeKey: 'sync-alpha', status: 'degraded', lastSeenAt: '2026-03-26T11:21:00+07:00' },
    ],
    notifications: [
      { severity: 'warning', title: 'Watcher sync is behind', createdAt: '2026-03-26T11:18:00+07:00' },
    ],
    requestLogs: {
      items: [{ method: 'GET', path: '/admin/api/platform/overview', statusCode: 503, error: 'timeout', at: '2026-03-26T11:12:00+07:00' }],
      metrics: {
        slowRequests: 12,
        routeHotspots: [{ routeGroup: 'admin.platform', requests: 164, errors: 3, p95LatencyMs: 842 }],
      },
    },
    deliveryLifecycle: { summary: { deadLetterCount: 3 } },
  });

  assert.equal(model.header.title, 'สุขภาพรันไทม์และเหตุการณ์');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.runtimeRows.length, 2);
  assert.equal(model.agentRows.length, 2);
  assert.equal(model.hotspots.length, 1);
});

test('owner runtime health v4 html includes runtime matrix and hotspot table', () => {
  const html = buildOwnerRuntimeHealthV4Html(createOwnerRuntimeHealthV4Model({}));
  assert.match(html, /บริการที่ต้องเฝ้าดู/);
  assert.match(html, /สัญญาณที่เจ้าของระบบควรรู้ตอนนี้/);
  assert.match(html, /จุดร้อนของคำขอ/);
});

test('owner runtime preview references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'owner-runtime-health-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');
  assert.match(html, /\.\.\/assets\/owner-runtime-health-v4\.css/);
  assert.match(html, /\.\.\/assets\/owner-runtime-health-v4\.js/);
  assert.match(html, /ownerRuntimeHealthV4PreviewRoot/);
});
