const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const { resolveTenantDatabaseTarget } = require('../src/utils/tenantDatabaseTopology');

const repoRoot = path.resolve(__dirname, '..');
const prismaModulePath = require.resolve('../src/prisma');
const memoryStoreModulePath = require.resolve('../src/store/memoryStore');
const playerAccountStoreModulePath = require.resolve('../src/store/playerAccountStore');
const rentBikeStoreModulePath = require.resolve('../src/store/rentBikeStore');
const luckyWheelStoreModulePath = require.resolve('../src/store/luckyWheelStore');

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
  delete require.cache[playerAccountStoreModulePath];
  delete require.cache[rentBikeStoreModulePath];
  delete require.cache[luckyWheelStoreModulePath];
}

function loadTenantTopologyModules() {
  clearTenantTopologyModules();
  return {
    prismaModule: require('../src/prisma'),
    memoryStore: require('../src/store/memoryStore'),
    playerAccountStore: require('../src/store/playerAccountStore'),
    rentBikeStore: require('../src/store/rentBikeStore'),
    luckyWheelStore: require('../src/store/luckyWheelStore'),
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

test('schema-per-tenant topology isolates player-facing stores when PLATFORM_DEFAULT_TENANT_ID is set', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for tenant topology integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const previousDefaultTenantId = process.env.PLATFORM_DEFAULT_TENANT_ID;
  const tenantId = `tenant-player-${Date.now()}`;
  const discordId = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  const rentDate = '2026-03-17';
  const target = resolveTenantDatabaseTarget({
    tenantId,
    env: {
      ...process.env,
      TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
    },
    mode: 'schema-per-tenant',
  });

  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  process.env.PLATFORM_DEFAULT_TENANT_ID = tenantId;
  await provisionTenantSchema(target);

  const cleanupSharedPrisma = createPrismaClient(process.env.DATABASE_URL);

  t.after(async () => {
    clearTenantTopologyModules();
    delete process.env.TENANT_DB_TOPOLOGY_MODE;
    delete process.env.PLATFORM_DEFAULT_TENANT_ID;
    if (previousMode) process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    if (previousDefaultTenantId) {
      process.env.PLATFORM_DEFAULT_TENANT_ID = previousDefaultTenantId;
    }
    await cleanupSharedPrisma.playerAccount
      .deleteMany({ where: { discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.userWallet
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.dailyRent
      .deleteMany({ where: { userKey: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.luckyWheelState
      .deleteMany({ where: { userId: discordId } })
      .catch(() => null);
    await cleanupSharedPrisma.$disconnect().catch(() => {});
    await dropTenantSchema(target).catch(() => null);
  });

  const {
    prismaModule,
    memoryStore,
    playerAccountStore,
    rentBikeStore,
    luckyWheelStore,
  } = loadTenantTopologyModules();
  const {
    prisma,
    getTenantScopedPrismaClient,
    disconnectAllPrismaClients,
  } = prismaModule;
  const { addCoins, getWallet } = memoryStore;
  const {
    upsertPlayerAccount,
    listPlayerAccounts,
    getPlayerDashboard,
  } = playerAccountStore;
  const { markDailyRentUsed, getDailyRent } = rentBikeStore;
  const { recordWheelSpin, getUserWheelState } = luckyWheelStore;

  try {
    const upserted = await upsertPlayerAccount({
      discordId,
      username: 'tenant-player',
      displayName: 'Tenant Player',
      isActive: true,
    });
    assert.equal(upserted.ok, true);

    const balance = await addCoins(discordId, 250, {
      reason: 'tenant-topology-proof',
      actor: 'test-suite',
    });
    assert.equal(balance, 250);

    const dashboard = await getPlayerDashboard(discordId);
    assert.equal(dashboard.ok, true);
    assert.equal(Number(dashboard.data?.wallet?.balance || 0), 250);

    const accounts = await listPlayerAccounts(50, { tenantId });
    assert.ok(accounts.some((row) => String(row?.discordId || '') === discordId));

    await markDailyRentUsed(discordId, rentDate);
    const rent = await getDailyRent(discordId, rentDate);
    assert.equal(rent?.used, true);

    const wheelResult = await recordWheelSpin(discordId, {
      id: 'tenant-proof-coins',
      label: 'Tenant Proof Coins',
      type: 'coins',
      amount: 100,
      at: new Date().toISOString(),
    });
    assert.equal(wheelResult.ok, true);
    const wheelState = await getUserWheelState(discordId);
    assert.equal(Number(wheelState?.totalSpins || 0), 1);

    const sharedAccount = await prisma.playerAccount.findUnique({
      where: { discordId },
    });
    const sharedWallet = await prisma.userWallet.findUnique({
      where: { userId: discordId },
    });
    const sharedRent = await prisma.dailyRent.findUnique({
      where: {
        userKey_date: {
          userKey: discordId,
          date: rentDate,
        },
      },
    });
    const sharedWheel = await prisma.luckyWheelState.findUnique({
      where: { userId: discordId },
    });

    assert.equal(sharedAccount, null);
    assert.equal(sharedWallet, null);
    assert.equal(sharedRent, null);
    assert.equal(sharedWheel, null);

    const scopedPrisma = getTenantScopedPrismaClient(tenantId);
    const scopedAccount = await scopedPrisma.playerAccount.findUnique({
      where: { discordId },
    });
    const scopedWallet = await scopedPrisma.userWallet.findUnique({
      where: { userId: discordId },
    });
    const scopedRent = await scopedPrisma.dailyRent.findUnique({
      where: {
        userKey_date: {
          userKey: discordId,
          date: rentDate,
        },
      },
    });
    const scopedWheel = await scopedPrisma.luckyWheelState.findUnique({
      where: { userId: discordId },
    });

    assert.equal(String(scopedAccount?.discordId || ''), discordId);
    assert.equal(Number(scopedWallet?.balance || 0), 250);
    assert.equal(Boolean(scopedRent?.used), true);
    assert.equal(Number(scopedWheel?.totalSpins || 0), 1);

    const scopedWalletView = await getWallet(discordId, { tenantId });
    assert.equal(Number(scopedWalletView?.balance || 0), 250);
  } finally {
    await disconnectAllPrismaClients().catch(() => {});
  }
});
