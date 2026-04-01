const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminGetRoutes,
} = require('../src/admin/api/adminGetRoutes');

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
  return createAdminGetRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    sendDownload() {
      throw new Error('download-not-used');
    },
    ensureRole(_req, _urlObj, _requiredRole) {
      return { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' };
    },
    getAuthTenantId(auth) {
      return auth?.tenantId || null;
    },
    resolveScopedTenantId(_req, _res, auth, requestedTenantId) {
      return requestedTenantId || auth?.tenantId || null;
    },
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback = null) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    listRaidActivitySnapshot: async () => ({
      requests: [{ id: 11, status: 'pending' }],
      windows: [{ id: 21, status: 'scheduled' }],
      summaries: [{ id: 31, outcome: 'Raid completed' }],
    }),
    ...overrides,
  });
}

test('admin raid get route exposes requests, windows, and summaries', async () => {
  const route = buildRoutes();
  const res = createMockRes();

  const handled = await route({
    req: { method: 'GET', headers: {} },
    res,
    pathname: '/admin/api/raid/list',
    urlObj: new URL('http://localhost/admin/api/raid/list?tenantId=tenant-1&limit=20'),
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.requests.length, 1);
  assert.equal(payload.data.windows.length, 1);
  assert.equal(payload.data.summaries.length, 1);
});
