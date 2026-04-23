const test = require('node:test');
const assert = require('node:assert/strict');
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
