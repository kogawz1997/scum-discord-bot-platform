const {
  normalizeSteamId,
  getLinkBySteamId,
  getLinkByUserId,
  setLink,
  unlinkByUserId,
  unlinkBySteamId,
} = require('../store/linkStore');
const {
  clearPlatformPlayerSteamLink,
  ensurePlatformPlayerIdentity,
  getPlatformUserIdentitySummary,
} = require('./platformIdentityService');
const {
  listServerDiscordLinks,
} = require('../data/repositories/controlPlaneRegistryRepository');
const { resolveDefaultTenantId } = require('../prisma');
const { assertTenantDbIsolationScope, getTenantDbIsolationRuntime } = require('../utils/tenantDbIsolation');

function normalizeText(value) {
  return String(value || '').trim();
}

function resolveTenantIdFromGuildId(guildId) {
  const normalizedGuildId = normalizeText(guildId);
  if (!normalizedGuildId) return null;
  const rows = listServerDiscordLinks({
    guildId: normalizedGuildId,
    allowGlobal: true,
  });
  const tenantIds = [...new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => normalizeText(row?.tenantId))
      .filter(Boolean),
  )];
  return tenantIds.length === 1 ? tenantIds[0] : null;
}

function resolveTenantScope(params = {}, operation = 'steam link operation') {
  const env = params.env;
  const explicitTenantId = normalizeText(params.tenantId) || normalizeText(params.defaultTenantId) || null;
  const guildTenantId = explicitTenantId ? null : resolveTenantIdFromGuildId(params.guildId);
  const runtime = getTenantDbIsolationRuntime(env);
  const tenantId =
    explicitTenantId
    || guildTenantId
    || (runtime.strict ? (resolveDefaultTenantId({ env }) || null) : null);
  const scope = assertTenantDbIsolationScope({
    tenantId,
    operation,
    env,
  });
  return {
    tenantId: scope.tenantId,
    defaultTenantId: scope.tenantId,
    guildId: normalizeText(params.guildId) || null,
    env,
  };
}

async function bindSteamLinkForUser(params = {}) {
  const userId = normalizeText(params.userId);
  const steamId = normalizeSteamId(params.steamId);
  const inGameName = normalizeText(params.inGameName) || null;
  const allowReplace = params.allowReplace === true;
  const allowSteamReuse = params.allowSteamReuse === true;

  if (!userId || !steamId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const tenantScope = resolveTenantScope(params, 'bind steam link');
  const tenantId = tenantScope.tenantId;

  const current = getLinkByUserId(userId, tenantScope);
  if (current?.steamId === steamId) {
    return {
      ok: true,
      alreadyLinked: true,
      link: current,
    };
  }

  if (current?.steamId && current.steamId !== steamId && !allowReplace) {
    return {
      ok: false,
      reason: 'user-already-linked',
      current,
    };
  }

  const existing = getLinkBySteamId(steamId, tenantScope);
  if (existing && existing.userId !== userId && !allowSteamReuse) {
    return {
      ok: false,
      reason: 'steam-already-linked',
      existing,
    };
  }

  const result = setLink({
    steamId,
    userId,
    inGameName,
  }, tenantScope);
  if (!result.ok) {
    return result;
  }

  let identity = null;
  let identitySummary = null;
  try {
    identity = await ensurePlatformPlayerIdentity({
      provider: 'steam',
      providerUserId: steamId,
      tenantId,
      role: 'player',
      membershipType: tenantId ? 'tenant' : 'player',
      discordUserId: userId,
      steamId,
      inGameName,
      verificationState: 'steam_linked',
      linkedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      identityMetadata: {
        source: 'steam-link-service',
        linkedUserId: userId,
      },
      profileMetadata: {
        source: 'steam-link-service',
      },
    });
    identitySummary = await getPlatformUserIdentitySummary({
      userId: identity?.user?.id || null,
      tenantId,
      discordUserId: userId,
      steamId,
      legacySteamLink: {
        linked: true,
        steamId,
        inGameName,
      },
      fallbackDiscordUserId: userId,
    });
  } catch {
    identity = null;
    identitySummary = null;
  }

  return {
    ok: true,
    steamId: result.steamId,
    userId: result.userId,
    identity: identity?.ok
      ? {
          userId: identity.user?.id || null,
          profileId: identity.profile?.id || null,
        }
      : null,
    identitySummary: identitySummary?.identitySummary || null,
  };
}

function getSteamLinkByUserId(userId, options = {}) {
  const normalized = normalizeText(userId);
  if (!normalized) return null;
  const scope = resolveTenantScope(options, 'read steam link by user');
  return getLinkByUserId(normalized, scope);
}

function getSteamLinkBySteamId(steamId, options = {}) {
  const normalized = normalizeSteamId(steamId);
  if (!normalized) return null;
  const scope = resolveTenantScope(options, 'read steam link by steam');
  return getLinkBySteamId(normalized, scope);
}

async function removeSteamLink(params = {}) {
  const steamId = normalizeSteamId(params.steamId);
  const userId = normalizeText(params.userId);
  if (!steamId && !userId) {
    return { ok: false, reason: 'invalid-input' };
  }
  const tenantScope = resolveTenantScope(params, 'remove steam link');

  const removed = steamId
    ? unlinkBySteamId(steamId, tenantScope)
    : unlinkByUserId(userId, tenantScope);
  if (!removed) {
    return { ok: false, reason: 'not-found' };
  }

  let platform = null;
  try {
    platform = await clearPlatformPlayerSteamLink({
      tenantId: tenantScope.tenantId,
      userId: removed.userId || userId || null,
      discordUserId: removed.userId || userId || null,
      steamId: removed.steamId || steamId || null,
    });
  } catch {
    platform = null;
  }

  return {
    ok: true,
    removed,
    identitySummary: platform?.identitySummary || null,
  };
}

module.exports = {
  normalizeSteamIdInput: normalizeSteamId,
  bindSteamLinkForUser,
  getSteamLinkByUserId,
  getSteamLinkBySteamId,
  removeSteamLink,
};
