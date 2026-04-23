const { addKill, addDeath, addPlaytimeMinutes } = require('../store/statsStore');

function normalizeUserId(value) {
  return String(value || '').trim();
}

function normalizeAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function buildScopeOptions(params = {}, operation = 'stats operation') {
  return {
    tenantId: String(params.tenantId || '').trim() || null,
    defaultTenantId: String(params.defaultTenantId || '').trim() || null,
    serverId: String(params.serverId || '').trim() || null,
    env: params.env,
    operation,
  };
}

function addKillsForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const amount = normalizeAmount(params.amount);
  if (!userId || amount == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addKill(userId, amount, buildScopeOptions(params, 'add player kills')) };
}

function addDeathsForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const amount = normalizeAmount(params.amount);
  if (!userId || amount == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addDeath(userId, amount, buildScopeOptions(params, 'add player deaths')) };
}

function addPlaytimeForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const minutes = normalizeAmount(params.minutes);
  if (!userId || minutes == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addPlaytimeMinutes(userId, minutes, buildScopeOptions(params, 'add player playtime')) };
}

module.exports = {
  addKillsForUser,
  addDeathsForUser,
  addPlaytimeForUser,
};
