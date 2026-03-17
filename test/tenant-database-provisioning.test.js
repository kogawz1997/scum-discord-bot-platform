const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldAutoProvisionTenantDatabaseTarget,
} = require('../src/utils/tenantDatabaseProvisioning');

test('tenant database provisioning stays off in non-test runtime unless explicitly enabled', () => {
  assert.equal(
    shouldAutoProvisionTenantDatabaseTarget({
      env: { NODE_ENV: 'production' },
      isTestRuntime: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoProvisionTenantDatabaseTarget({
      env: { NODE_ENV: 'production', TENANT_DB_AUTO_PROVISION: 'true' },
      isTestRuntime: false,
    }),
    true,
  );
});

test('tenant database provisioning stays on for test runtime unless explicitly disabled', () => {
  assert.equal(
    shouldAutoProvisionTenantDatabaseTarget({
      env: { NODE_ENV: 'test' },
      isTestRuntime: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoProvisionTenantDatabaseTarget({
      env: { NODE_ENV: 'test', TENANT_DB_AUTO_PROVISION: 'false' },
      isTestRuntime: true,
    }),
    false,
  );
});
