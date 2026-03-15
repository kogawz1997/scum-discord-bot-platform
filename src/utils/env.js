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
  const adminTwoFactorEnabled = isTruthy(env.ADMIN_WEB_2FA_ENABLED);
  const adminTwoFactorSecret = String(env.ADMIN_WEB_2FA_SECRET || '').trim();
  const adminStepUpEnabled = isTruthy(env.ADMIN_WEB_STEP_UP_ENABLED);

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

  if (!playerBaseUrlParsed || playerBaseUrlParsed.protocol !== 'https:' || isLocalOrExampleOrigin(playerBaseUrlParsed)) {
    errors.push(
      'Production requires WEB_PORTAL_BASE_URL on a real HTTPS origin (not localhost/example.com).',
    );
  }

  if (!adminTwoFactorEnabled) {
    errors.push('Production requires ADMIN_WEB_2FA_ENABLED=true.');
  }
  if (!adminTwoFactorSecret || adminTwoFactorSecret.length < 16 || isLikelyPlaceholder(adminTwoFactorSecret)) {
    errors.push('Production requires ADMIN_WEB_2FA_SECRET with at least 16 characters.');
  }
  if (!adminStepUpEnabled) {
    errors.push('Production requires ADMIN_WEB_STEP_UP_ENABLED=true.');
  }

  if (!isTruthy(env.PERSIST_REQUIRE_DB)) {
    errors.push('Production requires PERSIST_REQUIRE_DB=true.');
  }

  if (isTruthy(env.PERSIST_LEGACY_SNAPSHOTS)) {
    errors.push('Production requires PERSIST_LEGACY_SNAPSHOTS=false.');
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
  const missing = getMissingEnv(['SCUM_LOG_PATH', 'DISCORD_GUILD_ID'], env);
  const errors = [];

  if (missing.length) {
    errors.push(`Missing required env: ${missing.join(', ')}`);
  }

  if (env.DISCORD_GUILD_ID && !isSnowflake(env.DISCORD_GUILD_ID)) {
    errors.push(
      'DISCORD_GUILD_ID must be a numeric snowflake (Server ID).',
    );
  }

  if (errors.length) exitWithErrors(errors);
}

function assertWorkerEnv(env = process.env) {
  const errors = getWorkerRuntimeErrors(env);
  if (errors.length) exitWithErrors(errors);
}

module.exports = {
  isSnowflake,
  isProduction,
  isLikelyPlaceholder,
  getMissingEnv,
  getProductionSecurityErrors,
  getWorkerRuntimeErrors,
  assertBotEnv,
  assertRegisterEnv,
  assertWatcherEnv,
  assertWorkerEnv,
};
