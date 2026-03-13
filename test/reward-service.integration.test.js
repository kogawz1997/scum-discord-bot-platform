const test = require('node:test');
const assert = require('node:assert/strict');

const { prisma } = require('../src/prisma');
const {
  checkRewardClaimForUser,
  claimRewardForUser,
} = require('../src/services/rewardService');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function cleanupWallet(userId) {
  await prisma.walletLedger.deleteMany({ where: { userId } });
  await prisma.userWallet.deleteMany({ where: { userId } });
}

test('rewardService claims daily reward and then reports cooldown', async () => {
  const userId = uniqueId('daily-reward-user');

  try {
    const before = await checkRewardClaimForUser({ userId, type: 'daily' });
    assert.equal(before.ok, true);

    const claimed = await claimRewardForUser({ userId, type: 'daily' });
    assert.equal(claimed.ok, true);
    assert.equal(claimed.reason, 'daily_claim');
    assert.ok(Number(claimed.balance || 0) >= Number(claimed.reward || 0));

    const after = await checkRewardClaimForUser({ userId, type: 'daily' });
    assert.equal(after.ok, false);
    assert.equal(after.reason, 'daily-cooldown');
    assert.ok(Number(after.remainingMs || 0) > 0);
  } finally {
    await cleanupWallet(userId);
  }
});

test('rewardService claims weekly reward and then reports cooldown', async () => {
  const userId = uniqueId('weekly-reward-user');

  try {
    const before = await checkRewardClaimForUser({ userId, type: 'weekly' });
    assert.equal(before.ok, true);

    const claimed = await claimRewardForUser({ userId, type: 'weekly' });
    assert.equal(claimed.ok, true);
    assert.equal(claimed.reason, 'weekly_claim');
    assert.ok(Number(claimed.balance || 0) >= Number(claimed.reward || 0));

    const after = await checkRewardClaimForUser({ userId, type: 'weekly' });
    assert.equal(after.ok, false);
    assert.equal(after.reason, 'weekly-cooldown');
    assert.ok(Number(after.remainingMs || 0) > 0);
  } finally {
    await cleanupWallet(userId);
  }
});
