'use strict';

const path = require('node:path');
const http = require('node:http');

const { loadMergedEnvFiles } = require('../../src/utils/loadEnvFiles');
const {
  createDiscordOnlySurfaceServer,
  isDiscordOnlyMode,
} = require('../../src/config/discordOnlyMode');
loadMergedEnvFiles({
  basePath: path.resolve(process.cwd(), '.env'),
  overlayPath: path.join(__dirname, '.env'),
});

const {
  installBigIntJsonSerialization,
} = require('../../src/utils/jsonSerialization');
installBigIntJsonSerialization();

const {
  envBool,
  asInt,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeMode,
  normalizeSameSite,
} = require('./runtime/portalHelperRuntime');
const {
  createPortalEnvRuntime,
} = require('./runtime/portalEnvRuntime');
const {
  createPortalBootstrapRuntime,
} = require('./runtime/portalBootstrapRuntime');
const {
  createPortalServerLifecycle,
} = require('./runtime/portalServerLifecycle');

const {
  isProduction: IS_PRODUCTION,
  host: HOST,
  port: PORT,
  baseUrl: BASE_URL,
  portalMode: PORTAL_MODE,
  legacyAdminUrl: LEGACY_ADMIN_URL,
  sessionTtlMs: SESSION_TTL_MS,
  sessionCookieName: SESSION_COOKIE_NAME,
  sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
  sessionCookiePath: SESSION_COOKIE_PATH,
  sessionCookieDomain: SESSION_COOKIE_DOMAIN,
  secureCookie: SECURE_COOKIE,
  enforceOriginCheck: ENFORCE_ORIGIN_CHECK,
  discordClientId: DISCORD_CLIENT_ID,
  discordClientSecret: DISCORD_CLIENT_SECRET,
  discordGuildId: DISCORD_GUILD_ID,
  playerOpenAccess: PLAYER_OPEN_ACCESS,
  requireGuildMember: REQUIRE_GUILD_MEMBER,
  oauthStateTtlMs: OAUTH_STATE_TTL_MS,
  discordRedirectPath: DISCORD_REDIRECT_PATH,
  cleanupIntervalMs: CLEANUP_INTERVAL_MS,
  discordApiBase: DISCORD_API_BASE,
  publicAssetsDirPath: PUBLIC_ASSETS_DIR_PATH,
  authLoginHtmlPath: AUTH_LOGIN_HTML_PATH,
  playerLoginHtmlPath: PLAYER_LOGIN_HTML_PATH,
  playerHtmlPath: PLAYER_HTML_PATH,
  legacyPlayerHtmlPath: LEGACY_PLAYER_HTML_PATH,
  landingHtmlPath: LANDING_HTML_PATH,
  dashboardHtmlPath: DASHBOARD_HTML_PATH,
  pricingHtmlPath: PRICING_HTML_PATH,
  signupHtmlPath: SIGNUP_HTML_PATH,
  forgotPasswordHtmlPath: FORGOT_PASSWORD_HTML_PATH,
  verifyEmailHtmlPath: VERIFY_EMAIL_HTML_PATH,
  checkoutHtmlPath: CHECKOUT_HTML_PATH,
  paymentResultHtmlPath: PAYMENT_RESULT_HTML_PATH,
  previewHtmlPath: PREVIEW_HTML_PATH,
  trialHtmlPath: TRIAL_HTML_PATH,
  showcaseHtmlPath: SHOWCASE_HTML_PATH,
  docsDirPath: DOCS_DIR_PATH,
  defaultMapPortalUrl: DEFAULT_MAP_PORTAL_URL,
  scumItemsDirPath: SCUM_ITEMS_DIR_PATH,
  partyChatMinIntervalMs: PARTY_CHAT_MIN_INTERVAL_MS,
  partyChatMaxLength: PARTY_CHAT_MAX_LENGTH,
  nodeEnv: NODE_ENV,
} = createPortalEnvRuntime({
  path,
  processEnv: process.env,
  asInt,
  envBool,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeMode,
  normalizeSameSite,
});

if (isDiscordOnlyMode(process.env)) {
  createDiscordOnlySurfaceServer({
    surface: 'player-portal',
    env: process.env,
    hostEnvKey: 'WEB_PORTAL_HOST',
    portEnvKey: 'WEB_PORTAL_PORT',
    defaultHost: '127.0.0.1',
    defaultPort: 3300,
  });
  return;
}

const {
  startupReady,
  requestHandler,
  startCleanupTimer,
} = createPortalBootstrapRuntime({
  settings: {
    nodeEnv: NODE_ENV,
    isProduction: IS_PRODUCTION,
    baseUrl: BASE_URL,
    portalMode: PORTAL_MODE,
    legacyAdminUrl: LEGACY_ADMIN_URL,
    sessionTtlMs: SESSION_TTL_MS,
    sessionCookieName: SESSION_COOKIE_NAME,
    sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
    sessionCookiePath: SESSION_COOKIE_PATH,
    sessionCookieDomain: SESSION_COOKIE_DOMAIN,
    secureCookie: SECURE_COOKIE,
    enforceOriginCheck: ENFORCE_ORIGIN_CHECK,
    discordClientId: DISCORD_CLIENT_ID,
    discordClientSecret: DISCORD_CLIENT_SECRET,
    discordGuildId: DISCORD_GUILD_ID,
    playerOpenAccess: PLAYER_OPEN_ACCESS,
    requireGuildMember: REQUIRE_GUILD_MEMBER,
    oauthStateTtlMs: OAUTH_STATE_TTL_MS,
    discordRedirectPath: DISCORD_REDIRECT_PATH,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
    discordApiBase: DISCORD_API_BASE,
    publicAssetsDirPath: PUBLIC_ASSETS_DIR_PATH,
    authLoginHtmlPath: AUTH_LOGIN_HTML_PATH,
    playerLoginHtmlPath: PLAYER_LOGIN_HTML_PATH,
    playerHtmlPath: PLAYER_HTML_PATH,
    legacyPlayerHtmlPath: LEGACY_PLAYER_HTML_PATH,
    landingHtmlPath: LANDING_HTML_PATH,
    dashboardHtmlPath: DASHBOARD_HTML_PATH,
    pricingHtmlPath: PRICING_HTML_PATH,
    signupHtmlPath: SIGNUP_HTML_PATH,
    forgotPasswordHtmlPath: FORGOT_PASSWORD_HTML_PATH,
    verifyEmailHtmlPath: VERIFY_EMAIL_HTML_PATH,
    checkoutHtmlPath: CHECKOUT_HTML_PATH,
    paymentResultHtmlPath: PAYMENT_RESULT_HTML_PATH,
    previewHtmlPath: PREVIEW_HTML_PATH,
    trialHtmlPath: TRIAL_HTML_PATH,
    showcaseHtmlPath: SHOWCASE_HTML_PATH,
    docsDirPath: DOCS_DIR_PATH,
    defaultMapPortalUrl: DEFAULT_MAP_PORTAL_URL,
    scumItemsDirPath: SCUM_ITEMS_DIR_PATH,
    partyChatMinIntervalMs: PARTY_CHAT_MIN_INTERVAL_MS,
    partyChatMaxLength: PARTY_CHAT_MAX_LENGTH,
    allowedDiscordIdsRaw: process.env.WEB_PORTAL_ALLOWED_DISCORD_IDS || '',
  },
});

if (!startupReady) {
  process.exit(1);
}

createPortalServerLifecycle({
  http,
  host: HOST,
  port: PORT,
  requestHandler,
  startCleanupTimer,
});
