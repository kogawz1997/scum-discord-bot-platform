const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOCAL_ADMIN_AUTH_DISABLE_ENV,
} = require('C:\\new\\scripts\\pm2-local-start.js');

test('local PM2 profile forces 2FA and step-up off', () => {
  assert.deepEqual(LOCAL_ADMIN_AUTH_DISABLE_ENV, {
    ADMIN_WEB_2FA_ENABLED: 'false',
    ADMIN_WEB_2FA_SECRET: '',
    ADMIN_WEB_STEP_UP_ENABLED: 'false',
  });
});
