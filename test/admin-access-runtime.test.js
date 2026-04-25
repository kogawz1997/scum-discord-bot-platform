const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminAccessRuntime,
} = require('../src/admin/runtime/adminAccessRuntime');

test('admin access runtime records tenant-scope mismatch as a signal-only security event', () => {
  const sent = [];
  const signals = [];

  const runtime = createAdminAccessRuntime({
    sendJson: (res, statusCode, payload) => {
      sent.push({ res, statusCode, payload });
      return payload;
    },
    getAuthContext: () => null,
    hasRoleAtLeast: () => true,
    resolveTenantScope: ({ auth, requestedTenantId }) => {
      const authTenantId = String(auth?.tenantId || '').trim() || null;
      const requested = String(requestedTenantId || '').trim() || null;
      if (authTenantId && requested && requested !== authTenantId) {
        return {
          ok: false,
          statusCode: 403,
          error: 'Forbidden: tenant scope mismatch',
          tenantId: authTenantId,
        };
      }
      return { ok: true, tenantId: requested || authTenantId };
    },
    verifyPlatformApiKey: async () => ({ ok: false }),
    setRequestMeta: () => {},
    getAdminPermissionForPath: () => null,
    resolveItemIconUrl: () => null,
    getClientIp: () => '10.10.10.10',
    recordAdminSecuritySignal: (type, payload) => {
      signals.push({ type, payload });
    },
  });

  const req = {
    url: '/admin/api/platform/quota?tenantId=tenant-b',
    headers: {},
  };
  const res = {};
  const auth = {
    user: 'tenant-admin',
    role: 'admin',
    tenantId: 'tenant-a',
  };

  const tenantId = runtime.resolveScopedTenantId(req, res, auth, 'tenant-b', { required: true });

  assert.equal(tenantId, null);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].statusCode, 403);
  assert.equal(sent[0].payload.error, 'Forbidden: tenant scope mismatch');

  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'tenant-scope-mismatch');
  assert.equal(signals[0].payload.severity, 'warn');
  assert.equal(signals[0].payload.suppressNotification, true);
  assert.equal(signals[0].payload.actor, 'tenant-admin');
  assert.equal(signals[0].payload.role, 'admin');
  assert.equal(signals[0].payload.ip, '10.10.10.10');
  assert.equal(signals[0].payload.reason, 'tenant-scope-mismatch');
  assert.deepEqual(signals[0].payload.data, {
    tenantId: 'tenant-a',
    authTenantId: 'tenant-a',
    requestedTenantId: 'tenant-b',
  });
});

test('admin access runtime records insufficient platform API scope as a security signal', async () => {
  const sent = [];
  const signals = [];

  const runtime = createAdminAccessRuntime({
    sendJson: (res, statusCode, payload) => {
      sent.push({ res, statusCode, payload });
      return payload;
    },
    getAuthContext: () => null,
    hasRoleAtLeast: () => true,
    resolveTenantScope: () => ({ ok: true, tenantId: 'tenant-a' }),
    verifyPlatformApiKey: async () => ({
      ok: false,
      reason: 'insufficient-scope',
      missingScopes: ['agent:sync'],
      apiKey: {
        id: 'key-1',
        tenantId: 'tenant-a',
        name: 'Execute Agent',
      },
      tenant: { id: 'tenant-a' },
    }),
    setRequestMeta: () => {},
    getAdminPermissionForPath: () => null,
    resolveItemIconUrl: () => null,
    getClientIp: () => '10.10.10.11',
    recordAdminSecuritySignal: (type, payload) => {
      signals.push({ type, payload });
    },
  });

  const auth = await runtime.ensurePlatformApiKey(
    {
      url: '/platform/api/v1/agent/sync',
      headers: { authorization: 'Bearer sk_execute' },
    },
    {},
    ['agent:sync'],
  );

  assert.equal(auth, null);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].statusCode, 403);
  assert.equal(sent[0].payload.error, 'insufficient-scope');
  assert.deepEqual(sent[0].payload.missingScopes, ['agent:sync']);

  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'platform-api-insufficient-scope');
  assert.equal(signals[0].payload.severity, 'warn');
  assert.equal(signals[0].payload.suppressNotification, true);
  assert.equal(signals[0].payload.actor, 'Execute Agent');
  assert.equal(signals[0].payload.reason, 'insufficient-scope');
  assert.deepEqual(signals[0].payload.data, {
    tenantId: 'tenant-a',
    apiKeyId: 'key-1',
    requiredScopes: ['agent:sync'],
    missingScopes: ['agent:sync'],
  });
});
