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
  return 40100 + Math.floor(Math.random() * 500);
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

test('platform provisioning activates device-bound agents and exposes package and feature access', async (t) => {
  await cleanupPlatformTables();

  const previousDataDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-agent-provision-'));
  process.env.BOT_DATA_DIR = tempDir;

  const port = randomPort();
  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_USER = 'platform_owner_provision_test';
  process.env.ADMIN_WEB_PASSWORD = 'platform_owner_provision_pass';
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
    username: 'platform_owner_provision_test',
    password: 'platform_owner_provision_pass',
  });
  assert.equal(login.res.status, 200);
  const cookie = String(login.res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie);

  const tenantId = 'tenant-agent-provision';
  const serverId = 'server-agent-provision';
  const guildId = 'guild-agent-provision';
  const agentId = 'execute-agent-provision';

  const tenantCreate = await request('/admin/api/platform/tenant', 'POST', {
    id: tenantId,
    slug: tenantId,
    name: 'Tenant Agent Provision',
    type: 'direct',
    ownerEmail: 'tenant-agent-provision@example.com',
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
    name: 'Server Agent Provision',
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
    runtimeKey: 'execute-agent-runtime',
    role: 'execute',
    scope: 'execute_only',
    minimumVersion: '1.2.3',
    expiresAt: '2026-12-31T00:00:00.000Z',
  }, cookie);
  assert.equal(provision.res.status, 200);
  assert.equal(provision.data.ok, true);
  const setupToken = String(provision.data.data?.rawSetupToken || '');
  assert.match(setupToken, /^stp_[a-f0-9]+\.[a-f0-9]+$/);
  assert.equal(String(provision.data.data?.bootstrap?.agentType || ''), 'execute');

  const activate = await request('/platform/api/v1/agent/activate', 'POST', {
    setupToken,
    machineFingerprint: 'machine-fingerprint-a',
    hostname: 'machine-a',
    version: '1.2.3',
    runtimeKey: 'execute-agent-runtime',
  });
  assert.equal(activate.res.status, 200);
  assert.equal(activate.data.ok, true);
  const rawAgentKey = String(activate.data.data?.rawKey || '');
  assert.match(rawAgentKey, /^sk_/);

  const activateAgain = await request('/platform/api/v1/agent/activate', 'POST', {
    setupToken,
    machineFingerprint: 'machine-fingerprint-b',
  });
  assert.equal(activateAgain.res.status, 400);
  assert.equal(String(activateAgain.data.error || ''), 'setup-token-consumed');

  const register = await request('/platform/api/v1/agent/register', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId,
    runtimeKey: 'execute-agent-runtime',
    role: 'execute',
    scope: 'execute_only',
    version: '1.2.3',
  }, '', {
    'x-platform-api-key': rawAgentKey,
  });
  assert.equal(register.res.status, 200);

  const featureAccess = await request('/platform/api/v1/features/self', 'GET', null, '', {
    authorization: `Bearer ${rawAgentKey}`,
  });
  assert.equal(featureAccess.res.status, 200);
  assert.equal(String(featureAccess.data.data?.package?.id || ''), 'BOT_LOG_DELIVERY');
  assert.ok(featureAccess.data.data.enabledFeatureKeys.includes('execute_agent'));

  const packages = await request('/admin/api/platform/packages', 'GET', null, cookie);
  assert.equal(packages.res.status, 200);
  assert.ok(packages.data.data.some((entry) => String(entry.id || '') === 'FULL_OPTION'));

  const features = await request('/admin/api/platform/features', 'GET', null, cookie);
  assert.equal(features.res.status, 200);
  assert.ok(features.data.data.some((entry) => String(entry.key || '') === 'server_status'));

  const tenantFeatureAccess = await request(`/admin/api/platform/tenant-feature-access?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(tenantFeatureAccess.res.status, 200);
  assert.ok(tenantFeatureAccess.data.data.enabledFeatureKeys.includes('execute_agent'));

  const provisioningRows = await request(`/admin/api/platform/agent-provisioning?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(provisioningRows.res.status, 200);
  assert.ok(provisioningRows.data.data.some((entry) => String(entry.status || '') === 'consumed'));

  const deviceRows = await request(`/admin/api/platform/agent-devices?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(deviceRows.res.status, 200);
  assert.ok(deviceRows.data.data.some((entry) => String(entry.agentId || '') === agentId));

  const credentialRows = await request(`/admin/api/platform/agent-credentials?tenantId=${tenantId}`, 'GET', null, cookie);
  assert.equal(credentialRows.res.status, 200);
  assert.ok(credentialRows.data.data.some((entry) => String(entry.agentId || '') === agentId));
});
