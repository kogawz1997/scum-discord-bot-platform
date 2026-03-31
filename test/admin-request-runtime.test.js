const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminRequestRuntime,
} = require('../src/admin/runtime/adminRequestRuntime');

test('admin request runtime allows split owner and tenant web origins by default', () => {
  const runtime = createAdminRequestRuntime({
    adminWebMaxBodyBytes: 1024 * 1024,
    adminWebTrustProxy: false,
    adminWebEnforceOriginCheck: true,
    adminWebAllowedOrigins: '',
    getAdminRestoreState() {
      return null;
    },
    sendJson() {},
  });

  const allowedOrigins = runtime.buildAllowedOrigins('127.0.0.1', 3200);
  assert.equal(allowedOrigins.has('http://127.0.0.1:3201'), true);
  assert.equal(allowedOrigins.has('http://127.0.0.1:3202'), true);

  const ownerReq = {
    headers: {
      origin: 'http://127.0.0.1:3201',
      'sec-fetch-site': 'same-site',
    },
  };
  const tenantReq = {
    headers: {
      origin: 'http://127.0.0.1:3202',
      'sec-fetch-site': 'same-site',
    },
  };

  assert.equal(runtime.violatesBrowserOriginPolicy(ownerReq, allowedOrigins), false);
  assert.equal(runtime.violatesBrowserOriginPolicy(tenantReq, allowedOrigins), false);
});
