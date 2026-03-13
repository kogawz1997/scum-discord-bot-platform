const { vip } = require('../config');
const { debitCoins, creditCoins } = require('./coinService');
const {
  getMembership,
  setMembership,
  removeMembership,
  listMemberships,
} = require('../store/vipStore');

function getVipPlan(planId) {
  const key = String(planId || '').trim();
  return vip.plans.find((plan) => String(plan.id) === key) || null;
}

async function buyVipForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const actor = String(params.actor || '').trim() || 'system';
  const source = String(params.source || '').trim() || 'vip-service';
  const plan = params.plan || getVipPlan(params.planId);

  if (!userId || !plan) {
    return { ok: false, reason: 'invalid-input' };
  }

  const priceCoins = Math.max(0, Number(plan.priceCoins || 0));
  const debitCoinsFn = params.debitCoinsFn || debitCoins;
  const creditCoinsFn = params.creditCoinsFn || creditCoins;
  const setMembershipFn = params.setMembershipFn || setMembership;

  const debit = await debitCoinsFn({
    userId,
    amount: priceCoins,
    reason: params.debitReason || 'vip_purchase',
    actor,
    reference: String(plan.id || '').trim() || null,
    meta: {
      source,
      planId: plan.id,
      planName: plan.name,
      durationDays: Number(plan.durationDays || 0),
    },
  });
  if (!debit.ok) {
    return {
      ok: false,
      reason: debit.reason || 'vip-debit-failed',
      plan,
      priceCoins,
      balance: Number(debit.balance || 0),
    };
  }

  try {
    const now = params.now instanceof Date ? params.now : new Date();
    const expiresAt = new Date(
      now.getTime() + Number(plan.durationDays || 0) * 24 * 60 * 60 * 1000,
    );
    const membership = setMembershipFn(userId, plan.id, expiresAt);
    if (!membership) {
      throw new Error('vip-membership-write-failed');
    }

    return {
      ok: true,
      plan,
      membership,
      balance: Number(debit.balance || 0),
    };
  } catch (error) {
    await creditCoinsFn({
      userId,
      amount: priceCoins,
      reason: params.rollbackReason || 'vip_purchase_rollback',
      actor,
      reference: String(plan.id || '').trim() || null,
      meta: {
        source,
        planId: plan.id,
        planName: plan.name,
        rollbackReason: String(error?.message || error),
      },
    }).catch(() => null);

    return {
      ok: false,
      reason: 'vip-activation-failed',
      plan,
      priceCoins,
      error: String(error?.message || error),
      rolledBack: true,
    };
  }
}

async function grantVipForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const plan = params.plan || getVipPlan(params.planId);
  const durationDays = Math.max(1, Number(params.durationDays || plan?.durationDays || 0));
  const setMembershipFn = params.setMembershipFn || setMembership;

  if (!userId || !plan || !Number.isFinite(durationDays) || durationDays <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }

  const now = params.now instanceof Date ? params.now : new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const membership = setMembershipFn(userId, plan.id, expiresAt);
  if (!membership) {
    return { ok: false, reason: 'vip-membership-write-failed' };
  }

  return {
    ok: true,
    userId,
    plan,
    durationDays,
    membership,
    expiresAt,
  };
}

async function revokeVipForUser(params = {}) {
  const userId = String(params.userId || '').trim();
  const removeMembershipFn = params.removeMembershipFn || removeMembership;
  if (!userId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const removed = removeMembershipFn(userId);
  if (!removed) {
    return { ok: false, reason: 'membership-not-found' };
  }

  return {
    ok: true,
    userId,
  };
}

module.exports = {
  getVipPlan,
  buyVipForUser,
  grantVipForUser,
  revokeVipForUser,
  getMembership,
  listMemberships,
};
