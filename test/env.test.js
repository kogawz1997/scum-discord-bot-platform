const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isSnowflake,
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
} = require('../src/utils/env');

test('isSnowflake validates numeric Discord IDs', () => {
  assert.equal(isSnowflake('12345678901234567'), true);
  assert.equal(isSnowflake('abc'), false);
  assert.equal(isSnowflake('1234'), false);
});

test('getMissingEnv reports empty and missing keys', () => {
  const env = { A: 'ok', B: '', C: '  ' };
  assert.deepEqual(getMissingEnv(['A', 'B', 'C', 'D'], env), ['B', 'C', 'D']);
});

test('getProductionSecurityErrors blocks weak production config', () => {
  const errors = getProductionSecurityErrors({
    NODE_ENV: 'production',
    DISCORD_TOKEN: 'your_bot_token_here',
    SCUM_WEBHOOK_SECRET: 'short',
    ADMIN_WEB_PASSWORD: '1234',
    ADMIN_WEB_TOKEN: '',
    ADMIN_WEB_2FA_ENABLED: 'false',
    ADMIN_WEB_2FA_SECRET: 'short',
    ADMIN_WEB_STEP_UP_ENABLED: 'false',
    ADMIN_WEB_SECURE_COOKIE: 'false',
    ADMIN_WEB_HSTS_ENABLED: 'false',
    ADMIN_WEB_ALLOW_TOKEN_QUERY: 'true',
    ADMIN_WEB_ENFORCE_ORIGIN_CHECK: 'false',
    ADMIN_WEB_ALLOWED_ORIGINS: 'http://127.0.0.1:3200',
    WEB_PORTAL_BASE_URL: 'http://127.0.0.1:3300',
    PERSIST_REQUIRE_DB: 'false',
    PERSIST_LEGACY_SNAPSHOTS: 'true',
  });
  assert.ok(errors.length >= 5);
});

test('getProductionSecurityErrors passes strong production config', () => {
  const errors = getProductionSecurityErrors({
    NODE_ENV: 'production',
    DISCORD_TOKEN:
      'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0.NTQzMjE2.abcdefghijklmnopqrstuvwx',
    SCUM_WEBHOOK_SECRET: 'w'.repeat(32),
    ADMIN_WEB_PASSWORD: 'StrongPassword_12345',
    ADMIN_WEB_TOKEN: 't'.repeat(40),
    ADMIN_WEB_2FA_ENABLED: 'true',
    ADMIN_WEB_2FA_SECRET: 'A'.repeat(32),
    ADMIN_WEB_STEP_UP_ENABLED: 'true',
    ADMIN_WEB_SECURE_COOKIE: 'true',
    ADMIN_WEB_HSTS_ENABLED: 'true',
    ADMIN_WEB_ALLOW_TOKEN_QUERY: 'false',
    ADMIN_WEB_ENFORCE_ORIGIN_CHECK: 'true',
    ADMIN_WEB_ALLOWED_ORIGINS: 'https://admin.genz.noah-dns.online',
    WEB_PORTAL_BASE_URL: 'https://player.genz.noah-dns.online',
    DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum_th_platform?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PERSIST_REQUIRE_DB: 'true',
    PERSIST_LEGACY_SNAPSHOTS: 'false',
  });
  assert.deepEqual(errors, []);
});

test('getProductionSecurityErrors blocks SQLite production runtime', () => {
  const errors = getProductionSecurityErrors({
    NODE_ENV: 'production',
    DISCORD_TOKEN:
      'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0.NTQzMjE2.abcdefghijklmnopqrstuvwx',
    SCUM_WEBHOOK_SECRET: 'w'.repeat(32),
    ADMIN_WEB_PASSWORD: 'StrongPassword_12345',
    ADMIN_WEB_TOKEN: 't'.repeat(40),
    ADMIN_WEB_2FA_ENABLED: 'true',
    ADMIN_WEB_2FA_SECRET: 'A'.repeat(32),
    ADMIN_WEB_STEP_UP_ENABLED: 'true',
    ADMIN_WEB_SECURE_COOKIE: 'true',
    ADMIN_WEB_HSTS_ENABLED: 'true',
    ADMIN_WEB_ALLOW_TOKEN_QUERY: 'false',
    ADMIN_WEB_ENFORCE_ORIGIN_CHECK: 'true',
    ADMIN_WEB_ALLOWED_ORIGINS: 'https://admin.genz.noah-dns.online',
    WEB_PORTAL_BASE_URL: 'https://player.genz.noah-dns.online',
    DATABASE_URL: 'file:./prisma/dev.db',
    PERSIST_REQUIRE_DB: 'true',
    PERSIST_LEGACY_SNAPSHOTS: 'false',
  });

  assert.match(errors.join('\n'), /requires PostgreSQL DATABASE_URL/i);
});

test('getProductionSecurityErrors blocks production debug-token flags and setup-token activation without state secret', () => {
  const errors = getProductionSecurityErrors({
    NODE_ENV: 'production',
    DISCORD_TOKEN:
      'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0.NTQzMjE2.abcdefghijklmnopqrstuvwx',
    SCUM_WEBHOOK_SECRET: 'w'.repeat(32),
    ADMIN_WEB_PASSWORD: 'StrongPassword_12345',
    ADMIN_WEB_TOKEN: 't'.repeat(40),
    ADMIN_WEB_2FA_ENABLED: 'true',
    ADMIN_WEB_2FA_SECRET: 'A'.repeat(32),
    ADMIN_WEB_STEP_UP_ENABLED: 'true',
    ADMIN_WEB_SECURE_COOKIE: 'true',
    ADMIN_WEB_HSTS_ENABLED: 'true',
    ADMIN_WEB_ALLOW_TOKEN_QUERY: 'false',
    ADMIN_WEB_ENFORCE_ORIGIN_CHECK: 'true',
    ADMIN_WEB_ALLOWED_ORIGINS: 'https://admin.genz.noah-dns.online',
    WEB_PORTAL_BASE_URL: 'https://player.genz.noah-dns.online',
    DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum_th_platform?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PERSIST_REQUIRE_DB: 'true',
    PERSIST_LEGACY_SNAPSHOTS: 'false',
    PUBLIC_PREVIEW_DEBUG_TOKENS: 'true',
    PLAYER_MAGIC_LINK_DEBUG_TOKENS: 'true',
    PLATFORM_AGENT_SETUP_TOKEN: 'setup-token-12345678901234567890',
  });

  assert.match(errors.join('\n'), /PUBLIC_PREVIEW_DEBUG_TOKENS=false/i);
  assert.match(errors.join('\n'), /PLAYER_MAGIC_LINK_DEBUG_TOKENS=false/i);
  assert.match(errors.join('\n'), /PLATFORM_AGENT_STATE_SECRET/i);
});

test('getDatabaseRuntimeErrors blocks tenant topology on non-PostgreSQL engine', () => {
  const errors = getDatabaseRuntimeErrors({
    DATABASE_URL: 'file:./prisma/dev.db',
    TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
  });

  assert.match(errors.join('\n'), /schema-per-tenant requires PostgreSQL/i);
});

test('getRuntimeOwnershipErrors blocks duplicate delivery worker ownership', () => {
  const errors = getRuntimeOwnershipErrors({
    BOT_ENABLE_DELIVERY_WORKER: 'true',
    WORKER_ENABLE_DELIVERY: 'true',
  });

  assert.match(errors.join('\n'), /Do not enable delivery worker on both bot and worker/i);
});

test('getWorkerRuntimeErrors validates worker toggles', () => {
  const invalid = getWorkerRuntimeErrors({
    WORKER_ENABLE_RENTBIKE: 'false',
    WORKER_ENABLE_DELIVERY: 'false',
  });
  assert.equal(invalid.length > 0, true);

  const valid = getWorkerRuntimeErrors({
    WORKER_ENABLE_RENTBIKE: 'true',
    WORKER_ENABLE_DELIVERY: 'false',
  });
  assert.deepEqual(valid, []);
});

test('getAdminRuntimeErrors blocks insecure production admin backend toggles', () => {
  const errors = getAdminRuntimeErrors({
    NODE_ENV: 'production',
    ADMIN_WEB_PASSWORD: 'StrongPassword_12345',
    ADMIN_WEB_TOKEN: 't'.repeat(40),
    ADMIN_WEB_2FA_ENABLED: 'true',
    ADMIN_WEB_2FA_SECRET: 'A'.repeat(32),
    ADMIN_WEB_STEP_UP_ENABLED: 'true',
    ADMIN_WEB_SECURE_COOKIE: 'true',
    ADMIN_WEB_HSTS_ENABLED: 'true',
    ADMIN_WEB_ALLOW_TOKEN_QUERY: 'false',
    ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS: 'true',
    ADMIN_WEB_ENFORCE_ORIGIN_CHECK: 'true',
    ADMIN_WEB_ALLOWED_ORIGINS: 'https://admin.genz.noah-dns.online',
    DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum_th_platform?schema=public',
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    PERSIST_REQUIRE_DB: 'true',
    PERSIST_LEGACY_SNAPSHOTS: 'false',
  });

  assert.match(errors.join('\n'), /ALLOW_TOKEN_SENSITIVE_MUTATIONS=false/i);
});

test('getPortalRuntimeErrors blocks insecure production portal config', () => {
  const errors = getPortalRuntimeErrors({
    NODE_ENV: 'production',
    WEB_PORTAL_BASE_URL: 'http://127.0.0.1:3300',
    WEB_PORTAL_SESSION_SECRET: '',
    WEB_PORTAL_SECURE_COOKIE: 'false',
    WEB_PORTAL_ENFORCE_ORIGIN_CHECK: 'false',
    WEB_PORTAL_MODE: 'player',
    WEB_PORTAL_DISCORD_CLIENT_ID: '',
    WEB_PORTAL_DISCORD_CLIENT_SECRET: '',
    WEB_PORTAL_GOOGLE_CLIENT_ID: '',
    WEB_PORTAL_GOOGLE_CLIENT_SECRET: '',
    PUBLIC_PREVIEW_DEBUG_TOKENS: 'true',
    PLAYER_MAGIC_LINK_DEBUG_TOKENS: 'true',
    PLATFORM_BILLING_PROVIDER: 'stripe',
    PLATFORM_BILLING_WEBHOOK_SECRET: '',
    PLATFORM_BILLING_STRIPE_SECRET_KEY: '',
    PLATFORM_BILLING_STRIPE_PUBLISHABLE_KEY: '',
  });

  const combined = errors.join('\n');
  assert.match(combined, /WEB_PORTAL_BASE_URL/i);
  assert.match(combined, /WEB_PORTAL_SESSION_SECRET/i);
  assert.match(combined, /WEB_PORTAL_SECURE_COOKIE=true/i);
  assert.match(combined, /WEB_PORTAL_ENFORCE_ORIGIN_CHECK=true/i);
  assert.match(combined, /at least one OAuth provider: Discord or Google/i);
  assert.match(combined, /PUBLIC_PREVIEW_DEBUG_TOKENS=false/i);
  assert.match(combined, /PLAYER_MAGIC_LINK_DEBUG_TOKENS=false/i);
  assert.match(combined, /PLATFORM_BILLING_WEBHOOK_SECRET/i);
  assert.match(combined, /PLATFORM_BILLING_STRIPE_SECRET_KEY/i);
});

test('getDeliveryAgentRuntimeErrors blocks insecure production delivery-agent config', () => {
  const errors = getDeliveryAgentRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_CONSOLE_AGENT_BACKEND: 'exec',
    SCUM_CONSOLE_AGENT_EXEC_TEMPLATE: 'powershell -Command {command}',
    SCUM_CONSOLE_AGENT_TOKEN: 'short',
    SCUM_CONSOLE_AGENT_ALLOW_NON_HASH: 'true',
    PLATFORM_AGENT_SETUP_TOKEN: 'setup-token-12345678901234567890',
  });

  const combined = errors.join('\n');
  assert.match(combined, /SCUM_CONSOLE_AGENT_TOKEN/i);
  assert.match(combined, /SCUM_CONSOLE_AGENT_ALLOW_NON_HASH=false/i);
  assert.match(combined, /PLATFORM_AGENT_STATE_SECRET/i);
});

test('getDeliveryAgentRuntimeErrors blocks incomplete production managed delivery-agent config', () => {
  const errors = getDeliveryAgentRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_CONSOLE_AGENT_BACKEND: 'exec',
    SCUM_CONSOLE_AGENT_EXEC_TEMPLATE: 'powershell -Command {command}',
    SCUM_CONSOLE_AGENT_TOKEN: 'console-token-1234567890',
    PLATFORM_API_BASE_URL: 'http://control.platform.example.net',
    PLATFORM_AGENT_TOKEN: 'short',
  });

  const combined = errors.join('\n');
  assert.match(combined, /PLATFORM_API_BASE_URL \/ SCUM_SYNC_CONTROL_PLANE_URL/i);
  assert.match(combined, /PLATFORM_AGENT_TOKEN with at least 16 characters/i);
  assert.match(combined, /PLATFORM_TENANT_ID/i);
  assert.match(combined, /PLATFORM_SERVER_ID/i);
});

test('getDeliveryAgentRuntimeErrors accepts strong production managed delivery-agent config', () => {
  const errors = getDeliveryAgentRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_CONSOLE_AGENT_BACKEND: 'exec',
    SCUM_CONSOLE_AGENT_EXEC_TEMPLATE: 'powershell -Command {command}',
    SCUM_CONSOLE_AGENT_TOKEN: 'console-token-1234567890',
    SCUM_CONSOLE_AGENT_ALLOW_NON_HASH: 'false',
    PLATFORM_API_BASE_URL: 'https://control.platform.example.net',
    PLATFORM_AGENT_TOKEN: 'agent-token-12345678901234567890',
    PLATFORM_TENANT_ID: 'tenant-live-001',
    PLATFORM_SERVER_ID: 'server-live-001',
  });

  assert.deepEqual(errors, []);
});

test('getServerBotRuntimeErrors blocks insecure production server-bot config', () => {
  const errors = getServerBotRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_SYNC_CONTROL_PLANE_URL: 'http://control.platform.localhost.test',
    PLATFORM_AGENT_SETUP_TOKEN: 'setup-token-12345678901234567890',
    SCUM_TENANT_ID: '',
    SCUM_SERVER_ID: '',
    SCUM_SERVER_CONFIG_ROOT: '',
    SCUM_SERVER_APPLY_TEMPLATE: 'powershell -Command {command}',
  });

  const combined = errors.join('\n');
  assert.match(combined, /https/i);
  assert.match(combined, /PLATFORM_AGENT_STATE_SECRET/i);
  assert.match(combined, /SCUM_TENANT_ID/i);
  assert.match(combined, /SCUM_SERVER_ID/i);
  assert.match(combined, /SCUM_SERVER_CONFIG_ROOT/i);
});

test('getStandaloneSurfaceRuntimeErrors blocks insecure production owner surface config', () => {
  const errors = getStandaloneSurfaceRuntimeErrors('owner', {
    NODE_ENV: 'production',
    OWNER_WEB_HOST: '127.0.0.1',
    OWNER_WEB_PORT: '3201',
    WEB_PORTAL_BASE_URL: 'http://127.0.0.1:3300',
  });

  const combined = errors.join('\n');
  assert.match(combined, /OWNER_WEB_BASE_URL/i);
  assert.match(combined, /WEB_PORTAL_BASE_URL/i);
});

test('getWatcherRuntimeErrors blocks insecure production watcher transport config', () => {
  const errors = getWatcherRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_WATCHER_ENABLED: 'true',
    SCUM_LOG_PATH: 'C:\\SCUM\\Saved\\Logs\\SCUM.log',
    DISCORD_GUILD_ID: '12345678901234567',
    SCUM_SYNC_TRANSPORT: 'dual',
    SCUM_WEBHOOK_URL: 'http://watcher.platform.example.net/scum-event',
    SCUM_WEBHOOK_SECRET: 'short',
    SCUM_SYNC_CONTROL_PLANE_URL: 'http://control.platform.example.net',
    PLATFORM_AGENT_SETUP_TOKEN: 'setup-token-12345678901234567890',
    SCUM_TENANT_ID: '',
    SCUM_SERVER_ID: '',
  });

  const combined = errors.join('\n');
  assert.match(combined, /SCUM_WEBHOOK_URL/i);
  assert.match(combined, /SCUM_WEBHOOK_SECRET/i);
  assert.match(combined, /SCUM_SYNC_CONTROL_PLANE_URL/i);
  assert.match(combined, /SCUM_TENANT_ID/i);
  assert.match(combined, /SCUM_SERVER_ID/i);
  assert.match(combined, /PLATFORM_AGENT_STATE_SECRET/i);
});

test('getWatcherRuntimeErrors accepts strong production watcher transport config', () => {
  const errors = getWatcherRuntimeErrors({
    NODE_ENV: 'production',
    SCUM_WATCHER_ENABLED: 'true',
    SCUM_LOG_PATH: 'C:\\SCUM\\Saved\\Logs\\SCUM.log',
    DISCORD_GUILD_ID: '12345678901234567',
    SCUM_SYNC_TRANSPORT: 'dual',
    SCUM_WEBHOOK_URL: 'https://watcher.platform.example.net/scum-event',
    SCUM_WEBHOOK_SECRET: 'w'.repeat(32),
    SCUM_SYNC_CONTROL_PLANE_URL: 'https://control.platform.example.net',
    SCUM_TENANT_ID: 'tenant-live-001',
    SCUM_SERVER_ID: 'server-live-001',
    PLATFORM_AGENT_TOKEN: 'agent-token-12345678901234567890',
  });

  assert.deepEqual(errors, []);
});
