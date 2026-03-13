const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  claimWelcomePackForUser,
  revokeWelcomePackClaimForAdmin,
  clearWelcomePackClaimsForAdmin,
} = require('../src/services/welcomePackService');
const {
  hasClaimed,
  revokeClaim,
  flushWelcomePackStoreWrites,
} = require('../src/store/welcomePackStore');
const { awardWheelRewardForUser } = require('../src/services/wheelService');
const { getUserWheelState } = require('../src/store/luckyWheelStore');
const {
  setLink,
  unlinkByUserId,
  flushLinkStoreWrites,
} = require('../src/store/linkStore');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('claimWelcomePackForUser rolls claim back when coin credit fails', async () => {
  const userId = uniqueId('welcome-user');

  try {
    const result = await claimWelcomePackForUser({
      userId,
      amount: 1500,
      actor: 'test-suite',
      source: 'welcome-pack-test',
      creditCoinsFn: async () => {
        throw new Error('forced-credit-fail');
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'welcome-pack-credit-failed');
    assert.equal(result.rolledBack, true);
    assert.equal(hasClaimed(userId), false);

    await flushWelcomePackStoreWrites();
    const claimRow = await prisma.welcomeClaim.findUnique({
      where: { userId },
    });
    assert.equal(claimRow, null);
  } finally {
    revokeClaim(userId);
    await flushWelcomePackStoreWrites();
    await prisma.welcomeClaim.deleteMany({ where: { userId } });
    await prisma.walletLedger.deleteMany({ where: { userId } });
    await prisma.userWallet.deleteMany({ where: { userId } });
  }
});

test('awardWheelRewardForUser rolls wheel state back when coin credit fails', async () => {
  const userId = uniqueId('wheel-coins-user');

  try {
    const result = await awardWheelRewardForUser({
      userId,
      reward: {
        id: 'coins-test',
        label: 'Coins x100',
        type: 'coins',
        amount: 100,
      },
      actor: 'test-suite',
      source: 'wheel-service-test',
      creditCoinsFn: async () => {
        throw new Error('forced-credit-fail');
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'wheel-credit-failed');
    assert.equal(result.rolledBack, true);

    const state = await getUserWheelState(userId, 10);
    assert.equal(Number(state?.totalSpins || 0), 0);
    assert.equal(Array.isArray(state?.history) ? state.history.length : 0, 0);
  } finally {
    await prisma.luckyWheelState.deleteMany({ where: { userId } });
    await prisma.walletLedger.deleteMany({ where: { userId } });
    await prisma.userWallet.deleteMany({ where: { userId } });
  }
});

test('awardWheelRewardForUser rolls wheel state back when item queue creation fails', async () => {
  const userId = uniqueId('wheel-item-user');

  try {
    const link = setLink({
      steamId: '76561190000000001',
      userId,
      inGameName: 'WheelTester',
    });
    assert.equal(link?.ok, true);
    await flushLinkStoreWrites();

    const result = await awardWheelRewardForUser({
      userId,
      reward: {
        id: 'item-test',
        label: 'M1911',
        type: 'item',
        itemId: 'Weapon_M1911',
        gameItemId: 'Weapon_M1911',
        quantity: 1,
      },
      actor: 'test-suite',
      source: 'wheel-service-test',
      createQueuedPurchaseFn: async () => {
        throw new Error('forced-item-fail');
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'wheel-item-grant-failed');
    assert.equal(result.rolledBack, true);

    const state = await getUserWheelState(userId, 10);
    assert.equal(Number(state?.totalSpins || 0), 0);
    assert.equal(Array.isArray(state?.history) ? state.history.length : 0, 0);
  } finally {
    unlinkByUserId(userId);
    await flushLinkStoreWrites();
    await prisma.luckyWheelState.deleteMany({ where: { userId } });
    await prisma.link.deleteMany({ where: { userId } }).catch(() => null);
    await prisma.playerAccount.deleteMany({ where: { discordId: userId } });
  }
});

test('welcome pack admin helpers revoke and clear claims', async () => {
  const userIdA = uniqueId('welcome-admin-a');
  const userIdB = uniqueId('welcome-admin-b');

  try {
    const claimedA = await claimWelcomePackForUser({
      userId: userIdA,
      amount: 250,
      actor: 'test-suite',
      source: 'welcome-admin-helper-test',
    });
    const claimedB = await claimWelcomePackForUser({
      userId: userIdB,
      amount: 250,
      actor: 'test-suite',
      source: 'welcome-admin-helper-test',
    });
    assert.equal(claimedA.ok, true);
    assert.equal(claimedB.ok, true);

    const revoked = revokeWelcomePackClaimForAdmin({ userId: userIdA });
    assert.equal(revoked.ok, true);
    assert.equal(hasClaimed(userIdA), false);
    assert.equal(hasClaimed(userIdB), true);

    const cleared = clearWelcomePackClaimsForAdmin();
    assert.equal(cleared.ok, true);
    assert.equal(cleared.cleared, true);
    assert.ok(Number(cleared.clearedCount || 0) >= 1);
    assert.equal(hasClaimed(userIdB), false);
  } finally {
    revokeClaim(userIdA);
    revokeClaim(userIdB);
    await flushWelcomePackStoreWrites();
    await prisma.welcomeClaim.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.walletLedger.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
    await prisma.userWallet.deleteMany({
      where: { userId: { in: [userIdA, userIdB] } },
    });
  }
});
