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
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId || null,
    getAuthTenantId: (auth) => auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    buildControlPanelSettings: async (_client, _auth, options = {}) => ({
      tenantScope: { tenantId: options.tenantId || null },
    }),
    getTenantQuotaSnapshot: async (tenantId) => ({
      tenantId,
      quotas: {},
    }),
    getTenantFeatureAccess: async (tenantId) => ({
      tenantId,
      enabledFeatureKeys: ['feature-a'],
    }),
    listTenantStaffMemberships: async (tenantId) => ([{ tenantId, user: 'staff-1' }]),
    listUserPurchases: async (_userId, options = {}) => ([{ code: 'PUR-1', tenantId: options.tenantId || null }]),
    normalizePurchaseStatus: (value) => String(value || '').trim().toLowerCase(),
    ...overrides,
  });
}

test('control panel settings route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    controlPanelTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildControlPanelSettings: async (_client, _auth, options = {}) => {
      seen.controlPanelTenantId = options.tenantId || null;
      return { tenantScope: { tenantId: options.tenantId || null } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/control-panel/settings'),
    pathname: '/admin/api/control-panel/settings',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.controlPanelTenantId, 'tenant-1');
});

test('quota route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    quotaTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    getTenantQuotaSnapshot: async (tenantId) => {
      seen.quotaTenantId = tenantId;
      return { tenantId, quotas: {} };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/quota'),
    pathname: '/admin/api/platform/quota',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.quotaTenantId, 'tenant-1');
});

test('tenant feature access route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    featureTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    getTenantFeatureAccess: async (tenantId) => {
      seen.featureTenantId = tenantId;
      return { tenantId, enabledFeatureKeys: [] };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-feature-access'),
    pathname: '/admin/api/platform/tenant-feature-access',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.featureTenantId, 'tenant-1');
});

test('tenant staff route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    staffTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listTenantStaffMemberships: async (tenantId) => {
      seen.staffTenantId = tenantId;
      return [{ tenantId }];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/tenant-staff'),
    pathname: '/admin/api/platform/tenant-staff',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.staffTenantId, 'tenant-1');
});

test('purchase list route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    purchaseTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listUserPurchases: async (_userId, options = {}) => {
      seen.purchaseTenantId = options.tenantId || null;
      return [{ code: 'PUR-1', tenantId: options.tenantId || null, status: 'pending' }];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/purchase/list?userId=player-1'),
    pathname: '/admin/api/purchase/list',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.purchaseTenantId, 'tenant-1');
});
