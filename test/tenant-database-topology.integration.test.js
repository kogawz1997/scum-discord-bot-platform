const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const {
  buildTenantDatabaseAdminUrl,
  resolveTenantDatabaseTarget,
} = require('../src/utils/tenantDatabaseTopology');

const repoRoot = path.resolve(__dirname, '..');
const prismaModulePath = require.resolve('../src/prisma');
const memoryStoreModulePath = require.resolve('../src/store/memoryStore');
const deliveryAuditStoreModulePath = require.resolve('../src/store/deliveryAuditStore');
const platformServiceModulePath = require.resolve('../src/services/platformService');

function isPostgresRuntime() {
  return /^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || '').trim());
}

function createPrismaClient(databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function clearTenantTopologyModules() {
  delete require.cache[prismaModulePath];
  delete require.cache[memoryStoreModulePath];
  delete require.cache[deliveryAuditStoreModulePath];
  delete require.cache[platformServiceModulePath];
}

function loadTenantTopologyModules() {
  clearTenantTopologyModules();
  return {
    prismaModule: require('../src/prisma'),
    memoryStore: require('../src/store/memoryStore'),
    deliveryAuditStore: require('../src/store/deliveryAuditStore'),
    platformService: require('../src/services/platformService'),
  };
}

function runDbPush(databaseUrl) {
  const scriptPath = path.resolve(repoRoot, 'scripts', 'prisma-with-provider.js');
  const result = spawnSync(
    process.execPath,
    [scriptPath, '--provider', 'postgresql', 'db', 'push', '--skip-generate'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
    },
  );
  if (Number(result.status || 0) !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'prisma db push failed').trim());
  }
}

async function provisionTenantSchema(target) {
  if (!target?.schemaName || !target?.datasourceUrl) {
    throw new Error('schema-per-tenant target is required');
  }
  const adminClient = createPrismaClient(process.env.DATABASE_URL);
  try {
    await adminClient.$executeRawUnsafe(
      `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(target.schemaName)};`,
    );
  } finally {
    await adminClient.$disconnect().catch(() => {});
  }
  runDbPush(target.datasourceUrl);
}

async function dropTenantSchema(target) {
  if (!target?.schemaName) return;
  const adminClient = createPrismaClient(process.env.DATABASE_URL);
  try {
    await adminClient.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS ${quoteIdentifier(target.schemaName)} CASCADE;`,
    );
  } finally {
    await adminClient.$disconnect().catch(() => {});
  }
}

test('schema-per-tenant topology isolates shared registry from tenant-scoped operational data', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for tenant topology integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const tenantId = `tenant-topology-${Date.now()}`;
  const itemId = `tenant-topology-item-${Date.now()}`;
  const userId = `tenant-topology-user-${Date.now()}`;
  const target = resolveTenantDatabaseTarget({
    tenantId,
    env: {
      ...process.env,
      TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
    },
    mode: 'schema-per-tenant',
  });

  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  await provisionTenantSchema(target);

  const cleanupSharedPrisma = createPrismaClient(process.env.DATABASE_URL);

  t.after(async () => {
    clearTenantTopologyModules();
    delete process.env.TENANT_DB_TOPOLOGY_MODE;
    if (previousMode) {
      process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    }
    await cleanupSharedPrisma.deliveryAudit
      .deleteMany({ where: { tenantId } })
      .catch(() => null);
    await cleanupSharedPrisma.purchaseStatusHistory
      .deleteMany({
        where: {
          purchase: {
            tenantId,
          },
        },
      })
      .catch(() => null);
    await cleanupSharedPrisma.purchase.deleteMany({ where: { tenantId } }).catch(() => null);
    await cleanupSharedPrisma.shopItem.deleteMany({ where: { id: itemId } }).catch(() => null);
    await cleanupSharedPrisma.platformSubscription.deleteMany({ where: { tenantId } }).catch(() => null);
    await cleanupSharedPrisma.platformTenant.deleteMany({ where: { id: tenantId } }).catch(() => null);
    await cleanupSharedPrisma.$disconnect().catch(() => {});
    await dropTenantSchema(target).catch(() => null);
  });

  const { prismaModule, memoryStore, deliveryAuditStore, platformService } =
    loadTenantTopologyModules();
  const {
    prisma,
    getTenantScopedPrismaClient,
    disconnectAllPrismaClients,
  } = prismaModule;
  const {
    addShopItem,
    getShopItemById,
    createPurchase,
    findPurchaseByCode,
  } = memoryStore;
  const {
    addDeliveryAudit,
    flushDeliveryAuditStoreWrites,
  } = deliveryAuditStore;
  const {
    createTenant,
    createSubscription,
    getPlatformTenantById,
    listPlatformSubscriptions,
  } = platformService;

  try {
    const tenantResult = await createTenant({
      id: tenantId,
      slug: tenantId,
      name: tenantId,
      type: 'trial',
      status: 'active',
      locale: 'th',
      ownerEmail: `${tenantId}@example.com`,
    }, 'test-suite');
    assert.equal(tenantResult.ok, true);

    const sharedTenant = await getPlatformTenantById(tenantId);
    assert.equal(String(sharedTenant?.id || ''), tenantId);

    const subscriptionResult = await createSubscription({
      tenantId,
      planId: 'platform-starter',
      amountCents: 490000,
    }, 'test-suite');
    assert.equal(subscriptionResult.ok, true);

    const item = await addShopItem(
      itemId,
      'Tenant Topology Item',
      100,
      'tenant topology item',
      {
        kind: 'item',
        deliveryItems: [{ gameItemId: 'Water_05l', quantity: 1 }],
      },
      { tenantId },
    );
    assert.equal(String(item?.id || ''), itemId);

    const purchase = await createPurchase(userId, item, { tenantId });
    assert.equal(String(purchase?.tenantId || ''), tenantId);

    const audit = addDeliveryAudit({
      tenantId,
      action: 'tenant-topology-proof',
      level: 'info',
      purchaseCode: purchase.code,
      itemId,
      userId,
      message: 'schema-per-tenant proof row',
    });
    await flushDeliveryAuditStoreWrites();

    const sharedSubscriptionRows = await prisma.platformSubscription.findMany({
      where: { tenantId },
    });
    const sharedItem = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });
    const sharedPurchase = await prisma.purchase.findUnique({
      where: { code: purchase.code },
    });
    const sharedAudit = await prisma.deliveryAudit.findUnique({
      where: { id: audit.id },
    });

    assert.equal(sharedSubscriptionRows.length, 0);
    assert.equal(sharedItem, null);
    assert.equal(sharedPurchase, null);
    assert.equal(sharedAudit, null);

    const scopedSubscriptions = await listPlatformSubscriptions({ tenantId });
    const scopedItem = await getShopItemById(itemId, { tenantId });
    const scopedPurchase = await findPurchaseByCode(purchase.code, { tenantId });
    const scopedPrisma = getTenantScopedPrismaClient(tenantId);
    const scopedAudit = await scopedPrisma.deliveryAudit.findUnique({
      where: { id: audit.id },
    });

    assert.equal(scopedSubscriptions.length, 1);
    assert.equal(String(scopedSubscriptions[0]?.tenantId || ''), tenantId);
    assert.equal(String(scopedItem?.id || ''), itemId);
    assert.equal(String(scopedPurchase?.code || ''), purchase.code);
    assert.equal(String(scopedAudit?.tenantId || ''), tenantId);
  } finally {
    await disconnectAllPrismaClients().catch(() => {});
  }
});
