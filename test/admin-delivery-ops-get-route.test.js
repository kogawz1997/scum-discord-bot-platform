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
    getPlatformUserIdentitySummary: async ({ discordUserId, steamId, tenantId, allowGlobal }) => ({
      identitySummary: {
        linkedAccounts: {
          discord: { linked: true, value: discordUserId },
          steam: { linked: Boolean(steamId), value: steamId || null },
        },
        tenantId: tenantId || null,
        allowGlobal: Boolean(allowGlobal),
      },
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

test('delivery queue route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    queueTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'mod', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listFilteredDeliveryQueue: (options = {}) => {
      seen.queueTenantId = options.tenantId || null;
      return [{ id: 'job-1', tenantId: options.tenantId || null }];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/queue'),
    pathname: '/admin/api/delivery/queue',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.queueTenantId, 'tenant-1');
});

test('delivery detail route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    detailTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'mod', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    getDeliveryDetailsByPurchaseCode: async (code, _limit, options = {}) => {
      seen.detailTenantId = options.tenantId || null;
      return {
        purchase: { code, tenantId: options.tenantId || null },
        queueJob: { purchaseCode: code, tenantId: options.tenantId || null },
        deadLetter: null,
        auditRows: [],
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/delivery/detail?code=PUR-1001'),
    pathname: '/admin/api/delivery/detail',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.detailTenantId, 'tenant-1');
});

test('dashboard cards route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    dashboardTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'mod', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    buildAdminDashboardCards: async ({ tenantId }) => {
      seen.dashboardTenantId = tenantId || null;
      return { tenantId: tenantId || null, cards: [] };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/dashboard/cards'),
    pathname: '/admin/api/dashboard/cards',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.dashboardTenantId, 'tenant-1');
});

test('dashboard cards route passes explicit allowGlobal for owner global reads', async () => {
  const seen = {
    dashboardTenantId: 'unset',
    allowGlobal: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    buildAdminDashboardCards: async ({ tenantId, allowGlobal }) => {
      seen.dashboardTenantId = tenantId ?? null;
      seen.allowGlobal = allowGlobal === true;
      return { tenantId: tenantId || null, cards: [] };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/dashboard/cards'),
    pathname: '/admin/api/dashboard/cards',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.dashboardTenantId, null);
  assert.equal(seen.allowGlobal, true);
});

test('player accounts route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    listTenantId: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'mod', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listPlayerAccounts: async (_limit, options = {}) => {
      seen.listTenantId = options.tenantId || null;
      return [{ userId: 'player-1', tenantId: options.tenantId || null }];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/player/accounts'),
    pathname: '/admin/api/player/accounts',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.listTenantId, 'tenant-1');
});

test('player identity route falls back to auth tenant and returns identity summary', async () => {
  const seen = {
    requestedTenantId: null,
    dashboardTenantId: null,
    identityArgs: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'mod', tenantId: 'tenant-1' }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    getPlayerDashboard: async (userId, options = {}) => {
      seen.dashboardTenantId = options.tenantId || null;
      return {
        ok: true,
        data: {
          userId,
          account: { userId, steamId: '76561198000000123' },
          steamLink: { steamId: '76561198000000123' },
        },
      };
    },
    getPlatformUserIdentitySummary: async (args) => {
      seen.identityArgs = args;
      return {
        identitySummary: {
          linkedAccounts: {
            steam: { linked: true, value: args.steamId },
          },
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/player/identity?userId=player-1'),
    pathname: '/admin/api/player/identity',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.dashboardTenantId, 'tenant-1');
  assert.deepEqual(seen.identityArgs, {
    discordUserId: 'player-1',
    steamId: '76561198000000123',
    tenantId: 'tenant-1',
    allowGlobal: false,
    legacySteamLink: { steamId: '76561198000000123' },
    fallbackDiscordUserId: 'player-1',
  });
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.userId, 'player-1');
  assert.equal(payload.data.tenantId, 'tenant-1');
  assert.equal(payload.data.identitySummary.linkedAccounts.steam.value, '76561198000000123');
});

test('player identity route allows owner global reads when tenant scope is absent', async () => {
  const seen = {
    dashboardOptions: null,
    identityArgs: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    getPlayerDashboard: async (userId, options = {}) => {
      seen.dashboardOptions = options;
      return {
        ok: true,
        data: {
          userId,
          account: null,
          steamLink: { steamId: '76561198000000999' },
        },
      };
    },
    getPlatformUserIdentitySummary: async (args) => {
      seen.identityArgs = args;
      return {
        identitySummary: {
          linkedAccounts: {
            steam: { linked: true, value: args.steamId },
          },
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/player/identity?userId=player-9'),
    pathname: '/admin/api/player/identity',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(seen.dashboardOptions, {});
  assert.deepEqual(seen.identityArgs, {
    discordUserId: 'player-9',
    steamId: '76561198000000999',
    tenantId: null,
    allowGlobal: true,
    legacySteamLink: { steamId: '76561198000000999' },
    fallbackDiscordUserId: 'player-9',
  });
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, null);
  assert.equal(payload.data.identitySummary.linkedAccounts.steam.value, '76561198000000999');
});
