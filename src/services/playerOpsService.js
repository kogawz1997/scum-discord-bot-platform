const {
  getCode,
  markUsed,
  setCode,
  deleteCode,
  resetCodeUsage,
} = require('../store/redeemStore');
const { creditCoins } = require('./coinService');
const {
  createBounty,
  cancelBounty,
  listBounties,
} = require('../store/bountyStore');
const { requestRentBike } = require('./rentBikeService');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function normalizeCode(value) {
  const code = normalizeText(value).toUpperCase();
  return code || null;
}

async function redeemCodeForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const code = normalizeCode(params.code);
  const scopeOptions = {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
  if (!userId || !code) {
    return { ok: false, reason: 'invalid-input' };
  }

  const data = getCode(code, scopeOptions);
  if (!data) {
    return { ok: false, reason: 'code-not-found', code };
  }

  if (data.usedBy) {
    return { ok: false, reason: 'code-already-used', code };
  }

  const type = normalizeText(data.type).toLowerCase();
  if (type === 'coins') {
    const amount = normalizeAmount(data.amount);
    if (amount <= 0) {
      return { ok: false, reason: 'invalid-redeem-amount', code };
    }

    const credit = await creditCoins({
      userId,
      amount,
      reason: 'redeem_code_coins',
      actor: normalizeText(params.actor) || `discord:${userId}`,
      reference: code,
      meta: {
        source: normalizeText(params.source) || 'redeem-service',
      },
      ...scopeOptions,
    });
    if (!credit.ok) {
      return { ok: false, reason: 'credit-failed', code };
    }

    markUsed(code, userId, scopeOptions);
    return {
      ok: true,
      code,
      type: 'coins',
      amount,
      balance: credit.balance,
    };
  }

  markUsed(code, userId, scopeOptions);
  return {
    ok: true,
    code,
    type: type || 'item',
    itemId: normalizeText(data.itemId) || null,
  };
}

async function createBountyForUser(params = {}) {
  const createdBy = normalizeText(params.createdBy);
  const targetName = normalizeText(params.targetName);
  const amount = normalizeAmount(params.amount);
  const scopeOptions = {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
  if (!createdBy || !targetName || amount <= 0) {
    return { ok: false, reason: 'invalid-input' };
  }

  const bounty = await createBounty({
    targetName,
    amount,
    createdBy,
  }, scopeOptions);
  return { ok: true, bounty };
}

function cancelBountyForUser(params = {}) {
  const id = Number(params.id);
  const requesterId = normalizeText(params.requesterId);
  const isStaff = params.isStaff === true;
  const scopeOptions = {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
  if (!Number.isFinite(id) || id <= 0 || !requesterId) {
    return { ok: false, reason: 'invalid-input' };
  }
  return cancelBounty(id, requesterId, isStaff, scopeOptions);
}

function listActiveBountiesForUser(options = {}) {
  return listBounties(options).filter((row) => row.status === 'active');
}

function createRedeemCodeForAdmin(params = {}) {
  const code = normalizeCode(params.code);
  const type = normalizeText(params.type).toLowerCase();
  const amount = params.amount == null ? null : normalizeAmount(params.amount);
  const itemId = normalizeText(params.itemId) || null;

  if (!code || !type) {
    return { ok: false, reason: 'invalid-input' };
  }

  if (type === 'coins' && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, reason: 'invalid-amount' };
  }

  if (type === 'item' && !itemId) {
    return { ok: false, reason: 'invalid-item-id' };
  }

  return setCode(code, {
    type,
    amount,
    itemId,
  }, {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  });
}

function deleteRedeemCodeForAdmin(params = {}) {
  const code = normalizeCode(params.code);
  if (!code) {
    return { ok: false, reason: 'invalid-input' };
  }
  const removed = deleteCode(code, {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  });
  if (!removed) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, code };
}

function resetRedeemCodeUsageForAdmin(params = {}) {
  const code = normalizeCode(params.code);
  if (!code) {
    return { ok: false, reason: 'invalid-input' };
  }
  const item = resetCodeUsage(code, {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  });
  if (!item) {
    return { ok: false, reason: 'not-found' };
  }
  return { ok: true, data: item };
}

async function requestRentBikeForUser(params = {}) {
  const discordUserId = normalizeText(params.discordUserId);
  const guildId = normalizeText(params.guildId) || null;
  if (!discordUserId) {
    return { ok: false, reason: 'invalid-user-id', message: 'user id is required' };
  }
  return requestRentBike(discordUserId, guildId, {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  });
}

module.exports = {
  redeemCodeForUser,
  createBountyForUser,
  cancelBountyForUser,
  listActiveBountiesForUser,
  createRedeemCodeForAdmin,
  deleteRedeemCodeForAdmin,
  resetRedeemCodeUsageForAdmin,
  requestRentBikeForUser,
};
