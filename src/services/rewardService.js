const {
  getWallet,
  canClaimDaily,
  claimDaily,
  canClaimWeekly,
  claimWeekly,
} = require('../store/memoryStore');
const { economy } = require('../config');
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

function resolveRewardScope(params = {}, operation = 'reward claim') {
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

function claimKey(type) {
  return String(type || '').trim().toLowerCase() === 'weekly' ? 'weekly' : 'daily';
}

function claimConfig(type) {
  const key = claimKey(type);
  if (key === 'weekly') {
    return {
      key,
      reward: normalizeAmount(economy.weeklyReward, 0),
      currencySymbol: economy.currencySymbol,
      cooldownReason: 'weekly-cooldown',
      successReason: 'weekly_claim',
      canClaimFn: canClaimWeekly,
      claimFn: claimWeekly,
      successMessage: (reward) =>
        `รับรายสัปดาห์สำเร็จ +${Number(reward).toLocaleString()} ${economy.currencySymbol}`,
    };
  }
  return {
    key,
    reward: normalizeAmount(economy.dailyReward, 0),
    currencySymbol: economy.currencySymbol,
    cooldownReason: 'daily-cooldown',
    successReason: 'daily_claim',
    canClaimFn: canClaimDaily,
    claimFn: claimDaily,
    successMessage: (reward) =>
      `รับรายวันสำเร็จ +${Number(reward).toLocaleString()} ${economy.currencySymbol}`,
  };
}

async function checkRewardClaimForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const type = claimKey(params.type);
  if (!userId) {
    return { ok: false, reason: 'invalid-user-id' };
  }

  const configRow = claimConfig(type);
  const scopeOptions = resolveRewardScope(params, 'check reward claim');
  const check = await configRow.canClaimFn(userId, scopeOptions);
  if (check?.ok) {
    return {
      ok: true,
      type,
      reward: configRow.reward,
      currencySymbol: configRow.currencySymbol,
      remainingMs: 0,
    };
  }

  const wallet = await getWallet(userId, scopeOptions);
  return {
    ok: false,
    reason: configRow.cooldownReason,
    type,
    reward: configRow.reward,
    currencySymbol: configRow.currencySymbol,
    remainingMs: normalizeAmount(check?.remainingMs, 0),
    balance: normalizeAmount(wallet?.balance, 0),
  };
}

async function claimRewardForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const type = claimKey(params.type);
  if (!userId) {
    return { ok: false, reason: 'invalid-user-id' };
  }

  const configRow = claimConfig(type);
  const scopeOptions = resolveRewardScope(params, 'claim reward');
  const check = await checkRewardClaimForUser({
    userId,
    type,
    ...scopeOptions,
  });
  if (!check.ok) {
    return check;
  }

  const balance = await configRow.claimFn(userId, scopeOptions);
  return {
    ok: true,
    type,
    reward: configRow.reward,
    currencySymbol: configRow.currencySymbol,
    balance: normalizeAmount(balance, 0),
    reason: configRow.successReason,
    message: configRow.successMessage(configRow.reward),
  };
}

module.exports = {
  checkRewardClaimForUser,
  claimRewardForUser,
};
