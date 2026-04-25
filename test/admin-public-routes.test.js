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
    sendJson(res, statusCode, payload, headers = {}) {
      res.writeHead(statusCode, {
        'content-type': 'application/json',
        ...headers,
      });
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
    getOwnerLoginHtml: () => '<owner-login/>',
    getTenantLoginHtml: () => '<tenant-login/>',
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
    consumeAdminActionRateLimit: () => ({ limited: false, retryAfterMs: 0 }),
    createSession: () => ({ id: 'session-id' }),
    buildSessionCookie: () => 'session-id',
    buildClearSessionCookie: () => 'scum_admin_session=; Max-Age=0',
    invalidateSession: () => {},
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
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('admin public routes redirect backend owner path to split owner web when configured or loopback-defaulted', async () => {
  const previousOwnerBaseUrl = process.env.OWNER_WEB_BASE_URL;
  delete process.env.OWNER_WEB_BASE_URL;
  process.env.OWNER_WEB_PORT = '3201';
  try {
    const handler = buildRoutes();
    const res = createMockRes();

    const handled = await handler({
      client: null,
      req: { method: 'GET', headers: { host: '127.0.0.1:3200' } },
      res,
      urlObj: new URL('http://127.0.0.1:3200/owner/tenants'),
      pathname: '/owner/tenants',
      host: '127.0.0.1',
      port: 3200,
    });

    assert.equal(handled, true);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, 'http://127.0.0.1:3201/owner/tenants');
  } finally {
    if (previousOwnerBaseUrl === undefined) {
      delete process.env.OWNER_WEB_BASE_URL;
    } else {
      process.env.OWNER_WEB_BASE_URL = previousOwnerBaseUrl;
    }
    delete process.env.OWNER_WEB_PORT;
  }
});

test('admin public routes redirect backend tenant path to split tenant web when configured or loopback-defaulted', async () => {
  const previousTenantBaseUrl = process.env.TENANT_WEB_BASE_URL;
  delete process.env.TENANT_WEB_BASE_URL;
  process.env.TENANT_WEB_PORT = '3202';
  try {
    const handler = buildRoutes({
      getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
    });
    const res = createMockRes();

    const handled = await handler({
      client: null,
      req: { method: 'GET', headers: { host: '127.0.0.1:3200' } },
      res,
      urlObj: new URL('http://127.0.0.1:3200/tenant'),
      pathname: '/tenant',
      host: '127.0.0.1',
      port: 3200,
    });

    assert.equal(handled, true);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, 'http://127.0.0.1:3202/tenant');
  } finally {
    if (previousTenantBaseUrl === undefined) {
      delete process.env.TENANT_WEB_BASE_URL;
    } else {
      process.env.TENANT_WEB_BASE_URL = previousTenantBaseUrl;
    }
    delete process.env.TENANT_WEB_PORT;
  }
});

test('admin public platform routes record insufficient scope signals for any-scope endpoints', async () => {
  const signals = [];
  const handler = buildRoutes({
    verifyPlatformApiKey: async () => ({
      ok: false,
      reason: 'insufficient-scope',
      missingScopes: ['agent:sync'],
      apiKey: {
        id: 'key-execute',
        tenantId: 'tenant-a',
        name: 'Execute Agent',
      },
      tenant: { id: 'tenant-a' },
    }),
    recordAdminSecuritySignal: (type, payload) => {
      signals.push({ type, payload });
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: {
      method: 'GET',
      url: '/platform/api/v1/server-config/jobs/next?tenantId=tenant-a&serverId=server-a&runtimeKey=exec',
      headers: {
        host: '127.0.0.1:3200',
        'x-platform-api-key': 'sk_execute',
      },
    },
    res,
    urlObj: new URL('http://127.0.0.1:3200/platform/api/v1/server-config/jobs/next?tenantId=tenant-a&serverId=server-a&runtimeKey=exec'),
    pathname: '/platform/api/v1/server-config/jobs/next',
    host: '127.0.0.1',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).error, 'insufficient-scope');
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'platform-api-insufficient-scope');
  assert.equal(signals[0].payload.reason, 'insufficient-scope');
  assert.deepEqual(signals[0].payload.data, {
    tenantId: 'tenant-a',
    apiKeyId: 'key-execute',
    acceptedScopeSets: [['agent:sync'], ['config:write'], ['server:control']],
    missingScopes: ['agent:sync'],
  });
});

test('admin public routes redirect tenant-scoped admins from /admin to /tenant', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('admin public routes redirect tenant-scoped admins away from owner console page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('platform owner session is redirected away from tenant console page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant'),
    pathname: '/tenant',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant/login?switch=1');
});

test('tenant owner session can still open tenant console page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-owner', role: 'owner', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('tenant console redirects to tenant login and clears session when membership is no longer active', async () => {
  let revokedSessionId = null;
  const handler = buildRoutes({
    getAuthContext: () => ({
      mode: 'session',
      sessionId: 'session-1',
      user: 'tenant-owner@example.com',
      userId: 'platform-user-1',
      primaryEmail: 'tenant-owner@example.com',
      role: 'owner',
      tenantId: 'tenant-1',
      authMethod: 'platform-user-password',
    }),
    resolveTenantSessionAccessContext: async () => ({
      ok: false,
      reason: 'tenant-membership-inactive',
    }),
    invalidateSession: (sessionId) => {
      revokedSessionId = sessionId;
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant'),
    pathname: '/tenant',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(revokedSessionId, 'session-1');
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant/login');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
});

test('platform agent activate route is rate limited before activation when repeated attempts exceed policy', async () => {
  let activated = false;
  const handler = buildRoutes({
    readJsonBody: async () => ({
      setupToken: 'stp_token_1',
      machineFingerprint: 'machine-1',
      runtimeKey: 'server-bot-main',
      displayName: 'Main Server Bot',
      hostname: 'host-1',
      version: '1.2.3',
      channel: 'stable',
      baseUrl: 'http://127.0.0.1:3300',
    }),
    consumeAdminActionRateLimit: () => ({
      limited: true,
      retryAfterMs: 15_000,
    }),
    activatePlatformAgent: async () => {
      activated = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/platform/api/v1/agent/activate'),
    pathname: '/platform/api/v1/agent/activate',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 429);
  assert.equal(activated, false);
  assert.equal(res.headers['Retry-After'], '15');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.retryAfterSec, 15);
});

test('tenant login stays on login page when stale tenant session is invalidated', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({
      mode: 'session',
      sessionId: 'session-2',
      user: 'tenant-admin@example.com',
      userId: 'platform-user-2',
      primaryEmail: 'tenant-admin@example.com',
      role: 'admin',
      tenantId: 'tenant-1',
      authMethod: 'platform-user-password',
    }),
    resolveTenantSessionAccessContext: async () => ({
      ok: false,
      reason: 'tenant-user-inactive',
    }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/login'),
    pathname: '/tenant/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<tenant-login/>');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
});

test('owner console redirects to owner login and clears session when platform admin becomes inactive', async () => {
  let revokedSessionId = null;
  const handler = buildRoutes({
    getAuthContext: () => ({
      mode: 'session',
      sessionId: 'session-owner-1',
      user: 'owner-runtime',
      role: 'owner',
      tenantId: null,
      authMethod: 'password-db',
    }),
    resolveAdminSessionAccessContext: async () => ({
      ok: false,
      reason: 'admin-user-inactive',
    }),
    invalidateSession: (sessionId) => {
      revokedSessionId = sessionId;
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/owner'),
    pathname: '/owner',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(revokedSessionId, 'session-owner-1');
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner/login');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
});

test('owner login stays on login page when stale platform admin session is invalidated', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({
      mode: 'session',
      sessionId: 'session-owner-2',
      user: 'owner-runtime',
      role: 'owner',
      tenantId: null,
      authMethod: 'password-db',
    }),
    resolveAdminSessionAccessContext: async () => ({
      ok: false,
      reason: 'admin-user-inactive',
    }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/owner/login'),
    pathname: '/owner/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<owner-login/>');
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
});

test('admin public routes serve tenant console html for tenant-scoped admins', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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
    getAuthContext: () => null,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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
    getAuthContext: () => null,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('tenant deep-link redirects unauthenticated users to tenant login with next target', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
    getAuthContext: () => null,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/server/config?section=general'),
    pathname: '/tenant/server/config',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant/login?next=%2Ftenant%2Fserver%2Fconfig%3Fsection%3Dgeneral');
});

test('owner login route serves login html when unauthenticated', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
    getAuthContext: () => null,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/owner/login'),
    pathname: '/owner/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<owner-login/>');
});

test('tenant login route serves login html when unauthenticated', async () => {
  const handler = buildRoutes({
    isAuthorized: () => false,
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/login'),
    pathname: '/tenant/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<tenant-login/>');
});

test('tenant login route stays on tenant login for platform owner sessions', async () => {
  const handler = buildRoutes({
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'owner', role: 'owner', tenantId: null }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/login'),
    pathname: '/tenant/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<tenant-login/>');
});

test('tenant login route redirects tenant owner session into tenant console', async () => {
  const handler = buildRoutes({
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'tenant-owner', role: 'owner', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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

test('tenant login response keeps a safe nextUrl for direct tenant routes', async () => {
  const handler = buildRoutes({
    readJsonBody: async () => ({
      email: 'tenant-owner@example.com',
      password: 'secret',
      nextUrl: '/tenant/server/config',
    }),
    authenticateTenantUser: async () => ({
      ok: true,
      user: { id: 'user-1', primaryEmail: 'tenant-owner@example.com' },
      membership: {
        id: 'membership-1',
        tenantId: 'tenant-1',
        role: 'owner',
        membershipType: 'tenant',
        status: 'active',
      },
    }),
    createSession: () => 'session-tenant-1',
    buildSessionCookie: () => 'tenant-session-cookie',
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/api/auth/login'),
    pathname: '/tenant/api/auth/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.nextUrl, '/tenant/server/config');
  assert.equal(res.headers['Set-Cookie'], 'tenant-session-cookie');
});

test('tenant login response falls back to onboarding for unsafe nextUrl values', async () => {
  const handler = buildRoutes({
    readJsonBody: async () => ({
      email: 'tenant-owner@example.com',
      password: 'secret',
      nextUrl: 'https://evil.example/steal',
    }),
    authenticateTenantUser: async () => ({
      ok: true,
      user: { id: 'user-1', primaryEmail: 'tenant-owner@example.com' },
      membership: {
        id: 'membership-1',
        tenantId: 'tenant-1',
        role: 'owner',
        membershipType: 'tenant',
        status: 'active',
      },
    }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/tenant/api/auth/login'),
    pathname: '/tenant/api/auth/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.nextUrl, '/tenant/onboarding');
});

test('owner login route stays on owner login for tenant-scoped admins', async () => {
  const handler = buildRoutes({
    isAuthorized: () => true,
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/owner/login'),
    pathname: '/owner/login',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, '<owner-login/>');
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
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/admin/legacy?tab=auth'),
    pathname: '/admin/legacy',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/owner/audit');
});

test('admin legacy tab routes tenant delivery traffic into the tenant orders page', async () => {
  const handler = buildRoutes({
    getAuthContext: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
    res,
    urlObj: new URL('https://admin.example.com/admin/legacy?tab=delivery'),
    pathname: '/admin/legacy',
    host: 'admin.example.com',
    port: 3200,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, '/tenant/orders');
});

test('admin legacy fallback still serves dashboard html when explicitly requested', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: { host: 'admin.example.com' } },
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
