const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('../src/prismaClientLoader');

const { resolveTenantDatabaseTarget } = require('../src/utils/tenantDatabaseTopology');
const {
  buildAdminDashboardCards,
  clearAdminDashboardCardsCache,
} = require('../src/services/adminDashboardService');
const { buildAuditDataset } = require('../src/services/adminAuditService');
const { prisma, getTenantScopedPrismaClient, disconnectAllPrismaClients } = require('../src/prisma');

const repoRoot = path.resolve(__dirname, '..');

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

test('admin dashboard cards and audit dataset aggregate tenant topology correctly', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for tenant topology integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const previousDefaultTenantId = process.env.PLATFORM_DEFAULT_TENANT_ID;
  const tenantId = `tenant-admin-audit-${Date.now()}`;
  const target = resolveTenantDatabaseTarget({
    tenantId,
    env: {
      ...process.env,
      TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
    },
    mode: 'schema-per-tenant',
  });
  const userId = `audit-user-${Date.now()}`;
  const purchaseCode = `AUDIT-TENANT-${Date.now()}`;
  const deadLetterCode = `${purchaseCode}-DL`;
  const eventName = `tenant-event-${Date.now()}`;
  const auditId = `audit-${Date.now()}`;

  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  process.env.PLATFORM_DEFAULT_TENANT_ID = tenantId;
  clearAdminDashboardCardsCache();
  await provisionTenantSchema(target);

  t.after(async () => {
    clearAdminDashboardCardsCache();
    await disconnectAllPrismaClients().catch(() => null);
    delete process.env.TENANT_DB_TOPOLOGY_MODE;
    delete process.env.PLATFORM_DEFAULT_TENANT_ID;
    if (previousMode) process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    if (previousDefaultTenantId) process.env.PLATFORM_DEFAULT_TENANT_ID = previousDefaultTenantId;
    await dropTenantSchema(target).catch(() => null);
  });

  const scopedPrisma = getTenantScopedPrismaClient(tenantId);

  await scopedPrisma.userWallet.create({
    data: {
      userId,
      balance: 100,
    },
  });
  await scopedPrisma.walletLedger.create({
    data: {
      userId,
      delta: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      reason: 'daily',
      actor: 'test-suite',
    },
  });
  await scopedPrisma.purchase.create({
    data: {
      code: purchaseCode,
      tenantId,
      userId,
      itemId: 'tenant-item',
      price: 100,
      status: 'pending',
    },
  });
  await scopedPrisma.guildEvent.create({
    data: {
      id: 1,
      name: eventName,
      time: '20:00',
      reward: 'reward-box',
      status: 'scheduled',
    },
  });
  await scopedPrisma.guildEventParticipant.create({
    data: {
      eventId: 1,
      userId,
    },
  });
  await scopedPrisma.deliveryQueueJob.create({
    data: {
      purchaseCode,
      tenantId,
      userId,
      itemId: 'tenant-item',
      nextAttemptAt: new Date(Date.now() + 60_000),
    },
  });
  await scopedPrisma.deliveryDeadLetter.create({
    data: {
      purchaseCode: deadLetterCode,
      tenantId,
      userId,
      itemId: 'tenant-item',
      attempts: 1,
      reason: 'tenant-test',
    },
  });
  await scopedPrisma.deliveryAudit.create({
    data: {
      id: auditId,
      tenantId,
      level: 'info',
      action: 'enqueue',
      purchaseCode,
      itemId: 'tenant-item',
      userId,
      message: 'tenant audit row',
    },
  });

  const client = {
    guilds: {
      cache: new Map([['guild-1', {}]]),
    },
  };

  const scopedCards = await buildAdminDashboardCards({
    prisma,
    client,
    tenantId,
    forceRefresh: true,
  });
  assert.equal(scopedCards.metrics.guildCount, 1);
  assert.equal(scopedCards.metrics.walletCount, 1);
  assert.equal(scopedCards.metrics.purchaseCount, 1);
  assert.equal(scopedCards.metrics.eventCount, 1);
  assert.equal(scopedCards.metrics.deliveryQueueCount, 1);
  assert.equal(scopedCards.metrics.deliveryDeadLetterCount, 1);
  assert.equal(scopedCards.metrics.deliveryAuditCount, 1);

  const globalCards = await buildAdminDashboardCards({
    prisma,
    client,
    allowGlobal: true,
    forceRefresh: true,
  });
  assert.ok(globalCards.metrics.walletCount >= scopedCards.metrics.walletCount);
  assert.ok(globalCards.metrics.purchaseCount >= scopedCards.metrics.purchaseCount);
  assert.ok(globalCards.metrics.eventCount >= scopedCards.metrics.eventCount);
  assert.ok(globalCards.metrics.deliveryQueueCount >= scopedCards.metrics.deliveryQueueCount);
  assert.ok(globalCards.metrics.deliveryDeadLetterCount >= scopedCards.metrics.deliveryDeadLetterCount);
  assert.ok(globalCards.metrics.deliveryAuditCount >= scopedCards.metrics.deliveryAuditCount);

  const scopedWalletAudit = await buildAuditDataset({
    prisma,
    tenantId,
    view: 'wallet',
    userId,
  });
  assert.equal(scopedWalletAudit.total, 1);
  assert.equal(scopedWalletAudit.returned, 1);

  const scopedEventAudit = await buildAuditDataset({
    prisma,
    tenantId,
    view: 'event',
    query: eventName,
  });
  assert.equal(scopedEventAudit.total, 1);
  assert.equal(scopedEventAudit.returned, 1);

  const globalWalletAudit = await buildAuditDataset({
    prisma,
    allowGlobal: true,
    view: 'wallet',
    userId,
  });
  assert.equal(globalWalletAudit.total, 1);

  const globalEventAudit = await buildAuditDataset({
    prisma,
    allowGlobal: true,
    view: 'event',
    query: eventName,
  });
  assert.equal(globalEventAudit.total, 1);
});
