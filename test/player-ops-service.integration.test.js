const test = require('node:test');
const assert = require('node:assert/strict');

const { getWallet } = require('../src/store/memoryStore');
const { setCode, deleteCode } = require('../src/store/redeemStore');
const {
  redeemCodeForUser,
  createBountyForUser,
  cancelBountyForUser,
  listActiveBountiesForUser,
  createRedeemCodeForAdmin,
  deleteRedeemCodeForAdmin,
  resetRedeemCodeUsageForAdmin,
  requestRentBikeForUser,
} = require('../src/services/playerOpsService');

function randomDigits(length) {
  let out = '';
  while (out.length < length) {
    out += String(Math.floor(Math.random() * 10));
  }
  return out.slice(0, length);
}

const TEST_TENANT_ID = 'tenant-player-ops-integration';

function scope() {
  return { tenantId: TEST_TENANT_ID };
}

test('playerOps service: redeem + bounty + rentbike input guard', async () => {
  const userId = randomDigits(18);
  const code = `T${Date.now()}${Math.floor(Math.random() * 1000)}`.toUpperCase();

  try {
    const seed = setCode(code, {
      type: 'coins',
      amount: 321,
    }, scope());
    assert.equal(seed.ok, true);

    const beforeWallet = await getWallet(userId, scope());
    const redeemed = await redeemCodeForUser({
      userId,
      code,
      actor: `test:${userId}`,
      source: 'player-ops-test',
      ...scope(),
    });
    assert.equal(redeemed.ok, true);
    assert.equal(redeemed.type, 'coins');
    assert.equal(redeemed.amount, 321);

    const afterWallet = await getWallet(userId, scope());
    assert.equal(afterWallet.balance, beforeWallet.balance + 321);

    const redeemedAgain = await redeemCodeForUser({
      userId,
      code,
      actor: `test:${userId}`,
      source: 'player-ops-test',
      ...scope(),
    });
    assert.equal(redeemedAgain.ok, false);
    assert.equal(redeemedAgain.reason, 'code-already-used');

    const bountyCreated = await createBountyForUser({
      createdBy: userId,
      targetName: 'TargetPlayer',
      amount: 777,
      ...scope(),
    });
    assert.equal(bountyCreated.ok, true);
    assert.ok(bountyCreated.bounty?.id);

    const activeRows = listActiveBountiesForUser(scope());
    assert.ok(
      activeRows.some((row) => Number(row.id) === Number(bountyCreated.bounty.id)),
    );

    const bountyCancelled = cancelBountyForUser({
      id: bountyCreated.bounty.id,
      requesterId: userId,
      isStaff: false,
      ...scope(),
    });
    assert.equal(bountyCancelled.ok, true);
    assert.equal(String(bountyCancelled.bounty.status), 'cancelled');

    const invalidRent = await requestRentBikeForUser({
      discordUserId: '',
    });
    assert.equal(invalidRent.ok, false);
    assert.equal(invalidRent.reason, 'invalid-user-id');
  } finally {
    deleteCode(code, scope());
  }
});

test('playerOps admin helpers validate and mutate redeem codes', async () => {
  const code = `ADMIN${Date.now()}${Math.floor(Math.random() * 1000)}`.toUpperCase();

  try {
    const created = createRedeemCodeForAdmin({
      code,
      type: 'coins',
      amount: 123,
      ...scope(),
    });
    assert.equal(created.ok, true);
    assert.equal(String(created.code || ''), code);

    const reset = resetRedeemCodeUsageForAdmin({ code, ...scope() });
    assert.equal(reset.ok, true);
    assert.equal(String(reset.data?.usedBy || ''), '');

    const removed = deleteRedeemCodeForAdmin({ code, ...scope() });
    assert.equal(removed.ok, true);
    assert.equal(String(removed.code || ''), code);

    const removedAgain = deleteRedeemCodeForAdmin({ code, ...scope() });
    assert.equal(removedAgain.ok, false);
    assert.equal(removedAgain.reason, 'not-found');
  } finally {
    deleteCode(code, scope());
  }
});
