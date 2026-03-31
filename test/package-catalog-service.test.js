const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPackageCatalogEntry,
  deletePackageCatalogEntry,
  getFeatureCatalog,
  getPackageCatalog,
  listPersistedPackageCatalog,
  resolveFeatureAccess,
  resolvePackageForPlan,
  updatePackageCatalogEntry,
  hasFeature,
} = require('../src/domain/billing/packageCatalogService');

function createInMemoryPackageCatalogDb() {
  const rows = [];

  function serializeValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (value == null) return null;
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch {
        return String(value);
      }
    }
    return value;
  }

  function getSqlText(query) {
    return String(query?.strings?.join(' ') || '').toUpperCase();
  }

  function getValues(query) {
    return Array.isArray(query?.values) ? query.values.map(serializeValue) : [];
  }

  return {
    async $executeRawUnsafe() {
      return 0;
    },
    async $queryRaw(query) {
      const sql = getSqlText(query);
      if (!sql.includes('PLATFORMPACKAGECATALOGENTRY')) {
        return [];
      }
      return rows
        .map((row) => ({ ...row }))
        .sort((left, right) => {
          const positionDiff = Number(left.position || 0) - Number(right.position || 0);
          if (positionDiff !== 0) return positionDiff;
          const createdDiff = String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
          if (createdDiff !== 0) return createdDiff;
          return String(left.id || '').localeCompare(String(right.id || ''));
        });
    },
    async $executeRaw(query) {
      const sql = getSqlText(query);
      const values = getValues(query);
      if (sql.includes('INSERT INTO "PLATFORMPACKAGECATALOGENTRY"')) {
        rows.push({
          id: values[0],
          title: values[1],
          description: values[2],
          status: values[3],
          featuresJson: values[4],
          position: values[5],
          isSystem: values[6],
          metadataJson: values[7],
          actor: values[8],
          createdAt: values[9],
          updatedAt: values[10],
        });
        return 1;
      }
      if (sql.includes('UPDATE "PLATFORMPACKAGECATALOGENTRY"')) {
        const targetId = values[8];
        const row = rows.find((entry) => entry.id === targetId);
        if (!row) return 0;
        row.title = values[0];
        row.description = values[1];
        row.status = values[2];
        row.featuresJson = values[3];
        row.position = values[4];
        row.metadataJson = values[5];
        row.actor = values[6];
        row.updatedAt = values[7];
        return 1;
      }
      if (sql.includes('DELETE FROM "PLATFORMPACKAGECATALOGENTRY"')) {
        const targetId = values[0];
        const index = rows.findIndex((entry) => entry.id === targetId);
        if (index >= 0) rows.splice(index, 1);
        return index >= 0 ? 1 : 0;
      }
      return 0;
    },
  };
}

test('package catalog exposes requested managed-service packages', () => {
  const packages = getPackageCatalog();
  const packageIds = packages.map((entry) => entry.id);
  assert.ok(packageIds.includes('BOT_LOG'));
  assert.ok(packageIds.includes('BOT_LOG_DELIVERY'));
  assert.ok(packageIds.includes('FULL_OPTION'));
  assert.ok(packageIds.includes('SERVER_ONLY'));

  const featureKeys = getFeatureCatalog().map((entry) => entry.key);
  assert.ok(featureKeys.includes('sync_agent'));
  assert.ok(featureKeys.includes('execute_agent'));
  assert.ok(featureKeys.includes('server_hosting'));
  assert.ok(featureKeys.includes('donation_module'));
  assert.ok(featureKeys.includes('analytics_module'));
  assert.ok(featureKeys.includes('restart_announce_module'));
});

test('plan aliases resolve to package ids and feature-based access', () => {
  const starterPackage = resolvePackageForPlan('platform-starter');
  assert.equal(starterPackage?.id, 'BOT_LOG_DELIVERY');

  const growthAccess = resolveFeatureAccess({ planId: 'platform-growth' });
  assert.ok(hasFeature(growthAccess, 'server_hosting'));
  assert.ok(hasFeature(growthAccess, 'execute_agent'));
  assert.ok(hasFeature(growthAccess, 'event_module'));
  assert.ok(hasFeature(growthAccess, 'wallet_module'));
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

test('package catalog can create update and delete custom packages', async () => {
  const packageId = `TEST_PACKAGE_${Date.now()}`;
  const db = createInMemoryPackageCatalogDb();
  try {
    const created = await createPackageCatalogEntry({
      id: packageId,
      title: 'Test Package',
      description: 'Temporary package for CRUD verification.',
      status: 'draft',
      position: 150,
      featureText: 'sync_agent\nanalytics_module',
    }, 'test', db);
    assert.equal(created.ok, true);
    assert.equal(created.package?.id, packageId);
    assert.equal(created.package?.status, 'draft');

    const updated = await updatePackageCatalogEntry({
      id: packageId,
      title: 'Test Package Updated',
      description: 'Updated package description.',
      status: 'active',
      position: 175,
      featureText: 'sync_agent\nexecute_agent\nanalytics_module',
    }, 'test', db);
    assert.equal(updated.ok, true);
    assert.equal(updated.package?.title, 'Test Package Updated');
    assert.equal(updated.package?.status, 'active');
    assert.ok(updated.package?.features.includes('execute_agent'));

    const packages = await listPersistedPackageCatalog({ includeInactive: true }, db);
    const found = packages.find((entry) => entry.id === packageId);
    assert.ok(found);
    assert.equal(found.status, 'active');

    const deleted = await deletePackageCatalogEntry({ id: packageId }, 'test', db);
    assert.equal(deleted.ok, true);
  } finally {
    await deletePackageCatalogEntry({ id: packageId }, 'test', db).catch(() => {});
  }
});
