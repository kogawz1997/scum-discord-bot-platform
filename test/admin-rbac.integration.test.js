const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');

const {
  setAdminRestoreState,
} = require('../src/store/adminRestoreStateStore');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');

function freshAdminWebServerModule() {
  delete require.cache[adminWebServerPath];
  return require(adminWebServerPath);
}

function randomPort(base = 40500, span = 500) {
  return base + Math.floor(Math.random() * span);
}

function resetRestoreMaintenanceState() {
  setAdminRestoreState({
    status: 'idle',
    active: false,
    maintenance: false,
    backup: null,
    confirmBackup: null,
    rollbackBackup: null,
    actor: null,
    role: null,
    startedAt: null,
    endedAt: null,
    updatedAt: new Date().toISOString(),
    lastCompletedAt: null,
    durationMs: null,
    lastError: null,
    rollbackStatus: 'none',
    rollbackError: null,
    counts: null,
    currentCounts: null,
    diff: null,
    warnings: [],
    previewToken: null,
    previewBackup: null,
    previewIssuedAt: null,
    previewExpiresAt: null,
  });
}

async function login(baseUrl, username, password) {
  const res = await fetch(`${baseUrl}/admin/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  assert.equal(res.status, 200, JSON.stringify(data));
  const cookie = String(res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie, 'expected login cookie');
  return cookie;
}

test('admin RBAC blocks owner-only routes for mod role', async (t) => {
  const port = randomPort();
  resetRestoreMaintenanceState();
  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_TOKEN = 'token_rbac';
  process.env.ADMIN_WEB_2FA_ENABLED = 'false';
  process.env.ADMIN_WEB_USERS_JSON = JSON.stringify([
    { username: 'mod_user', password: 'mod_pass', role: 'mod' },
    { username: 'owner_user', password: 'owner_pass', role: 'owner' },
  ]);

  const fakeClient = {
    guilds: {
      cache: new Map(),
    },
    channels: {
      fetch: async () => null,
    },
  };

  const { startAdminWebServer } = freshAdminWebServerModule();
  const server = startAdminWebServer(fakeClient);
  if (!server.listening) {
    await once(server, 'listening');
  }

  t.after(async () => {
    resetRestoreMaintenanceState();
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[adminWebServerPath];
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const modCookie = await login(baseUrl, 'mod_user', 'mod_pass');
  const ownerCookie = await login(baseUrl, 'owner_user', 'owner_pass');

  const modResetRes = await fetch(`${baseUrl}/admin/api/config/reset`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: modCookie,
    },
    body: JSON.stringify({}),
  });
  const modResetData = await modResetRes.json().catch(() => ({}));
  assert.equal(modResetRes.status, 403);
  assert.equal(modResetData.ok, false);

  const modTicketRes = await fetch(`${baseUrl}/admin/api/ticket/close`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: modCookie,
    },
    body: JSON.stringify({ channelId: 'ticket-not-found' }),
  });
  assert.notEqual(modTicketRes.status, 403, 'mod should be allowed to close ticket route');

  const ownerResetRes = await fetch(`${baseUrl}/admin/api/config/reset`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: ownerCookie,
    },
    body: JSON.stringify({}),
  });
  const ownerResetData = await ownerResetRes.json().catch(() => ({}));
  assert.equal(ownerResetRes.status, 200, JSON.stringify(ownerResetData));
  assert.equal(ownerResetData.ok, true);
});
