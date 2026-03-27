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
