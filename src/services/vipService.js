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

function normalizeText(value) {
  return String(value || '').trim();
}

function buildScopeOptions(params = {}) {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
    operation: normalizeText(params.operation) || 'vip membership operation',
  };
}

async function buyVipForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const actor = normalizeText(params.actor) || 'system';
  const source = normalizeText(params.source) || 'vip-service';
  const plan = params.plan || getVipPlan(params.planId);
  const scopeOptions = buildScopeOptions(params);

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
    ...scopeOptions,
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
    const membership = setMembershipFn(userId, plan.id, expiresAt, scopeOptions);
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
      ...scopeOptions,
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
  const userId = normalizeText(params.userId);
  const plan = params.plan || getVipPlan(params.planId);
  const durationDays = Math.max(1, Number(params.durationDays || plan?.durationDays || 0));
  const setMembershipFn = params.setMembershipFn || setMembership;
  const scopeOptions = buildScopeOptions(params);

  if (!userId || !plan || !Number.isFinite(durationDays) || durationDays <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }

  const now = params.now instanceof Date ? params.now : new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const membership = setMembershipFn(userId, plan.id, expiresAt, scopeOptions);
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
  const userId = normalizeText(params.userId);
  const removeMembershipFn = params.removeMembershipFn || removeMembership;
  const scopeOptions = buildScopeOptions(params);
  if (!userId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const removed = removeMembershipFn(userId, scopeOptions);
  if (!removed) {
    return { ok: false, reason: 'membership-not-found' };
  }

  return {
    ok: true,
    userId,
  };
}

function getMembershipSnapshot(userId, options = {}) {
  return getMembership(userId, buildScopeOptions(options));
}

function listMembershipSnapshots(options = {}) {
  return listMemberships(buildScopeOptions(options));
}

module.exports = {
  getVipPlan,
  buyVipForUser,
  grantVipForUser,
  revokeVipForUser,
  getMembership: getMembershipSnapshot,
  listMemberships: listMembershipSnapshots,
};
