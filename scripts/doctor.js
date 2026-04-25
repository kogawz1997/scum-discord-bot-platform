'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');
const { validateCommandTemplate } = require('../src/utils/commandTemplate');
const { getAdminSsoRoleMappingSummary } = require('../src/utils/adminSsoRoleMapping');
const { resolveDatabaseRuntime } = require('../src/utils/dbEngine');
const { getPrismaRuntimeProfile } = require('../src/prisma');
const { listTrackedMutableArtifacts } = require('../src/utils/trackedMutableArtifacts');
const {
  CONTROL_PLANE_REGISTRY_HIGH_CHURN_FILE_MIRROR_SLICES,
  resolveControlPlaneRegistryFileMirrorSlices,
} = require('../src/utils/controlPlaneRegistryFileMirror');
const {
  createValidationCheck,
  createValidationReport,
} = require('../src/utils/runtimeStatus');

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const PORTAL_ENV_PATH = path.join(
  ROOT_DIR,
  'apps',
  'web-portal-standalone',
  '.env',
);

loadMergedEnvFiles({
  basePath: ROOT_ENV_PATH,
  overlayPath: fs.existsSync(PORTAL_ENV_PATH) ? PORTAL_ENV_PATH : null,
});

if (!String(process.env.CONTROL_PLANE_REGISTRY_AUTO_INIT || '').trim()) {
  process.env.CONTROL_PLANE_REGISTRY_AUTO_INIT = 'false';
}

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');

const checks = [];
const warnings = [];
const isProduction =
  String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

function runCheck(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

function isTruthy(value, fallback = false) {
  if (value == null || String(value).trim() === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function isLoopbackHost(hostname) {
  const h = String(hostname || '').trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function parseCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hostnameMatchesCookieDomain(hostname, cookieDomain) {
  const normalizedHost = String(hostname || '').trim().toLowerCase();
  const normalizedDomain = String(cookieDomain || '')
    .trim()
    .replace(/^\./, '')
    .toLowerCase();
  if (!normalizedHost || !normalizedDomain) return true;
  return (
    normalizedHost === normalizedDomain
    || normalizedHost.endsWith(`.${normalizedDomain}`)
  );
}

function parseUrlOrThrow(value, label) {
  try {
    return new URL(String(value || '').trim());
  } catch {
    throw new Error(`${label} must be a full URL`);
  }
}

function readPort(value, fallback = 0) {
  const raw = String(value == null || value === '' ? fallback : value).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid port value: ${raw}`);
  }
  return Math.max(0, Math.trunc(parsed));
}

function pushPort(portMap, port, label) {
  if (!port) return;
  if (!portMap.has(port)) {
    portMap.set(port, [label]);
    return;
  }
  portMap.get(port).push(label);
}

function addPortConflictChecks() {
  const portMap = new Map();
  pushPort(
    portMap,
    readPort(process.env.ADMIN_WEB_PORT, 3200),
    'admin-web',
  );
  pushPort(
    portMap,
    readPort(process.env.SCUM_WEBHOOK_PORT, 3100),
    'scum-webhook',
  );
  pushPort(
    portMap,
    readPort(process.env.WEB_PORTAL_PORT, 3300),
    'player-web',
  );
  pushPort(
    portMap,
    readPort(process.env.BOT_HEALTH_PORT, 0),
    'bot-health',
  );
  pushPort(
    portMap,
    readPort(process.env.WORKER_HEALTH_PORT, 0),
    'worker-health',
  );
  pushPort(
    portMap,
    readPort(process.env.SCUM_WATCHER_HEALTH_PORT, 0),
    'watcher-health',
  );
  pushPort(
    portMap,
    readPort(process.env.SCUM_CONSOLE_AGENT_PORT, 0),
    'scum-console-agent',
  );

  for (const [port, labels] of portMap.entries()) {
    if (labels.length > 1) {
      throw new Error(`Port ${port} is reused by: ${labels.join(', ')}`);
    }
  }
}

function addDatabaseDeploymentChecks() {
  const runtime = resolveDatabaseRuntime();
  const topologyMode = String(process.env.TENANT_DB_TOPOLOGY_MODE || 'shared')
    .trim()
    .toLowerCase() || 'shared';

  if (isProduction && runtime.engine !== 'postgresql') {
    throw new Error(
      'Production requires PostgreSQL DATABASE_URL; SQLite remains for local dev/import/compatibility only',
    );
  }

  if (
    ['schema-per-tenant', 'database-per-tenant'].includes(topologyMode)
    && runtime.engine !== 'postgresql'
  ) {
    throw new Error(
      `TENANT_DB_TOPOLOGY_MODE=${topologyMode} requires PostgreSQL DATABASE_URL`,
    );
  }
}

function readSchemaProvider(schemaPath) {
  const text = fs.readFileSync(schemaPath, 'utf8');
  const match = text.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
  return String(match?.[1] || '').trim().toLowerCase();
}

function addPrismaRuntimeClientChecks() {
  const profile = getPrismaRuntimeProfile();
  if (profile.runtimeEngine === 'unsupported') {
    throw new Error(`Unsupported DATABASE_URL engine: ${profile.runtimeDatabaseUrl}`);
  }

  if (!profile.usesProviderRenderedSchema) {
    return;
  }

  if (!profile.clientModulePath) {
    throw new Error(
      `Prisma runtime uses ${profile.runtimeProvider}, but no generated provider-specific client was found; run npm run db:generate:${profile.runtimeProvider}`,
    );
  }

  const clientEntry = path.join(profile.clientModulePath, 'index.js');
  const clientSchema = path.join(profile.clientModulePath, 'schema.prisma');
  if (!fs.existsSync(clientEntry) || !fs.existsSync(clientSchema)) {
    throw new Error(
      `Prisma generated client for ${profile.runtimeProvider} is incomplete at ${profile.clientModulePath}; run npm run db:generate:${profile.runtimeProvider}`,
    );
  }

  const clientProvider = readSchemaProvider(clientSchema);
  if (clientProvider !== profile.runtimeProvider) {
    throw new Error(
      `Prisma generated client provider (${clientProvider || 'unknown'}) does not match runtime provider (${profile.runtimeProvider})`,
    );
  }
}

function addRuntimeOwnershipChecks() {
  const discordOnly = isTruthy(process.env.PLATFORM_DISCORD_ONLY, false);
  const botDeliveryWorkerEnabled = isTruthy(
    process.env.BOT_ENABLE_DELIVERY_WORKER,
    true,
  );
  const workerDeliveryEnabled = isTruthy(
    process.env.WORKER_ENABLE_DELIVERY,
    true,
  );
  const workerRentEnabled = isTruthy(
    process.env.WORKER_ENABLE_RENTBIKE,
    true,
  );

  if (botDeliveryWorkerEnabled && workerDeliveryEnabled) {
    throw new Error(
      'Do not enable delivery worker on both bot and worker (BOT_ENABLE_DELIVERY_WORKER + WORKER_ENABLE_DELIVERY)',
    );
  }

  if (discordOnly && isTruthy(process.env.BOT_ENABLE_ADMIN_WEB, false)) {
    warnings.push(
      'PLATFORM_DISCORD_ONLY=true is active; BOT_ENABLE_ADMIN_WEB is ignored and admin web stays disabled',
    );
  }

  if ((workerDeliveryEnabled || workerRentEnabled) && !readPort(process.env.WORKER_HEALTH_PORT, 0)) {
    warnings.push(
      'Worker runtime is enabled without WORKER_HEALTH_PORT; health/readiness drift will be harder to detect',
    );
  }
}

function addCookieScopeChecks() {
  const adminOrigins = parseCsvList(process.env.ADMIN_WEB_ALLOWED_ORIGINS);
  const adminCookieDomain = String(
    process.env.ADMIN_WEB_SESSION_COOKIE_DOMAIN || '',
  ).trim();
  const adminCookiePath = String(
    process.env.ADMIN_WEB_SESSION_COOKIE_PATH || '/',
  ).trim() || '/';
  const portalCookieDomain = String(
    process.env.WEB_PORTAL_COOKIE_DOMAIN || '',
  ).trim();
  const portalBaseUrl = parseUrlOrThrow(
    process.env.WEB_PORTAL_BASE_URL || 'http://127.0.0.1:3300',
    'WEB_PORTAL_BASE_URL',
  );
  const legacyAdminUrl = parseUrlOrThrow(
    process.env.WEB_PORTAL_LEGACY_ADMIN_URL || 'http://127.0.0.1:3200/admin',
    'WEB_PORTAL_LEGACY_ADMIN_URL',
  );

  if (adminCookieDomain) {
    for (const origin of adminOrigins) {
      const parsed = new URL(origin);
      if (!hostnameMatchesCookieDomain(parsed.hostname, adminCookieDomain)) {
        throw new Error(
          `ADMIN_WEB_SESSION_COOKIE_DOMAIN (${adminCookieDomain}) does not match allowed admin origin host (${parsed.hostname})`,
        );
      }
    }
  }

  if (
    portalCookieDomain
    && !hostnameMatchesCookieDomain(portalBaseUrl.hostname, portalCookieDomain)
  ) {
    throw new Error(
      `WEB_PORTAL_COOKIE_DOMAIN (${portalCookieDomain}) does not match WEB_PORTAL_BASE_URL host (${portalBaseUrl.hostname})`,
    );
  }

  if (
    adminCookieDomain
    && portalCookieDomain
    && adminCookieDomain === portalCookieDomain
    && portalBaseUrl.origin !== legacyAdminUrl.origin
    && adminCookiePath === '/'
  ) {
    warnings.push(
      'Admin and player cookies share the same cookie domain while split origins are enabled and ADMIN_WEB_SESSION_COOKIE_PATH=/; tighten cookie scope to reduce cross-surface drift',
    );
  }

  if (adminCookiePath !== '/') {
    throw new Error(
      'ADMIN_WEB_SESSION_COOKIE_PATH must be / for the current /owner and /tenant admin routes',
    );
  }
}

function addAdminReverseProxyChecks() {
  const isProduction =
    String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const adminHost = String(process.env.ADMIN_WEB_HOST || '127.0.0.1').trim();
  const secureCookie = isTruthy(process.env.ADMIN_WEB_SECURE_COOKIE, false);
  const trustProxy = isTruthy(process.env.ADMIN_WEB_TRUST_PROXY, false);
  const hstsEnabled = isTruthy(process.env.ADMIN_WEB_HSTS_ENABLED, false);
  const enforceOrigin = isTruthy(
    process.env.ADMIN_WEB_ENFORCE_ORIGIN_CHECK,
    true,
  );
  const origins = parseCsvList(process.env.ADMIN_WEB_ALLOWED_ORIGINS);

  if (enforceOrigin && origins.length === 0) {
    throw new Error(
      'ADMIN_WEB_ALLOWED_ORIGINS must be set when ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true',
    );
  }

  for (const origin of origins) {
    const parsed = parseUrlOrThrow(origin, `ADMIN_WEB_ALLOWED_ORIGINS entry (${origin})`);
    if (isProduction && parsed.protocol !== 'https:') {
      throw new Error(`ADMIN origin must use https in production: ${origin}`);
    }
  }

  const hasExternalOrigin = origins.some((origin) => {
    const parsed = new URL(origin);
    return !isLoopbackHost(parsed.hostname);
  });

  if (hasExternalOrigin && !secureCookie) {
    throw new Error(
      'ADMIN_WEB_SECURE_COOKIE=true is required when admin is exposed via external origin',
    );
  }

  if (hasExternalOrigin && !trustProxy) {
    throw new Error(
      'ADMIN_WEB_TRUST_PROXY=true is required when admin is behind reverse proxy',
    );
  }

  if (hasExternalOrigin && !hstsEnabled) {
    throw new Error(
      'ADMIN_WEB_HSTS_ENABLED=true is required when admin is exposed via external origin',
    );
  }

  if (!isLoopbackHost(adminHost) && hasExternalOrigin) {
    warnings.push(
      'ADMIN_WEB_HOST is public while reverse proxy origins are configured; prefer loopback bind behind proxy',
    );
  }
}

function addPortalReverseProxyChecks() {
  const isProduction =
    String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const baseUrl = parseUrlOrThrow(
    process.env.WEB_PORTAL_BASE_URL || 'http://127.0.0.1:3300',
    'WEB_PORTAL_BASE_URL',
  );
  const legacyAdminUrl = parseUrlOrThrow(
    process.env.WEB_PORTAL_LEGACY_ADMIN_URL || 'http://127.0.0.1:3200/admin',
    'WEB_PORTAL_LEGACY_ADMIN_URL',
  );
  const secureCookie = isTruthy(process.env.WEB_PORTAL_SECURE_COOKIE, isProduction);
  const originCheck = isTruthy(process.env.WEB_PORTAL_ENFORCE_ORIGIN_CHECK, true);
  const adminOrigins = parseCsvList(process.env.ADMIN_WEB_ALLOWED_ORIGINS);

  if (isProduction && baseUrl.protocol !== 'https:') {
    throw new Error('WEB_PORTAL_BASE_URL must use https in production');
  }

  if (isProduction && legacyAdminUrl.protocol !== 'https:') {
    throw new Error('WEB_PORTAL_LEGACY_ADMIN_URL must use https in production');
  }

  if (!secureCookie && !isLoopbackHost(baseUrl.hostname)) {
    throw new Error(
      'WEB_PORTAL_SECURE_COOKIE=true is required when player portal is exposed externally',
    );
  }

  if (!originCheck) {
    throw new Error('WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true is required');
  }

  const adminOrigin = legacyAdminUrl.origin;
  const adminCookiePath = String(
    process.env.ADMIN_WEB_SESSION_COOKIE_PATH || '/',
  ).trim() || '/';
  if (
    adminOrigins.length > 0
    && !adminOrigins.includes(adminOrigin)
  ) {
    throw new Error(
      `WEB_PORTAL_LEGACY_ADMIN_URL origin (${adminOrigin}) is not listed in ADMIN_WEB_ALLOWED_ORIGINS`,
    );
  }

  if (baseUrl.origin === adminOrigin) {
    warnings.push(
      'Player portal and admin portal share the same origin; current role-separated admin routes require ADMIN_WEB_SESSION_COOKIE_PATH=/, so split origins are recommended for tighter cookie isolation',
    );
  }
}

function addAuthHardeningChecks() {
  const adminOrigins = parseCsvList(process.env.ADMIN_WEB_ALLOWED_ORIGINS);
  const hasExternalAdminOrigin = adminOrigins.some((origin) => {
    try {
      return !isLoopbackHost(new URL(origin).hostname);
    } catch {
      return false;
    }
  });
  const adminTwoFactorEnabled = isTruthy(process.env.ADMIN_WEB_2FA_ENABLED, false);
  const adminTwoFactorSecret = String(process.env.ADMIN_WEB_2FA_SECRET || '').trim();
  const adminStepUpEnabled = isTruthy(process.env.ADMIN_WEB_STEP_UP_ENABLED, adminTwoFactorEnabled);
  const adminStepUpTtlMinutes = Number(process.env.ADMIN_WEB_STEP_UP_TTL_MINUTES || 15);
  const adminSessionTtlHours = Number(process.env.ADMIN_WEB_SESSION_TTL_HOURS || 12);
  const portalSessionTtlHours = Number(process.env.WEB_PORTAL_SESSION_TTL_HOURS || 12);
  const localRecoveryEnabled = isTruthy(process.env.ADMIN_WEB_LOCAL_RECOVERY, false);

  if (hasExternalAdminOrigin && (!adminTwoFactorEnabled || !adminTwoFactorSecret)) {
    warnings.push(
      'Admin web is exposed externally without active 2FA; enable ADMIN_WEB_2FA_ENABLED=true and set ADMIN_WEB_2FA_SECRET',
    );
  }

  if (hasExternalAdminOrigin && !adminStepUpEnabled) {
    warnings.push(
      'Admin web is exposed externally without step-up auth for sensitive mutations; enable ADMIN_WEB_STEP_UP_ENABLED=true',
    );
  }

  if (isProduction && localRecoveryEnabled) {
    throw new Error(
      'NODE_ENV=production requires ADMIN_WEB_LOCAL_RECOVERY=false',
    );
  }

  if (Number.isFinite(adminStepUpTtlMinutes) && adminStepUpTtlMinutes > 60) {
    warnings.push(
      `ADMIN_WEB_STEP_UP_TTL_MINUTES=${adminStepUpTtlMinutes} is longer than 60 minutes; review step-up window for sensitive actions`,
    );
  }

  if (Number.isFinite(adminSessionTtlHours) && adminSessionTtlHours > 24) {
    warnings.push(
      `ADMIN_WEB_SESSION_TTL_HOURS=${adminSessionTtlHours} is longer than 24 hours; review admin session lifetime`,
    );
  }

  if (Number.isFinite(portalSessionTtlHours) && portalSessionTtlHours > 24) {
    warnings.push(
      `WEB_PORTAL_SESSION_TTL_HOURS=${portalSessionTtlHours} is longer than 24 hours; review player session lifetime`,
    );
  }
}

function addTrackedMutableArtifactChecks() {
  const trackedMutableArtifacts = listTrackedMutableArtifacts();
  if (trackedMutableArtifacts.length === 0) return;
  const sample = trackedMutableArtifacts
    .slice(0, 5)
    .map((entry) => entry.file)
    .join(', ');
  throw new Error(
    `Tracked mutable/runtime artifacts detected (${trackedMutableArtifacts.length}): ${sample}`,
  );
}

function parseRequiredUrl(value, label) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${label} is required`);
  }
  return parseUrlOrThrow(text, label);
}

function normalizePathname(value, fallback) {
  const text = String(value || '').trim() || fallback;
  return text.startsWith('/') ? text : `/${text}`;
}

function addDiscordRedirectChecks() {
  const portalBaseUrl = parseRequiredUrl(
    process.env.WEB_PORTAL_BASE_URL || 'http://127.0.0.1:3300',
    'WEB_PORTAL_BASE_URL',
  );
  const portalRedirectPath = normalizePathname(
    process.env.WEB_PORTAL_DISCORD_REDIRECT_PATH,
    '/auth/discord/callback',
  );
  const portalRedirectUrl = new URL(portalRedirectPath, portalBaseUrl);
  const portalClientId = String(
    process.env.WEB_PORTAL_DISCORD_CLIENT_ID
      || process.env.ADMIN_WEB_SSO_DISCORD_CLIENT_ID
      || process.env.DISCORD_CLIENT_ID
      || '',
  ).trim();
  const portalClientSecret = String(
    process.env.WEB_PORTAL_DISCORD_CLIENT_SECRET
      || process.env.ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET
      || '',
  ).trim();

  if (!portalClientId) {
    throw new Error('WEB_PORTAL_DISCORD_CLIENT_ID (or fallback client id) is required');
  }
  if (!portalClientSecret) {
    throw new Error('WEB_PORTAL_DISCORD_CLIENT_SECRET (or fallback secret) is required');
  }
  if (
    portalRedirectUrl.pathname !== '/admin/auth/discord/callback'
    && portalRedirectUrl.pathname !== '/auth/discord/callback'
  ) {
    warnings.push(
      `Player portal redirect path is custom (${portalRedirectUrl.pathname}); verify the same URI is registered in Discord Developer Portal`,
    );
  }
  if (isProduction && portalRedirectUrl.protocol !== 'https:') {
    throw new Error('Player portal Discord redirect must use https in production');
  }

  const adminSsoEnabled = isTruthy(process.env.ADMIN_WEB_SSO_DISCORD_ENABLED, false);
  if (!adminSsoEnabled) return;

  const adminClientId = String(process.env.ADMIN_WEB_SSO_DISCORD_CLIENT_ID || '').trim();
  const adminClientSecret = String(
    process.env.ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET || '',
  ).trim();
  if (!adminClientId) {
    throw new Error('ADMIN_WEB_SSO_DISCORD_CLIENT_ID is required when ADMIN_WEB_SSO_DISCORD_ENABLED=true');
  }
  if (!adminClientSecret) {
    throw new Error('ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET is required when ADMIN_WEB_SSO_DISCORD_ENABLED=true');
  }

  const adminOrigins = parseCsvList(process.env.ADMIN_WEB_ALLOWED_ORIGINS);
  const hasExternalAdminOrigin = adminOrigins.some((origin) => {
    const parsed = new URL(origin);
    return !isLoopbackHost(parsed.hostname);
  });
  const configuredRedirect = String(process.env.ADMIN_WEB_SSO_DISCORD_REDIRECT_URI || '').trim();
  if (!configuredRedirect && (isProduction || hasExternalAdminOrigin)) {
    throw new Error(
      'ADMIN_WEB_SSO_DISCORD_REDIRECT_URI is required when admin Discord SSO is used behind reverse proxy or in production',
    );
  }

  const adminRedirectUrl = configuredRedirect
    ? parseUrlOrThrow(configuredRedirect, 'ADMIN_WEB_SSO_DISCORD_REDIRECT_URI')
    : new URL(
        `/admin/auth/discord/callback`,
        `http://${String(process.env.ADMIN_WEB_HOST || '127.0.0.1').trim()}:${readPort(
          process.env.ADMIN_WEB_PORT,
          3200,
        )}`,
      );

  if (adminRedirectUrl.pathname !== '/admin/auth/discord/callback') {
    throw new Error(
      `ADMIN_WEB_SSO_DISCORD_REDIRECT_URI must end with /admin/auth/discord/callback (current=${adminRedirectUrl.pathname})`,
    );
  }
  if (isProduction && adminRedirectUrl.protocol !== 'https:') {
    throw new Error('Admin Discord SSO redirect must use https in production');
  }
  if (adminOrigins.length > 0 && !adminOrigins.includes(adminRedirectUrl.origin)) {
    throw new Error(
      `ADMIN_WEB_SSO_DISCORD_REDIRECT_URI origin (${adminRedirectUrl.origin}) is not listed in ADMIN_WEB_ALLOWED_ORIGINS`,
    );
  }
  if (
    adminClientId === portalClientId
    && adminRedirectUrl.toString() === portalRedirectUrl.toString()
  ) {
    warnings.push(
      'Admin SSO and player portal reuse the exact same Discord redirect URI; verify this is intentional',
    );
  }

  const roleMapping = getAdminSsoRoleMappingSummary(process.env);
  if (!roleMapping.hasExplicitMappings) {
    warnings.push(
      'Admin Discord SSO is enabled without explicit ADMIN_WEB_SSO_DISCORD_*_ROLE_IDS or ADMIN_WEB_SSO_DISCORD_*_ROLE_NAMES; all SSO logins will fall back to ADMIN_WEB_SSO_DEFAULT_ROLE',
    );
  } else if (!roleMapping.hasElevatedMappings) {
    warnings.push(
      'Admin Discord SSO has no owner/admin role mapping; elevated access still depends on ADMIN_WEB_SSO_DEFAULT_ROLE or manual admin users',
    );
  }
}

function addRconChecks() {
  const deliveryMode = String(
    process.env.DELIVERY_EXECUTION_MODE || 'rcon',
  ).trim().toLowerCase() || 'rcon';
  const needsRcon =
    isTruthy(process.env.BOT_ENABLE_RENTBIKE_SERVICE, true)
    || isTruthy(process.env.BOT_ENABLE_DELIVERY_WORKER, true)
    || isTruthy(process.env.WORKER_ENABLE_RENTBIKE, true)
    || isTruthy(process.env.WORKER_ENABLE_DELIVERY, true);

  if (!needsRcon) return;

  if (deliveryMode === 'agent') {
    const token = String(process.env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
    const baseUrl = String(process.env.SCUM_CONSOLE_AGENT_BASE_URL || '').trim();
    const host = String(process.env.SCUM_CONSOLE_AGENT_HOST || '127.0.0.1').trim();
    const port = readPort(process.env.SCUM_CONSOLE_AGENT_PORT, 3213);
    const backend = String(
      process.env.SCUM_CONSOLE_AGENT_BACKEND || 'exec',
    ).trim().toLowerCase() || 'exec';

    if (!token || token.length < 16) {
      throw new Error(
        'SCUM_CONSOLE_AGENT_TOKEN is required and should be at least 16 chars when DELIVERY_EXECUTION_MODE=agent',
      );
    }
    if (baseUrl) {
      const parsed = parseUrlOrThrow(baseUrl, 'SCUM_CONSOLE_AGENT_BASE_URL');
      if (isProduction && parsed.protocol !== 'https:' && !isLoopbackHost(parsed.hostname)) {
        throw new Error('SCUM_CONSOLE_AGENT_BASE_URL must use https in production when not loopback');
      }
    } else {
      if (!host) {
        throw new Error('SCUM_CONSOLE_AGENT_HOST is required when DELIVERY_EXECUTION_MODE=agent');
      }
      if (!port) {
        throw new Error('SCUM_CONSOLE_AGENT_PORT is required when DELIVERY_EXECUTION_MODE=agent');
      }
    }
    if (backend === 'exec') {
      const template = String(process.env.SCUM_CONSOLE_AGENT_EXEC_TEMPLATE || '').trim();
      if (!template || !template.includes('{command}')) {
        throw new Error(
          'SCUM_CONSOLE_AGENT_EXEC_TEMPLATE must include {command} when SCUM_CONSOLE_AGENT_BACKEND=exec',
        );
      }
      validateCommandTemplate(template);
    }
    if (backend !== 'exec') {
      throw new Error(
        'SCUM_CONSOLE_AGENT_BACKEND must be exec because the delivery agent no longer embeds server control',
      );
    }
    return;
  }

  const template = String(process.env.RCON_EXEC_TEMPLATE || '').trim();
  if (!template) {
    throw new Error('RCON_EXEC_TEMPLATE is required when delivery/rent services are enabled');
  }
  if (!template.includes('{command}')) {
    throw new Error('RCON_EXEC_TEMPLATE must include {command}');
  }
  validateCommandTemplate(template);

  const host = String(process.env.RCON_HOST || '').trim();
  const port = String(process.env.RCON_PORT || '').trim();
  const password = String(process.env.RCON_PASSWORD || '').trim();

  if (template.includes('{host}') && !host) {
    throw new Error('RCON_HOST is required by RCON_EXEC_TEMPLATE');
  }
  if (template.includes('{port}')) {
    const parsedPort = Number(port);
    if (!port || !Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error(`RCON_PORT must be a valid TCP port when used by RCON_EXEC_TEMPLATE (current=${port || 'empty'})`);
    }
  }
  if (template.includes('{password}') && !password) {
    throw new Error('RCON_PASSWORD is required by RCON_EXEC_TEMPLATE');
  }
}

function addAgentSyncControlPlaneChecks() {
  const transport = String(
    process.env.SCUM_SYNC_TRANSPORT || 'webhook',
  ).trim().toLowerCase() || 'webhook';
  if (!['webhook', 'control-plane', 'dual'].includes(transport)) {
    throw new Error(
      `SCUM_SYNC_TRANSPORT must be webhook, control-plane, or dual (current=${transport})`,
    );
  }

  if (transport === 'webhook') return;

  const baseUrl = String(
    process.env.SCUM_SYNC_CONTROL_PLANE_URL
      || process.env.PLATFORM_API_BASE_URL
      || process.env.ADMIN_WEB_BASE_URL
      || '',
  ).trim();
  const token = String(
    process.env.SCUM_SYNC_AGENT_TOKEN
      || process.env.PLATFORM_AGENT_TOKEN
      || process.env.SCUM_AGENT_TOKEN
      || '',
  ).trim();
  const tenantId = String(
    process.env.SCUM_TENANT_ID
      || process.env.TENANT_ID
      || process.env.PLATFORM_TENANT_ID
      || '',
  ).trim();
  const serverId = String(
    process.env.SCUM_SERVER_ID
      || process.env.PLATFORM_SERVER_ID
      || '',
  ).trim();

  if (!baseUrl) {
    throw new Error(
      'SCUM_SYNC_CONTROL_PLANE_URL or PLATFORM_API_BASE_URL is required when SCUM_SYNC_TRANSPORT=control-plane|dual',
    );
  }
  const parsed = parseUrlOrThrow(baseUrl, 'SCUM_SYNC_CONTROL_PLANE_URL');
  if (isProduction && parsed.protocol !== 'https:' && !isLoopbackHost(parsed.hostname)) {
    throw new Error(
      'SCUM_SYNC_CONTROL_PLANE_URL must use https in production when not loopback',
    );
  }
  if (!token || token.length < 16) {
    throw new Error(
      'SCUM_SYNC_AGENT_TOKEN or PLATFORM_AGENT_TOKEN is required and should be at least 16 chars when SCUM_SYNC_TRANSPORT=control-plane|dual',
    );
  }
  if (!tenantId) {
    throw new Error(
      'SCUM_TENANT_ID (or TENANT_ID / PLATFORM_TENANT_ID) is required when SCUM_SYNC_TRANSPORT=control-plane|dual',
    );
  }
  if (!serverId) {
    throw new Error(
      'SCUM_SERVER_ID (or PLATFORM_SERVER_ID) is required when SCUM_SYNC_TRANSPORT=control-plane|dual',
    );
  }
}

function addPlatformPersistenceChecks() {
  const requireDb = isTruthy(process.env.PERSIST_REQUIRE_DB, isProduction);
  if (!requireDb) {
    return;
  }

  const forbiddenRuntimeBootstrapKeys = [
    'ADMIN_WEB_RUNTIME_BOOTSTRAP',
    'PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP',
    'PLATFORM_RAID_RUNTIME_BOOTSTRAP',
    'CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY',
  ];

  const requiredDbModeKeys = [
    'ADMIN_NOTIFICATION_STORE_MODE',
    'ADMIN_SECURITY_EVENT_STORE_MODE',
    'PLATFORM_AUTOMATION_STATE_STORE_MODE',
    'PLATFORM_OPS_STATE_STORE_MODE',
    'CONTROL_PLANE_REGISTRY_STORE_MODE',
  ];

  for (const envKey of requiredDbModeKeys) {
    const value = String(process.env[envKey] || '').trim().toLowerCase();
    if (value !== 'db') {
      throw new Error(`${envKey}=db is required when PERSIST_REQUIRE_DB=true`);
    }
  }

  const rawMirrorSlices = String(process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES || '').trim();
  if (!rawMirrorSlices) {
    throw new Error(
      'CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES must be set explicitly when CONTROL_PLANE_REGISTRY_STORE_MODE=db',
    );
  }

  const resolved = resolveControlPlaneRegistryFileMirrorSlices({
    env: process.env,
    persistenceMode: 'db',
  });
  if (resolved.invalid.length > 0) {
    throw new Error(
      `CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES contains unknown slices: ${resolved.invalid.join(', ')}`,
    );
  }

  const highChurnSlices = resolved.slices.filter((sliceKey) => (
    CONTROL_PLANE_REGISTRY_HIGH_CHURN_FILE_MIRROR_SLICES.includes(sliceKey)
  ));
  if (highChurnSlices.length > 0) {
    warnings.push(
      `CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES still includes high-churn slices: ${highChurnSlices.join(', ')}`,
    );
  }

  for (const envKey of forbiddenRuntimeBootstrapKeys) {
    const value = String(process.env[envKey] || '').trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(value)) {
      throw new Error(`${envKey} must stay disabled when PERSIST_REQUIRE_DB=true`);
    }
  }

  const {
    assertControlPlaneRegistryPersistenceReady,
  } = require('../src/data/repositories/controlPlaneRegistryRepository');

  assertControlPlaneRegistryPersistenceReady({
    requireDb: true,
  });
}

runCheck('load dotenv', () => {
  require('dotenv');
});

runCheck('load prisma client module', () => {
  require('../src/prismaClientLoader');
});

runCheck('load discord.js', () => {
  require('discord.js');
});

runCheck('root .env exists', () => {
  if (!fs.existsSync(ROOT_ENV_PATH)) {
    throw new Error(`Missing ${ROOT_ENV_PATH}`);
  }
});

runCheck('portal .env exists', () => {
  if (!fs.existsSync(PORTAL_ENV_PATH)) {
    throw new Error(`Missing ${PORTAL_ENV_PATH}`);
  }
});

runCheck('DATABASE_URL format', () => {
  const runtime = resolveDatabaseRuntime();
  if (runtime.engine === 'unsupported') {
    throw new Error(`Unsupported DATABASE_URL engine: ${runtime.rawUrl}`);
  }
  if (runtime.isSqlite && !runtime.filePath) {
    throw new Error('SQLite DATABASE_URL must point to a file path');
  }
  if (runtime.isServerEngine) {
    const schemaProvider = String(
      process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || runtime.engine,
    ).trim().toLowerCase();
    if (schemaProvider && ![runtime.engine, runtime.engine === 'postgresql' ? 'postgres' : runtime.engine].includes(schemaProvider)) {
      throw new Error(
        `PRISMA_SCHEMA_PROVIDER/DATABASE_PROVIDER (${schemaProvider}) does not match DATABASE_URL engine (${runtime.engine})`,
      );
    }
  }
});

runCheck('Prisma runtime provider/client readiness', () => {
  addPrismaRuntimeClientChecks();
});

runCheck('database deployment posture', () => {
  addDatabaseDeploymentChecks();
});

runCheck('prisma schema exists', () => {
  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Missing ${schemaPath}`);
  }
});

runCheck('admin reverse proxy / origins config', () => {
  addAdminReverseProxyChecks();
});

runCheck('player portal reverse proxy / origins config', () => {
  addPortalReverseProxyChecks();
});

runCheck('Discord OAuth redirect consistency', () => {
  addDiscordRedirectChecks();
});

runCheck('runtime ownership / worker drift', () => {
  addRuntimeOwnershipChecks();
});

runCheck('cookie scope / split-origin drift', () => {
  addCookieScopeChecks();
});

runCheck('auth/session hardening posture', () => {
  addAuthHardeningChecks();
});

runCheck('tracked mutable artifact hygiene', () => {
  addTrackedMutableArtifactChecks();
});

runCheck('RCON runtime consistency', () => {
  addRconChecks();
});

runCheck('sync control-plane routing consistency', () => {
  addAgentSyncControlPlaneChecks();
});

runCheck('platform persistence posture', () => {
  addPlatformPersistenceChecks();
});

runCheck('port matrix has no conflicts', () => {
  addPortConflictChecks();
});

const failed = checks.filter((c) => !c.ok);
const report = createValidationReport({
  kind: 'doctor',
  checks: checks.map((entry) => createValidationCheck(entry.name, {
    ok: entry.ok,
    detail: entry.error || '',
  })),
  warnings,
  errors: failed.map((entry) => `${entry.name} -> ${entry.error}`),
});

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const c of checks) {
    if (c.ok) {
      console.log(`OK: ${c.name}`);
    } else {
      console.error(`ERROR: ${c.name} -> ${c.error}`);
    }
  }

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }
}

if (!report.ok) {
  process.exit(1);
}
