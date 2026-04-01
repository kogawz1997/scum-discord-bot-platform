const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlatformAnalyticsService,
} = require('../src/services/platformAnalyticsService');

function createBaseDeps(overrides = {}) {
  return {
    config: {
      serverInfo: { name: 'SCUM TH Platform' },
      platform: {
        billing: { currency: 'THB' },
        marketplace: { enabled: true },
        demo: { trialEnabled: true },
        legal: {
          currentVersion: '2026-04',
          docs: [],
        },
        localization: { defaultLocale: 'th' },
      },
    },
    prisma: {
      platformTenant: {
        findMany: async () => ([
          { id: 'tenant-1', status: 'active', type: 'standard' },
          { id: 'tenant-2', status: 'trialing', type: 'reseller' },
        ]),
      },
    },
    assertTenantDbIsolationScope: ({ tenantId }) => ({ tenantId: tenantId || null }),
    getTenantDatabaseTopologyMode: () => 'shared',
    runWithOptionalTenantDbIsolation: async (_tenantId, work) => work({
      platformSubscription: {
        findMany: async () => ([
          { status: 'active', billingCycle: 'monthly', amountCents: 3000 },
          { status: 'trialing', billingCycle: 'yearly', amountCents: 12000 },
          { status: 'canceled', billingCycle: 'monthly', amountCents: 5000 },
        ]),
      },
      platformLicense: {
        findMany: async () => ([
          { status: 'active', legalAcceptedAt: '2026-04-01T00:00:00.000Z' },
          { status: 'inactive', legalAcceptedAt: null },
        ]),
      },
      platformApiKey: {
        findMany: async () => ([
          { status: 'active' },
          { status: 'revoked' },
        ]),
      },
      platformWebhookEndpoint: {
        findMany: async () => ([
          { enabled: true },
          { enabled: false },
        ]),
      },
      platformAgentRuntime: {
        findMany: async () => ([
          { status: 'healthy' },
          { status: 'outdated' },
        ]),
      },
      platformMarketplaceOffer: {
        findMany: async () => ([
          { status: 'active' },
          { status: 'draft' },
        ]),
      },
      purchase: {
        count: async ({ where }) => {
          if (where?.status === 'delivered') return 7;
          if (where?.status === 'delivery_failed') return 2;
          return 10;
        },
      },
      deliveryQueueJob: {
        count: async () => 3,
      },
      deliveryDeadLetter: {
        count: async () => 1,
      },
      deliveryAudit: {
        count: async () => 5,
      },
    }),
    readAcrossPlatformTenantScopesBatch: async () => {
      throw new Error('not-expected');
    },
    readAcrossDeliveryPersistenceScopeBatch: async () => {
      throw new Error('not-expected');
    },
    dedupePlatformRows: (rows) => rows,
    buildPlatformRowScopeKey: (row) => row?.id || row?.tenantId || 'row',
    dedupeDeliveryScopeRows: (rows) => rows,
    getTenantQuotaSnapshot: async () => ({ ok: true, tenantId: 'tenant-1' }),
    nowIso: () => '2026-04-01T12:00:00.000Z',
    trimText(value, maxLen = 240) {
      const text = String(value || '').trim();
      return text.length > maxLen ? text.slice(0, maxLen) : text;
    },
    asInt(value, fallback = 0, min = 0) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.trunc(parsed));
    },
    normalizeShopKind: (value) => String(value || '').trim().toLowerCase() || 'item',
    getPlanCatalog: () => ([
      { id: 'starter', name: 'Starter', amountCents: 9900 },
    ]),
    getFeatureCatalogSummary: () => ([
      { key: 'delivery', name: 'Delivery' },
    ]),
    getPackageCatalogSummary: () => ([
      { id: 'starter', name: 'Starter Package' },
    ]),
    listPersistedPackageCatalog: async () => ([
      { id: 'starter', name: 'Starter Package' },
    ]),
    listMarketplaceOffers: async () => ([
      { id: 'offer-1', status: 'active' },
    ]),
    ...overrides,
  };
}

test('platform analytics service summarizes subscription, delivery, and runtime metrics', async () => {
  const service = createPlatformAnalyticsService(createBaseDeps());

  const analytics = await service.getPlatformAnalyticsOverview({ allowGlobal: true });

  assert.equal(analytics.generatedAt, '2026-04-01T12:00:00.000Z');
  assert.equal(analytics.scope.mode, 'global');
  assert.equal(analytics.tenants.total, 2);
  assert.equal(analytics.tenants.active, 1);
  assert.equal(analytics.tenants.trialing, 1);
  assert.equal(analytics.tenants.reseller, 1);
  assert.equal(analytics.subscriptions.total, 3);
  assert.equal(analytics.subscriptions.active, 1);
  assert.equal(analytics.subscriptions.mrrCents, 4000);
  assert.equal(analytics.licenses.total, 2);
  assert.equal(analytics.licenses.active, 1);
  assert.equal(analytics.api.apiKeys, 1);
  assert.equal(analytics.api.webhooks, 1);
  assert.equal(analytics.agent.runtimes, 2);
  assert.equal(analytics.agent.outdated, 1);
  assert.equal(analytics.marketplace.offers, 1);
  assert.equal(analytics.marketplace.draftOffers, 1);
  assert.equal(analytics.delivery.purchaseCount30d, 10);
  assert.equal(analytics.delivery.deliveredCount, 7);
  assert.equal(analytics.delivery.failedCount, 2);
  assert.equal(analytics.delivery.queueJobs, 3);
  assert.equal(analytics.delivery.deadLetters, 1);
  assert.equal(analytics.delivery.auditEvents, 5);
  assert.equal(analytics.delivery.successRate, 0.7);
});

test('platform public overview falls back cleanly when analytics query fails', async () => {
  const service = createPlatformAnalyticsService(createBaseDeps({
    config: {
      serverInfo: { name: 'Fallback Brand' },
      platform: {
        billing: { currency: 'USD' },
        marketplace: { enabled: true },
        demo: { trialEnabled: true },
        legal: {
          currentVersion: '2026-04',
          docs: [
            { id: 'terms', version: '1.0', path: 'docs/terms.pdf' },
          ],
        },
        localization: { defaultLocale: 'en' },
      },
    },
    runWithOptionalTenantDbIsolation: async () => {
      throw new Error('analytics-offline');
    },
    listPersistedPackageCatalog: async () => {
      throw new Error('catalog-offline');
    },
    getPackageCatalogSummary: () => ([
      { id: 'fallback', name: 'Fallback Package' },
    ]),
  }));

  const overview = await service.getPlatformPublicOverview();

  assert.equal(overview.generatedAt, '2026-04-01T12:00:00.000Z');
  assert.equal(overview.brand.name, 'Fallback Brand');
  assert.equal(overview.billing.currency, 'USD');
  assert.deepEqual(overview.billing.packages, [
    { id: 'fallback', name: 'Fallback Package' },
  ]);
  assert.equal(overview.trial.enabled, true);
  assert.equal(overview.marketplace.enabled, true);
  assert.equal(overview.analytics.overview.activeTenants, 0);
  assert.equal(overview.analytics.overview.currency, 'USD');
  assert.equal(overview.legal.currentVersion, '2026-04');
  assert.equal(overview.legal.docs[0].title, 'terms.pdf');
  assert.equal(overview.legal.docs[0].url, '/docs/terms.pdf');
});
