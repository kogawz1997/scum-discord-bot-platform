const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

function runEntrypoint(relativePath, overrides = {}) {
  const entrypoint = path.resolve(projectRoot, relativePath);
  return spawnSync(process.execPath, [entrypoint], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PLATFORM_DISCORD_ONLY: 'false',
      NODE_ENV: 'production',
      ...overrides,
    },
    encoding: 'utf8',
    timeout: 12000,
    windowsHide: true,
  });
}

function assertFailedWith(result, pattern) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.notEqual(result.status, 0, output || 'expected non-zero exit status');
  assert.match(output, pattern);
}

test('api entrypoint fails fast when local recovery remains enabled in production', () => {
  const result = runEntrypoint('apps/api/server.js', {
    ADMIN_WEB_LOCAL_RECOVERY: 'true',
  });

  assertFailedWith(result, /ADMIN_WEB_LOCAL_RECOVERY=false/i);
});

test('portal entrypoint fails fast when public preview debug tokens stay enabled in production', () => {
  const result = runEntrypoint('apps/web-portal-standalone/server.js', {
    WEB_PORTAL_BASE_URL: 'https://player.example.net',
    WEB_PORTAL_SESSION_SECRET: 'portal-session-secret-1234567890',
    WEB_PORTAL_SECURE_COOKIE: 'true',
    WEB_PORTAL_ENFORCE_ORIGIN_CHECK: 'true',
    WEB_PORTAL_MODE: 'player',
    WEB_PORTAL_DISCORD_CLIENT_ID: '1478651427088760842',
    WEB_PORTAL_DISCORD_CLIENT_SECRET: 'portal-secret-1234567890',
    PUBLIC_PREVIEW_DEBUG_TOKENS: 'true',
  });

  assertFailedWith(result, /PUBLIC_PREVIEW_DEBUG_TOKENS=false/i);
});

test('owner-web entrypoint fails fast when base url is non-https in production', () => {
  const result = runEntrypoint('apps/owner-web/server.js', {
    OWNER_WEB_BASE_URL: 'http://owner.platform.example.net',
    WEB_PORTAL_BASE_URL: 'https://player.example.net',
  });

  assertFailedWith(result, /OWNER_WEB_BASE_URL must use https/i);
});

test('tenant-web entrypoint fails fast when base url is non-https in production', () => {
  const result = runEntrypoint('apps/tenant-web/server.js', {
    TENANT_WEB_BASE_URL: 'http://tenant.platform.example.net',
    WEB_PORTAL_BASE_URL: 'https://player.example.net',
  });

  assertFailedWith(result, /TENANT_WEB_BASE_URL must use https/i);
});

test('server-bot entrypoint fails fast when control-plane url is non-https in production', () => {
  const result = runEntrypoint('apps/server-bot/server.js', {
    SCUM_SYNC_CONTROL_PLANE_URL: 'http://control.platform.example.net',
    PLATFORM_AGENT_TOKEN: 'agent-token-12345678901234567890',
    SCUM_TENANT_ID: 'tenant-live-001',
    SCUM_SERVER_ID: 'server-live-001',
    SCUM_SERVER_CONFIG_ROOT: 'C:\\new',
  });

  assertFailedWith(result, /SCUM_SYNC_CONTROL_PLANE_URL \/ PLATFORM_API_BASE_URL/i);
});

test('delivery-agent entrypoint fails fast when non-hash commands remain enabled in production', () => {
  const result = runEntrypoint('src/scum-console-agent.js', {
    SCUM_CONSOLE_AGENT_BACKEND: 'exec',
    SCUM_CONSOLE_AGENT_EXEC_TEMPLATE: 'echo {command}',
    SCUM_CONSOLE_AGENT_TOKEN: 'agent-token-12345678901234567890',
    SCUM_CONSOLE_AGENT_ALLOW_NON_HASH: 'true',
  });

  assertFailedWith(result, /SCUM_CONSOLE_AGENT_ALLOW_NON_HASH=false/i);
});

test('watcher entrypoint fails fast when dual transport uses insecure external urls in production', () => {
  const result = runEntrypoint('apps/watcher/server.js', {
    SCUM_WATCHER_ENABLED: 'true',
    SCUM_LOG_PATH: 'C:\\SCUM\\Saved\\Logs\\SCUM.log',
    DISCORD_GUILD_ID: '12345678901234567',
    SCUM_SYNC_TRANSPORT: 'dual',
    SCUM_WEBHOOK_URL: 'http://watcher.platform.example.net/scum-event',
    SCUM_WEBHOOK_SECRET: 'webhook-secret-12345678901234567890',
    SCUM_SYNC_CONTROL_PLANE_URL: 'http://control.platform.example.net',
    SCUM_TENANT_ID: 'tenant-live-001',
    SCUM_SERVER_ID: 'server-live-001',
    PLATFORM_AGENT_TOKEN: 'agent-token-12345678901234567890',
  });

  assertFailedWith(result, /SCUM_WEBHOOK_URL must use https/i);
});
