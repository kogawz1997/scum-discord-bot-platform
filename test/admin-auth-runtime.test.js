const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminAuthRuntime,
} = require('../src/admin/auth/adminAuthRuntime');

function createRuntime(overrides = {}) {
  return createAdminAuthRuntime({
    sessions: new Map(),
    secureEqual: (left, right) => String(left) === String(right),
    normalizeRole: (role) => String(role || 'mod').trim().toLowerCase() || 'mod',
    recordAdminSecuritySignal: () => {},
    getClientIp: () => '127.0.0.1',
    setRequestMeta: () => {},
    getAdminToken: () => 'token',
    adminWebAllowTokenQuery: false,
    adminWebTokenRole: 'owner',
    defaultUser: 'admin',
    sessionBindUserAgent: false,
    sessionIdleTimeoutMs: 60_000,
    sessionTtlMs: 60_000,
    sessionMaxPerUser: 3,
    sessionCookieName: 'scum_admin_session',
    sessionCookiePath: '/',
    sessionCookieSameSite: 'Strict',
    sessionCookieDomain: 'admin.example.com',
    sessionSecureCookie: true,
    adminWebStepUpTtlMs: 15 * 60 * 1000,
    ...overrides,
  });
}

test('admin auth runtime downgrades cookie security for loopback hosts', () => {
  const runtime = createRuntime();

  const sessionCookie = runtime.buildSessionCookie('session-1', {
    headers: {
      host: '127.0.0.1:3200',
    },
  });
  const clearCookie = runtime.buildClearSessionCookie({
    headers: {
      host: 'localhost:3200',
    },
  });

  assert.match(sessionCookie, /scum_admin_session=session-1/);
  assert.doesNotMatch(sessionCookie, /Domain=/);
  assert.doesNotMatch(sessionCookie, /Secure/);
  assert.doesNotMatch(clearCookie, /Domain=/);
  assert.doesNotMatch(clearCookie, /Secure/);
});

test('admin auth runtime keeps configured cookie security for non-loopback hosts', () => {
  const runtime = createRuntime();
  const cookie = runtime.buildSessionCookie('session-2', {
    headers: {
      host: 'admin.example.com',
    },
  });

  assert.match(cookie, /Domain=admin\.example\.com/);
  assert.match(cookie, /Secure/);
});

test('admin auth runtime carries tenant membership context into session auth state', () => {
  const runtime = createRuntime();
  const req = {
    headers: {
      host: 'tenant.example.com',
    },
    __pendingAdminTenantId: 'tenant-1',
    __pendingAdminSessionContext: {
      userId: 'platform-user-1',
      primaryEmail: 'tenant-owner@example.com',
      tenantMembershipId: 'mship-1',
      tenantMembershipType: 'tenant',
      tenantMembershipStatus: 'active',
    },
  };

  const sessionId = runtime.createSession('tenant-owner@example.com', 'owner', 'platform-user-password', req);
  const auth = runtime.getAuthContext({
    headers: {
      cookie: `scum_admin_session=${encodeURIComponent(sessionId)}`,
      host: 'tenant.example.com',
    },
  });

  assert.equal(auth.userId, 'platform-user-1');
  assert.equal(auth.primaryEmail, 'tenant-owner@example.com');
  assert.equal(auth.tenantId, 'tenant-1');
  assert.equal(auth.tenantMembershipId, 'mship-1');
  assert.equal(auth.tenantMembershipType, 'tenant');
  assert.equal(auth.tenantMembershipStatus, 'active');
});

test('admin auth runtime prefers resolved auth context override when present', () => {
  const runtime = createRuntime();

  const auth = runtime.getAuthContext({
    __resolvedAdminAuthContext: {
      mode: 'session',
      sessionId: 'session-override',
      user: 'tenant-admin@example.com',
      role: 'admin',
      tenantId: 'tenant-1',
      tenantMembershipStatus: 'disabled',
    },
    headers: {},
  });

  assert.equal(auth.sessionId, 'session-override');
  assert.equal(auth.tenantMembershipStatus, 'disabled');
  assert.equal(auth.tenantId, 'tenant-1');
});
