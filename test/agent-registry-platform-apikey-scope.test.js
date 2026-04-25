const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/domain/agents/agentRegistryService.js');
const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');

function installMock(modulePath, exportsValue) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function buildRepositoryMock(overrides = {}) {
  return {
    listAgents: () => [],
    listAgentCredentials: () => [],
    listAgentDevices: () => [],
    listAgentProvisioningTokens: () => [],
    listAgentSessions: () => [],
    listAgentTokenBindings: () => [],
    listServers: () => [],
    recordAgentSession: () => ({ ok: true }),
    revokeAgentCredential: () => ({ ok: true }),
    revokeAgentDevice: () => ({ ok: true }),
    revokeAgentProvisioningToken: () => ({ ok: true }),
    revokeAgentTokenBinding: () => ({ ok: true }),
    upsertAgent: () => ({ ok: true }),
    upsertAgentCredential: () => ({ ok: true }),
    upsertAgentDevice: () => ({ ok: true }),
    upsertAgentProvisioningToken: () => ({ ok: true }),
    upsertAgentTokenBinding: () => ({ ok: true }),
    ...overrides,
  };
}

function loadService(repositoryMock, deps = {}) {
  clearModule(servicePath);
  clearModule(repositoryPath);
  installMock(repositoryPath, repositoryMock);
  const { createAgentRegistryService } = require(servicePath);
  return createAgentRegistryService(deps);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(repositoryPath);
});

test('agent registry rejects mismatched runtime role and scope before API key creation', async () => {
  let createPlatformApiKeyCalled = false;
  const service = loadService(
    buildRepositoryMock({
      listServers: () => [{ id: 'server-1', tenantId: 'tenant-a' }],
    }),
    {
      getPlatformTenantById: async () => ({ id: 'tenant-a' }),
      createPlatformApiKey: async () => {
        createPlatformApiKeyCalled = true;
        return {
          ok: true,
          apiKey: { id: 'key-1' },
          rawKey: 'raw-key-1',
        };
      },
    },
  );

  const tokenResult = await service.createAgentToken({
    tenantId: 'tenant-a',
    serverId: 'server-1',
    agentId: 'agent-1',
    role: 'sync',
    scope: 'execute_only',
  }, 'owner');
  const provisionResult = await service.createAgentProvisioningToken({
    tenantId: 'tenant-a',
    serverId: 'server-1',
    agentId: 'agent-1',
    runtimeKind: 'server-bots',
    role: 'execute',
    scope: 'execute_only',
  }, 'owner');

  assert.equal(tokenResult.ok, false);
  assert.equal(tokenResult.reason, 'agent-runtime-role-scope-mismatch');
  assert.equal(provisionResult.ok, false);
  assert.equal(provisionResult.reason, 'agent-runtime-role-scope-mismatch');
  assert.equal(createPlatformApiKeyCalled, false);
});

test('agent registry emits provisioning governance audit without raw setup token', async () => {
  const auditCalls = [];
  const service = loadService(
    buildRepositoryMock({
      listServers: () => [{ id: 'server-1', tenantId: 'tenant-a', guildId: 'guild-1' }],
      upsertAgentProvisioningToken: (row) => ({ ok: true, token: row }),
      upsertAgent: (row) => ({ ok: true, agent: row }),
    }),
    {
      getPlatformTenantById: async () => ({ id: 'tenant-a' }),
      recordAdminSecuritySignal: (type, payload) => auditCalls.push({ type, payload }),
    },
  );

  const result = await service.createAgentProvisioningToken({
    tokenId: 'setup-1',
    tenantId: 'tenant-a',
    serverId: 'server-1',
    guildId: 'guild-1',
    agentId: 'sync-agent',
    runtimeKey: 'sync-runtime',
    role: 'sync',
    scope: 'sync_only',
    runtimeKind: 'server-bots',
    requestId: 'req-setup-1',
    actorRole: 'owner',
  }, 'admin-web:owner');

  assert.equal(result.ok, true);
  assert.match(result.rawSetupToken, /^stp_/);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].type, 'agent.provision.issue');
  assert.equal(auditCalls[0].payload.data.governance, true);
  assert.equal(auditCalls[0].payload.data.actionType, 'agent.provision.issue');
  assert.equal(auditCalls[0].payload.data.targetId, 'setup-1');
  assert.equal(auditCalls[0].payload.data.actorId, 'admin-web:owner');
  assert.equal(auditCalls[0].payload.data.actorRole, 'owner');
  assert.equal(auditCalls[0].payload.data.requestId, 'req-setup-1');
  assert.doesNotMatch(JSON.stringify(auditCalls[0]), /stp_/);
});

test('agent activation rejects attempts to change the runtime profile issued by setup token', async () => {
  const rawSetupToken = 'stp_abcdefabcdef.1234567890abcdef1234567890abcdef';
  const tokenHash = crypto.createHash('sha256').update(rawSetupToken, 'utf8').digest('hex');
  let createPlatformApiKeyCalled = false;
  const service = loadService(
    buildRepositoryMock({
      listAgentProvisioningTokens: () => [{
        id: 'setup-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        agentId: 'agent-1',
        role: 'sync',
        scope: 'sync_only',
        tokenPrefix: rawSetupToken.slice(0, 16),
        tokenHash,
        status: 'pending_activation',
        expiresAt: '2999-01-01T00:00:00.000Z',
      }],
      listServers: () => [{ id: 'server-1', tenantId: 'tenant-a' }],
      listAgentDevices: () => [],
    }),
    {
      createPlatformApiKey: async () => {
        createPlatformApiKeyCalled = true;
        return {
          ok: true,
          apiKey: { id: 'key-1' },
          rawKey: 'raw-key-1',
        };
      },
    },
  );

  const result = await service.activateAgent({
    setupToken: rawSetupToken,
    machineFingerprint: 'machine-a',
    runtimeKind: 'delivery-agents',
    metadata: {
      role: 'execute',
      scope: 'execute_only',
      runtimeKind: 'delivery-agents',
    },
  }, 'platform-agent');

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'agent-activation-runtime-boundary-mismatch');
  assert.equal(createPlatformApiKeyCalled, false);
});

test('agent registry emits activation governance audit without raw API key', async () => {
  const rawSetupToken = 'stp_abcdefabcdef.1234567890abcdef1234567890abcdef';
  const tokenHash = crypto.createHash('sha256').update(rawSetupToken, 'utf8').digest('hex');
  const auditCalls = [];
  const service = loadService(
    buildRepositoryMock({
      listAgentProvisioningTokens: () => [{
        id: 'setup-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        guildId: 'guild-1',
        agentId: 'sync-agent',
        runtimeKey: 'sync-runtime',
        role: 'sync',
        scope: 'sync_only',
        tokenPrefix: rawSetupToken.slice(0, 16),
        tokenHash,
        status: 'pending_activation',
        expiresAt: '2999-01-01T00:00:00.000Z',
      }],
      listServers: () => [{ id: 'server-1', tenantId: 'tenant-a', guildId: 'guild-1' }],
      listAgentDevices: () => [],
      upsertAgentDevice: (row) => ({ ok: true, device: row }),
      upsertAgentCredential: (row) => ({ ok: true, credential: row }),
      upsertAgentTokenBinding: (row) => ({ ok: true, binding: row }),
      upsertAgent: (row) => ({ ok: true, agent: row }),
      upsertAgentProvisioningToken: (row) => ({ ok: true, token: row }),
    }),
    {
      createPlatformApiKey: async () => ({
        ok: true,
        apiKey: { id: 'key-1' },
        rawKey: 'raw-key-secret-1',
      }),
      recordAdminSecuritySignal: (type, payload) => auditCalls.push({ type, payload }),
    },
  );

  const result = await service.activateAgent({
    setupToken: rawSetupToken,
    machineFingerprint: 'machine-a',
    hostname: 'host-a',
    requestId: 'req-activate-1',
  }, 'platform-agent:sync-runtime');

  assert.equal(result.ok, true);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].type, 'agent.activation');
  assert.equal(auditCalls[0].payload.data.governance, true);
  assert.equal(auditCalls[0].payload.data.actionType, 'agent.activation');
  assert.equal(auditCalls[0].payload.data.tenantId, 'tenant-a');
  assert.equal(auditCalls[0].payload.data.serverId, 'server-1');
  assert.equal(auditCalls[0].payload.data.targetId, 'sync-agent');
  assert.equal(auditCalls[0].payload.data.jobId, 'setup-1');
  assert.equal(auditCalls[0].payload.data.requestId, 'req-activate-1');
  assert.equal(auditCalls[0].payload.data.afterState.apiKeyId, 'key-1');
  assert.doesNotMatch(JSON.stringify(auditCalls[0]), /raw-key-secret|1234567890abcdef/);
});

test('agent registry forwards tenant scope when revoking an agent token API key', async () => {
  let seenCall = null;
  const service = loadService(
    buildRepositoryMock({
      listAgentCredentials: () => [{ id: 'cred-1', tenantId: 'tenant-a', apiKeyId: 'key-1' }],
      listAgentTokenBindings: () => [{ apiKeyId: 'key-1', tenantId: 'tenant-a' }],
    }),
    {
      revokePlatformApiKey: async (apiKeyId, actor, options = {}) => {
        seenCall = { apiKeyId, actor, options };
        return { ok: true, apiKey: { id: apiKeyId, tenantId: options.tenantId || null } };
      },
    },
  );

  const result = await service.revokeAgentToken({ apiKeyId: 'key-1' }, 'owner');

  assert.equal(result.ok, true);
  assert.deepEqual(seenCall, {
    apiKeyId: 'key-1',
    actor: 'owner',
    options: { tenantId: 'tenant-a' },
  });
});

test('agent registry forwards tenant scope when rotating a token through fallback revocation', async () => {
  let seenCall = null;
  const service = loadService(
    buildRepositoryMock({
      listAgentTokenBindings: () => [{
        apiKeyId: 'key-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        guildId: null,
        agentId: 'agent-1',
        role: 'sync',
        scope: 'sync_only',
        minVersion: '1.0.0',
      }],
      listAgentCredentials: () => [{
        id: 'cred-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        agentId: 'agent-1',
        apiKeyId: 'key-1',
        deviceId: 'device-1',
      }],
    }),
    {
      createPlatformApiKey: async () => ({
        ok: true,
        apiKey: { id: 'key-2', tenantId: 'tenant-a' },
        rawKey: 'raw-key-2',
      }),
      revokePlatformApiKey: async (apiKeyId, actor, options = {}) => {
        seenCall = { apiKeyId, actor, options };
        return { ok: true, apiKey: { id: apiKeyId, tenantId: options.tenantId || null } };
      },
    },
  );

  const result = await service.rotateAgentToken({ apiKeyId: 'key-1' }, 'owner');

  assert.equal(result.ok, true);
  assert.deepEqual(seenCall, {
    apiKeyId: 'key-1',
    actor: 'owner',
    options: { tenantId: 'tenant-a' },
  });
});

test('agent registry forwards tenant scope when revoking device-linked API keys', async () => {
  const calls = [];
  const service = loadService(
    buildRepositoryMock({
      listAgentDevices: () => [{
        id: 'device-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        agentId: 'agent-1',
      }],
      listAgentCredentials: () => [{
        id: 'cred-1',
        tenantId: 'tenant-a',
        serverId: 'server-1',
        agentId: 'agent-1',
        deviceId: 'device-1',
        apiKeyId: 'key-1',
      }],
    }),
    {
      revokePlatformApiKey: async (apiKeyId, actor, options = {}) => {
        calls.push({ apiKeyId, actor, options });
        return { ok: true, apiKey: { id: apiKeyId, tenantId: options.tenantId || null } };
      },
    },
  );

  const result = await service.revokeManagedAgentDevice({ deviceId: 'device-1' }, 'owner');

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    apiKeyId: 'key-1',
    actor: 'owner',
    options: {
      tenantId: 'tenant-a',
      allowGlobal: false,
    },
  }]);
});
