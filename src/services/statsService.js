const { addKill, addDeath, addPlaytimeMinutes } = require('../store/statsStore');

function normalizeUserId(value) {
  return String(value || '').trim();
}

function normalizeAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function addKillsForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const amount = normalizeAmount(params.amount);
  if (!userId || amount == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addKill(userId, amount) };
}

function addDeathsForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const amount = normalizeAmount(params.amount);
  if (!userId || amount == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addDeath(userId, amount) };
}

function addPlaytimeForUser(params = {}) {
  const userId = normalizeUserId(params.userId);
  const minutes = normalizeAmount(params.minutes);
  if (!userId || minutes == null) return { ok: false, reason: 'invalid-input' };
  return { ok: true, stat: addPlaytimeMinutes(userId, minutes) };
}

module.exports = {
  addKillsForUser,
  addDeathsForUser,
  addPlaytimeForUser,
};
