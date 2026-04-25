const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlatformServerConfigService,
} = require('../src/services/platformServerConfigService');

test('server config runtime APIs reject delivery-agent runtime profile before persistence', async () => {
  const service = createPlatformServerConfigService({
    listServerRegistry: () => {
      throw new Error('server registry should not be reached');
    },
    withTenantDbIsolation: () => {
      throw new Error('database should not be reached');
    },
  });

  const claim = await service.claimNextServerConfigJob({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'delivery-runtime',
    role: 'execute',
    scope: 'execute_only',
  });
  assert.equal(claim.ok, false);
  assert.equal(claim.reason, 'server-bot-runtime-required');

  const complete = await service.completeServerConfigJob({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    jobId: 'job-a',
    runtimeKey: 'delivery-runtime',
    status: 'succeeded',
    runtimeKind: 'delivery-agents',
  });
  assert.equal(complete.ok, false);
  assert.equal(complete.reason, 'server-bot-runtime-required');

  const snapshot = await service.upsertServerConfigSnapshot({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    runtimeKey: 'delivery-runtime',
    role: 'execute',
    scope: 'execute_only',
    snapshot: { files: [] },
  });
  assert.equal(snapshot.ok, false);
  assert.equal(snapshot.reason, 'server-bot-runtime-required');
});
