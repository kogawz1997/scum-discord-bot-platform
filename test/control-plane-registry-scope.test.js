const test = require('node:test');
const assert = require('node:assert/strict');

const repositoryPath = require.resolve('../src/data/repositories/controlPlaneRegistryRepository');
const persistPath = require.resolve('../src/store/_persist');
const prismaPath = require.resolve('../src/prisma');
const dbEnginePath = require.resolve('../src/utils/dbEngine');
const tenantIsolationPath = require.resolve('../src/utils/tenantDbIsolation');
const contractsPath = require.resolve('../src/contracts/agent/agentContracts');
const mirrorPath = require.resolve('../src/utils/controlPlaneRegistryFileMirror');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
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

test.afterEach(() => {
  clearModule(repositoryPath);
  clearModule(persistPath);
  clearModule(prismaPath);
  clearModule(dbEnginePath);
  clearModule(tenantIsolationPath);
  clearModule(contractsPath);
  clearModule(mirrorPath);
});

function loadRepositoryWithState(state) {
  const previousStoreMode = process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
  installMock(prismaPath, {
    prisma: {},
  });
  installMock(persistPath, {
    atomicWriteJson: async () => {},
    getFilePath: (name) => name,
    isDbPersistenceEnabled: () => false,
  });
  installMock(dbEnginePath, {
    resolveDatabaseRuntime: () => ({ engine: 'postgresql' }),
  });
  installMock(tenantIsolationPath, {
    assertTenantDbIsolationScope({ tenantId, allowGlobal, operation }) {
      if (!tenantId && allowGlobal !== true) {
        const error = new Error(`${operation} requires tenantId`);
        error.code = 'TENANT_DB_SCOPE_REQUIRED';
        throw error;
      }
      return { tenantId: tenantId || null, allowGlobal: allowGlobal === true };
    },
  });
  installMock(contractsPath, {
    normalizeAgentRegistrationInput: (value = {}) => value,
    normalizeAgentSessionInput: (value = {}) => value,
    normalizeAgentSyncPayload: (value = {}) => value,
    normalizeServerDiscordLinkInput: (value = {}) => value,
    normalizeServerInput: (value = {}) => value,
    trimText(value, maxLen = 240) {
      const text = String(value || '').trim();
      if (!text) return '';
      return text.length > maxLen ? text.slice(0, maxLen) : text;
    },
  });
  installMock(mirrorPath, {
    resolveControlPlaneRegistryFileMirrorSlices() {
      return {
        mode: 'explicit',
        slices: [
          'servers',
          'serverDiscordLinks',
          'agents',
          'agentTokenBindings',
          'agentProvisioningTokens',
          'agentDevices',
          'agentCredentials',
          'agentSessions',
          'syncRuns',
          'syncEvents',
        ],
        invalid: [],
      };
    },
  });
  const repository = require(repositoryPath);
  repository.mutateRegistry((registry) => ({
    ...registry,
    servers: Array.isArray(state.servers) ? state.servers.slice() : [],
    serverDiscordLinks: Array.isArray(state.serverDiscordLinks) ? state.serverDiscordLinks.slice() : [],
    agents: Array.isArray(state.agents) ? state.agents.slice() : [],
    agentTokenBindings: Array.isArray(state.agentTokenBindings) ? state.agentTokenBindings.slice() : [],
    agentProvisioningTokens: Array.isArray(state.agentProvisioningTokens) ? state.agentProvisioningTokens.slice() : [],
    agentDevices: Array.isArray(state.agentDevices) ? state.agentDevices.slice() : [],
    agentCredentials: Array.isArray(state.agentCredentials) ? state.agentCredentials.slice() : [],
    agentSessions: Array.isArray(state.agentSessions) ? state.agentSessions.slice() : [],
    syncRuns: Array.isArray(state.syncRuns) ? state.syncRuns.slice() : [],
    syncEvents: Array.isArray(state.syncEvents) ? state.syncEvents.slice() : [],
  }));
  if (previousStoreMode === undefined) {
    delete process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  } else {
    process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = previousStoreMode;
  }
  return repository;
}

test('control-plane registry requires explicit allowGlobal for global runtime journal listings in strict mode', () => {
  const repository = loadRepositoryWithState({
    agentSessions: [{ tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' }],
    syncRuns: [{ tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' }],
    syncEvents: [{ tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' }],
  });

  assert.throws(
    () => repository.listAgentSessions({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listSyncRuns({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listSyncEvents({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );

  assert.equal(repository.listAgentSessions({ allowGlobal: true }).length, 1);
  assert.equal(repository.listSyncRuns({ allowGlobal: true }).length, 1);
  assert.equal(repository.listSyncEvents({ allowGlobal: true }).length, 1);
});

test('control-plane registry journal listings remain tenant-scoped when tenantId is provided', () => {
  const repository = loadRepositoryWithState({
    agentSessions: [
      { tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' },
      { tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b' },
    ],
    syncRuns: [
      { tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' },
      { tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b' },
    ],
    syncEvents: [
      { tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' },
      { tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b' },
    ],
  });

  assert.deepEqual(
    repository.listAgentSessions({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listSyncRuns({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listSyncEvents({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
});

test('control-plane registry requires explicit allowGlobal for global infrastructure listings in strict mode', () => {
  const repository = loadRepositoryWithState({
    servers: [{ id: 'srv-a', tenantId: 'tenant-a', name: 'Server A' }],
    serverDiscordLinks: [{ id: 'link-a', tenantId: 'tenant-a', serverId: 'srv-a', guildId: 'guild-a' }],
    agents: [{ id: 'agent-row-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', runtimeKey: 'runtime-a' }],
    agentTokenBindings: [{ id: 'binding-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', apiKeyId: 'key-a' }],
    agentProvisioningTokens: [{ id: 'token-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', tokenPrefix: 'pref-a' }],
    agentDevices: [{ id: 'device-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' }],
    agentCredentials: [{ id: 'cred-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', apiKeyId: 'key-a' }],
  });

  assert.throws(
    () => repository.listServers({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listServerDiscordLinks({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listAgents({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listAgentTokenBindings({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listAgentProvisioningTokens({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listAgentDevices({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
  assert.throws(
    () => repository.listAgentCredentials({}),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );

  assert.equal(repository.listServers({ allowGlobal: true }).length, 1);
  assert.equal(repository.listServerDiscordLinks({ allowGlobal: true }).length, 1);
  assert.equal(repository.listAgents({ allowGlobal: true }).length, 1);
  assert.equal(repository.listAgentTokenBindings({ allowGlobal: true }).length, 1);
  assert.equal(repository.listAgentProvisioningTokens({ allowGlobal: true }).length, 1);
  assert.equal(repository.listAgentDevices({ allowGlobal: true }).length, 1);
  assert.equal(repository.listAgentCredentials({ allowGlobal: true }).length, 1);
});

test('control-plane registry infrastructure listings remain tenant-scoped when tenantId is provided', () => {
  const repository = loadRepositoryWithState({
    servers: [
      { id: 'srv-a', tenantId: 'tenant-a', name: 'Server A' },
      { id: 'srv-b', tenantId: 'tenant-b', name: 'Server B' },
    ],
    serverDiscordLinks: [
      { id: 'link-a', tenantId: 'tenant-a', serverId: 'srv-a', guildId: 'guild-a' },
      { id: 'link-b', tenantId: 'tenant-b', serverId: 'srv-b', guildId: 'guild-b' },
    ],
    agents: [
      { id: 'agent-row-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', runtimeKey: 'runtime-a' },
      { id: 'agent-row-b', tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b', runtimeKey: 'runtime-b' },
    ],
    agentTokenBindings: [
      { id: 'binding-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', apiKeyId: 'key-a' },
      { id: 'binding-b', tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b', apiKeyId: 'key-b' },
    ],
    agentProvisioningTokens: [
      { id: 'token-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', tokenPrefix: 'pref-a' },
      { id: 'token-b', tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b', tokenPrefix: 'pref-b' },
    ],
    agentDevices: [
      { id: 'device-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a' },
      { id: 'device-b', tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b' },
    ],
    agentCredentials: [
      { id: 'cred-a', tenantId: 'tenant-a', serverId: 'srv-a', agentId: 'agent-a', apiKeyId: 'key-a' },
      { id: 'cred-b', tenantId: 'tenant-b', serverId: 'srv-b', agentId: 'agent-b', apiKeyId: 'key-b' },
    ],
  });

  assert.deepEqual(
    repository.listServers({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listServerDiscordLinks({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listAgents({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listAgentTokenBindings({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listAgentProvisioningTokens({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listAgentDevices({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
  assert.deepEqual(
    repository.listAgentCredentials({ tenantId: 'tenant-a' }).map((row) => row.tenantId),
    ['tenant-a'],
  );
});
