const {
  hasClaimed,
  claim,
  revokeClaim,
  clearClaims,
  listClaimed,
} = require('../store/welcomePackStore');
const { creditCoins } = require('./coinService');
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAmount(value, fallback = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.trunc(amount));
}

function buildScopeOptions(params = {}, operation = 'welcome pack') {
  const env = params.env;
  const explicitTenantId = normalizeText(params.tenantId) || normalizeText(params.defaultTenantId) || null;
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId = explicitTenantId || (runtime.strict ? (resolveDefaultTenantId({ env }) || null) : null);
  const scope = assertTenantDbIsolationScope({
    tenantId,
    operation,
    env,
  });
  return {
    tenantId: scope.tenantId,
    defaultTenantId: scope.tenantId,
    env,
  };
}

async function claimWelcomePackForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const actor = normalizeText(params.actor) || `discord:${userId}`;
  const source = normalizeText(params.source) || 'welcome-pack-service';
  const amount = normalizeAmount(params.amount, 0);
  const hasClaimedFn = params.hasClaimedFn || hasClaimed;
  const claimFn = params.claimFn || claim;
  const revokeClaimFn = params.revokeClaimFn || revokeClaim;
  const creditCoinsFn = params.creditCoinsFn || creditCoins;
  const scopeOptions = buildScopeOptions(params, 'claim welcome pack');

  if (!userId || amount <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }

  if (hasClaimedFn(userId, scopeOptions)) {
    return { ok: false, reason: 'already-claimed' };
  }

  const claimed = claimFn(userId, scopeOptions);
  if (!claimed) {
    return { ok: false, reason: 'already-claimed' };
  }

  try {
    const credit = await creditCoinsFn({
      userId,
      amount,
      reason: params.creditReason || 'welcome_pack_claim',
      actor,
      reference: normalizeText(params.reference),
      ...scopeOptions,
      meta: {
        source,
        ...(params.meta && typeof params.meta === 'object' ? params.meta : {}),
      },
    });
    if (!credit.ok) {
      throw new Error(credit.reason || 'credit-failed');
    }

    return {
      ok: true,
      userId,
      amount,
      balance: Number(credit.balance || 0),
    };
  } catch (error) {
    revokeClaimFn(userId, scopeOptions);
    return {
      ok: false,
      reason: 'welcome-pack-credit-failed',
      userId,
      amount,
      error: String(error?.message || error),
      rolledBack: true,
    };
  }
}

function revokeWelcomePackClaimForAdmin(params = {}) {
  const userId = normalizeText(params.userId);
  if (!userId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const removed = revokeClaim(userId, buildScopeOptions(params, 'revoke welcome pack'));
  if (!removed) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, userId };
}

function clearWelcomePackClaimsForAdmin(params = {}) {
  const scopeOptions = buildScopeOptions(params, 'clear welcome pack claims');
  const clearedCount = listClaimed(scopeOptions).length;
  clearClaims(scopeOptions);
  return {
    ok: true,
    cleared: true,
    clearedCount,
  };
}

module.exports = {
  claimWelcomePackForUser,
  revokeWelcomePackClaimForAdmin,
  clearWelcomePackClaimsForAdmin,
};
