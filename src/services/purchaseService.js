const {
  findPurchaseByCode,
  setPurchaseStatusByCode,
  listPurchaseStatusHistory,
} = require('../store/memoryStore');
const { creditCoins } = require('./coinService');
const {
  normalizePurchaseStatus,
  validatePurchaseStatusTransition,
  listAllowedPurchaseTransitions,
  listKnownPurchaseStatuses,
} = require('./purchaseStateMachine');
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizeText(value) {
  return String(value || '').trim();
}

function resolvePurchaseScope(params = {}, operation = 'purchase status operation') {
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

async function updatePurchaseStatusForActor(params = {}) {
  const code = normalizeText(params.code);
  const targetStatus = normalizePurchaseStatus(params.status);
  const actor = normalizeText(params.actor) || 'system';
  const reason = normalizeText(params.reason) || 'manual-status-update';
  const historyLimit = Math.max(1, Math.min(100, Number(params.historyLimit || 20)));

  if (!code || !targetStatus) {
    return {
      ok: false,
      reason: 'invalid-input',
      knownStatuses: listKnownPurchaseStatuses(),
    };
  }
  const scope = resolvePurchaseScope(params, 'update purchase status');

  const purchase = await findPurchaseByCode(code, {
    tenantId: scope.tenantId,
  });
  if (!purchase) {
    return { ok: false, reason: 'not-found' };
  }

  const currentStatus = normalizePurchaseStatus(purchase.status);
  const validation = validatePurchaseStatusTransition(currentStatus, targetStatus, {
    force: params.force === true,
  });
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      code,
      currentStatus,
      targetStatus,
      allowedTransitions: listAllowedPurchaseTransitions(currentStatus),
      knownStatuses: listKnownPurchaseStatuses(),
    };
  }

  let updated = null;
  try {
    updated = await setPurchaseStatusByCode(code, targetStatus, {
      force: params.force === true,
      actor,
      reason,
      tenantId: scope.tenantId || purchase?.tenantId || null,
      meta: params.meta && typeof params.meta === 'object' ? params.meta : {},
      recordIfSame: params.recordIfSame === true,
    });
  } catch (error) {
    return {
      ok: false,
      reason: 'update-failed',
      error: String(error?.message || error),
      code,
      currentStatus,
      targetStatus,
    };
  }

  if (!updated) {
    return { ok: false, reason: 'not-found' };
  }

  const history = await listPurchaseStatusHistory(updated.code, historyLimit, {
    tenantId: scope.tenantId || updated?.tenantId || purchase?.tenantId || null,
  });
  return {
    ok: true,
    purchase: updated,
    history,
    currentStatus,
    targetStatus,
  };
}

async function refundPurchaseForActor(params = {}) {
  const code = normalizeText(params.code);
  const actor = normalizeText(params.actor) || 'system';
  const reason = normalizeText(params.reason) || 'refund-command';

  if (!code) {
    return { ok: false, reason: 'invalid-input' };
  }
  const scope = resolvePurchaseScope(params, 'refund purchase');

  const purchase = await findPurchaseByCode(code, {
    tenantId: scope.tenantId,
  });
  if (!purchase) {
    return { ok: false, reason: 'not-found' };
  }

  const currentStatus = normalizePurchaseStatus(purchase.status);
  if (currentStatus === 'refunded') {
    return {
      ok: false,
      reason: 'already-refunded',
      purchase,
      currentStatus,
    };
  }
  if (currentStatus === 'delivered') {
    return {
      ok: false,
      reason: 'already-delivered',
      purchase,
      currentStatus,
    };
  }

  const statusResult = await updatePurchaseStatusForActor({
    code,
    status: 'refunded',
    actor,
    reason,
    meta: params.meta && typeof params.meta === 'object' ? params.meta : {},
    historyLimit: Number(params.historyLimit || 20),
    tenantId: scope.tenantId || purchase?.tenantId || null,
    defaultTenantId: scope.defaultTenantId,
    env: scope.env,
  });
  if (!statusResult.ok) {
    return statusResult;
  }

  const refundResult = await creditCoins({
    userId: purchase.userId,
    amount: Number(purchase.price || 0),
    reason: params.creditReason || 'refund_credit',
    reference: purchase.code,
    actor,
      meta: {
        source: normalizeText(params.source) || 'refund-service',
        ...(params.meta && typeof params.meta === 'object' ? params.meta : {}),
      },
      tenantId: scope.tenantId || purchase?.tenantId || null,
      defaultTenantId: scope.defaultTenantId,
      env: scope.env,
    });

  if (!refundResult.ok) {
    return {
      ok: false,
      reason: 'refund-credit-failed',
      purchase: statusResult.purchase,
      history: statusResult.history,
      currentStatus,
      targetStatus: 'refunded',
    };
  }

  return {
    ok: true,
    purchase: statusResult.purchase,
    history: statusResult.history,
    currentStatus,
    targetStatus: 'refunded',
    balance: Number(refundResult.balance || 0),
    amount: Number(purchase.price || 0),
  };
}

module.exports = {
  updatePurchaseStatusForActor,
  refundPurchaseForActor,
};
