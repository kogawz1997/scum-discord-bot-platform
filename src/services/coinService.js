const {
  addCoins,
  removeCoins,
  setCoins,
  getWallet,
} = require('../store/memoryStore');
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function resolveCoinScope(params = {}, operation = 'coin operation') {
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

async function creditCoins(params = {}) {
  const userId = String(params.userId || '').trim();
  const amount = normalizeAmount(params.amount);
  if (!userId || amount <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scope = resolveCoinScope(params, 'credit coins');

  const balance = await addCoins(userId, amount, {
    reason: params.reason || 'credit',
    reference: normalizeText(params.reference),
    actor: normalizeText(params.actor) || 'system',
    meta: params.meta && typeof params.meta === 'object' ? params.meta : null,
    tenantId: scope.tenantId,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  return {
    ok: true,
    userId,
    amount,
    balance,
  };
}

async function debitCoins(params = {}) {
  const userId = String(params.userId || '').trim();
  const amount = normalizeAmount(params.amount);
  if (!userId || amount <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scope = resolveCoinScope(params, 'debit coins');

  const wallet = await getWallet(userId, {
    tenantId: scope.tenantId,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  if (wallet.balance < amount) {
    return {
      ok: false,
      reason: 'insufficient-balance',
      userId,
      amount,
      balance: wallet.balance,
    };
  }

  const balance = await removeCoins(userId, amount, {
    reason: params.reason || 'debit',
    reference: normalizeText(params.reference),
    actor: normalizeText(params.actor) || 'system',
    meta: params.meta && typeof params.meta === 'object' ? params.meta : null,
    tenantId: scope.tenantId,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  return {
    ok: true,
    userId,
    amount,
    balance,
  };
}

async function setCoinsExact(params = {}) {
  const userId = String(params.userId || '').trim();
  const amount = normalizeAmount(params.amount);
  if (!userId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scope = resolveCoinScope(params, 'set coin balance');

  const balance = await setCoins(userId, amount, {
    reason: params.reason || 'set',
    reference: normalizeText(params.reference),
    actor: normalizeText(params.actor) || 'system',
    meta: params.meta && typeof params.meta === 'object' ? params.meta : null,
    tenantId: scope.tenantId,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  return {
    ok: true,
    userId,
    amount,
    balance,
  };
}

async function transferCoins(params = {}) {
  const fromUserId = String(params.fromUserId || '').trim();
  const toUserId = String(params.toUserId || '').trim();
  const amount = normalizeAmount(params.amount);
  if (!fromUserId || !toUserId || fromUserId === toUserId || amount <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scope = resolveCoinScope(params, 'transfer coins');

  const outResult = await debitCoins({
    userId: fromUserId,
    amount,
    reason: params.outReason || 'transfer_out',
    actor: params.actor,
    reference: params.reference,
    meta: {
      source: params.source || 'transfer',
      toUserId,
      ...(params.meta && typeof params.meta === 'object' ? params.meta : {}),
    },
    tenantId: scope.tenantId,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  if (!outResult.ok) return outResult;

  try {
    const inResult = await creditCoins({
      userId: toUserId,
      amount,
      reason: params.inReason || 'transfer_in',
      actor: params.actor,
      reference: params.reference,
      meta: {
        source: params.source || 'transfer',
        fromUserId,
        ...(params.meta && typeof params.meta === 'object' ? params.meta : {}),
      },
      tenantId: scope.tenantId,
      defaultTenantId: scope.defaultTenantId,
      env: scope.env,
    });
    if (!inResult.ok) {
      throw new Error(inResult.reason || 'credit-failed');
    }
    return {
      ok: true,
      amount,
      fromUserId,
      toUserId,
      fromBalance: outResult.balance,
      toBalance: inResult.balance,
    };
  } catch (error) {
    await creditCoins({
      userId: fromUserId,
      amount,
      reason: 'transfer_rollback',
      actor: params.actor || 'system',
      reference: params.reference,
      meta: {
        source: params.source || 'transfer',
        toUserId,
        rollbackReason: String(error?.message || error),
      },
      tenantId: scope.tenantId,
      defaultTenantId: scope.defaultTenantId,
      env: scope.env,
    }).catch(() => null);
    return {
      ok: false,
      reason: 'transfer-failed',
      error: String(error?.message || error),
    };
  }
}

module.exports = {
  creditCoins,
  debitCoins,
  setCoinsExact,
  transferCoins,
};
