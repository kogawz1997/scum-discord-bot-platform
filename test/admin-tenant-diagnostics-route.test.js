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
    sendDownload(res, statusCode, content, options = {}) {
      res.writeHead(statusCode, {
        'content-type': options.contentType || 'application/octet-stream',
        'content-disposition': `attachment; filename="${options.filename || 'download.txt'}"`,
      });
      res.end(content);
    },
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId,
    getAuthTenantId: (auth) => auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    buildTenantDiagnosticsBundle: async (tenantId) => ({
      tenantId,
      headline: { tenantId, tenant: 'Demo Tenant' },
    }),
    buildTenantDiagnosticsCsv: () => 'key,value\ntenantId,tenant-1\n',
    jsonReplacer: null,
    ...overrides,
  });
}

test('tenant diagnostics route returns JSON payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-diagnostics?tenantId=tenant-1'),
    pathname: '/admin/api/platform/tenant-diagnostics',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /application\/json/i);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, 'tenant-1');
});

test('tenant diagnostics route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    bundleTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildTenantDiagnosticsBundle: async (tenantId) => {
      seen.bundleTenantId = tenantId;
      return { tenantId };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-diagnostics'),
    pathname: '/admin/api/platform/tenant-diagnostics',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.bundleTenantId, 'tenant-1');
});

test('tenant diagnostics export route returns CSV payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-diagnostics/export?tenantId=tenant-1&format=csv'),
    pathname: '/admin/api/platform/tenant-diagnostics/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/csv/i);
  assert.match(String(res.headers['content-disposition'] || ''), /tenant-diagnostics-tenant-1/i);
  assert.match(String(res.body || ''), /tenantId,tenant-1/);
});

test('tenant diagnostics export route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    bundleTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildTenantDiagnosticsBundle: async (tenantId) => {
      seen.bundleTenantId = tenantId;
      return { tenantId };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-diagnostics/export?format=csv'),
    pathname: '/admin/api/platform/tenant-diagnostics/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.bundleTenantId, 'tenant-1');
  assert.match(String(res.headers['content-disposition'] || ''), /tenant-diagnostics-tenant-1/i);
});
