const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantDiagnosticsBundle,
  buildTenantDiagnosticsCsv,
} = require('../src/services/tenantDiagnosticsService');

function createDeps() {
  return {
    getPlatformTenantById: async (tenantId) => ({
      id: tenantId,
      name: 'Demo Tenant',
      status: 'active',
    }),
    getTenantOperationalState: async () => ({ ok: true, tenant: { id: 'tenant-1' } }),
    getTenantQuotaSnapshot: async () => ({
      tenantId: 'tenant-1',
      quotas: {
        apiKeys: { limit: 3, used: 2 },
      },
    }),
    getPlatformAnalyticsOverview: async () => ({
      tenants: { total: 1, active: 1 },
      delivery: { purchaseCount30d: 12 },
    }),
    listPlatformSubscriptions: async () => ([{ id: 'sub-1', status: 'active' }]),
    listPlatformLicenses: async () => ([{ id: 'lic-1', status: 'active' }]),
    listPlatformApiKeys: async () => ([{ id: 'key-1', tenantId: 'tenant-1', status: 'active' }]),
    listPlatformWebhookEndpoints: async () => ([{ id: 'webhook-1', tenantId: 'tenant-1', enabled: true }]),
    listPlatformAgentRuntimes: async () => ([{ runtimeKey: 'agent-a', status: 'ready' }]),
    listMarketplaceOffers: async () => ([{ id: 'offer-1', status: 'active' }]),
    reconcileDeliveryState: async () => ({
      generatedAt: '2026-03-20T10:00:00.000Z',
      summary: {
        purchases: 12,
        queueJobs: 2,
        deadLetters: 1,
        anomalies: 3,
        abuseFindings: 1,
        windowMs: 3600000,
      },
      anomalies: [{ code: 'P-1', type: 'delivered-without-audit' }],
      abuseFindings: [{ type: 'order-burst', userId: 'u-1' }],
    }),
    getRuntimeSupervisorSnapshot: async () => ({
      refreshedAt: '2026-03-20T10:10:00.000Z',
      items: [
        { runtimeKey: 'bot', status: 'ready' },
        { runtimeKey: 'worker', status: 'degraded', detail: 'queue lag' },
      ],
    }),
    listAdminNotifications: () => ([
      { id: 'n-1', tenantId: 'tenant-1', kind: 'queue-pressure' },
      { id: 'n-2', tenantId: 'tenant-2', kind: 'ignore-me' },
    ]),
    listAdminRequestLogs: () => ([
      { at: '2026-03-20T10:09:00.000Z', tenantId: 'tenant-1', statusCode: 500, path: '/admin/api/foo' },
      { at: '2026-03-20T10:08:00.000Z', tenantId: 'tenant-1', statusCode: 403, path: '/admin/api/bar' },
    ]),
    getPlatformOpsState: () => ({
      lastMonitoringAt: '2026-03-20T09:55:00.000Z',
      lastReconcileAt: '2026-03-20T09:56:00.000Z',
    }),
    getPlatformAutomationState: () => ({
      lastAutomationAt: '2026-03-20T09:57:00.000Z',
      lastForcedMonitoringAt: '2026-03-20T09:58:00.000Z',
    }),
  };
}

test('buildTenantDiagnosticsBundle aggregates tenant support context', async () => {
  const bundle = await buildTenantDiagnosticsBundle('tenant-1', {
    deps: createDeps(),
    limit: 10,
  });

  assert.equal(bundle.tenantId, 'tenant-1');
  assert.equal(bundle.tenant.name, 'Demo Tenant');
  assert.equal(bundle.notifications.length, 1);
  assert.equal(bundle.requestErrors.summary.total, 2);
  assert.equal(bundle.delivery.anomalies, 3);
  assert.equal(bundle.runtime.degraded, 1);
  assert.equal(bundle.headline.deadLetters, 1);
});

test('buildTenantDiagnosticsBundle enforces tenant scope in strict isolation mode', async () => {
  await assert.rejects(
    () => buildTenantDiagnosticsBundle('', {
      deps: createDeps(),
      env: {
        DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/app?schema=public',
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
    }),
    /requires tenantId/i,
  );
});

test('buildTenantDiagnosticsCsv flattens the diagnostics headline', () => {
  const csv = buildTenantDiagnosticsCsv({
    generatedAt: '2026-03-20T10:00:00.000Z',
    tenantId: 'tenant-1',
    tenant: { name: 'Demo Tenant', status: 'active' },
    delivery: { anomalies: 2, deadLetters: 1 },
    notifications: [{ id: 'n-1' }],
    requestErrors: { summary: { total: 4, latestAt: '2026-03-20T10:05:00.000Z' } },
    commercial: { subscriptions: [{ id: 'sub-1' }], licenses: [], offers: [] },
    integrations: { apiKeys: [], webhooks: [], agentRuntimes: [] },
    runtime: { total: 3, degraded: 1 },
    platform: { lastMonitoringAt: '2026-03-20T09:55:00.000Z' },
  });

  assert.match(csv, /tenantId,tenant-1/);
  assert.match(csv, /deliveryAnomalies,2/);
  assert.match(csv, /requestErrors,4/);
});
