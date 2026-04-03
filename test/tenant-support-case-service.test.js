const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantSupportCaseBundle,
  buildTenantSupportCaseCsv,
} = require('../src/services/tenantDiagnosticsService');

function createDeps() {
  return {
    getPlatformTenantById: async (tenantId) => ({
      id: tenantId,
      name: 'Demo Tenant',
      ownerName: 'Ops Owner',
      ownerEmail: 'ops@example.com',
      status: 'active',
      type: 'direct',
    }),
    getTenantOperationalState: async () => ({
      ok: true,
      reason: 'ready',
      tenant: { id: 'tenant-1', name: 'Demo Tenant', status: 'active' },
      subscription: { id: 'sub-1', planId: 'starter', status: 'active' },
      license: { id: 'lic-1', status: 'active', expiresAt: '2026-12-31T00:00:00.000Z' },
    }),
    getTenantQuotaSnapshot: async () => ({
      tenantId: 'tenant-1',
      quotas: {
        apiKeys: { limit: 3, used: 2, exceeded: false },
      },
    }),
    getPlatformAnalyticsOverview: async () => ({
      tenants: { total: 1, active: 1 },
      delivery: { purchaseCount30d: 12 },
    }),
    listPlatformSubscriptions: async () => ([{ id: 'sub-1', status: 'active', planId: 'starter' }]),
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
    ]),
    listAdminRequestLogs: () => ([
      { at: '2026-03-20T10:09:00.000Z', tenantId: 'tenant-1', statusCode: 500, path: '/admin/api/foo' },
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

test('buildTenantSupportCaseBundle derives lifecycle, checklist, and actions from diagnostics', async () => {
  const bundle = await buildTenantSupportCaseBundle('tenant-1', {
    deps: createDeps(),
    limit: 10,
  });

  assert.equal(bundle.tenantId, 'tenant-1');
  assert.equal(bundle.lifecycle.key, 'attention');
  assert.equal(bundle.onboarding.requiredTotal, 4);
  assert.equal(bundle.onboarding.requiredCompleted, 4);
  assert.ok(bundle.signals.items.some((item) => item.key === 'dead-letters'));
  assert.ok(bundle.actions.some((item) => item.key === 'inspect-dead-letters'));
});

test('buildTenantSupportCaseBundle enforces tenant scope in strict isolation mode', async () => {
  await assert.rejects(
    () => buildTenantSupportCaseBundle('', {
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

test('buildTenantSupportCaseCsv flattens the support case summary', () => {
  const csv = buildTenantSupportCaseCsv({
    generatedAt: '2026-03-20T10:00:00.000Z',
    tenantId: 'tenant-1',
    tenant: { name: 'Demo Tenant' },
    lifecycle: {
      key: 'attention',
      detail: 'Support or runtime signals need follow-up.',
      tenantStatus: 'active',
      subscriptionStatus: 'active',
      licenseStatus: 'active',
    },
    onboarding: { completed: 6, total: 7, requiredCompleted: 4, requiredTotal: 4 },
    signals: { total: 3 },
    actions: [{ key: 'review-runtime' }],
    diagnostics: {
      delivery: { anomalies: 2, deadLetters: 1 },
      requestErrors: { summary: { total: 4 } },
      notifications: [{ id: 'n-1' }],
      runtime: { degraded: 1 },
    },
  });

  assert.match(csv, /tenantId,tenant-1/);
  assert.match(csv, /lifecyclePhase,attention/);
  assert.match(csv, /signals,3/);
  assert.match(csv, /deadLetters,1/);
});
