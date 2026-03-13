const { updateStatus } = require('../store/scumStore');

function normalizeOptionalInt(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function updateScumStatusForAdmin(params = {}) {
  const onlinePlayers = normalizeOptionalInt(params.onlinePlayers);
  const maxPlayers = normalizeOptionalInt(params.maxPlayers);
  const pingMs = normalizeOptionalInt(params.pingMs);
  const uptimeMinutes = normalizeOptionalInt(params.uptimeMinutes);

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
  });

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
