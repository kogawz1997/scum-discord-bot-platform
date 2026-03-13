const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');

const { prisma } = require('../src/prisma');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');

function freshAdminWebServerModule() {
  delete require.cache[adminWebServerPath];
  return require(adminWebServerPath);
}

function randomPort(base = 39050, span = 300) {
  return base + Math.floor(Math.random() * span);
}

test('admin audit presets support private/public/role sharing', async (t) => {
  const port = randomPort();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const modUser = `mod_${suffix}`;
  const adminUser = `admin_${suffix}`;
  const ownerUser = `owner_${suffix}`;
  const createdPresetIds = [];

  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_USER = ownerUser;
  process.env.ADMIN_WEB_PASSWORD = 'owner_pass';
  process.env.ADMIN_WEB_TOKEN = `token_${suffix}`;
  process.env.ADMIN_WEB_USERS_JSON = JSON.stringify([
    { username: modUser, password: 'mod_pass', role: 'mod' },
    { username: adminUser, password: 'admin_pass', role: 'admin' },
    { username: ownerUser, password: 'owner_pass', role: 'owner' },
  ]);
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
    if (createdPresetIds.length > 0) {
      await prisma.adminAuditPreset.deleteMany({
        where: { id: { in: createdPresetIds } },
      }).catch(() => {});
    }
    await new Promise((resolve) => server.close(resolve));
    delete require.cache[adminWebServerPath];
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(pathname, method = 'GET', body = null, cookie = '') {
    const headers = {};
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

  async function login(username, password) {
    const result = await request('/admin/api/login', 'POST', { username, password });
    assert.equal(result.res.status, 200);
    const setCookie = result.res.headers.get('set-cookie');
    assert.ok(setCookie);
    return String(setCookie).split(';')[0];
  }

  const modCookie = await login(modUser, 'mod_pass');
  const adminCookie = await login(adminUser, 'admin_pass');
  const ownerCookie = await login(ownerUser, 'owner_pass');

  const modPrivate = await request('/admin/api/audit/presets', 'POST', {
    name: `mod-private-${suffix}`,
    view: 'wallet',
    visibility: 'private',
    actor: modUser,
  }, modCookie);
  assert.equal(modPrivate.res.status, 200);
  createdPresetIds.push(String(modPrivate.data.data?.id || ''));

  const adminRoleShared = await request('/admin/api/audit/presets', 'POST', {
    name: `admin-role-${suffix}`,
    view: 'reward',
    visibility: 'role',
    sharedRole: 'admin',
  }, adminCookie);
  assert.equal(adminRoleShared.res.status, 200);
  createdPresetIds.push(String(adminRoleShared.data.data?.id || ''));

  const ownerPublic = await request('/admin/api/audit/presets', 'POST', {
    name: `owner-public-${suffix}`,
    view: 'event',
    visibility: 'public',
  }, ownerCookie);
  assert.equal(ownerPublic.res.status, 200);
  createdPresetIds.push(String(ownerPublic.data.data?.id || ''));

  const modList = await request('/admin/api/audit/presets', 'GET', null, modCookie);
  assert.equal(modList.res.status, 200);
  const modNames = new Set((modList.data.data || []).map((row) => String(row?.name || '')));
  assert.ok(modNames.has(`mod-private-${suffix}`));
  assert.ok(modNames.has(`owner-public-${suffix}`));
  assert.ok(!modNames.has(`admin-role-${suffix}`));

  const adminList = await request('/admin/api/audit/presets', 'GET', null, adminCookie);
  assert.equal(adminList.res.status, 200);
  const adminNames = new Set((adminList.data.data || []).map((row) => String(row?.name || '')));
  assert.ok(adminNames.has(`admin-role-${suffix}`));
  assert.ok(adminNames.has(`owner-public-${suffix}`));
  assert.ok(!adminNames.has(`mod-private-${suffix}`));

  const ownerList = await request('/admin/api/audit/presets', 'GET', null, ownerCookie);
  assert.equal(ownerList.res.status, 200);
  const ownerRows = Array.isArray(ownerList.data.data) ? ownerList.data.data : [];
  assert.ok(ownerRows.some((row) => String(row?.name || '') === `mod-private-${suffix}`));
  assert.ok(ownerRows.some((row) => String(row?.name || '') === `admin-role-${suffix}`));
  assert.ok(ownerRows.some((row) => String(row?.name || '') === `owner-public-${suffix}`));

  const forbiddenUpdate = await request('/admin/api/audit/presets', 'POST', {
    id: String(ownerPublic.data.data?.id || ''),
    name: `owner-public-${suffix}-edited`,
    view: 'event',
    visibility: 'public',
  }, modCookie);
  assert.equal(forbiddenUpdate.res.status, 403);
  assert.equal(forbiddenUpdate.data.ok, false);
});
