const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma, getTenantScopedPrismaClient } = require('../src/prisma');
const { getTenantDatabaseTopologyMode } = require('../src/utils/tenantDatabaseTopology');
const {
  getPlatformTenantConfig,
  listPlatformTenantConfigs,
  upsertPlatformTenantConfig,
} = require('../src/services/platformTenantConfigService');

async function cleanupTenantConfigs() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM platform_tenant_configs WHERE tenant_id IN ('tenant-config-a', 'tenant-config-b')",
  ).catch(() => null);
  await prisma.platformTenant.deleteMany({
    where: {
      id: { in: ['tenant-config-a', 'tenant-config-b'] },
    },
  }).catch(() => null);
  for (const tenantId of ['tenant-config-a', 'tenant-config-b']) {
    const tenantPrisma = getTenantScopedPrismaClient(tenantId);
    await tenantPrisma.$executeRawUnsafe(
      'DELETE FROM platform_tenant_configs WHERE tenant_id = $1',
      tenantId,
    ).catch(() => null);
  }
}

test('platform tenant config service stores and scopes tenant config rows', async (t) => {
  await cleanupTenantConfigs();
  t.after(async () => {
    await cleanupTenantConfigs();
  });

  await prisma.platformTenant.createMany({
    data: [
      {
        id: 'tenant-config-a',
        slug: 'tenant-config-a',
        name: 'Tenant Config A',
      },
      {
        id: 'tenant-config-b',
        slug: 'tenant-config-b',
        name: 'Tenant Config B',
      },
    ],
  });

  const first = await upsertPlatformTenantConfig({
    tenantId: 'tenant-config-a',
    configPatch: { platform: { locale: 'th' } },
    portalEnvPatch: { WEB_PORTAL_BASE_URL: 'https://tenant-a.example.com' },
    featureFlags: { showcase: true },
    updatedBy: 'test',
  });
  assert.equal(first.ok, true);
  assert.equal(String(first.data?.tenantId || ''), 'tenant-config-a');

  const second = await upsertPlatformTenantConfig({
    tenantId: 'tenant-config-b',
    configPatch: { platform: { locale: 'en' } },
    portalEnvPatch: { WEB_PORTAL_BASE_URL: 'https://tenant-b.example.com' },
    featureFlags: { showcase: false },
    updatedBy: 'test',
  });
  assert.equal(second.ok, true);

  const scoped = await getPlatformTenantConfig('tenant-config-a');
  assert.equal(String(scoped?.tenantId || ''), 'tenant-config-a');
  assert.equal(String(scoped?.portalEnvPatch?.WEB_PORTAL_BASE_URL || ''), 'https://tenant-a.example.com');

  const list = await listPlatformTenantConfigs({ tenantId: 'tenant-config-a', limit: 20 });
  assert.deepEqual(
    list.map((row) => row.tenantId),
    ['tenant-config-a'],
  );

  const globalList = await listPlatformTenantConfigs({ limit: 20 });
  assert.deepEqual(
    globalList.map((row) => row.tenantId),
    ['tenant-config-a', 'tenant-config-b'],
  );

  if (getTenantDatabaseTopologyMode() !== 'shared') {
    await prisma.$executeRaw`
      INSERT INTO platform_tenant_configs (
        tenant_id,
        config_patch_json,
        portal_env_patch_json,
        feature_flags_json,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (
        ${'tenant-config-a'},
        ${JSON.stringify({ platform: { locale: 'legacy' } })},
        ${JSON.stringify({ WEB_PORTAL_BASE_URL: 'https://stale-shared.example.com' })},
        ${JSON.stringify({ showcase: false })},
        ${'stale-shared'},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        config_patch_json = EXCLUDED.config_patch_json,
        portal_env_patch_json = EXCLUDED.portal_env_patch_json,
        feature_flags_json = EXCLUDED.feature_flags_json,
        updated_by = EXCLUDED.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `;

    const dedupedGlobalList = await listPlatformTenantConfigs({ limit: 20 });
    const resolvedTenantA = dedupedGlobalList.find((row) => row.tenantId === 'tenant-config-a');
    assert.equal(String(resolvedTenantA?.updatedBy || ''), 'test');
    assert.equal(
      String(resolvedTenantA?.portalEnvPatch?.WEB_PORTAL_BASE_URL || ''),
      'https://tenant-a.example.com',
    );
  }
});
