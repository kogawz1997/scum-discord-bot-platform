const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminPublicRoutes,
} = require('../src/admin/api/adminPublicRoutes');

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
  return createAdminPublicRoutes({
    tryServeAdminStaticAsset: async () => false,
    tryServeStaticScumIcon: async () => false,
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    sendText(res, statusCode, text) {
      res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(text);
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    getLoginHtml: () => '<login/>',
    getOwnerConsoleHtml: () => '<owner/>',
    getTenantConsoleHtml: () => '<tenant/>',
    getDashboardHtml: () => '<legacy/>',
    getPersistenceStatus: () => ({ ok: true }),
    getPublicPersistenceStatus: () => ({ ok: true, databaseUrlRedacted: true }),
    getDeliveryMetricsSnapshot: () => ({ ok: true }),
    ensurePlatformApiKey: async () => null,
    requiredString: (value) => String(value || '').trim(),
    readJsonBody: async () => ({}),
    getTenantQuotaSnapshot: async () => ({}),
    getPlatformPublicOverview: async () => ({}),
    getPlatformAnalyticsOverview: async () => ({}),
    recordPlatformAgentHeartbeat: async () => ({ ok: true }),
    reconcileDeliveryState: async () => ({}),
    dispatchPlatformWebhookEvent: async () => ([]),
    ssoDiscordActive: false,
    cleanupDiscordOauthStates: () => {},
    buildDiscordAuthorizeUrl: () => 'https://discord.com/oauth2/authorize',
    getDiscordRedirectUri: () => 'https://example.com/admin/auth/discord/callback',
    exchangeDiscordOauthCode: async () => ({}),
    fetchDiscordProfile: async () => ({}),
    fetchDiscordGuildMember: async () => ({}),
    listDiscordGuildRolesFromClient: async () => ([]),
    resolveMappedMemberRole: () => 'mod',
    getAdminSsoRoleMappingSummary: () => ({}),
    ssoDiscordGuildId: '',
    ssoDiscordDefaultRole: 'mod',
    setDiscordOauthState: () => {},
    hasDiscordOauthState: () => true,
    deleteDiscordOauthState: () => {},
    getClientIp: () => '127.0.0.1',
    recordAdminSecuritySignal: () => {},
    createSession: () => ({ id: 'session-id' }),
    buildSessionCookie: () => 'session-id',
    ...overrides,
  });
}

test('admin public routes redirect global admins from /admin to /owner', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin'),
    pathname: '/admin',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner');
});

test('admin public routes redirect tenant-scoped admins from /admin to /tenant', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin'),
    pathname: '/admin',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant');
});

test('admin public routes block tenant-scoped admins from owner console page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/owner'),
    pathname: '/owner',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner/login?switch=1');
});

test('owner-scoped session can open tenant console page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/tenant'),
    pathname: '/tenant',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<tenant/>');
});

test('admin public routes serve tenant console html for tenant-scoped admins', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/tenant'),
    pathname: '/tenant',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<tenant/>');
});

test('owner page redirects unauthenticated users to owner login', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/owner'),
    pathname: '/owner',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner/login');
});

test('tenant page redirects unauthenticated users to tenant login', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/tenant'),
    pathname: '/tenant',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant/login');
});

test('owner login route serves login html when unauthenticated', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/owner/login'),
    pathname: '/owner/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<login/>');
});

test('tenant login route serves login html when unauthenticated', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/tenant/login'),
    pathname: '/tenant/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<login/>');
});

test('tenant login route redirects owner session into tenant console', async () => {
  const handler = buildRoutes({
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/tenant/login'),
    pathname: '/tenant/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant');
});

test('owner login route redirects tenant-scoped admins back to tenant console', async () => {
  const handler = buildRoutes({
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/owner/login'),
    pathname: '/owner/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant');
});

test('admin public healthz uses the redacted persistence payload', async () => {
  const handler = buildRoutes({
    getPersistenceStatus: () => ({
      mode: 'db-only',
      databaseUrl: 'postgresql://secret:secret@example.invalid:5432/app',
      dbPath: '/secret/db',
      dataDir: '/secret/data',
    }),
    getPublicPersistenceStatus: () => ({
      mode: 'db-only',
      databaseUrlRedacted: true,
      storagePathsRedacted: true,
    }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/healthz'),
    pathname: '/healthz',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.service, 'admin-web');
  assert.equal(payload.data.persistence.databaseUrlRedacted, true);
  assert.equal(payload.data.persistence.storagePathsRedacted, true);
  assert.equal('databaseUrl' in payload.data.persistence, false);
  assert.equal('dbPath' in payload.data.persistence, false);
  assert.equal('dataDir' in payload.data.persistence, false);
});

test('admin legacy tab routes owner auth traffic into the owner security page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/legacy?tab=auth'),
    pathname: '/admin/legacy',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner#security');
});

test('admin legacy tab routes tenant delivery traffic into the tenant commerce page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/legacy?tab=delivery'),
    pathname: '/admin/legacy',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant#commerce');
});

test('admin legacy fallback still serves dashboard html when explicitly requested', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/legacy?fallback=1'),
    pathname: '/admin/legacy',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<legacy/>');
});

test('admin public routes redirect local /player traffic to the local player portal', async () => {
  const previousPortalPort = process.env.WEB_PORTAL_PORT;
  process.env.WEB_PORTAL_PORT = '3300';
  const handler = buildRoutes();
  const res = createMockRes();

  try {
    const handled = await handler({
      client: null,
      req: { method: 'GET', headers: { host: '127.0.0.1:3200' } },
      res,
      urlObj: new URL('http://127.0.0.1:3200/player'),
      pathname: '/player',
      host: '127.0.0.1',
      port: 3200,
    });

    assert.equal(handled, true);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, 'http://127.0.0.1:3300/player');
  } finally {
    if (previousPortalPort == null) {
      delete process.env.WEB_PORTAL_PORT;
    } else {
      process.env.WEB_PORTAL_PORT = previousPortalPort;
    }
  }
});

test('admin public routes redirect non-loopback /player traffic to canonical player portal', async () => {
  const previousPortalBaseUrl = process.env.WEB_PORTAL_BASE_URL;
  process.env.WEB_PORTAL_BASE_URL = 'https://player.example.com';
  const handler = buildRoutes();
  const res = createMockRes();

  try {
    const handled = await handler({
      client: null,
      req: { method: 'GET', headers: { host: 'admin.example.com' } },
      res,
      urlObj: new URL('https://admin.example.com/player/login?next=orders'),
      pathname: '/player/login',
      host: 'admin.example.com',
      port: 3200,
    });

    assert.equal(handled, true);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, 'https://player.example.com/player/login?next=orders');
  } finally {
    if (previousPortalBaseUrl == null) {
      delete process.env.WEB_PORTAL_BASE_URL;
    } else {
      process.env.WEB_PORTAL_BASE_URL = previousPortalBaseUrl;
    }
  }
});
