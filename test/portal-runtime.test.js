const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyAdminUrl,
  buildPortalHealthPayload,
  buildPortalRuntimeSettings,
  buildPortalStartupValidation,
  isDiscordCallbackPath,
  isDiscordStartPath,
  isGoogleCallbackPath,
  isGoogleStartPath,
  printPortalStartupHints,
} = require('../apps/web-portal-standalone/runtime/portalRuntime');

test('portal runtime health payload reflects runtime settings', () => {
  const payload = buildPortalHealthPayload({
    nodeEnv: 'production',
    mode: 'player',
    sessionCount: 2,
    oauthStateCount: 1,
    secureCookie: true,
    cookieName: 'portal',
    cookiePath: '/',
    cookieSameSite: 'Lax',
    enforceOriginCheck: true,
    discordOAuthConfigured: true,
    googleOAuthConfigured: true,
    playerOpenAccess: true,
    requireGuildMember: false,
    legacyAdminUrl: 'https://admin.example.com/admin',
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.data.nodeEnv, 'production');
  assert.equal(payload.data.mode, 'player');
  assert.equal(payload.data.sessions, 2);
  assert.equal(payload.data.oauthStates, 1);
  assert.equal(payload.data.cookieName, 'portal');
  assert.equal(payload.data.legacyAdminUrl, 'https://admin.example.com/admin');
});

test('portal runtime validation reports production and access-policy issues', () => {
  const result = buildPortalStartupValidation({
    baseUrl: 'http://player.example.com',
    legacyAdminUrl: 'http://admin.example.com/admin',
    discordClientId: '',
    discordClientSecret: '',
    googleClientId: '',
    googleClientSecret: '',
    discordGuildId: '',
    playerOpenAccess: false,
    requireGuildMember: true,
    allowedDiscordIdsCount: 0,
    mode: 'player',
    enforceOriginCheck: false,
    cookieSameSite: 'None',
    secureCookie: false,
    sessionTtlMs: 48 * 60 * 60 * 1000,
    isProduction: true,
  });

  assert.ok(
    result.errors.includes('At least one player OAuth provider must be configured: Discord or Google'),
  );
  assert.ok(
    result.errors.includes(
      'WEB_PORTAL_REQUIRE_GUILD_MEMBER=true requires WEB_PORTAL_DISCORD_GUILD_ID',
    ),
  );
  assert.ok(
    result.errors.includes(
      'WEB_PORTAL_REQUIRE_GUILD_MEMBER=true requires Discord OAuth to be configured',
    ),
  );
  assert.ok(result.errors.includes('WEB_PORTAL_SECURE_COOKIE must be true in production'));
  assert.ok(
    result.errors.includes('WEB_PORTAL_ENFORCE_ORIGIN_CHECK must be true in production'),
  );
  assert.ok(result.errors.includes('WEB_PORTAL_BASE_URL must use https in production'));
  assert.ok(
    result.warnings.includes(
      'WEB_PORTAL_COOKIE_SAMESITE=None without secure cookie may be rejected by browsers',
    ),
  );
  assert.ok(
    result.warnings.includes(
      'WEB_PORTAL_SESSION_TTL_HOURS is longer than 24 hours; review whether player sessions should expire sooner',
    ),
  );
});

test('portal runtime route helpers normalize admin URL and Discord paths', () => {
  assert.equal(
    buildLegacyAdminUrl(
      'https://admin.example.com/admin',
      '/admin/api/portal/shop/list',
      '?limit=10',
    ),
    'https://admin.example.com/admin/api/portal/shop/list?limit=10',
  );
  assert.equal(isDiscordStartPath('/auth/discord/start'), true);
  assert.equal(isDiscordCallbackPath('/oauth/callback', '/oauth/callback'), true);
  assert.equal(isDiscordCallbackPath('/auth/discord/callback', '/oauth/callback'), true);
  assert.equal(isGoogleStartPath('/auth/google/start'), true);
  assert.equal(isGoogleCallbackPath('/oauth/google/callback', '/oauth/google/callback'), true);
  assert.equal(isGoogleCallbackPath('/auth/google/callback', '/oauth/google/callback'), true);
});

test('portal runtime settings builder normalizes counts and booleans', () => {
  const settings = buildPortalRuntimeSettings({
    nodeEnv: 'production',
    mode: 'player',
    baseUrl: 'https://player.example.com',
    legacyAdminUrl: 'https://admin.example.com/admin',
    sessionCount: '4',
    oauthStateCount: '2',
    secureCookie: 1,
    cookieName: 'portal',
    cookiePath: '/',
    cookieSameSite: 'Lax',
    enforceOriginCheck: 1,
    discordOAuthConfigured: 1,
    discordClientId: 'client',
    discordClientSecret: 'secret',
    googleOAuthConfigured: 1,
    googleClientId: 'google-client',
    googleClientSecret: 'google-secret',
    discordGuildId: 'guild',
    playerOpenAccess: 1,
    requireGuildMember: 0,
    allowedDiscordIdsCount: '3',
    sessionTtlMs: '3600',
    isProduction: 1,
  });

  assert.equal(settings.sessionCount, 4);
  assert.equal(settings.oauthStateCount, 2);
  assert.equal(settings.secureCookie, true);
  assert.equal(settings.googleOAuthConfigured, true);
  assert.equal(settings.requireGuildMember, false);
  assert.equal(settings.allowedDiscordIdsCount, 3);
});

test('portal runtime startup printer returns false and logs errors when invalid', () => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  const calls = [];
  const logger = {
    log(message) {
      calls.push(['log', message]);
    },
    warn(message) {
      calls.push(['warn', message]);
    },
    error(message) {
      calls.push(['error', message]);
    },
  };

  try {
    const ok = printPortalStartupHints(
      {
        baseUrl: 'http://player.example.com',
        legacyAdminUrl: 'https://admin.example.com/admin',
        discordClientId: '',
        discordClientSecret: '',
        googleClientId: '',
        googleClientSecret: '',
        discordGuildId: '',
        playerOpenAccess: true,
        requireGuildMember: false,
        allowedDiscordIdsCount: 0,
        mode: 'player',
        cookieName: 'portal',
        cookiePath: '/',
        cookieSameSite: 'Lax',
        cookieDomain: '',
        enforceOriginCheck: true,
        secureCookie: true,
        sessionTtlMs: 12 * 60 * 60 * 1000,
        isProduction: false,
      },
      logger,
    );

    assert.equal(ok, false);
    assert.equal(process.exitCode, 1);
    assert.ok(calls.some(([level, message]) => level === 'error' && /startup errors/i.test(message)));
  } finally {
    process.exitCode = originalExitCode;
  }
});
