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
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.syncRuns.length, 1);
  assert.equal(model.syncEvents.length, 1);
  assert.equal(model.timelineRows.length, 3);
});

test('tenant logs sync v4 html includes refresh action and history sections', () => {
  const html = buildTenantLogsSyncV4Html(createTenantLogsSyncV4Model({}));

  assert.match(html, /Refresh sync status/);
  assert.match(html, /Latest sync runs/);
  assert.match(html, /Recent sync events/);
  assert.match(html, /Audit timeline/);
  assert.match(html, /data-tenant-logs-sync-refresh/);
  assert.match(html, /data-tenant-logs-sync-timeline/);
});

test('tenant logs sync v4 exposes config job recovery and delivery watch', () => {
  const model = createTenantLogsSyncV4Model({
    notifications: [{
      severity: 'warn',
      title: 'Subscription Expiring Soon',
      message: 'FULL_OPTION ends soon',
      createdAt: '2026-03-29T09:15:00+07:00',
    }],
    serverConfigJobs: [{
      id: 'cfgjob-1',
      serverId: 'server-1',
      jobType: 'config_update',
      applyMode: 'save_restart',
      status: 'failed',
      queueStatus: 'failed',
      error: 'Config apply failed',
      completedAt: '2026-03-29T09:20:00+07:00',
      retryable: true,
    }],
    restartExecutions: [{
      id: 'rexec-1',
      action: 'restart',
      resultStatus: 'succeeded',
      completedAt: '2026-03-29T09:25:00+07:00',
      detail: 'Restart completed',
    }],
    deliveryLifecycle: {
      summary: {
        queueCount: 2,
        deadLetterCount: 1,
        recentSuccessCount: 4,
      },
      deadLetterWatch: [{
        purchaseCode: 'ORD-1',
        status: 'dead-letter',
        signalKey: 'retryableDeadLetter',
        detail: 'Waiting for retry',
        at: '2026-03-29T09:30:00+07:00',
      }],
    },
  });

  const html = buildTenantLogsSyncV4Html(model);

  assert.equal(model.configJobs.length, 1);
  assert.equal(model.restartJobs.length, 1);
  assert.equal(model.deliveryWatch.length, 1);
  assert.equal(model.notificationRows.length, 1);
  assert.match(html, /Config jobs and control tasks/);
  assert.match(html, /Latest alerts/);
  assert.match(html, /Subscription Expiring Soon/);
  assert.match(html, /Retry failed job/);
  assert.match(html, /data-config-job-retry/);
  assert.match(html, /Restart results and delivery recovery/);
});

test('tenant logs sync v4 audit timeline merges support, sync, and recovery activity newest first', () => {
  const model = createTenantLogsSyncV4Model({
    notifications: [{
      kind: 'platform.player.identity.support',
      createdAt: '2026-03-29T09:40:00+07:00',
      data: {
        eventType: 'platform.player.identity.support',
        userId: 'discord-1',
        steamId: '7656119',
        supportIntent: 'relink',
        supportOutcome: 'pending-verification',
        supportReason: 'Steam mismatch with active order',
        supportSource: 'owner-support',
        followupAction: 'bind',
      },
    }],
    syncRuns: [{ kind: 'sync', status: 'completed', startedAt: '2026-03-29T09:00:00+07:00', detail: 'Applied 4 log records' }],
    restartExecutions: [{
      id: 'rexec-1',
      action: 'restart',
      resultStatus: 'succeeded',
      completedAt: '2026-03-29T09:25:00+07:00',
      detail: 'Restart completed',
    }],
  });

  assert.equal(model.timelineRows[0].title, 'Identity support: Relink');
  assert.equal(model.timelineRows[0].sourceLabel, 'Support');
  assert.match(model.timelineRows[0].detail, /Steam mismatch with active order/);
  assert.equal(model.timelineRows[1].title, 'Restart');
});
