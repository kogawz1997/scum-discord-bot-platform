const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlatformAgentRuntimeService,
} = require('../src/services/platformAgentRuntimeService');
const {
  createPlatformCommercialService,
} = require('../src/services/platformCommercialService');
const {
  createPlatformIntegrationService,
} = require('../src/services/platformIntegrationService');
const {
  createPlatformMarketplaceService,
} = require('../src/services/platformMarketplaceService');
const {
  createPlatformAnalyticsService,
} = require('../src/services/platformAnalyticsService');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function normalizeStatus(value, allowed = ['active']) {
  const text = String(value || '').trim().toLowerCase();
  if (allowed.includes(text)) return text;
  return allowed[0] || 'active';
}

function normalizeBillingCycle(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['trial', 'monthly', 'quarterly', 'yearly', 'one-time'].includes(text)) return text;
  return 'monthly';
}

function normalizeCurrency(value) {
  return trimText(value || 'THB', 12).toUpperCase() || 'THB';
}

function normalizeLocale(value) {
  const text = String(value || '').trim().toLowerCase();
  return text || 'th';
}

function parseDateOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseJsonOrFallback(value, fallback = null) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function stringifyMeta(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function buildPlatformRowScopeKey(row, fields = ['id']) {
  return [String(row?.tenantId || '__shared__'), ...fields.map((field) => String(row?.[field] || ''))].join(':');
}

function createGlobalReadRecorder() {
  const calls = [];
  return {
    calls,
    readAcrossPlatformTenantScopes: async (_readWork, options = {}) => {
      calls.push({ type: 'single', options });
      return [];
    },
    readAcrossPlatformTenantScopesBatch: async (_tasks, options = {}) => {
      calls.push({ type: 'batch', options });
      return {
        subscriptionRows: [],
        licenseRows: [],
        apiKeyRows: [],
        webhookRows: [],
        agentRows: [],
        offerRows: [],
      };
    },
  };
}

test('platform global listing services declare allowGlobal when aggregating across tenant topology', async () => {
  const recorder = createGlobalReadRecorder();
  const assertTenantDbIsolationScope = ({ tenantId, allowGlobal }) => ({ tenantId: tenantId || null, allowGlobal });
  const getTenantDatabaseTopologyMode = () => 'schema-per-tenant';
  const sortRowsByTimestampDesc = (rows) => rows;

  const agentRuntimeService = createPlatformAgentRuntimeService({
    config: {},
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    stringifyMeta,
    createId: () => 'agent-id',
    compareVersions: () => 0,
    sanitizeAgentRow: (row) => row,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation: async () => [],
    readAcrossPlatformTenantScopes: recorder.readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow: async () => null,
    assertTenantQuotaAvailable: async () => ({ ok: true }),
    mergeAgentRuntimeProfile: (value) => value,
    normalizeAgentRuntimeProfile: (value) => value,
    publishAdminLiveUpdate: () => {},
    emitPlatformEvent: async () => {},
  });

  const commercialService = createPlatformCommercialService({
    crypto: require('node:crypto'),
    config: {},
    prisma: {},
    trimText,
    asInt,
    normalizeStatus,
    normalizeBillingCycle,
    normalizeCurrency,
    parseDateOrNull,
    stringifyMeta,
    createId: () => 'sub-id',
    findPlanById: () => null,
    sanitizeSubscriptionRow: (row) => row,
    sanitizeLicenseRow: (row) => row,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation: async () => [],
    readAcrossPlatformTenantScopes: recorder.readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow: async () => null,
    resolvePackageForPlan: () => null,
    ensureBillingCustomer: async () => null,
    createInvoiceDraft: async () => null,
    recordSubscriptionEvent: async () => null,
    emitPlatformEvent: async () => {},
  });

  const integrationService = createPlatformIntegrationService({
    crypto: require('node:crypto'),
    prisma: {
      platformApiKey: { findMany: async () => [] },
      platformTenant: { findMany: async () => [] },
    },
    scopeGroups: [],
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    toIso: (value) => value,
    createId: () => 'key-id',
    sha256: (value) => value,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation: async () => [],
    readAcrossPlatformTenantScopes: recorder.readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    dedupePlatformRows: (rows) => rows,
    annotatePlatformScopeRow: (row) => row,
    getSharedTenantRegistryRow: async () => null,
    assertTenantQuotaAvailable: async () => ({ ok: true }),
    emitPlatformEvent: async () => {},
    getTenantOperationalState: async () => ({ ok: true, tenant: { id: 'tenant-a' } }),
  });

  const marketplaceService = createPlatformMarketplaceService({
    trimText,
    asInt,
    normalizeStatus,
    normalizeCurrency,
    normalizeLocale,
    stringifyMeta,
    toIso: (value) => value,
    createId: () => 'offer-id',
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation: async () => [],
    readAcrossPlatformTenantScopes: recorder.readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow: async () => null,
    assertTenantQuotaAvailable: async () => ({ ok: true }),
    emitPlatformEvent: async () => {},
  });

  await agentRuntimeService.listPlatformAgentRuntimes({ allowGlobal: true, limit: 10 });
  await commercialService.listPlatformSubscriptions({ allowGlobal: true, limit: 10 });
  await commercialService.listPlatformLicenses({ allowGlobal: true, limit: 10 });
  await integrationService.listPlatformApiKeys({ allowGlobal: true, limit: 10 });
  await integrationService.listPlatformWebhookEndpoints({ allowGlobal: true, limit: 10 });
  await marketplaceService.listMarketplaceOffers({ allowGlobal: true, limit: 10 });

  assert.deepEqual(
    recorder.calls.map((entry) => [entry.type, entry.options.allowGlobal, String(entry.options.operation || '')]),
    [
      ['single', true, 'platform agent runtime global aggregation'],
      ['single', true, 'platform subscription global aggregation'],
      ['single', true, 'platform license global aggregation'],
      ['single', true, 'platform API key global aggregation'],
      ['single', true, 'platform webhook global aggregation'],
      ['single', true, 'platform marketplace global aggregation'],
    ],
  );
});

test('platform analytics service declares allowGlobal for control-plane aggregation batch', async () => {
  const recorder = createGlobalReadRecorder();
  const service = createPlatformAnalyticsService({
    config: {
      platform: {
        billing: { currency: 'THB' },
        marketplace: { enabled: true },
        demo: { trialEnabled: true },
        legal: { currentVersion: '2026-04', docs: [] },
        localization: { defaultLocale: 'th' },
      },
    },
    prisma: {
      platformTenant: { findMany: async () => [] },
    },
    assertTenantDbIsolationScope: ({ tenantId }) => ({ tenantId: tenantId || null }),
    getTenantDatabaseTopologyMode: () => 'schema-per-tenant',
    runWithOptionalTenantDbIsolation: async () => ({
      tenantRows: [],
      subscriptionRows: [],
      licenseRows: [],
      apiKeyRows: [],
      webhookRows: [],
      agentRows: [],
      offerRows: [],
      purchaseCount30d: null,
      deliveredCount: null,
      failedCount: null,
      queueJobsCount: null,
      deadLettersCount: null,
      auditRowsCount: null,
      quota: null,
    }),
    readAcrossPlatformTenantScopesBatch: recorder.readAcrossPlatformTenantScopesBatch,
    readAcrossDeliveryPersistenceScopeBatch: async () => ({
      purchaseRows30d: [],
      deliveredRows30d: [],
      failedRows30d: [],
      queueJobs: [],
      deadLetters: [],
      auditRows: [],
    }),
    dedupePlatformRows: (rows) => rows,
    buildPlatformRowScopeKey,
    dedupeDeliveryScopeRows: (rows) => rows,
    getTenantQuotaSnapshot: async () => null,
    nowIso: () => '2026-04-04T00:00:00.000Z',
    trimText,
    asInt,
    normalizeShopKind: (value) => String(value || '').trim().toLowerCase() || 'item',
    getPlanCatalog: () => [],
    getFeatureCatalogSummary: () => [],
    getPackageCatalogSummary: () => [],
    listPersistedPackageCatalog: async () => [],
    listMarketplaceOffers: async () => [],
  });

  await service.getPlatformAnalyticsOverview({ allowGlobal: true });

  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].type, 'batch');
  assert.equal(recorder.calls[0].options.allowGlobal, true);
  assert.equal(recorder.calls[0].options.operation, 'platform analytics control-plane aggregation');
});

test('platform integration service declares allowGlobal for API key candidate scans during verification', async () => {
  const scopeCalls = [];
  const rawKey = '1234567890abcdef.secret';
  const keyPrefix = rawKey.slice(0, 16);
  const assertTenantDbIsolationScope = ({ tenantId, allowGlobal, operation }) => {
    scopeCalls.push({
      tenantId: tenantId || null,
      allowGlobal: allowGlobal === true,
      operation: String(operation || ''),
    });
    if (!tenantId && allowGlobal !== true) {
      const error = new Error('scope required');
      error.code = 'TENANT_DB_SCOPE_REQUIRED';
      throw error;
    }
    return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
  };

  const integrationService = createPlatformIntegrationService({
    crypto: require('node:crypto'),
    prisma: {
      platformApiKey: {
        findMany: async () => [],
      },
      platformTenant: {
        findMany: async () => [{ id: 'tenant-a' }],
      },
    },
    scopeGroups: [{ scopes: ['analytics:read'] }],
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    toIso: (value) => value,
    createId: () => 'key-id',
    sha256: (value) => value,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode: () => 'schema-per-tenant',
    runWithOptionalTenantDbIsolation: async (tenantId, work) => work({
      platformApiKey: {
        findMany: async () => [{
          id: 'key-1',
          tenantId,
          keyPrefix,
          keyHash: rawKey,
          status: 'active',
          revokedAt: null,
          scopesJson: JSON.stringify(['analytics:read']),
        }],
        update: async ({ where, data }) => ({
          id: where.id,
          tenantId,
          keyPrefix,
          keyHash: rawKey,
          status: 'active',
          revokedAt: null,
          scopesJson: JSON.stringify(['analytics:read']),
          ...data,
        }),
      },
    }),
    readAcrossPlatformTenantScopes: async () => [],
    sortRowsByTimestampDesc: (rows) => rows,
    buildPlatformRowScopeKey,
    dedupePlatformRows: (rows, buildKey) => {
      const seen = new Set();
      return rows.filter((row) => {
        const key = typeof buildKey === 'function' ? buildKey(row) : JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    annotatePlatformScopeRow: (row, tenantId) => ({ ...row, tenantId: tenantId || row?.tenantId || null }),
    getSharedTenantRegistryRow: async () => null,
    assertTenantQuotaAvailable: async () => ({ ok: true }),
    emitPlatformEvent: async () => {},
    getTenantOperationalState: async (tenantId) => ({ ok: true, tenant: { id: tenantId } }),
  });

  const verified = await integrationService.verifyPlatformApiKey(rawKey, ['analytics:read']);

  assert.equal(verified.ok, true);
  assert.equal(String(verified.tenant?.id || ''), 'tenant-a');
  assert.deepEqual(
    scopeCalls.map((entry) => [entry.operation, entry.allowGlobal, entry.tenantId]),
    [
      ['platform API key candidate lookup', true, null],
    ],
  );
});

test('platform integration service requires explicit global intent for API key revoke and rotate mutations', async () => {
  const scopeCalls = [];
  const assertTenantDbIsolationScope = ({ tenantId, allowGlobal, operation }) => {
    scopeCalls.push({
      tenantId: tenantId || null,
      allowGlobal: allowGlobal === true,
      operation: String(operation || ''),
    });
    if (!tenantId && allowGlobal !== true) {
      const error = new Error('scope required');
      error.code = 'TENANT_DB_SCOPE_REQUIRED';
      throw error;
    }
    return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
  };

  const integrationService = createPlatformIntegrationService({
    crypto: require('node:crypto'),
    prisma: {
      platformApiKey: {
        findMany: async () => [],
      },
      platformTenant: {
        findMany: async () => [{ id: 'tenant-a' }],
      },
    },
    scopeGroups: [{ scopes: ['analytics:read'] }],
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    toIso: (value) => value,
    createId: () => 'key-id',
    sha256: (value) => value,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode: () => 'shared',
    runWithOptionalTenantDbIsolation: async (tenantId, work) => work({
      platformApiKey: {
        findMany: async () => [{
          id: 'key-1',
          tenantId: tenantId || 'tenant-a',
          name: 'Tenant Key',
          keyPrefix: 'key-prefix',
          keyHash: 'hash',
          status: 'active',
          revokedAt: null,
          scopesJson: JSON.stringify(['analytics:read']),
        }],
        update: async ({ where, data }) => ({
          id: where.id,
          tenantId: tenantId || 'tenant-a',
          name: 'Tenant Key',
          keyPrefix: 'key-prefix',
          keyHash: 'hash',
          status: data.status || 'active',
          revokedAt: data.revokedAt || null,
          scopesJson: JSON.stringify(['analytics:read']),
        }),
        count: async () => 0,
        create: async ({ data }) => ({
          id: data.id || 'key-2',
          tenantId: data.tenantId,
          name: data.name,
          keyPrefix: data.keyPrefix,
          keyHash: data.keyHash,
          status: data.status,
          revokedAt: null,
          scopesJson: data.scopesJson,
        }),
      },
    }),
    readAcrossPlatformTenantScopes: async () => [],
    sortRowsByTimestampDesc: (rows) => rows,
    buildPlatformRowScopeKey,
    dedupePlatformRows: (rows) => rows,
    annotatePlatformScopeRow: (row) => row,
    getSharedTenantRegistryRow: async (tenantId) => ({ id: tenantId }),
    assertTenantQuotaAvailable: async () => ({ ok: true }),
    emitPlatformEvent: async () => {},
    getTenantOperationalState: async (tenantId) => ({ ok: true, tenant: { id: tenantId } }),
  });

  await assert.rejects(
    () => integrationService.revokePlatformApiKey('key-1', 'owner'),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  const revoked = await integrationService.revokePlatformApiKey('key-1', 'owner', { allowGlobal: true });
  assert.equal(revoked.ok, true);

  await assert.rejects(
    () => integrationService.rotatePlatformApiKey({ apiKeyId: 'key-1' }, 'owner'),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  const rotated = await integrationService.rotatePlatformApiKey({
    apiKeyId: 'key-1',
    tenantId: 'tenant-a',
    name: 'Rotated Key',
  }, 'owner');
  assert.equal(rotated.ok, true);

  assert.deepEqual(
    scopeCalls.map((entry) => [entry.operation, entry.allowGlobal, entry.tenantId]),
    [
      ['platform API key revocation', false, null],
      ['platform API key revocation', true, null],
      ['platform API key listing', true, null],
      ['platform API key rotation', false, null],
      ['platform API key rotation', false, 'tenant-a'],
      ['platform API key listing', false, 'tenant-a'],
      ['platform API key revocation', false, 'tenant-a'],
      ['platform API key listing', false, 'tenant-a'],
    ],
  );
});

test('platform commercial service requires explicit global intent for license legal acceptance', async () => {
  const scopeCalls = [];
  const assertTenantDbIsolationScope = ({ tenantId, allowGlobal, operation }) => {
    scopeCalls.push({
      tenantId: tenantId || null,
      allowGlobal: allowGlobal === true,
      operation: String(operation || ''),
    });
    if (!tenantId && allowGlobal !== true) {
      const error = new Error('scope required');
      error.code = 'TENANT_DB_SCOPE_REQUIRED';
      throw error;
    }
    return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
  };

  const commercialService = createPlatformCommercialService({
    crypto: require('node:crypto'),
    config: { platform: { legal: { currentVersion: '2026-04' } } },
    prisma: {
      platformTenant: {
        findMany: async () => [{ id: 'tenant-a' }],
      },
      platformLicense: {
        update: async ({ where, data }) => ({
          id: where.id,
          tenantId: null,
          ...data,
        }),
      },
    },
    trimText,
    asInt,
    normalizeStatus,
    normalizeBillingCycle,
    normalizeCurrency,
    parseDateOrNull,
    stringifyMeta,
    createId: () => 'sub-id',
    findPlanById: () => null,
    sanitizeSubscriptionRow: (row) => row,
    sanitizeLicenseRow: (row) => row,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode: () => 'schema-per-tenant',
    runWithOptionalTenantDbIsolation: async (tenantId, work) => work({
      platformLicense: {
        update: async ({ where, data }) => ({
          id: where.id,
          tenantId,
          ...data,
        }),
      },
    }),
    readAcrossPlatformTenantScopes: async () => [],
    sortRowsByTimestampDesc: (rows) => rows,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow: async () => null,
    resolvePackageForPlan: () => null,
    ensureBillingCustomer: async () => null,
    createInvoiceDraft: async () => null,
    recordSubscriptionEvent: async () => null,
    emitPlatformEvent: async () => {},
  });

  await assert.rejects(
    () => commercialService.acceptPlatformLicenseLegal({ licenseId: 'lic-1' }, 'owner'),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );

  const accepted = await commercialService.acceptPlatformLicenseLegal({
    licenseId: 'lic-1',
    allowGlobal: true,
  }, 'owner');
  assert.equal(accepted.ok, true);
  assert.deepEqual(
    scopeCalls.map((entry) => [entry.operation, entry.allowGlobal, entry.tenantId]),
    [
      ['platform license legal acceptance', false, null],
      ['platform license legal acceptance', true, null],
    ],
  );
});
