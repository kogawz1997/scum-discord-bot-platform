const { validateCommandTemplate } = require('./commandTemplate');
const { resolveDatabaseRuntime } = require('./dbEngine');
const { resolveAgentStateSecret } = require('./agentStateSecret');

function isSnowflake(value) {
  return /^\d{15,25}$/.test(String(value || ''));
}

function isTruthy(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function isProduction(env = process.env) {
  return String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function parseOriginList(value) {
  const origins = [];
  for (const token of String(value || '').split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    try {
      origins.push(new URL(trimmed));
    } catch {}
  }
  return origins;
}

function isLocalOrExampleOrigin(origin) {
  if (!origin || !origin.hostname) return true;
  const hostname = String(origin.hostname || '').trim().toLowerCase();
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    return true;
  }
  return hostname.endsWith('.example.com') || hostname === 'example.com';
}

function isLikelyPlaceholder(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  const patterns = [
    'your_',
    'example',
    'changeme',
    'replace',
    'rotate_in_',
    'rotate_me',
    'token_here',
    'password_here',
    'put_a_',
    'placeholder',
    'xxx',
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

function getMissingEnv(keys, env = process.env) {
  return keys.filter((key) => !env[key] || String(env[key]).trim() === '');
}

function parseUrlOrNull(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function requireRealHttpsUrl(name, value, errors) {
  const parsed = parseUrlOrNull(value);
  if (!parsed) {
    errors.push(`${name} must be a valid URL.`);
    return;
  }
  if (parsed.protocol !== 'https:') {
    errors.push(`${name} must use https:// in production.`);
  }
  if (isLocalOrExampleOrigin(parsed)) {
    errors.push(`${name} must not use localhost/127.0.0.1/example.com in production.`);
  }
}

function requireHttpsWhenExternal(name, value, errors) {
  const parsed = parseUrlOrNull(value);
  if (!parsed) {
    errors.push(`${name} must be a valid URL.`);
    return;
  }
  if (!isLocalOrExampleOrigin(parsed) && parsed.protocol !== 'https:') {
    errors.push(`${name} must use https:// for non-local production origins.`);
  }
}

function resolveConfiguredControlPlaneBaseUrl(env = process.env) {
  const explicit = String(
    env.SCUM_SYNC_CONTROL_PLANE_URL
      || env.PLATFORM_API_BASE_URL
      || env.ADMIN_BACKEND_BASE_URL
      || env.ADMIN_WEB_BASE_URL
      || '',
  ).trim();
  if (explicit) return explicit;

  const adminHost = String(env.ADMIN_WEB_HOST || '127.0.0.1').trim() || '127.0.0.1';
  const adminPort = String(env.ADMIN_WEB_PORT || '').trim();
  if (!adminPort) return '';
  if (/^https?:\/\//i.test(adminHost)) {
    return `${adminHost.replace(/\/+$/, '')}:${adminPort}`;
  }
  return `http://${adminHost}:${adminPort}`;
}

function resolveSurfaceBaseUrl(envKey, hostKey, portKey, defaultPort, env = process.env) {
  const explicit = String(env[envKey] || '').trim();
  if (explicit) return explicit;
  const host = String(env[hostKey] || '127.0.0.1').trim() || '127.0.0.1';
  const port = String(env[portKey] || String(defaultPort)).trim() || String(defaultPort);
  return `http://${host}:${port}`;
}

function getConfiguredBillingProvider(env = process.env) {
  const normalized = String(env.PLATFORM_BILLING_PROVIDER || 'platform_local')
    .trim()
    .toLowerCase() || 'platform_local';
  return normalized === 'stripe_checkout' ? 'stripe' : normalized;
}

function resolveWatcherEnabled(env = process.env) {
  const explicit = String(env.SCUM_WATCHER_ENABLED || '').trim();
  if (explicit) {
    return isTruthy(explicit);
  }
  return String(env.SCUM_LOG_PATH || '').trim().length > 0;
}

function normalizeWatcherTransport(value) {
  const normalized = String(value || 'webhook').trim().toLowerCase() || 'webhook';
  return ['webhook', 'control-plane', 'dual'].includes(normalized)
    ? normalized
    : '';
}

function getProductionSecurityErrors(env = process.env) {
  if (!isProduction(env)) return [];

  const errors = [];
  const discordToken = String(env.DISCORD_TOKEN || '').trim();
  const webhookSecret = String(env.SCUM_WEBHOOK_SECRET || '').trim();
  const adminPassword = String(env.ADMIN_WEB_PASSWORD || '').trim();
  const adminToken = String(env.ADMIN_WEB_TOKEN || '').trim();
  const allowedOrigins = String(env.ADMIN_WEB_ALLOWED_ORIGINS || '').trim();
  const allowedOriginUrls = parseOriginList(allowedOrigins);
  const deliveryExecutionMode = String(
    env.DELIVERY_EXECUTION_MODE || 'rcon',
  ).trim().toLowerCase() || 'rcon';
  const playerBaseUrl = String(env.WEB_PORTAL_BASE_URL || '').trim();
  const playerBaseUrlParsed = playerBaseUrl ? parseOriginList(playerBaseUrl)[0] || null : null;
  const agentBaseUrl = String(env.SCUM_CONSOLE_AGENT_BASE_URL || '').trim();
  const agentPort = String(env.SCUM_CONSOLE_AGENT_PORT || '').trim();
  const adminLocalRecovery = isTruthy(env.ADMIN_WEB_LOCAL_RECOVERY);
  const adminTwoFactorEnabled = isTruthy(env.ADMIN_WEB_2FA_ENABLED);
  const adminTwoFactorSecret = String(env.ADMIN_WEB_2FA_SECRET || '').trim();
  const adminStepUpEnabled = isTruthy(env.ADMIN_WEB_STEP_UP_ENABLED);
  const dbRuntime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER || '',
  });
  const platformAgentSetupToken = String(
    env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN || '',
  ).trim();
  const dedicatedAgentStateSecret = String(
    env.PLATFORM_AGENT_STATE_SECRET || env.SCUM_PLATFORM_AGENT_STATE_SECRET || '',
  ).trim();
  const playerMagicLinkDebug = isTruthy(env.PLAYER_MAGIC_LINK_DEBUG_TOKENS);
  const publicPreviewDebug = isTruthy(env.PUBLIC_PREVIEW_DEBUG_TOKENS);

  if (!discordToken || isLikelyPlaceholder(discordToken)) {
    errors.push('Production requires a valid DISCORD_TOKEN (not placeholder).');
  }

  if (
    !webhookSecret ||
    webhookSecret.length < 24 ||
    isLikelyPlaceholder(webhookSecret)
  ) {
    errors.push(
      'Production requires SCUM_WEBHOOK_SECRET with at least 24 characters.',
    );
  }

  if (!adminLocalRecovery) {
    if (
      !adminPassword ||
      adminPassword.length < 12 ||
      isLikelyPlaceholder(adminPassword)
    ) {
      errors.push(
        'Production requires ADMIN_WEB_PASSWORD with at least 12 characters.',
      );
    }

    if (!adminToken || adminToken.length < 24 || isLikelyPlaceholder(adminToken)) {
      errors.push(
        'Production requires ADMIN_WEB_TOKEN with at least 24 characters.',
      );
    }

    if (!isTruthy(env.ADMIN_WEB_SECURE_COOKIE)) {
      errors.push('Production requires ADMIN_WEB_SECURE_COOKIE=true.');
    }

    if (!isTruthy(env.ADMIN_WEB_HSTS_ENABLED)) {
      errors.push('Production requires ADMIN_WEB_HSTS_ENABLED=true.');
    }

    if (
      String(env.ADMIN_WEB_ALLOW_TOKEN_QUERY || '').trim().toLowerCase() !==
      'false'
    ) {
      errors.push('Production requires ADMIN_WEB_ALLOW_TOKEN_QUERY=false.');
    }

    if (isTruthy(env.ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS)) {
      errors.push('Production requires ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS=false.');
    }

    if (!isTruthy(env.ADMIN_WEB_ENFORCE_ORIGIN_CHECK)) {
      errors.push('Production requires ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true.');
    }

    if (!allowedOrigins || allowedOrigins.includes('http://')) {
      errors.push(
        'Production requires strict HTTPS ADMIN_WEB_ALLOWED_ORIGINS (no http://).',
      );
    }
    if (allowedOriginUrls.length === 0 || allowedOriginUrls.some(isLocalOrExampleOrigin)) {
      errors.push(
        'Production requires non-local ADMIN_WEB_ALLOWED_ORIGINS (no localhost/127.0.0.1/example.com).',
      );
    }
  }

  if (!playerBaseUrlParsed || playerBaseUrlParsed.protocol !== 'https:' || isLocalOrExampleOrigin(playerBaseUrlParsed)) {
    errors.push(
      'Production requires WEB_PORTAL_BASE_URL on a real HTTPS origin (not localhost/example.com).',
    );
  }

  if (!adminLocalRecovery) {
    if (!adminTwoFactorEnabled) {
      errors.push('Production requires ADMIN_WEB_2FA_ENABLED=true.');
    }
    if (!adminTwoFactorSecret || adminTwoFactorSecret.length < 16 || isLikelyPlaceholder(adminTwoFactorSecret)) {
      errors.push('Production requires ADMIN_WEB_2FA_SECRET with at least 16 characters.');
    }
    if (!adminStepUpEnabled) {
      errors.push('Production requires ADMIN_WEB_STEP_UP_ENABLED=true.');
    }
  }

  if (!isTruthy(env.PERSIST_REQUIRE_DB)) {
    errors.push('Production requires PERSIST_REQUIRE_DB=true.');
  }

  if (isTruthy(env.PERSIST_LEGACY_SNAPSHOTS)) {
    errors.push('Production requires PERSIST_LEGACY_SNAPSHOTS=false.');
  }

  if (dbRuntime.engine !== 'postgresql') {
    errors.push(
      'Production requires PostgreSQL DATABASE_URL; SQLite/MySQL are not supported as the primary production runtime path.',
    );
  }

  if (playerMagicLinkDebug) {
    errors.push('Production requires PLAYER_MAGIC_LINK_DEBUG_TOKENS=false.');
  }

  if (publicPreviewDebug) {
    errors.push('Production requires PUBLIC_PREVIEW_DEBUG_TOKENS=false.');
  }

  if (platformAgentSetupToken && (!resolveAgentStateSecret(env) || !dedicatedAgentStateSecret)) {
    errors.push(
      'Production requires PLATFORM_AGENT_STATE_SECRET (or SCUM_PLATFORM_AGENT_STATE_SECRET) when using PLATFORM_AGENT_SETUP_TOKEN so agent token persistence remains encrypted and independently rotatable.',
    );
  }

  if (deliveryExecutionMode === 'agent') {
    const agentToken = String(env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
    if (!agentToken || agentToken.length < 16 || isLikelyPlaceholder(agentToken)) {
      errors.push(
        'Production agent mode requires SCUM_CONSOLE_AGENT_TOKEN with at least 16 characters.',
      );
    }
    if (!agentBaseUrl && !agentPort) {
      errors.push(
        'Production agent mode requires SCUM_CONSOLE_AGENT_BASE_URL or SCUM_CONSOLE_AGENT_PORT.',
      );
    }
  }

  return errors;
}

function getDatabaseRuntimeErrors(env = process.env) {
  const errors = [];
  const dbRuntime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER || '',
  });
  const topologyMode = String(env.TENANT_DB_TOPOLOGY_MODE || 'shared')
    .trim()
    .toLowerCase() || 'shared';

  if (dbRuntime.engine === 'unsupported') {
    errors.push(
      `Unsupported DATABASE_URL engine: ${String(env.DATABASE_URL || '').trim()}`,
    );
    return errors;
  }

  // Tenant database topology beyond shared mode is a PostgreSQL-first path here.
  if (
    ['schema-per-tenant', 'database-per-tenant'].includes(topologyMode)
    && dbRuntime.engine !== 'postgresql'
  ) {
    errors.push(
      `TENANT_DB_TOPOLOGY_MODE=${topologyMode} requires PostgreSQL DATABASE_URL.`,
    );
  }

  return errors;
}

function getRuntimeOwnershipErrors(env = process.env) {
  const errors = [];
  const botDeliveryEnabled = isTruthy(
    env.BOT_ENABLE_DELIVERY_WORKER == null ? 'true' : env.BOT_ENABLE_DELIVERY_WORKER,
  );
  const workerDeliveryEnabled = isTruthy(
    env.WORKER_ENABLE_DELIVERY == null ? 'true' : env.WORKER_ENABLE_DELIVERY,
  );

  // Do not let bot and worker both own the delivery worker role at once.
  if (botDeliveryEnabled && workerDeliveryEnabled) {
    errors.push(
      'Do not enable delivery worker on both bot and worker at the same time (BOT_ENABLE_DELIVERY_WORKER + WORKER_ENABLE_DELIVERY).',
    );
  }

  return errors;
}

function getWorkerRuntimeErrors(env = process.env) {
  const errors = [];
  const workerRentEnabled = isTruthy(
    env.WORKER_ENABLE_RENTBIKE == null ? 'true' : env.WORKER_ENABLE_RENTBIKE,
  );
  const workerDeliveryEnabled = isTruthy(
    env.WORKER_ENABLE_DELIVERY == null ? 'true' : env.WORKER_ENABLE_DELIVERY,
  );
  if (!workerRentEnabled && !workerDeliveryEnabled) {
    errors.push(
      'Worker requires at least one enabled service: WORKER_ENABLE_RENTBIKE or WORKER_ENABLE_DELIVERY.',
    );
  }
  errors.push(...getDatabaseRuntimeErrors(env));
  errors.push(...getRuntimeOwnershipErrors(env));
  return errors;
}

function getAdminRuntimeErrors(env = process.env) {
  const errors = [];
  if (!isProduction(env)) return errors;

  const adminPassword = String(env.ADMIN_WEB_PASSWORD || '').trim();
  const adminToken = String(env.ADMIN_WEB_TOKEN || '').trim();
  const adminTwoFactorSecret = String(env.ADMIN_WEB_2FA_SECRET || '').trim();
  const allowedOrigins = String(env.ADMIN_WEB_ALLOWED_ORIGINS || '').trim();
  const allowedOriginUrls = parseOriginList(allowedOrigins);

  if (isTruthy(env.ADMIN_WEB_LOCAL_RECOVERY)) {
    errors.push('Production requires ADMIN_WEB_LOCAL_RECOVERY=false.');
  }
  if (!adminPassword || adminPassword.length < 12 || isLikelyPlaceholder(adminPassword)) {
    errors.push('Production requires ADMIN_WEB_PASSWORD with at least 12 characters.');
  }
  if (!adminToken || adminToken.length < 24 || isLikelyPlaceholder(adminToken)) {
    errors.push('Production requires ADMIN_WEB_TOKEN with at least 24 characters.');
  }
  if (!isTruthy(env.ADMIN_WEB_SECURE_COOKIE)) {
    errors.push('Production requires ADMIN_WEB_SECURE_COOKIE=true.');
  }
  if (!isTruthy(env.ADMIN_WEB_HSTS_ENABLED)) {
    errors.push('Production requires ADMIN_WEB_HSTS_ENABLED=true.');
  }
  if (String(env.ADMIN_WEB_ALLOW_TOKEN_QUERY || '').trim().toLowerCase() !== 'false') {
    errors.push('Production requires ADMIN_WEB_ALLOW_TOKEN_QUERY=false.');
  }
  if (isTruthy(env.ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS)) {
    errors.push('Production requires ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS=false.');
  }
  if (!isTruthy(env.ADMIN_WEB_ENFORCE_ORIGIN_CHECK)) {
    errors.push('Production requires ADMIN_WEB_ENFORCE_ORIGIN_CHECK=true.');
  }
  if (!allowedOrigins || allowedOrigins.includes('http://')) {
    errors.push('Production requires strict HTTPS ADMIN_WEB_ALLOWED_ORIGINS (no http://).');
  }
  if (allowedOriginUrls.length === 0 || allowedOriginUrls.some(isLocalOrExampleOrigin)) {
    errors.push('Production requires non-local ADMIN_WEB_ALLOWED_ORIGINS (no localhost/127.0.0.1/example.com).');
  }
  if (!isTruthy(env.ADMIN_WEB_2FA_ENABLED)) {
    errors.push('Production requires ADMIN_WEB_2FA_ENABLED=true.');
  }
  if (!adminTwoFactorSecret || adminTwoFactorSecret.length < 16 || isLikelyPlaceholder(adminTwoFactorSecret)) {
    errors.push('Production requires ADMIN_WEB_2FA_SECRET with at least 16 characters.');
  }
  if (!isTruthy(env.ADMIN_WEB_STEP_UP_ENABLED)) {
    errors.push('Production requires ADMIN_WEB_STEP_UP_ENABLED=true.');
  }
  if (!isTruthy(env.PERSIST_REQUIRE_DB)) {
    errors.push('Production requires PERSIST_REQUIRE_DB=true.');
  }
  if (isTruthy(env.PERSIST_LEGACY_SNAPSHOTS)) {
    errors.push('Production requires PERSIST_LEGACY_SNAPSHOTS=false.');
  }

  errors.push(...getDatabaseRuntimeErrors(env));
  const dbRuntime = resolveDatabaseRuntime({
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER || '',
  });
  if (dbRuntime.engine !== 'postgresql') {
    errors.push('Production requires PostgreSQL DATABASE_URL; SQLite/MySQL are not supported as the primary production runtime path.');
  }

  return errors;
}

function getPortalRuntimeErrors(env = process.env) {
  const errors = [];
  if (!isProduction(env)) return errors;

  requireRealHttpsUrl('WEB_PORTAL_BASE_URL', env.WEB_PORTAL_BASE_URL, errors);

  const sessionSecret = String(env.WEB_PORTAL_SESSION_SECRET || '').trim();
  if (!sessionSecret || sessionSecret.length < 24 || isLikelyPlaceholder(sessionSecret)) {
    errors.push('Production requires WEB_PORTAL_SESSION_SECRET with at least 24 characters.');
  }
  if (!isTruthy(env.WEB_PORTAL_SECURE_COOKIE)) {
    errors.push('Production requires WEB_PORTAL_SECURE_COOKIE=true.');
  }
  if (!isTruthy(env.WEB_PORTAL_ENFORCE_ORIGIN_CHECK)) {
    errors.push('Production requires WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true.');
  }
  if (isTruthy(env.PUBLIC_PREVIEW_DEBUG_TOKENS)) {
    errors.push('Production requires PUBLIC_PREVIEW_DEBUG_TOKENS=false.');
  }
  if (isTruthy(env.PLAYER_MAGIC_LINK_DEBUG_TOKENS)) {
    errors.push('Production requires PLAYER_MAGIC_LINK_DEBUG_TOKENS=false.');
  }

  const portalMode = String(env.WEB_PORTAL_MODE || 'player').trim().toLowerCase() || 'player';
  if (portalMode === 'player') {
    const portalClientId = String(
      env.WEB_PORTAL_DISCORD_CLIENT_ID
        || env.ADMIN_WEB_SSO_DISCORD_CLIENT_ID
        || env.DISCORD_CLIENT_ID
        || '',
    ).trim();
    const portalClientSecret = String(
      env.WEB_PORTAL_DISCORD_CLIENT_SECRET
        || env.ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET
        || '',
    ).trim();
    if (!portalClientId || isLikelyPlaceholder(portalClientId)) {
      errors.push('Production player portal requires WEB_PORTAL_DISCORD_CLIENT_ID (or ADMIN_WEB_SSO_DISCORD_CLIENT_ID / DISCORD_CLIENT_ID fallback).');
    }
    if (!portalClientSecret || isLikelyPlaceholder(portalClientSecret)) {
      errors.push('Production player portal requires WEB_PORTAL_DISCORD_CLIENT_SECRET (or ADMIN_WEB_SSO_DISCORD_CLIENT_SECRET fallback).');
    }
  }

  const billingProvider = getConfiguredBillingProvider(env);
  if (billingProvider !== 'platform_local') {
    const webhookSecret = String(env.PLATFORM_BILLING_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret || webhookSecret.length < 24 || isLikelyPlaceholder(webhookSecret)) {
      errors.push('Production hosted billing requires PLATFORM_BILLING_WEBHOOK_SECRET with at least 24 characters.');
    }
  }
  if (billingProvider === 'stripe') {
    const stripeSecretKey = String(env.PLATFORM_BILLING_STRIPE_SECRET_KEY || '').trim();
    const stripePublishableKey = String(env.PLATFORM_BILLING_STRIPE_PUBLISHABLE_KEY || '').trim();
    if (!stripeSecretKey || isLikelyPlaceholder(stripeSecretKey)) {
      errors.push('Production Stripe billing requires PLATFORM_BILLING_STRIPE_SECRET_KEY.');
    }
    if (!stripePublishableKey || isLikelyPlaceholder(stripePublishableKey)) {
      errors.push('Production Stripe billing requires PLATFORM_BILLING_STRIPE_PUBLISHABLE_KEY.');
    }
  }

  return errors;
}

function getDeliveryAgentRuntimeErrors(env = process.env) {
  const errors = [];
  const backend = String(env.SCUM_CONSOLE_AGENT_BACKEND || 'exec').trim().toLowerCase() || 'exec';
  const execTemplate = String(env.SCUM_CONSOLE_AGENT_EXEC_TEMPLATE || '').trim();
  const setupToken = String(env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN || '').trim();
  const dedicatedAgentStateSecret = String(
    env.PLATFORM_AGENT_STATE_SECRET || env.SCUM_PLATFORM_AGENT_STATE_SECRET || '',
  ).trim();

  if (backend === 'exec') {
    if (!execTemplate) {
      errors.push('SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is required when SCUM_CONSOLE_AGENT_BACKEND=exec.');
    } else {
      try {
        validateCommandTemplate(execTemplate);
      } catch (error) {
        errors.push(`SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is not supported safely: ${error.message}`);
      }
    }
  }

  if (backend === 'process' && isTruthy(env.SCUM_CONSOLE_AGENT_AUTOSTART)) {
    const serverExe = String(env.SCUM_CONSOLE_AGENT_SERVER_EXE || '').trim();
    if (!serverExe) {
      errors.push('SCUM_CONSOLE_AGENT_SERVER_EXE is required when SCUM_CONSOLE_AGENT_BACKEND=process and SCUM_CONSOLE_AGENT_AUTOSTART=true.');
    }
  }

  if (!isProduction(env)) return errors;

  const token = String(env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
  if (!token || token.length < 16 || isLikelyPlaceholder(token)) {
    errors.push('Production delivery-agent requires SCUM_CONSOLE_AGENT_TOKEN with at least 16 characters.');
  }
  if (isTruthy(env.SCUM_CONSOLE_AGENT_ALLOW_NON_HASH)) {
    errors.push('Production requires SCUM_CONSOLE_AGENT_ALLOW_NON_HASH=false.');
  }
  if (setupToken && (!resolveAgentStateSecret(env) || !dedicatedAgentStateSecret)) {
    errors.push(
      'Production delivery-agent requires PLATFORM_AGENT_STATE_SECRET (or SCUM_PLATFORM_AGENT_STATE_SECRET) when PLATFORM_AGENT_SETUP_TOKEN is used.',
    );
  }

  return errors;
}

function getServerBotRuntimeErrors(env = process.env) {
  const errors = [];
  const templateKeys = [
    'SCUM_SERVER_APPLY_TEMPLATE',
    'SCUM_SERVER_RESTART_TEMPLATE',
    'SCUM_SERVER_START_TEMPLATE',
    'SCUM_SERVER_STOP_TEMPLATE',
  ];
  for (const key of templateKeys) {
    const template = String(env[key] || '').trim();
    if (!template) continue;
    try {
      validateCommandTemplate(template);
    } catch (error) {
      errors.push(`${key} is not supported safely: ${error.message}`);
    }
  }

  if (!isProduction(env)) return errors;

  const controlPlaneUrl = resolveConfiguredControlPlaneBaseUrl(env);
  const token = String(
    env.PLATFORM_AGENT_TOKEN
      || env.SCUM_SYNC_AGENT_TOKEN
      || env.SCUM_AGENT_TOKEN
      || '',
  ).trim();
  const setupToken = String(env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN || '').trim();
  const dedicatedAgentStateSecret = String(
    env.PLATFORM_AGENT_STATE_SECRET || env.SCUM_PLATFORM_AGENT_STATE_SECRET || '',
  ).trim();
  const tenantId = String(env.SCUM_TENANT_ID || env.TENANT_ID || env.PLATFORM_TENANT_ID || '').trim();
  const serverId = String(env.SCUM_SERVER_ID || env.PLATFORM_SERVER_ID || '').trim();
  const configRoot = String(
    env.SCUM_SERVER_CONFIG_ROOT || env.SCUM_SERVER_SETTINGS_DIR || env.SCUM_SERVER_DIR || '',
  ).trim();

  if (!controlPlaneUrl) {
    errors.push('Production server-bot requires SCUM_SYNC_CONTROL_PLANE_URL or PLATFORM_API_BASE_URL.');
  } else {
    requireHttpsWhenExternal('SCUM_SYNC_CONTROL_PLANE_URL / PLATFORM_API_BASE_URL', controlPlaneUrl, errors);
  }
  if (!token && !setupToken) {
    errors.push('Production server-bot requires PLATFORM_AGENT_TOKEN or PLATFORM_AGENT_SETUP_TOKEN.');
  }
  if (token && (token.length < 16 || isLikelyPlaceholder(token))) {
    errors.push('Production server-bot requires PLATFORM_AGENT_TOKEN with at least 16 characters.');
  }
  if (setupToken && (setupToken.length < 16 || isLikelyPlaceholder(setupToken))) {
    errors.push('Production server-bot requires PLATFORM_AGENT_SETUP_TOKEN with at least 16 characters.');
  }
  if (setupToken && (!resolveAgentStateSecret(env) || !dedicatedAgentStateSecret)) {
    errors.push(
      'Production server-bot requires PLATFORM_AGENT_STATE_SECRET (or SCUM_PLATFORM_AGENT_STATE_SECRET) when PLATFORM_AGENT_SETUP_TOKEN is used.',
    );
  }
  if (!tenantId) {
    errors.push('Production server-bot requires SCUM_TENANT_ID / TENANT_ID / PLATFORM_TENANT_ID.');
  }
  if (!serverId) {
    errors.push('Production server-bot requires SCUM_SERVER_ID / PLATFORM_SERVER_ID.');
  }
  if (!configRoot) {
    errors.push('Production server-bot requires SCUM_SERVER_CONFIG_ROOT (or SCUM_SERVER_SETTINGS_DIR / SCUM_SERVER_DIR).');
  }

  return errors;
}

function getStandaloneSurfaceRuntimeErrors(surface, env = process.env) {
  const errors = [];
  if (!isProduction(env)) return errors;

  const normalizedSurface = String(surface || '').trim().toLowerCase();
  const envKey = normalizedSurface === 'tenant' ? 'TENANT_WEB_BASE_URL' : 'OWNER_WEB_BASE_URL';
  const hostKey = normalizedSurface === 'tenant' ? 'TENANT_WEB_HOST' : 'OWNER_WEB_HOST';
  const portKey = normalizedSurface === 'tenant' ? 'TENANT_WEB_PORT' : 'OWNER_WEB_PORT';
  const defaultPort = normalizedSurface === 'tenant' ? 3202 : 3201;
  const surfaceBaseUrl = resolveSurfaceBaseUrl(envKey, hostKey, portKey, defaultPort, env);

  requireRealHttpsUrl(envKey, surfaceBaseUrl, errors);
  requireRealHttpsUrl('WEB_PORTAL_BASE_URL', env.WEB_PORTAL_BASE_URL, errors);

  const adminBackendBaseUrl = String(env.ADMIN_BACKEND_BASE_URL || '').trim();
  if (adminBackendBaseUrl) {
    requireHttpsWhenExternal('ADMIN_BACKEND_BASE_URL', adminBackendBaseUrl, errors);
  }

  return errors;
}

function getWatcherRuntimeErrors(env = process.env) {
  const errors = [];
  if (!resolveWatcherEnabled(env)) return errors;

  const missing = getMissingEnv(['SCUM_LOG_PATH', 'DISCORD_GUILD_ID'], env);
  if (missing.length) {
    errors.push(`Missing required env: ${missing.join(', ')}`);
  }

  if (env.DISCORD_GUILD_ID && !isSnowflake(env.DISCORD_GUILD_ID)) {
    errors.push('DISCORD_GUILD_ID must be a numeric snowflake (Server ID).');
  }

  const transport = normalizeWatcherTransport(env.SCUM_SYNC_TRANSPORT);
  if (!transport) {
    errors.push('SCUM_SYNC_TRANSPORT must be one of webhook, control-plane, or dual.');
    return errors;
  }

  if (transport === 'webhook' || transport === 'dual') {
    const webhookUrl = String(
      env.SCUM_WEBHOOK_URL || 'http://127.0.0.1:3100/scum-event',
    ).trim();
    const webhookSecret = String(env.SCUM_WEBHOOK_SECRET || '').trim();
    const parsedWebhookUrl = parseUrlOrNull(webhookUrl);

    if (!parsedWebhookUrl) {
      errors.push('SCUM_WEBHOOK_URL must be a valid URL when watcher transport includes webhook delivery.');
    } else if (isProduction(env) && !isLocalOrExampleOrigin(parsedWebhookUrl) && parsedWebhookUrl.protocol !== 'https:') {
      errors.push('SCUM_WEBHOOK_URL must use https:// for non-local production webhook delivery.');
    }

    if (isProduction(env) && (!webhookSecret || webhookSecret.length < 24 || isLikelyPlaceholder(webhookSecret))) {
      errors.push('Production watcher webhook delivery requires SCUM_WEBHOOK_SECRET with at least 24 characters.');
    }
  }

  if (transport === 'control-plane' || transport === 'dual') {
    const controlPlaneUrl = resolveConfiguredControlPlaneBaseUrl(env);
    const tenantId = String(
      env.SCUM_TENANT_ID || env.TENANT_ID || env.PLATFORM_TENANT_ID || '',
    ).trim();
    const serverId = String(env.SCUM_SERVER_ID || env.PLATFORM_SERVER_ID || '').trim();
    const setupToken = String(
      env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN || '',
    ).trim();
    const dedicatedAgentStateSecret = String(
      env.PLATFORM_AGENT_STATE_SECRET || env.SCUM_PLATFORM_AGENT_STATE_SECRET || '',
    ).trim();

    if (!controlPlaneUrl) {
      errors.push('Watcher control-plane sync requires SCUM_SYNC_CONTROL_PLANE_URL or PLATFORM_API_BASE_URL.');
    } else {
      requireHttpsWhenExternal(
        'SCUM_SYNC_CONTROL_PLANE_URL / PLATFORM_API_BASE_URL',
        controlPlaneUrl,
        errors,
      );
    }

    if (!tenantId) {
      errors.push('Watcher control-plane sync requires SCUM_TENANT_ID / TENANT_ID / PLATFORM_TENANT_ID.');
    }
    if (!serverId) {
      errors.push('Watcher control-plane sync requires SCUM_SERVER_ID / PLATFORM_SERVER_ID.');
    }
    if (
      isProduction(env)
      && setupToken
      && (!resolveAgentStateSecret(env) || !dedicatedAgentStateSecret)
    ) {
      errors.push(
        'Production watcher control-plane sync requires PLATFORM_AGENT_STATE_SECRET (or SCUM_PLATFORM_AGENT_STATE_SECRET) when PLATFORM_AGENT_SETUP_TOKEN is used.',
      );
    }
  }

  return errors;
}

function exitWithErrors(errors) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

function assertBotEnv(env = process.env) {
  const missing = getMissingEnv(['DISCORD_TOKEN'], env);
  const errors = [];

  if (missing.length) {
    errors.push(`Missing required env: ${missing.join(', ')}`);
  }

  if (env.DISCORD_GUILD_ID && !isSnowflake(env.DISCORD_GUILD_ID)) {
    errors.push('DISCORD_GUILD_ID should be a numeric snowflake.');
  }

  errors.push(...getProductionSecurityErrors(env));
  errors.push(...getDatabaseRuntimeErrors(env));
  errors.push(...getRuntimeOwnershipErrors(env));

  if (errors.length) exitWithErrors(errors);
}

function assertRegisterEnv(env = process.env) {
  const missing = getMissingEnv(
    ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'],
    env,
  );
  const errors = [];

  if (missing.length) {
    errors.push(`Missing required env: ${missing.join(', ')}`);
  }

  if (env.DISCORD_CLIENT_ID && !isSnowflake(env.DISCORD_CLIENT_ID)) {
    errors.push('DISCORD_CLIENT_ID must be a numeric snowflake.');
  }

  if (env.DISCORD_GUILD_ID && !isSnowflake(env.DISCORD_GUILD_ID)) {
    errors.push(
      'DISCORD_GUILD_ID must be a numeric snowflake (Server ID).',
    );
  }

  if (errors.length) exitWithErrors(errors);
}

function assertWatcherEnv(env = process.env) {
  const errors = getWatcherRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertWorkerEnv(env = process.env) {
  const errors = getWorkerRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertAdminRuntimeEnv(env = process.env) {
  const errors = getAdminRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertPortalEnv(env = process.env) {
  const errors = getPortalRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertDeliveryAgentEnv(env = process.env) {
  const errors = getDeliveryAgentRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertServerBotEnv(env = process.env) {
  const errors = getServerBotRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

function assertStandaloneSurfaceEnv(surface, env = process.env) {
  const errors = getStandaloneSurfaceRuntimeErrors(surface, env);
  if (errors.length) exitWithErrors(errors);
}

module.exports = {
  isSnowflake,
  isProduction,
  isLikelyPlaceholder,
  getMissingEnv,
  getProductionSecurityErrors,
  getDatabaseRuntimeErrors,
  getRuntimeOwnershipErrors,
  getWorkerRuntimeErrors,
  getAdminRuntimeErrors,
  getPortalRuntimeErrors,
  getDeliveryAgentRuntimeErrors,
  getServerBotRuntimeErrors,
  getStandaloneSurfaceRuntimeErrors,
  getWatcherRuntimeErrors,
  assertBotEnv,
  assertRegisterEnv,
  assertWatcherEnv,
  assertWorkerEnv,
  assertAdminRuntimeEnv,
  assertPortalEnv,
  assertDeliveryAgentEnv,
  assertServerBotEnv,
  assertStandaloneSurfaceEnv,
};
