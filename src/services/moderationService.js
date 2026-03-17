const { addPunishment } = require('../store/moderationStore');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeMinutes(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function buildScopeOptions(params = {}) {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
  };
}

function createPunishmentEntry(params = {}) {
  const userId = normalizeText(params.userId);
  const type = normalizeText(params.type);
  const reason = normalizeText(params.reason);
  const staffId = normalizeText(params.staffId) || 'system';
  const durationMinutes = normalizeMinutes(params.durationMinutes);

  if (!userId || !type || !reason) {
    return { ok: false, reason: 'invalid-input' };
  }

  const entry = addPunishment(
    userId,
    type,
    reason,
    staffId,
    durationMinutes,
    buildScopeOptions(params),
  );
  if (!entry) {
    return { ok: false, reason: 'create-failed' };
  }

  return {
    ok: true,
    entry,
  };
}

module.exports = {
  createPunishmentEntry,
};
