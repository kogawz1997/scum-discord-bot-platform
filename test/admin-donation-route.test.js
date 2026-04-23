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
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    getAuthTenantId: (auth) => auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    buildTenantDonationOverview: async ({ tenantId, windowDays, limit }) => ({
      tenantId,
      windowDays,
      limit,
      summary: { totalPackages: 2 },
      readiness: { percent: 75, steps: [] },
      issues: [],
      topPackages: [],
      recentActivity: [],
    }),
    ...overrides,
  });
}

test('donation overview route returns backend summary for tenant workspace', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/donations/overview?tenantId=tenant-1&days=14&limit=6'),
    pathname: '/admin/api/donations/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, 'tenant-1');
  assert.equal(payload.data.windowDays, 14);
  assert.equal(payload.data.limit, 6);
});

test('donation overview route validates tenant scope', async () => {
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    resolveScopedTenantId: () => null,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/donations/overview'),
    pathname: '/admin/api/donations/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'tenantId is required');
});

test('donation overview route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    overviewTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildTenantDonationOverview: async ({ tenantId }) => {
      seen.overviewTenantId = tenantId;
      return { tenantId };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/donations/overview'),
    pathname: '/admin/api/donations/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.overviewTenantId, 'tenant-1');
});
