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
      {
        id: 'n-support-1',
        tenantId: 'tenant-1',
        kind: 'platform.player.identity.support',
        createdAt: '2026-03-20T10:08:00.000Z',
        data: {
          eventType: 'platform.player.identity.support',
          userId: '222222222222222222',
          supportIntent: 'conflict',
          supportOutcome: 'pending-player-reply',
          supportReason: 'Waiting for the player to confirm which Steam account is correct.',
          supportSource: 'owner',
          followupAction: 'relink',
          actor: 'owner-user',
        },
      },
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
    listPlayerAccounts: async () => ([
      {
        discordId: '111111111111111111',
        displayName: 'Linked Player',
        steamId: '76561198000000001',
        isActive: true,
      },
      {
        discordId: '222222222222222222',
        displayName: 'Needs Help',
        steamId: null,
        isActive: true,
      },
    ]),
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
  assert.ok(bundle.signals.items.some((item) => item.key === 'identity-gaps'));
  assert.equal(bundle.identity.missingSteam, 1);
  assert.equal(bundle.identity.trailTotal, 1);
  assert.equal(bundle.identity.trail[0].displayName, 'Needs Help');
  assert.equal(bundle.identity.trail[0].supportIntent, 'conflict');
  assert.equal(bundle.identity.trail[0].followupAction, 'relink');
  assert.ok(bundle.actions.some((item) => item.key === 'inspect-dead-letters'));
  assert.ok(bundle.actions.some((item) => item.key === 'review-player-identity'));
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
      identity: { total: 2, needsSupport: 1, missingSteam: 1, trailTotal: 1 },
    });

  assert.match(csv, /tenantId,tenant-1/);
  assert.match(csv, /lifecyclePhase,attention/);
  assert.match(csv, /signals,3/);
  assert.match(csv, /identityNeedsSupport,1/);
  assert.match(csv, /identitySupportTrail,1/);
  assert.match(csv, /deadLetters,1/);
});

test('buildTenantSupportCaseBundle requires tenant scope in strict isolation mode', async () => {
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
