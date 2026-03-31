const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantLogsSyncV4Model,
  buildTenantLogsSyncV4Html,
} = require('../src/admin/assets/tenant-logs-sync-v4.js');

test('tenant logs sync v4 model summarizes sync runs and events', () => {
  const model = createTenantLogsSyncV4Model({
    tenantConfig: { name: 'Tenant Demo' },
    syncRuns: [{ kind: 'sync', status: 'completed', startedAt: '2026-03-29T09:00:00+07:00', detail: 'Applied 4 log records' }],
    syncEvents: [{ kind: 'log_ingest', severity: 'warning', occurredAt: '2026-03-29T09:10:00+07:00', detail: 'Lag detected' }],
    audit: { items: [{ action: 'sync-run', createdAt: '2026-03-29T09:15:00+07:00', detail: 'Audit evidence' }] },
  });

  assert.equal(model.header.title, 'Logs & Sync');
  assert.equal(model.summaryStrip.length, 4);
  assert.equal(model.syncRuns.length, 1);
  assert.equal(model.syncEvents.length, 1);
});

test('tenant logs sync v4 html includes refresh action and history sections', () => {
  const html = buildTenantLogsSyncV4Html(createTenantLogsSyncV4Model({}));

  assert.match(html, /Refresh sync status/);
  assert.match(html, /Latest sync runs/);
  assert.match(html, /Recent sync events/);
  assert.match(html, /data-tenant-logs-sync-refresh/);
});
