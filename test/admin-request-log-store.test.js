const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clearAdminRequestLogs,
  getAdminRequestLogMetrics,
  listAdminRequestLogs,
  recordAdminRequestLog,
} = require('../src/store/adminRequestLogStore');

test('admin request log metrics include latency and hotspot summaries for the active window', () => {
  clearAdminRequestLogs();
  const now = Date.now();
  const recentBase = now - 2 * 60 * 1000;

  recordAdminRequestLog({
    at: new Date(recentBase - 1000).toISOString(),
    method: 'GET',
    path: '/admin/api/observability',
    routeGroup: 'observability',
    statusCode: 200,
    latencyMs: 30,
  });
  recordAdminRequestLog({
    at: new Date(recentBase - 900).toISOString(),
    method: 'GET',
    path: '/admin/api/observability/export',
    routeGroup: 'observability',
    statusCode: 500,
    latencyMs: 1800,
  });
  recordAdminRequestLog({
    at: new Date(recentBase - 800).toISOString(),
    method: 'POST',
    path: '/admin/api/platform/tenant',
    routeGroup: 'platform',
    statusCode: 403,
    latencyMs: 120,
  });
  recordAdminRequestLog({
    at: new Date(recentBase - 700).toISOString(),
    method: 'POST',
    path: '/admin/api/platform/agent/heartbeat',
    routeGroup: 'platform',
    statusCode: 502,
    latencyMs: 2400,
  });
  recordAdminRequestLog({
    at: new Date(recentBase - 600).toISOString(),
    method: 'GET',
    path: '/admin/api/runtime/supervisor',
    routeGroup: 'runtime',
    statusCode: 200,
    latencyMs: 75,
  });
  recordAdminRequestLog({
    at: new Date(now - 20 * 60 * 1000).toISOString(),
    method: 'GET',
    path: '/admin/api/old-window',
    routeGroup: 'legacy',
    statusCode: 500,
    latencyMs: 9999,
  });

  const metrics = getAdminRequestLogMetrics({ windowMs: 10 * 60 * 1000 });

  assert.equal(metrics.total, 5);
  assert.equal(metrics.errors, 3);
  assert.equal(metrics.serverErrors, 2);
  assert.equal(metrics.unauthorized, 1);
  assert.equal(metrics.slowRequests, 2);
  assert.equal(metrics.avgLatencyMs, (30 + 1800 + 120 + 2400 + 75) / 5);
  assert.equal(metrics.p95LatencyMs, 2400);
  assert.equal(metrics.statusCounts.success, 2);
  assert.equal(metrics.statusCounts.clientError, 1);
  assert.equal(metrics.statusCounts.serverError, 2);
  assert.equal(metrics.routeHotspots.length, 3);
  assert.equal(metrics.routeHotspots[0].routeGroup, 'platform');
  assert.equal(metrics.routeHotspots[0].requests, 2);
  assert.equal(metrics.routeHotspots[0].errors, 2);
  assert.equal(metrics.routeHotspots[0].slowRequests, 1);
  assert.equal(metrics.routeHotspots[0].p95LatencyMs, 2400);

  const filtered = listAdminRequestLogs({ windowMs: 10 * 60 * 1000, routeGroup: 'platform' });
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((entry) => entry.routeGroup === 'platform'));

  clearAdminRequestLogs();
});
