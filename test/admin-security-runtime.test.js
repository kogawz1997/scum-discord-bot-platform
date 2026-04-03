const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminSecurityRuntime,
} = require('../src/admin/runtime/adminSecurityRuntime');

function buildRuntime(overrides = {}) {
  const signals = [];
  const notifications = [];
  const events = [];
  const runtime = createAdminSecurityRuntime({
    loginRateLimitWindowMs: 60_000,
    loginRateLimitMaxAttempts: 5,
    loginSpikeWindowMs: 60_000,
    loginSpikeThreshold: 10,
    loginSpikeIpThreshold: 5,
    loginSpikeAlertCooldownMs: 60_000,
    getClientIp: () => '127.0.0.1',
    publishAdminLiveUpdate: () => {},
    addAdminNotification: (entry) => {
      notifications.push(entry);
      return entry;
    },
    recordAdminSecurityEvent: (entry) => {
      events.push(entry);
      return entry;
    },
    logger: { warn() {} },
    ...overrides,
  });
  return {
    ...runtime,
    signals,
    notifications,
    events,
  };
}

test('admin security runtime limits config-apply actions per tenant and actor', () => {
  const runtime = buildRuntime();
  const req = { headers: {} };

  for (let index = 0; index < 6; index += 1) {
    const state = runtime.consumeActionRateLimit('config-apply', req, {
      actor: 'tenant-admin',
      tenantId: 'tenant-1',
    });
    assert.equal(state.limited, false);
  }

  const limited = runtime.consumeActionRateLimit('config-apply', req, {
    actor: 'tenant-admin',
    tenantId: 'tenant-1',
  });
  assert.equal(limited.limited, true);
  assert.ok(limited.retryAfterMs > 0);

  const otherTenant = runtime.consumeActionRateLimit('config-apply', req, {
    actor: 'tenant-admin',
    tenantId: 'tenant-2',
  });
  assert.equal(otherTenant.limited, false);
});

test('admin security runtime limits restart actions using the restart bucket', () => {
  const runtime = buildRuntime();
  const req = { headers: {} };

  for (let index = 0; index < 4; index += 1) {
    const state = runtime.consumeActionRateLimit('restart', req, {
      actor: 'owner',
      tenantId: 'global',
    });
    assert.equal(state.limited, false);
  }

  const limited = runtime.consumeActionRateLimit('restart', req, {
    actor: 'owner',
    tenantId: 'global',
  });
  assert.equal(limited.limited, true);
  assert.ok(limited.retryAfterMs > 0);
});
