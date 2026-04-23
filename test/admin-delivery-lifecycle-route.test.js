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
    getAuthTenantId: () => null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    buildDeliveryLifecycleReport: async (options = {}) => ({
      scope: options.tenantId || 'global',
      tenantId: options.tenantId || null,
      summary: { queueCount: 2, deadLetterCount: 1 },
      signals: [{ key: 'overdue', count: 1 }],
      topErrors: [{ key: 'AGENT_PREFLIGHT_FAILED', count: 1 }],
    }),
    buildDeliveryLifecycleCsv: () => 'key,value\nqueueCount,2\n',
    jsonReplacer: null,
    ...overrides,
  });
}

test('delivery lifecycle route returns JSON payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/lifecycle?tenantId=tenant-1'),
    pathname: '/admin/api/delivery/lifecycle',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, 'tenant-1');
});

test('delivery lifecycle route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    reportTenantId: null,
    allowGlobal: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildDeliveryLifecycleReport: async (options = {}) => {
      seen.reportTenantId = options.tenantId || null;
      seen.allowGlobal = options.allowGlobal === true;
      return { tenantId: options.tenantId || null, summary: {} };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/lifecycle'),
    pathname: '/admin/api/delivery/lifecycle',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.reportTenantId, 'tenant-1');
  assert.equal(seen.allowGlobal, false);
});

test('delivery lifecycle route allows explicit global access for owner when tenantId is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    reportTenantId: null,
    allowGlobal: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    getAuthTenantId: () => null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildDeliveryLifecycleReport: async (options = {}) => {
      seen.reportTenantId = options.tenantId || null;
      seen.allowGlobal = options.allowGlobal === true;
      return { tenantId: options.tenantId || null, summary: {} };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/lifecycle'),
    pathname: '/admin/api/delivery/lifecycle',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, null);
  assert.equal(seen.reportTenantId, null);
  assert.equal(seen.allowGlobal, true);
});

test('delivery lifecycle export route returns CSV payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/lifecycle/export?tenantId=tenant-1&format=csv'),
    pathname: '/admin/api/delivery/lifecycle/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/csv/i);
  assert.match(String(res.headers['content-disposition'] || ''), /delivery-lifecycle-tenant-1/i);
  assert.match(String(res.body || ''), /queueCount,2/);
});

test('delivery lifecycle export route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    reportTenantId: null,
    allowGlobal: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildDeliveryLifecycleReport: async (options = {}) => {
      seen.reportTenantId = options.tenantId || null;
      seen.allowGlobal = options.allowGlobal === true;
      return { tenantId: options.tenantId || null, summary: {} };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/lifecycle/export?format=csv'),
    pathname: '/admin/api/delivery/lifecycle/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.reportTenantId, 'tenant-1');
  assert.equal(seen.allowGlobal, false);
  assert.match(String(res.headers['content-disposition'] || ''), /delivery-lifecycle-tenant-1/i);
});
