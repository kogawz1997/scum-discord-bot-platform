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
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    getAuthTenantId: (auth) => auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    listFilteredDeliveryQueue: () => ([
      { id: 'job-1', tenantId: 'tenant-1', purchaseCode: 'PUR-1001' },
    ]),
    listFilteredDeliveryDeadLetters: () => ([
      { id: 'dead-1', tenantId: 'tenant-1', purchaseCode: 'PUR-1002' },
    ]),
    getDeliveryRuntimeStatus: async () => ({ online: true, agents: 1 }),
    listScumAdminCommandCapabilities: () => ([
      { key: 'announce', supported: true },
    ]),
    listAdminCommandCapabilityPresets: () => ([
      { id: 'preset-1', name: 'Announce' },
    ]),
    getDeliveryCommandOverride: () => ({ template: '#announce {message}' }),
    getDeliveryDetailsByPurchaseCode: async (code) => ({
      purchase: { code, tenantId: 'tenant-1' },
      queueJob: { purchaseCode: code, tenantId: 'tenant-1' },
      deadLetter: null,
      auditRows: [],
    }),
    normalizePurchaseStatus: (value) => String(value || '').trim().toLowerCase(),
    listKnownPurchaseStatuses: () => ['queued', 'delivered', 'failed'],
    listAllowedPurchaseTransitions: (current) => current === 'queued'
      ? ['delivered', 'failed']
      : [],
    buildAdminDashboardCards: async ({ tenantId, forceRefresh }) => ({
      tenantId: tenantId || null,
      forceRefresh,
      cards: [{ id: 'runtime', status: 'ok' }],
    }),
    listPlayerAccounts: async (_limit, options = {}) => ([
      { userId: 'player-1', tenantId: options.tenantId || null },
    ]),
    getPlayerDashboard: async (userId, options = {}) => ({
      ok: true,
      data: { userId, tenantId: options.tenantId || null, summary: { orders: 3 } },
    }),
    ...overrides,
  });
}

test('delivery queue route is handled by extracted delivery ops slice', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/queue?tenantId=tenant-1&limit=25'),
    pathname: '/admin/api/delivery/queue',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].purchaseCode, 'PUR-1001');
});

test('delivery detail route returns 404 when extracted handler cannot find data', async () => {
  const handler = buildRoutes({
    getDeliveryDetailsByPurchaseCode: async () => ({
      purchase: null,
      queueJob: null,
      deadLetter: null,
      auditRows: [],
    }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/detail?code=PUR-404&tenantId=tenant-1'),
    pathname: '/admin/api/delivery/detail',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Resource not found');
});

test('purchase status route returns known statuses and transitions from extracted slice', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/purchase/statuses?current=queued'),
    pathname: '/admin/api/purchase/statuses',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.knownStatuses, ['queued', 'delivered', 'failed']);
  assert.deepEqual(payload.data.allowedTransitions, ['delivered', 'failed']);
});

test('player dashboard route validates missing user id in extracted slice', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/player/dashboard?tenantId=tenant-1'),
    pathname: '/admin/api/player/dashboard',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'Invalid request payload');
});
