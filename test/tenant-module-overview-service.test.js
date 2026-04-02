const test = require('node:test');
const assert = require('node:assert/strict');

function loadServiceWithStubs() {
  const servicePath = require.resolve('../src/services/tenantModuleOverviewService');
  const platformServicePath = require.resolve('../src/services/platformService');
  const tenantConfigServicePath = require.resolve('../src/services/platformTenantConfigService');
  const entitlementServicePath = require.resolve('../src/domain/billing/productEntitlementService');

  delete require.cache[servicePath];
  delete require.cache[platformServicePath];
  delete require.cache[tenantConfigServicePath];
  delete require.cache[entitlementServicePath];

  require.cache[platformServicePath] = {
    id: platformServicePath,
    filename: platformServicePath,
    loaded: true,
    exports: {
      getTenantFeatureAccess: async () => null,
      listPlatformAgentRuntimes: async () => [],
    },
  };
  require.cache[tenantConfigServicePath] = {
    id: tenantConfigServicePath,
    filename: tenantConfigServicePath,
    loaded: true,
    exports: {
      getPlatformTenantConfig: async () => null,
    },
  };
  require.cache[entitlementServicePath] = {
    id: entitlementServicePath,
    filename: entitlementServicePath,
    loaded: true,
    exports: {
      buildTenantProductEntitlements: () => ({ actions: {} }),
    },
  };

  return require('../src/services/tenantModuleOverviewService');
}

test('tenant module overview builds readiness, issues, and runtime summary from backend inputs', async () => {
  const { buildTenantModuleOverview } = loadServiceWithStubs();
  const overview = await buildTenantModuleOverview({
    tenantId: 'tenant-1',
    limit: 4,
    getTenantFeatureAccessFn: async () => ({
      package: {
        features: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'sync_agent'],
      },
      enabledFeatureKeys: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'sync_agent'],
    }),
    getPlatformTenantConfigFn: async () => ({
      featureFlags: {
        bot_log: true,
        donation_module: true,
      },
    }),
    listPlatformAgentRuntimesFn: async () => ([
      { role: 'sync', status: 'offline' },
      { role: 'execute', status: 'offline' },
    ]),
    buildTenantProductEntitlementsFn: () => ({
      actions: {
        can_use_modules: {
          locked: false,
          reason: '',
        },
      },
    }),
  });

  assert.equal(overview.tenantId, 'tenant-1');
  assert.equal(overview.summary.totalCatalogModules, 8);
  assert.equal(overview.summary.activeModules, 2);
  assert.equal(overview.summary.runtimeBlocked, 1);
  assert.equal(overview.summary.dependencyBlocked >= 1, true);
  assert.equal(overview.runtimeHealth.syncOnline, false);
  assert.equal(Array.isArray(overview.readiness.steps), true);
  assert.equal(overview.readiness.nextRequiredStep?.key, 'server-bot');
  assert.equal(Array.isArray(overview.issues), true);
  assert.ok(overview.issues.some((issue) => issue.key === 'runtime-blocked'));
  assert.ok(Array.isArray(overview.topActions));
  assert.ok(overview.topActions.length <= 4);
});

test('tenant module overview requires tenant id', async () => {
  const { buildTenantModuleOverview } = loadServiceWithStubs();
  await assert.rejects(
    () => buildTenantModuleOverview({ tenantId: '' }),
    /tenantId is required/,
  );
});
