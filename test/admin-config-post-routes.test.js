const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminConfigPostRoutes,
} = require('../src/admin/api/adminConfigPostRoutes');
const {
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');

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
  return createAdminConfigPostRoutes({
    sendJson(res, statusCode, payload, headers = {}) {
      res.writeHead(statusCode, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(payload));
    },
    requiredString(value, key) {
      if (value && typeof value === 'object' && key) {
        return String(value[key] || '').trim();
      }
      return String(value || '').trim();
    },
    parseStringArray: () => [],
    getAuthTenantId: (auth) => auth?.tenantId || null,
    buildControlPanelEnvPatch: () => ({ root: {}, portal: {} }),
    buildControlPanelEnvApplySummary: () => ({ restartRequired: false }),
    updateEnvFile: () => ({ changedKeys: [] }),
    getRootEnvFilePath: () => 'C:\\new\\.env',
    getPortalEnvFilePath: () => 'C:\\new\\.env.portal',
    recordAdminSecuritySignal: () => {},
    consumeActionRateLimit: () => ({ limited: false, retryAfterMs: 0, ip: '127.0.0.1' }),
    getClientIp: () => '127.0.0.1',
    upsertAdminUserInDb: async () => ({}),
    revokeSessionsForUser: () => [],
    buildClearSessionCookie: () => 'scum_admin_session=; Max-Age=0',
    restartManagedRuntimeServices: async () => ({ ok: true, services: [] }),
    config: {},
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    getPlatformTenantById: async () => ({ id: 'tenant-1' }),
    upsertPlatformTenantConfig: async () => ({ ok: true, data: { tenantId: 'tenant-1' } }),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: ['server_settings', 'donation_module', 'event_module', 'staff_roles'],
    }),
    buildTenantProductEntitlements,
    ...overrides,
  });
}

test('admin auth user route revokes active sessions immediately after saving an admin user', async () => {
  let revokedMeta = null;
  const handler = buildRoutes({
    upsertAdminUserInDb: async () => ({
      username: 'owner-runtime',
      role: 'owner',
      tenantId: null,
      isActive: false,
    }),
    revokeSessionsForUser: (username, meta) => {
      revokedMeta = { username, meta };
      return [{ id: 'session-owner-1' }, { id: 'session-owner-2' }];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/auth/user',
    body: {
      username: 'owner-runtime',
      role: 'owner',
      isActive: false,
    },
    res,
    auth: {
      user: 'platform-owner',
      role: 'owner',
      sessionId: 'session-owner-1',
      tenantId: null,
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(revokedMeta, {
    username: 'owner-runtime',
    meta: {
      actor: 'platform-owner',
      reason: 'admin-user-updated',
    },
  });
  assert.equal(res.headers['Set-Cookie'], 'scum_admin_session=; Max-Age=0');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.username, 'owner-runtime');
  assert.equal(payload.data.revokedSessionCount, 2);
});

test('admin tenant-config route denies settings save when config editing is not in package', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    upsertPlatformTenantConfig: async () => {
      called = true;
      return { ok: true, data: { tenantId: 'tenant-1' } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/tenant-config',
    body: {
      tenantId: 'tenant-1',
      updateScope: 'settings',
      configPatch: { maintenanceModeEnabled: true },
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_edit_config');
});

test('admin tenant-config route allows module save when module entitlement is enabled', async () => {
  const calls = [];
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: ['donation_module'],
    }),
    upsertPlatformTenantConfig: async (input) => {
      calls.push(input);
      return { ok: true, data: input };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/tenant-config',
    body: {
      tenantId: 'tenant-1',
      updateScope: 'modules',
      featureFlags: { donation_module: true },
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantId, 'tenant-1');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
});

test('admin runtime restart-service route is rate limited before restarting managed services', async () => {
  let restarted = false;
  const handler = buildRoutes({
    consumeActionRateLimit: () => ({
      limited: true,
      retryAfterMs: 4_000,
      ip: '127.0.0.1',
    }),
    restartManagedRuntimeServices: async () => {
      restarted = true;
      return { ok: true, services: ['worker'] };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/runtime/restart-service',
    body: {
      service: 'worker',
    },
    res,
    auth: {
      user: 'platform-owner',
      role: 'owner',
      tenantId: null,
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 429);
  assert.equal(restarted, false);
  assert.equal(res.headers['Retry-After'], '4');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.match(payload.error, /Too many restart actions/i);
});
