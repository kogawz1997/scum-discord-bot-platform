const test = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveControlPlaneBaseUrl,
} = require('../src/integrations/scum/adapters/controlPlaneSyncClient');

test('resolveControlPlaneBaseUrl prefers explicit admin backend urls', () => {
  assert.equal(resolveControlPlaneBaseUrl({
    ADMIN_BACKEND_BASE_URL: 'http://127.0.0.1:3200/',
    ADMIN_WEB_HOST: '127.0.0.1',
    ADMIN_WEB_PORT: '9999',
  }), 'http://127.0.0.1:3200');
});

test('resolveControlPlaneBaseUrl falls back to admin host and port', () => {
  assert.equal(resolveControlPlaneBaseUrl({
    ADMIN_WEB_HOST: '127.0.0.1',
    ADMIN_WEB_PORT: '3200',
  }), 'http://127.0.0.1:3200');
});

test('resolveControlPlaneBaseUrl preserves explicit protocol in admin host fallback', () => {
  assert.equal(resolveControlPlaneBaseUrl({
    ADMIN_WEB_HOST: 'https://admin.example.com',
    ADMIN_WEB_PORT: '443',
  }), 'https://admin.example.com:443');
});
