const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminPlatformPostRoutes,
} = require('../src/admin/api/adminPlatformPostRoutes');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = null) {
      this.ended = true;
      this.body = body;
    },
  };
}

function buildRoutes(overrides = {}) {
  return createAdminPlatformPostRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    parseStringArray(value) {
      return Array.isArray(value)
        ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [];
    },
    getAuthTenantId(auth) {
      return auth?.tenantId || null;
    },
    requiredString(value) {
      return String(value || '').trim();
    },
    resolveScopedTenantId(_req, _res, auth, requestedTenantId) {
      return requestedTenantId || auth?.tenantId || null;
    },
    acknowledgeAdminNotifications(ids, actor) {
      return {
        acknowledged: ids.length,
        actor,
      };
    },
    clearAdminNotifications(options = {}) {
      return {
        cleared: true,
        acknowledgedOnly: options.acknowledgedOnly === true,
      };
    },
    ...overrides,
  });
}

test('admin notification ack route acknowledges owner notifications', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    res,
    pathname: '/admin/api/notifications/ack',
    body: { ids: ['note-1', 'note-2'] },
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.acknowledged, 2);
  assert.equal(payload.data.actor, 'owner');
});

test('tenant-scoped admin cannot clear shared owner notifications', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    res,
    pathname: '/admin/api/notifications/clear',
    body: { acknowledgedOnly: true },
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.match(String(payload.error || ''), /tenant-scoped admin/i);
});
