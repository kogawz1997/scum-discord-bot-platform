'use strict';

/**
 * Player portal runtime helpers for health payloads and startup validation.
 * Keep these pure so the standalone server can stay focused on routes.
 */

function isLoopbackHost(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function buildPortalHealthPayload(settings) {
  return {
    ok: true,
    data: {
      now: new Date().toISOString(),
      nodeEnv: settings.nodeEnv,
      mode: settings.mode,
      uptimeSec: Math.round(process.uptime()),
      sessions: settings.sessionCount,
      oauthStates: settings.oauthStateCount,
      secureCookie: settings.secureCookie,
      cookieName: settings.cookieName,
      cookiePath: settings.cookiePath,
      cookieSameSite: settings.cookieSameSite,
      enforceOriginCheck: settings.enforceOriginCheck,
      discordOAuthConfigured: settings.discordOAuthConfigured,
      googleOAuthConfigured: settings.googleOAuthConfigured,
      playerOpenAccess: settings.playerOpenAccess,
      requireGuildMember: settings.requireGuildMember,
      legacyAdminUrl: settings.legacyAdminUrl,
      landingUrl: '/landing',
      showcaseUrl: '/showcase',
      trialUrl: '/trial',
    },
  };
}

function buildLegacyAdminUrl(legacyAdminUrl, pathname, search) {
  try {
    const base = new URL(legacyAdminUrl);
    const basePath = base.pathname.replace(/\/+$/, '') || '/admin';
    const suffix = pathname.startsWith('/admin')
      ? pathname.slice('/admin'.length)
      : pathname;
    base.pathname = `${basePath}${suffix || ''}`;
    base.search = search || '';
    return base.toString();
  } catch {
    return null;
  }
}

function buildAdminProductUrl(legacyAdminUrl, pathname, search) {
  try {
    const base = new URL(legacyAdminUrl);
    base.pathname = String(pathname || '/tenant').startsWith('/')
      ? String(pathname || '/tenant')
      : `/${String(pathname || 'tenant')}`;
    base.search = search || '';
    return base.toString();
  } catch {
    return null;
  }
}

function buildPortalRuntimeSettings(settings) {
  return {
    nodeEnv: settings.nodeEnv,
    mode: settings.mode,
    baseUrl: settings.baseUrl,
    legacyAdminUrl: settings.legacyAdminUrl,
    sessionCount: Number(settings.sessionCount || 0),
    oauthStateCount: Number(settings.oauthStateCount || 0),
    secureCookie: Boolean(settings.secureCookie),
    cookieName: settings.cookieName,
    cookiePath: settings.cookiePath,
    cookieSameSite: settings.cookieSameSite,
    cookieDomain: settings.cookieDomain || '',
    enforceOriginCheck: Boolean(settings.enforceOriginCheck),
    discordOAuthConfigured: Boolean(settings.discordOAuthConfigured),
    discordClientId: settings.discordClientId || '',
    discordClientSecret: settings.discordClientSecret || '',
    googleOAuthConfigured: Boolean(settings.googleOAuthConfigured),
    googleClientId: settings.googleClientId || '',
    googleClientSecret: settings.googleClientSecret || '',
    discordGuildId: settings.discordGuildId || '',
    playerOpenAccess: Boolean(settings.playerOpenAccess),
    requireGuildMember: Boolean(settings.requireGuildMember),
    allowedDiscordIdsCount: Number(settings.allowedDiscordIdsCount || 0),
    sessionTtlMs: Number(settings.sessionTtlMs || 0),
    isProduction: Boolean(settings.isProduction),
  };
}

function isDiscordStartPath(pathname) {
  return pathname === '/auth/discord/start' || pathname === '/admin/auth/discord/start';
}

function isDiscordCallbackPath(pathname, redirectPath = '/auth/discord/callback') {
  const normalizedPath = String(redirectPath || '/auth/discord/callback').startsWith('/')
    ? String(redirectPath || '/auth/discord/callback')
    : `/${String(redirectPath || '/auth/discord/callback')}`;
  return (
    pathname === '/auth/discord/callback'
    || pathname === '/admin/auth/discord/callback'
    || pathname === normalizedPath
  );
}

function isGoogleStartPath(pathname) {
  return pathname === '/auth/google/start' || pathname === '/admin/auth/google/start';
}

function isGoogleCallbackPath(pathname, redirectPath = '/auth/google/callback') {
  const normalizedPath = String(redirectPath || '/auth/google/callback').startsWith('/')
    ? String(redirectPath || '/auth/google/callback')
    : `/${String(redirectPath || '/auth/google/callback')}`;
  return (
    pathname === '/auth/google/callback'
    || pathname === '/admin/auth/google/callback'
    || pathname === normalizedPath
  );
}

function buildPortalStartupValidation(settings) {
  const errors = [];
  const warnings = [];

  let base;
  let legacy;

  try {
    base = new URL(settings.baseUrl);
  } catch {
    errors.push('WEB_PORTAL_BASE_URL is invalid URL');
  }

  try {
    legacy = new URL(settings.legacyAdminUrl);
  } catch {
    errors.push('WEB_PORTAL_LEGACY_ADMIN_URL is invalid URL');
  }

  const discordConfigured = Boolean(settings.discordClientId && settings.discordClientSecret);
  const googleConfigured = Boolean(settings.googleClientId && settings.googleClientSecret);
  const discordPartial = Boolean(settings.discordClientId || settings.discordClientSecret) && !discordConfigured;
  const googlePartial = Boolean(settings.googleClientId || settings.googleClientSecret) && !googleConfigured;

  if (discordPartial) {
    errors.push('Discord OAuth configuration requires both WEB_PORTAL_DISCORD_CLIENT_ID and WEB_PORTAL_DISCORD_CLIENT_SECRET');
  }

  if (googlePartial) {
    errors.push('Google OAuth configuration requires both WEB_PORTAL_GOOGLE_CLIENT_ID and WEB_PORTAL_GOOGLE_CLIENT_SECRET');
  }

  if (!discordConfigured && !googleConfigured) {
    errors.push('At least one player OAuth provider must be configured: Discord or Google');
  }

  if (!settings.playerOpenAccess && settings.requireGuildMember && !settings.discordGuildId) {
    errors.push('WEB_PORTAL_REQUIRE_GUILD_MEMBER=true requires WEB_PORTAL_DISCORD_GUILD_ID');
  }

  if (!settings.playerOpenAccess && settings.requireGuildMember && !discordConfigured) {
    errors.push('WEB_PORTAL_REQUIRE_GUILD_MEMBER=true requires Discord OAuth to be configured');
  }

  if (settings.mode !== 'player') {
    warnings.push(`WEB_PORTAL_MODE=${settings.mode} is not supported, forcing player mode`);
  }

  if (
    !settings.playerOpenAccess
    && settings.allowedDiscordIdsCount === 0
    && !settings.requireGuildMember
  ) {
    warnings.push('Access policy is restricted mode but no allowlist/guild guard configured');
  }

  if (
    settings.playerOpenAccess
    && (settings.allowedDiscordIdsCount > 0 || settings.requireGuildMember)
  ) {
    warnings.push('WEB_PORTAL_PLAYER_OPEN_ACCESS=true ignores allowlist/guild-member restrictions');
  }

  if (!settings.enforceOriginCheck) {
    warnings.push('WEB_PORTAL_ENFORCE_ORIGIN_CHECK=false increases CSRF risk');
  }

  if (settings.cookieSameSite === 'Strict') {
    warnings.push('WEB_PORTAL_COOKIE_SAMESITE=Strict may break OAuth redirect flow');
  }

  if (settings.cookieSameSite === 'None' && !settings.secureCookie) {
    warnings.push('WEB_PORTAL_COOKIE_SAMESITE=None without secure cookie may be rejected by browsers');
  }

  if (base && legacy && base.origin === legacy.origin) {
    warnings.push('WEB_PORTAL_BASE_URL and WEB_PORTAL_LEGACY_ADMIN_URL share the same origin; prefer split origin/subdomain for cleaner cookie and routing isolation');
  }

  if (settings.sessionTtlMs > 24 * 60 * 60 * 1000) {
    warnings.push('WEB_PORTAL_SESSION_TTL_HOURS is longer than 24 hours; review whether player sessions should expire sooner');
  }

  if (base && !isLoopbackHost(base.hostname) && base.protocol !== 'https:') {
    warnings.push('WEB_PORTAL_BASE_URL is not HTTPS on non-loopback host');
  }

  if (legacy && !isLoopbackHost(legacy.hostname) && legacy.protocol !== 'https:') {
    warnings.push('WEB_PORTAL_LEGACY_ADMIN_URL is not HTTPS on non-loopback host');
  }

  if (settings.isProduction) {
    if (!settings.secureCookie) {
      errors.push('WEB_PORTAL_SECURE_COOKIE must be true in production');
    }

    if (!settings.enforceOriginCheck) {
      errors.push('WEB_PORTAL_ENFORCE_ORIGIN_CHECK must be true in production');
    }

    if (base && base.protocol !== 'https:') {
      errors.push('WEB_PORTAL_BASE_URL must use https in production');
    }
  }

  return { errors, warnings };
}

function printPortalStartupHints(settings, logger = console) {
  logger.log(`[web-portal-standalone] listening at ${settings.baseUrl}`);
  logger.log(`[web-portal-standalone] mode: ${settings.mode}`);
  logger.log(`[web-portal-standalone] legacy admin: ${settings.legacyAdminUrl}`);
  logger.log(
    `[web-portal-standalone] landing: ${new URL('/landing', settings.baseUrl).toString()}`,
  );
  logger.log(
    `[web-portal-standalone] showcase: ${new URL('/showcase', settings.baseUrl).toString()}`,
  );
  logger.log(
    `[web-portal-standalone] trial: ${new URL('/trial', settings.baseUrl).toString()}`,
  );
  logger.log(
    `[web-portal-standalone] cookie: name=${settings.cookieName} path=${settings.cookiePath} secure=${settings.secureCookie} sameSite=${settings.cookieSameSite}${settings.cookieDomain ? ` domain=${settings.cookieDomain}` : ''}`,
  );

  const validation = buildPortalStartupValidation(settings);

  if (validation.warnings.length > 0) {
    logger.warn('[web-portal-standalone] startup warnings:');
    for (const warning of validation.warnings) {
      logger.warn(`- ${warning}`);
    }
  }

  if (validation.errors.length > 0) {
    logger.error('[web-portal-standalone] startup errors:');
    for (const error of validation.errors) {
      logger.error(`- ${error}`);
    }
    process.exitCode = 1;
    return false;
  }

  return true;
}

module.exports = {
  buildAdminProductUrl,
  buildLegacyAdminUrl,
  buildPortalHealthPayload,
  buildPortalRuntimeSettings,
  buildPortalStartupValidation,
  isDiscordCallbackPath,
  isDiscordStartPath,
  isGoogleCallbackPath,
  isGoogleStartPath,
  printPortalStartupHints,
};
