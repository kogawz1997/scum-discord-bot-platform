require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const { cleanupPlatformTenantFixtures } = require('./helpers/platformTestCleanup');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const registryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const TEST_TENANT_IDS = Object.freeze(['tenant-agent-api']);

function freshAdminWebServerModule() {
  for (const entry of [adminWebServerPath, persistPath, runtimeDataDirPath, registryPath]) {
    delete require.cache[entry];
  }
  return require(adminWebServerPath);
}

function randomPort() {
  return 39400 + Math.floor(Math.random() * 600);
}

function setScopedEnv(overrides) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined);
    process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }
      process.env[key] = value;
    }
  };
}

async function cleanupPlatformTables() {
  await cleanupPlatformTenantFixtures({
    tenantIds: TEST_TENANT_IDS,
  });
}

test('platform agent routes register scoped agents and ingest sync through the control plane', async (t) => {
  await cleanupPlatformTables();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-agent-api-'));

  const port = randomPort();
  const restoreEnv = setScopedEnv({
    BOT_DATA_DIR: tempDir,
    ADMIN_WEB_HOST: '127.0.0.1',
    ADMIN_WEB_PORT: String(port),
    ADMIN_WEB_USER: 'platform_owner_agent_test',
    ADMIN_WEB_PASSWORD: 'platform_owner_agent_pass',
    ADMIN_WEB_USERS_JSON: '',
    ADMIN_WEB_2FA_ENABLED: 'false',
    ADMIN_WEB_2FA_SECRET: '',
    ADMIN_WEB_LOCAL_RECOVERY: 'false',
  });

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
    restoreEnv();
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
    username: 'platform_owner_agent_test',
    password: 'platform_owner_agent_pass',
  });
  assert.equal(login.res.status, 200);
  const cookie = String(login.res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie);

  const tenantCreate = await request('/admin/api/platform/tenant', 'POST', {
    id: 'tenant-agent-api',
    slug: 'tenant-agent-api',
    name: 'Tenant Agent API',
    type: 'direct',
    ownerEmail: 'tenant-agent@example.com',
  }, cookie);
  assert.equal(tenantCreate.res.status, 200);

  const serverCreate = await request('/admin/api/platform/server', 'POST', {
    tenantId: 'tenant-agent-api',
    id: 'server-agent-api',
    slug: 'server-agent-api',
    name: 'Server Agent API',
    guildId: 'guild-agent-api',
  }, cookie);
  assert.equal(serverCreate.res.status, 200);
  assert.equal(serverCreate.data.ok, true);

  const guildLink = await request('/admin/api/platform/server-discord-link', 'POST', {
    tenantId: 'tenant-agent-api',
    serverId: 'server-agent-api',
    guildId: 'guild-agent-api',
  }, cookie);
  assert.equal(guildLink.res.status, 200);
  assert.equal(guildLink.data.ok, true);

  const syncToken = await request('/admin/api/platform/agent-token', 'POST', {
    tenantId: 'tenant-agent-api',
    serverId: 'server-agent-api',
    guildId: 'guild-agent-api',
    agentId: 'sync-agent-api',
    runtimeKey: 'sync-agent-runtime',
    role: 'sync',
    scope: 'sync_only',
    version: '1.0.0',
  }, cookie);
  assert.equal(syncToken.res.status, 200);
  assert.equal(syncToken.data.ok, true);
  const rawSyncKey = String(syncToken.data.data?.rawKey || '');
  assert.match(rawSyncKey, /^sk_/);

  const register = await request('/platform/api/v1/agent/register', 'POST', {
    tenantId: 'tenant-agent-api',
    serverId: 'server-agent-api',
    guildId: 'guild-agent-api',
    agentId: 'sync-agent-api',
    runtimeKey: 'sync-agent-runtime',
    role: 'sync',
    scope: 'sync_only',
    version: '1.0.0',
    baseUrl: 'http://127.0.0.1:3311',
  }, '', {
    'x-platform-api-key': rawSyncKey,
  });
  assert.equal(register.res.status, 200);
  assert.equal(register.data.ok, true);

  const session = await request('/platform/api/v1/agent/session', 'POST', {
    tenantId: 'tenant-agent-api',
    serverId: 'server-agent-api',
    guildId: 'guild-agent-api',
    agentId: 'sync-agent-api',
    runtimeKey: 'sync-agent-runtime',
    sessionId: 'agent-session-1',
    heartbeatAt: '2026-03-25T10:00:00.000Z',
    baseUrl: 'http://127.0.0.1:3311',
  }, '', {
    authorization: `Bearer ${rawSyncKey}`,
  });
  assert.equal(session.res.status, 200);
  assert.equal(session.data.ok, true);

  const heartbeat = await request('/platform/api/v1/agent/heartbeat', 'POST', {
    tenantId: 'tenant-agent-api',
    runtimeKey: 'sync-agent-runtime',
    version: '1.0.1',
    channel: 'watch',
    status: 'online',
    minRequiredVersion: '1.0.0',
    meta: {
      agentId: 'sync-agent-api',
      serverId: 'server-agent-api',
      guildId: 'guild-agent-api',
      agentRole: 'sync',
      agentScope: 'sync_only',
    },
  }, '', {
    'x-platform-api-key': rawSyncKey,
  });
  assert.equal(heartbeat.res.status, 200);
  assert.equal(heartbeat.data.ok, true);

  const sync = await request('/platform/api/v1/agent/sync', 'POST', {
    tenantId: 'tenant-agent-api',
    serverId: 'server-agent-api',
    guildId: 'guild-agent-api',
    agentId: 'sync-agent-api',
    runtimeKey: 'sync-agent-runtime',
    role: 'sync',
    scope: 'sync_only',
    channel: 'watch',
    version: '1.0.1',
    heartbeatAt: '2026-03-25T10:00:00.000Z',
    syncRunId: 'sync-run-1',
    events: [{ type: 'join', playerName: 'Tester' }],
  }, '', {
    'x-platform-api-key': rawSyncKey,
  });
  assert.equal(sync.res.status, 200, JSON.stringify(sync.data));
  assert.equal(sync.data.ok, true);
  assert.equal(sync.data.data.syncEvents.length, 1);

  const servers = await request('/admin/api/platform/servers', 'GET', null, cookie);
  assert.equal(servers.res.status, 200);
  assert.ok(servers.data.data.some((row) => String(row.id || '') === 'server-agent-api'));

  const links = await request('/admin/api/platform/server-discord-links', 'GET', null, cookie);
  assert.equal(links.res.status, 200);
  assert.ok(links.data.data.some((row) => String(row.guildId || '') === 'guild-agent-api'));

  const registry = await request('/admin/api/platform/agent-registry', 'GET', null, cookie);
  assert.equal(registry.res.status, 200);
  const registeredAgent = registry.data.data.find((row) => String(row.agentId || '') === 'sync-agent-api');
  assert.ok(registeredAgent);
  assert.equal(String(registeredAgent?.runtime?.runtimeKey || ''), 'sync-agent-runtime');
  assert.equal(String(registeredAgent?.runtime?.meta?.guildId || ''), 'guild-agent-api');

  const runtimes = await request('/admin/api/platform/agent-runtimes', 'GET', null, cookie);
  assert.equal(runtimes.res.status, 200);
  assert.ok(runtimes.data.data.some((row) => String(row.runtimeKey || '') === 'sync-agent-runtime'));

  const sessions = await request('/admin/api/platform/agent-sessions', 'GET', null, cookie);
  assert.equal(sessions.res.status, 200);
  assert.ok(sessions.data.data.some((row) => String(row.sessionId || '') === 'agent-session-1'));

  const syncRuns = await request('/admin/api/platform/sync-runs', 'GET', null, cookie);
  assert.equal(syncRuns.res.status, 200);
  assert.ok(syncRuns.data.data.some((row) => String(row.id || '') === 'sync-run-1'));

  const syncEvents = await request('/admin/api/platform/sync-events', 'GET', null, cookie);
  assert.equal(syncEvents.res.status, 200);
  assert.ok(syncEvents.data.data.some((row) => String(row.syncRunId || '') === 'sync-run-1'));
});
