const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  getPlatformTenantConfig,
  listPlatformTenantConfigs,
  upsertPlatformTenantConfig,
} = require('../src/services/platformTenantConfigService');

async function cleanupTenantConfigs() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM platform_tenant_configs WHERE tenant_id IN ('tenant-config-a', 'tenant-config-b')",
  ).catch(() => null);
}

test('platform tenant config service stores and scopes tenant config rows', async (t) => {
  await cleanupTenantConfigs();
  t.after(async () => {
    await cleanupTenantConfigs();
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
});
