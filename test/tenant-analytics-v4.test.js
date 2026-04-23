const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantAnalyticsV4Model,
  buildTenantAnalyticsV4Html,
} = require('../src/admin/assets/tenant-analytics-v4.js');

test('tenant analytics v4 model summarizes delivery, restart, billing, and community signals', () => {
  const model = createTenantAnalyticsV4Model({
    tenantId: 'tenant-demo',
    tenantConfig: { name: 'Tenant Demo' },
    activeServer: { id: 'server-1', name: 'SCUM TH Prime' },
    overview: {
      analytics: {
        delivery: {
          purchaseCount30d: 64,
          successRate: 97,
          lastSyncAt: '2026-04-01T10:00:00+07:00',
        },
      },
    },
    deliveryLifecycle: {
      summary: {
        queueCount: 3,
        deadLetterCount: 1,
        recentSuccessCount: 21,
      },
      signals: [
        { key: 'overdue', count: 2, detail: 'Two orders have been waiting too long.', tone: 'warning' },
      ],
      actionPlan: {
        actions: [
          { key: 'retry-dead-letter-batch', count: 1, detail: 'Retry the retryable dead-letter row.', tone: 'warning' },
        ],
      },
      topErrors: [
        { key: 'AGENT_PREFLIGHT_FAILED', count: 3 },
      ],
    },
    restartPlans: [
      { status: 'blocked', restartMode: 'safe_restart', scheduledFor: '2026-04-01T11:00:00+07:00', reason: 'delivery-runtime-offline' },
    ],
    restartExecutions: [
      { resultStatus: 'failed', runtimeKey: 'server-bot', finishedAt: '2026-04-01T09:40:00+07:00', detail: 'Health verification failed' },
    ],
    syncRuns: [
      { status: 'succeeded', finishedAt: '2026-04-01T09:55:00+07:00', scope: 'server-log' },
    ],
    syncEvents: [
      { kind: 'sync.completed', createdAt: '2026-04-01T09:56:00+07:00', detail: 'Fresh SCUM.log batch stored' },
    ],
    billingOverview: {
      summary: {
        collectedCents: 199900,
        openInvoiceCount: 2,
      },
    },
    billingInvoices: [
      { id: 'inv-1', status: 'open', amountCents: 9900, currency: 'usd', dueAt: '2026-04-02T00:00:00Z' },
    ],
    billingPaymentAttempts: [
      { id: 'pay-1', status: 'failed', provider: 'stripe', amountCents: 9900, currency: 'usd', errorCode: 'card_declined' },
    ],
    killfeed: [
      { killerName: 'MiraTH', victimName: 'BanditX', weapon: 'AKM', occurredAt: '2026-04-01T09:30:00+07:00', sector: 'B2' },
    ],
    events: [
      { title: 'Weekend convoy', status: 'live', summary: 'Convoy escort in progress' },
    ],
    raids: {
      requests: [{ id: 'raid-1' }],
      windows: [{ title: 'Friday West Gate', status: 'scheduled' }],
      summaries: [{ summary: 'South compound cleared', status: 'completed' }],
    },
    notifications: [
      { title: 'Bot offline', detail: 'Server Bot missed heartbeat.', severity: 'warning', createdAt: '2026-04-01T09:58:00+07:00' },
    ],
    audit: {
      items: [
        { action: 'restart.scheduled', detail: 'Scheduled safe restart for config rollout.', createdAt: '2026-04-01T09:45:00+07:00' },
      ],
    },
  });

  assert.equal(model.header.title, 'Analytics');
  assert.equal(model.summaryStrip.length, 6);
  assert.equal(model.deliverySignals.length, 1);
  assert.equal(model.deliveryActions.length, 1);
  assert.equal(model.topErrors.length, 1);
  assert.equal(model.auditTimelineRows.length >= 4, true);
  assert.ok(model.links.deliveryExport.includes('/admin/api/delivery/lifecycle/export?tenantId=tenant-demo'));
  assert.equal(model.communityRows.length >= 3, true);
});

test('tenant analytics v4 audit timeline merges support, restart, sync, and billing evidence', () => {
  const model = createTenantAnalyticsV4Model({
    notifications: [{
      kind: 'platform.player.identity.support',
      createdAt: '2026-04-01T10:05:00+07:00',
      data: {
        eventType: 'platform.player.identity.support',
        supportIntent: 'relink',
        supportOutcome: 'pending-verification',
        supportReason: 'Steam mismatch with latest order.',
        supportSource: 'owner-support',
        followupAction: 'bind',
      },
    }],
    restartExecutions: [
      { resultStatus: 'failed', runtimeKey: 'server-bot', finishedAt: '2026-04-01T09:40:00+07:00', detail: 'Health verification failed' },
    ],
    syncEvents: [
      { kind: 'sync.completed', createdAt: '2026-04-01T09:56:00+07:00', detail: 'Fresh SCUM.log batch stored' },
    ],
    billingPaymentAttempts: [
      { id: 'pay-1', status: 'failed', provider: 'stripe', amountCents: 9900, currency: 'usd', errorCode: 'card_declined', createdAt: '2026-04-01T09:50:00+07:00' },
    ],
  });

  assert.equal(model.auditTimelineRows[0].title, 'Identity support: Relink');
  assert.match(model.auditTimelineRows[0].meta, /Support/);
  assert.match(model.auditTimelineRows[0].meta, /Pending Verification/);
  assert.equal(model.auditTimelineRows[1].title, 'sync.completed');
});

test('tenant analytics v4 html includes reporting sections and export CTA', () => {
  const html = buildTenantAnalyticsV4Html(createTenantAnalyticsV4Model({ tenantId: 'tenant-demo' }));

  assert.match(html, /Analytics/);
  assert.match(html, /Export delivery CSV/);
  assert.match(html, /data-tenant-analytics-delivery/);
  assert.match(html, /data-tenant-analytics-restart/);
  assert.match(html, /data-tenant-analytics-community/);
  assert.match(html, /data-tenant-analytics-timeline/);
  assert.match(html, /Delivery and job health/);
  assert.match(html, /Restart outcomes and sync activity/);
  assert.match(html, /Billing signals/);
  assert.match(html, /Events, raids, and recent combat/);
  assert.match(html, /Audit timeline/);
});
