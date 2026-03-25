const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getFeatureCatalog,
  getPackageCatalog,
  resolveFeatureAccess,
  resolvePackageForPlan,
  hasFeature,
} = require('../src/domain/billing/packageCatalogService');

test('package catalog exposes requested managed-service packages', () => {
  const packages = getPackageCatalog();
  assert.deepEqual(
    packages.map((entry) => entry.id),
    ['BOT_LOG', 'BOT_LOG_DELIVERY', 'FULL_OPTION', 'SERVER_ONLY'],
  );

  const featureKeys = getFeatureCatalog().map((entry) => entry.key);
  assert.ok(featureKeys.includes('sync_agent'));
  assert.ok(featureKeys.includes('execute_agent'));
  assert.ok(featureKeys.includes('server_hosting'));
});

test('plan aliases resolve to package ids and feature-based access', () => {
  const starterPackage = resolvePackageForPlan('platform-starter');
  assert.equal(starterPackage?.id, 'BOT_LOG_DELIVERY');

  const growthAccess = resolveFeatureAccess({ planId: 'platform-growth' });
  assert.ok(hasFeature(growthAccess, 'server_hosting'));
  assert.ok(hasFeature(growthAccess, 'execute_agent'));
  assert.ok(!hasFeature(growthAccess, 'non-existent'));
});

test('feature overrides can disable and enable capabilities independently of package defaults', () => {
  const access = resolveFeatureAccess({
    planId: 'platform-starter',
    featureFlags: {
      delivery_dashboard: false,
      server_hosting: true,
    },
  });

  assert.ok(hasFeature(access, 'server_hosting'));
  assert.equal(hasFeature(access, 'delivery_dashboard'), false);
});
