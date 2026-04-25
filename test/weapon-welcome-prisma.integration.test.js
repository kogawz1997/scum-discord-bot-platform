const test = require('node:test');
const assert = require('node:assert/strict');

const {
  recordWeaponKill,
  flushWeaponStatsStoreWrites,
} = require('../src/store/weaponStatsStore');
const {
  claim,
  revokeClaim,
  flushWelcomePackStoreWrites,
} = require('../src/store/welcomePackStore');
const { prisma, getTenantScopedPrismaClient } = require('../src/prisma');

function uniqueText(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const TEST_TENANT_ID = 'tenant-weapon-welcome-integration';

function scope() {
  return { tenantId: TEST_TENANT_ID };
}

test('weaponStats and welcomePack stores write through to prisma', async () => {
  const weapon = uniqueText('weapon');
  const userId = uniqueText('welcome-user');
  const db = getTenantScopedPrismaClient(TEST_TENANT_ID);

  try {
    recordWeaponKill({
      weapon,
      distance: 87,
      killer: 'killer-a',
    });
    recordWeaponKill({
      weapon,
      distance: 120,
      killer: 'killer-b',
    });
    await flushWeaponStatsStoreWrites();

    let row = await prisma.weaponStat.findUnique({ where: { weapon } });
    assert.ok(row);
    assert.equal(row.kills, 2);
    assert.equal(Number(row.longestDistance), 120);
    assert.equal(row.recordHolder, 'killer-b');

    const firstClaim = claim(userId, scope());
    const secondClaim = claim(userId, scope());
    assert.equal(firstClaim, true);
    assert.equal(secondClaim, false);
    await flushWelcomePackStoreWrites(scope());

    let claimRow = await db.welcomeClaim.findUnique({
      where: { userId },
    });
    assert.ok(claimRow);

    const revoked = revokeClaim(userId, scope());
    assert.equal(revoked, true);
    await flushWelcomePackStoreWrites(scope());

    claimRow = await db.welcomeClaim.findUnique({
      where: { userId },
    });
    assert.equal(claimRow, null);
  } finally {
    await prisma.weaponStat.deleteMany({ where: { weapon } });
    await db.welcomeClaim.deleteMany({ where: { userId } });
  }
});
