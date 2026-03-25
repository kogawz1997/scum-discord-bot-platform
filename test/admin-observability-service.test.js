const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminObservabilitySnapshot,
  buildObservabilityCsv,
} = require('../src/services/adminObservabilityService');

test('observability snapshot forwards effective window to request-log dependencies', () => {
  let metricsWindowMs = null;
  let listWindowMs = null;

  const snapshot = buildAdminObservabilitySnapshot({
    windowMs: 5 * 60 * 1000,
    retentionMs: 60 * 60 * 1000,
    captureSeries: () => {},
    getDeliveryMetricsSnapshot: () => ({ queueLength: 0, failRate: 0 }),
    getLoginFailureMetrics: () => ({ failures: 0, hotIps: [] }),
    getWebhookMetricsSnapshot: () => ({ attempts: 0, errors: 0, errorRate: 0 }),
    getAdminRequestLogMetrics: ({ windowMs }) => {
      metricsWindowMs = windowMs;
      return { total: 1, errors: 0, serverErrors: 0, unauthorized: 0 };
    },
    listAdminRequestLogs: ({ windowMs }) => {
      listWindowMs = windowMs;
      return [];
    },
    listSeries: () => ({}),
  });

  assert.equal(metricsWindowMs, 5 * 60 * 1000);
  assert.equal(listWindowMs, 5 * 60 * 1000);
  assert.equal(snapshot.timeSeriesWindowMs, 5 * 60 * 1000);
});

test('observability csv includes request hotspot analytics section', () => {
  const csv = buildObservabilityCsv({
    delivery: {},
    deliveryRuntime: {},
    adminLogin: {},
    webhook: {},
    requestLog: {
      errors: 3,
      serverErrors: 2,
      unauthorized: 1,
      slowRequests: 2,
      avgLatencyMs: 812.5,
      p95LatencyMs: 2400,
      routeHotspots: [
        {
          routeGroup: 'platform',
          samplePath: '/admin/api/platform/agent/heartbeat',
          requests: 2,
          errors: 2,
          serverErrors: 1,
          unauthorized: 1,
          slowRequests: 1,
          avgLatencyMs: 1260,
          p95LatencyMs: 2400,
          latestAt: '2026-03-25T10:00:00.000Z',
        },
      ],
    },
    runtimeSupervisor: {},
    recentRequests: [],
    timeSeries: {},
  });

  assert.match(csv, /requestLog\.avgLatencyMs/);
  assert.match(csv, /requestLog\.p95LatencyMs/);
  assert.match(csv, /routeGroup","samplePath","requests"/);
  assert.match(csv, /"platform","\/admin\/api\/platform\/agent\/heartbeat","2"/);
});
