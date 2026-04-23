const { updateStatus } = require('../store/scumStore');

function normalizeOptionalInt(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function buildScopeOptions(params = {}, operation = 'scum status update') {
  return {
    tenantId: normalizeText(params.tenantId),
    defaultTenantId: normalizeText(params.defaultTenantId),
    env: params.env,
    operation,
  };
}

function updateScumStatusForAdmin(params = {}) {
  const onlinePlayers = normalizeOptionalInt(params.onlinePlayers);
  const maxPlayers = normalizeOptionalInt(params.maxPlayers);
  const pingMs = normalizeOptionalInt(params.pingMs);
  const uptimeMinutes = normalizeOptionalInt(params.uptimeMinutes);
  const scopeOptions = buildScopeOptions(params);

  if (
    onlinePlayers == null
    && maxPlayers == null
    && pingMs == null
    && uptimeMinutes == null
  ) {
    return { ok: false, reason: 'invalid-input' };
  }

  updateStatus({
    ...(onlinePlayers != null ? { onlinePlayers } : {}),
    ...(maxPlayers != null ? { maxPlayers } : {}),
    ...(pingMs != null ? { pingMs } : {}),
    ...(uptimeMinutes != null ? { uptimeMinutes } : {}),
  }, scopeOptions);

  return {
    ok: true,
    data: {
      onlinePlayers,
      maxPlayers,
      pingMs,
      uptimeMinutes,
    },
  };
}

module.exports = {
  updateScumStatusForAdmin,
};
