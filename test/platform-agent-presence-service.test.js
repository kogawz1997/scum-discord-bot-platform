'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlatformAgentPresenceService,
} = require('../src/services/platformAgentPresenceService');

function createJsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

test('server-config snapshot requires tenant/server scope for server-bot runtime', async () => {
  let fetchCount = 0;
  const service = createPlatformAgentPresenceService({
    baseUrl: 'https://control.example',
    env: {
      PLATFORM_AGENT_TOKEN: 'agent-token',
    },
    role: 'sync',
    scope: 'sync_only',
    fetchImpl: async () => {
      fetchCount += 1;
      return createJsonResponse({ ok: true, data: {} });
    },
  });

  const result = await service.uploadServerConfigSnapshot({
    status: 'ready',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'platform-agent-server-config-scope-required');
  assert.equal(fetchCount, 0);
});

test('server-config job APIs reject execute-only delivery runtime', async () => {
  let fetchCount = 0;
  const service = createPlatformAgentPresenceService({
    baseUrl: 'https://control.example',
    env: {
      PLATFORM_AGENT_TOKEN: 'agent-token',
    },
    tenantId: 'tenant-delivery',
    serverId: 'server-delivery',
    runtimeKey: 'delivery-runtime',
    role: 'execute',
    scope: 'execute_only',
    fetchImpl: async () => {
      fetchCount += 1;
      return createJsonResponse({ ok: true, data: {} });
    },
  });

  const result = await service.claimNextServerConfigJob();

  assert.equal(result.ok, false);
  assert.equal(result.error, 'platform-agent-server-bot-required');
  assert.equal(fetchCount, 0);
});

test('claimNextServerConfigJob sends explicit scoped query for server-bot runtime', async () => {
  let requestUrl = '';
  let authorization = '';
  const service = createPlatformAgentPresenceService({
    baseUrl: 'https://control.example',
    env: {
      PLATFORM_AGENT_TOKEN: 'agent-token',
    },
    tenantId: 'tenant-sync',
    serverId: 'server-sync',
    runtimeKey: 'server-bot-runtime',
    role: 'sync',
    scope: 'sync_only',
    fetchImpl: async (url, options = {}) => {
      requestUrl = String(url || '');
      authorization = String(options?.headers?.Authorization || '');
      return createJsonResponse({
        ok: true,
        data: {
          job: {
            id: 'cfg-job-1',
          },
        },
      });
    },
  });

  const result = await service.claimNextServerConfigJob();

  assert.equal(result.ok, true);
  assert.match(requestUrl, /\/platform\/api\/v1\/server-config\/jobs\/next\?/);
  assert.match(requestUrl, /tenantId=tenant-sync/);
  assert.match(requestUrl, /serverId=server-sync/);
  assert.match(requestUrl, /runtimeKey=server-bot-runtime/);
  assert.equal(authorization, 'Bearer agent-token');
});

test('reportServerConfigJobResult does not allow payload to override scoped tenant or runtime keys', async () => {
  let requestBody = null;
  const service = createPlatformAgentPresenceService({
    baseUrl: 'https://control.example',
    env: {
      PLATFORM_AGENT_TOKEN: 'agent-token',
    },
    tenantId: 'tenant-sync',
    serverId: 'server-sync',
    runtimeKey: 'server-bot-runtime',
    role: 'sync',
    scope: 'sync_only',
    fetchImpl: async (_url, options = {}) => {
      requestBody = JSON.parse(String(options?.body || '{}'));
      return createJsonResponse({
        ok: true,
        data: {
          status: 'succeeded',
        },
      });
    },
  });

  const result = await service.reportServerConfigJobResult({
    tenantId: 'tenant-other',
    serverId: 'server-other',
    runtimeKey: 'runtime-other',
    jobId: 'cfg-job-2',
    status: 'succeeded',
  });

  assert.equal(result.ok, true);
  assert.equal(requestBody.tenantId, 'tenant-sync');
  assert.equal(requestBody.serverId, 'server-sync');
  assert.equal(requestBody.runtimeKey, 'server-bot-runtime');
  assert.equal(requestBody.jobId, 'cfg-job-2');
  assert.equal(requestBody.status, 'succeeded');
});
