const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantLogsSyncV4Model,
  buildTenantLogsSyncV4Html,
} = require('../src/admin/assets/tenant-logs-sync-v4.js');

test('tenant logs sync v4 model summarizes sync runs and events', () => {
  const model = createTenantLogsSyncV4Model({
    tenantId: 'tenant-demo',
    tenantConfig: { name: 'Tenant Demo' },
    syncRuns: [{ kind: 'sync', status: 'completed', startedAt: '2026-03-29T09:00:00+07:00', detail: 'Applied 4 log records' }],
    syncEvents: [{ kind: 'log_ingest', severity: 'warning', occurredAt: '2026-03-29T09:10:00+07:00', detail: 'Lag detected' }],
    audit: { items: [{ action: 'sync-run', createdAt: '2026-03-29T09:15:00+07:00', detail: 'Audit evidence' }] },
    serverConfigWorkspace: {
      currentJob: {
        id: 'job-probe-sync',
        jobType: 'probe_sync',
        status: 'queued',
        requestedAt: '2026-03-29T09:16:00+07:00',
      },
    },
    tenantSupportCase: {
      lifecycle: { label: 'active', tone: 'success' },
      signals: {
        items: [{ key: 'runtime-degraded', tone: 'warning', count: 1, detail: 'One runtime is degraded.' }],
      },
      actions: [{ key: 'review-runtime', tone: 'warning', detail: 'Inspect the runtime before closing the case.' }],
    },
  });

  assert.equal(model.header.title, 'Logs & Sync');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.syncRuns.length, 1);
  assert.equal(model.syncEvents.length, 1);
  assert.equal(model.currentJob.status, 'queued');
  assert.equal(model.supportSignals.length, 1);
  assert.equal(model.recommendedActions.length, 1);
  assert.match(String(model.exports?.jsonHref || ''), /tenant-support-case\/export/);
});

test('tenant logs sync v4 html includes refresh, probe, and follow-up sections', () => {
  const html = buildTenantLogsSyncV4Html(createTenantLogsSyncV4Model({}));

  assert.match(html, /Refresh sync status/);
  assert.match(html, /Run sync probe/);
  assert.match(html, /Run config access probe/);
  assert.match(html, /Run restart readiness probe/);
  assert.match(html, /Latest job and sync history/);
  assert.match(html, /Recent sync events/);
  assert.match(html, /Support signals and next steps/);
  assert.match(html, /data-tenant-logs-sync-refresh/);
  assert.match(html, /data-server-bot-probe-action="sync"/);
});
