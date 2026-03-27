require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const { prisma } = require('../src/prisma');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const registryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');

function freshAdminWebServerModule() {
  for (const entry of [adminWebServerPath, persistPath, runtimeDataDirPath, registryPath]) {
    delete require.cache[entry];
  }
  return require(adminWebServerPath);
}

function randomPort() {
  return 40700 + Math.floor(Math.random() * 500);
}

async function cleanupPlatformTables() {
  await prisma.$transaction([
    prisma.platformMarketplaceOffer.deleteMany({}),
    prisma.platformAgentRuntime.deleteMany({}),
    prisma.platformWebhookEndpoint.deleteMany({}),
    prisma.platformApiKey.deleteMany({}),
    prisma.platformLicense.deleteMany({}),
    prisma.platformSubscription.deleteMany({}),
    prisma.platformTenant.deleteMany({}),
  ]);
}

test('platform provisioning brings a server bot online with setup token, register, and session heartbeat', async (t) => {
  await cleanupPlatformTables();

  const previousDataDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-server-bot-provision-'));
  process.env.BOT_DATA_DIR = tempDir;

  const port = randomPort();
  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_USER = 'platform_owner_server_bot_test';
  process.env.ADMIN_WEB_PASSWORD = 'platform_owner_server_bot_pass';
  process.env.ADMIN_WEB_USERS_JSON = '';
  process.env.ADMIN_WEB_2FA_ENABLED = 'false';

  const fakeClient = {
    guilds: { cache: new Map() },
    channels: { fetch: async () => null },
  };

  const { startAdminWebServer } = freshAdminWebServerModule();
  const server = startAdminWebServer(fakeClient);
  if (!server.listening) {
    await once(server, 'listening');
  }

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    process.env.BOT_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
    await cleanupPlatformTables();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  async function request(pathname, method = 'GET', body = null, cookie = '', extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (body != null) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  const login = await request('/admin/api/login', 'POST', {
    username: 'platform_owner_server_bot_test',
    password: 'platform_owner_server_bot_pass',
  });
  assert.equal(login.res.status, 200);
  const cookie = String(login.res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie);

  const tenantId = 'tenant-server-bot-provision';
  const serverId = 'server-server-bot-provision';
  const guildId = 'guild-server-bot-provision';
  const agentId = 'server-bot-provision';

  const tenantCreate = await request('/admin/api/platform/tenant', 'POST', {
    id: tenantId,
    slug: tenantId,
    name: 'Tenant Server Bot Provision',
    type: 'direct',
    ownerEmail: 'tenant-server-bot@example.com',
  }, cookie);
  assert.equal(tenantCreate.res.status, 200);

  const subscriptionCreate = await request('/admin/api/platform/subscription', 'POST', {
    tenantId,
    planId: 'platform-starter',
    amountCents: 490000,
  }, cookie);
  assert.equal(subscriptionCreate.res.status, 200);

  const serverCreate = await request('/admin/api/platform/server', 'POST', {
    tenantId,
    id: serverId,
    slug: serverId,
    name: 'Server Bot Provision Server',
    guildId,
  }, cookie);
  assert.equal(serverCreate.res.status, 200);

  const guildLink = await request('/admin/api/platform/server-discord-link', 'POST', {
    tenantId,
    serverId,
    guildId,
  }, cookie);
  assert.equal(guildLink.res.status, 200);

  const provision = await request('/admin/api/platform/agent-provision', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId,
    runtimeKey: 'server-bot-runtime',
    role: 'sync',
    scope: 'sync_only',
    minimumVersion: '2.0.0',
    expiresAt: '2026-12-31T00:00:00.000Z',
  }, cookie);
  assert.equal(provision.res.status, 200);
  assert.equal(provision.data.ok, true);
  const setupToken = String(provision.data.data?.rawSetupToken || '');
  assert.match(setupToken, /^stp_[a-f0-9]+\.[a-f0-9]+$/);
  assert.equal(String(provision.data.data?.bootstrap?.agentType || ''), 'sync');

  const activate = await request('/platform/api/v1/agent/activate', 'POST', {
    setupToken,
    machineFingerprint: 'server-bot-machine-a',
    hostname: 'server-bot-host',
    version: '2.0.0',
    runtimeKey: 'server-bot-runtime',
  });
  assert.equal(activate.res.status, 200);
  assert.equal(activate.data.ok, true);
  const rawAgentKey = String(activate.data.data?.rawKey || '');
  assert.match(rawAgentKey, /^sk_/);

  const register = await request('/platform/api/v1/agent/register', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId,
    runtimeKey: 'server-bot-runtime',
    role: 'sync',
    scope: 'sync_only',
    version: '2.0.0',
    baseUrl: 'http://127.0.0.1:3211',
    hostname: 'server-bot-host',
  }, '', {
    authorization: `Bearer ${rawAgentKey}`,
  });
  assert.equal(register.res.status, 200);
  assert.equal(register.data.ok, true);

  const session = await request('/platform/api/v1/agent/session', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId,
    runtimeKey: 'server-bot-runtime',
    sessionId: 'server-bot-session-1',
    heartbeatAt: '2026-03-27T12:00:00.000Z',
    baseUrl: 'http://127.0.0.1:3211',
    hostname: 'server-bot-host',
    diagnostics: {
      configRoot: 'C:\\SCUM\\Config',
      backupRoot: 'C:\\SCUM\\Config\\.control-plane-backups',
    },
  }, '', {
    authorization: `Bearer ${rawAgentKey}`,
  });
  assert.equal(session.res.status, 200);
  assert.equal(session.data.ok, true);

  const registry = await request(`/admin/api/platform/agent-registry?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(registry.res.status, 200);
  const registeredBot = registry.data.data.find((row) => String(row.agentId || '') === agentId);
  assert.ok(registeredBot);
  assert.equal(String(registeredBot.role || ''), 'sync');
  assert.equal(String(registeredBot.runtime?.runtimeKey || ''), 'server-bot-runtime');

  const runtimes = await request(`/admin/api/platform/agent-runtimes?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(runtimes.res.status, 200);
  const serverBotRuntime = runtimes.data.data.find((row) => String(row.runtimeKey || '') === 'server-bot-runtime');
  assert.ok(serverBotRuntime);
  assert.equal(String(serverBotRuntime.meta?.agentRole || ''), 'sync');

  const devices = await request(`/admin/api/platform/agent-devices?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(devices.res.status, 200);
  const serverBotDevice = devices.data.data.find((row) => String(row.agentId || '') === agentId);
  assert.ok(serverBotDevice);
  assert.equal(String(serverBotDevice.hostname || ''), 'server-bot-host');

  const revokeProvisioning = await request('/admin/api/platform/agent-provision/revoke', 'POST', {
    tenantId,
    tokenId: String(provision.data.data?.token?.id || ''),
    revokeReason: 'cleanup-after-activation',
  }, cookie);
  assert.equal(revokeProvisioning.res.status, 200);
  assert.equal(revokeProvisioning.data.ok, true);
  assert.equal(String(revokeProvisioning.data.data?.token?.status || ''), 'revoked');
});
