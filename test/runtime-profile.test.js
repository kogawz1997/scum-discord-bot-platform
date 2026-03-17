const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBotRuntimeProfile,
  getWorkerRuntimeProfile,
} = require('../src/config/runtimeProfile');

test('bot runtime profile disables optional services by default in test mode', () => {
  const profile = getBotRuntimeProfile({
    NODE_ENV: 'test',
    BOT_HEALTH_HOST: '127.0.0.1',
    BOT_HEALTH_PORT: '3212',
  });

  assert.equal(profile.runtime, 'bot');
  assert.equal(profile.isTestRuntime, true);
  assert.equal(profile.features.adminWeb, false);
  assert.equal(profile.features.scumWebhook, false);
  assert.equal(profile.health.port, 3212);
});

test('worker runtime profile exposes provider, execution mode, and feature flags', () => {
  const profile = getWorkerRuntimeProfile({
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/scum',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_TOPOLOGY_MODE: 'schema-per-tenant',
    WORKER_ENABLE_RENTBIKE: 'true',
    WORKER_ENABLE_DELIVERY: 'false',
    DELIVERY_EXECUTION_MODE: 'agent',
    DELIVERY_NATIVE_PROOF_MODE: 'required',
    WORKER_HEARTBEAT_MS: '45000',
    PLATFORM_DEFAULT_TENANT_ID: 'tenant-a',
  });

  assert.equal(profile.database.provider, 'postgresql');
  assert.equal(profile.executionMode, 'agent');
  assert.equal(profile.tenantDbTopologyMode, 'schema-per-tenant');
  assert.equal(profile.deliveryNativeProofMode, 'required');
  assert.equal(profile.features.rentBike, true);
  assert.equal(profile.features.delivery, false);
  assert.equal(profile.heartbeatMs, 45000);
  assert.equal(profile.tenantMode, 'scoped');
});
