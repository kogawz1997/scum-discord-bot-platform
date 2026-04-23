const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');

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

function createDelegateStore(options = {}) {
  const rows = new Map();
  const uniqueKeyOf = typeof options.uniqueKeyOf === 'function'
    ? options.uniqueKeyOf
    : ((row) => String(row?.id || ''));
  return {
    delegate: {
      async findMany() {
        return Array.from(rows.values()).map((row) => JSON.parse(JSON.stringify(row)));
      },
      async deleteMany() {
        rows.clear();
        return { count: 0 };
      },
      async createMany({ data }) {
        const seen = new Set();
        for (const row of Array.isArray(data) ? data : []) {
          const uniqueKey = String(uniqueKeyOf(row) || '');
          if (uniqueKey && seen.has(uniqueKey)) {
            const error = new Error('unique');
            error.code = 'P2002';
            throw error;
          }
          if (uniqueKey) {
            seen.add(uniqueKey);
          }
          rows.set(String(row.id), JSON.parse(JSON.stringify(row)));
        }
        return { count: rows.size };
      },
      snapshot() {
        return Array.from(rows.values()).map((row) => JSON.parse(JSON.stringify(row)));
      },
    },
  };
}

function createPrismaHarness() {
  const stores = {
    controlPlaneServer: createDelegateStore(),
    controlPlaneServerDiscordLink: createDelegateStore({
      uniqueKeyOf: (row) => `${row.tenantId || ''}::${row.guildId || ''}`,
    }),
    controlPlaneAgent: createDelegateStore({
      uniqueKeyOf: (row) => `${row.tenantId || ''}::${row.serverId || ''}::${row.agentId || ''}`,
    }),
    controlPlaneAgentTokenBinding: createDelegateStore({
      uniqueKeyOf: (row) => String(row.apiKeyId || ''),
    }),
    controlPlaneAgentProvisioningToken: createDelegateStore({
      uniqueKeyOf: (row) => String(row.tokenPrefix || ''),
    }),
    controlPlaneAgentDevice: createDelegateStore(),
    controlPlaneAgentCredential: createDelegateStore({
      uniqueKeyOf: (row) => String(row.apiKeyId || ''),
    }),
    controlPlaneAgentSession: createDelegateStore({
      uniqueKeyOf: (row) => String(row.sessionId || ''),
    }),
    controlPlaneSyncRun: createDelegateStore(),
    controlPlaneSyncEvent: createDelegateStore(),
  };
  return {
    prisma: Object.fromEntries(
      Object.entries(stores).map(([key, value]) => [key, value.delegate]),
    ),
    snapshot(key) {
      return stores[key]?.delegate.snapshot() || [];
    },
  };
}

function loadRepositoryWithMocks(prismaHarness, options = {}) {
  clearModule(repositoryPath);
  installMock(prismaPath, {
    prisma: prismaHarness?.prisma || {},
  });
  const fileWrites = [];
  const filePath = options.filePath || path.join(process.cwd(), 'tmp', 'control-plane-registry.json');
  installMock(persistPath, {
    atomicWriteJson(filePath, payload) {
      fileWrites.push({
        filePath,
        payload: JSON.parse(JSON.stringify(payload)),
      });
    },
    getFilePath(name) {
      if (name === 'control-plane-registry.json') {
        return filePath;
      }
      return path.join(process.cwd(), 'tmp', name);
    },
    isDbPersistenceEnabled() {
      return String(process.env.PERSIST_REQUIRE_DB || '').trim().toLowerCase() === 'true';
    },
  });
  return {
    repository: require(repositoryPath),
    fileWrites,
  };
}

test.afterEach(() => {
  delete process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  delete process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES;
  delete process.env.CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY;
  delete process.env.PERSIST_REQUIRE_DB;
  delete process.env.DATABASE_URL;
  delete process.env.NODE_ENV;
  clearModule(repositoryPath);
  clearModule(prismaPath);
  clearModule(persistPath);
});

test('control plane registry mirrors core server, agent, session, and sync slices through prisma delegates when available', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  const prismaHarness = createPrismaHarness();
  const { repository } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertServer({
    tenantId: 'tenant-a',
    id: 'server-a',
    slug: 'server-a',
    name: 'Server A',
    guildId: 'guild-a',
  }).ok, true);

  assert.equal(repository.upsertServerDiscordLink({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
  }).ok, true);

  assert.equal(repository.upsertAgent({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-a',
    role: 'execute',
    scope: 'execute_only',
    version: '1.2.3',
  }).ok, true);

  assert.equal(repository.upsertAgentTokenBinding({
    id: 'binding-a',
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    apiKeyId: 'api-key-a',
    role: 'execute',
    scope: 'execute_only',
  }).ok, true);

  assert.equal(repository.recordAgentSession({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-a',
    role: 'execute',
    scope: 'execute_only',
    sessionId: 'session-a',
    heartbeatAt: '2026-03-28T05:00:00.000Z',
    baseUrl: 'http://127.0.0.1:3211',
  }).ok, true);

  assert.equal(repository.recordSyncPayload({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-a',
    role: 'sync',
    scope: 'sync_only',
    syncRunId: 'sync-a',
    freshnessAt: '2026-03-28T05:01:00.000Z',
    events: [{ type: 'join', playerName: 'Tester' }],
  }).ok, true);

  await repository.waitForControlPlaneRegistryPersistence();

  assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneServerDiscordLink').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneAgent').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneAgentTokenBinding').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneAgentSession').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneSyncRun').length, 1);
  assert.equal(prismaHarness.snapshot('controlPlaneSyncEvent').length, 1);
});

test('control plane registry dedupes rows by slice unique keys before db persistence', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  const prismaHarness = createPrismaHarness();
  const { repository } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertAgent({
    id: 'agent-row-1',
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-a',
    role: 'execute',
    scope: 'execute_only',
    version: '1.2.3',
  }).ok, true);

  assert.equal(repository.upsertAgent({
    id: 'agent-row-2',
    tenantId: 'tenant-a',
    serverId: 'server-a',
    guildId: 'guild-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-b',
    role: 'execute',
    scope: 'execute_only',
    version: '1.2.4',
  }).ok, true);

  await repository.waitForControlPlaneRegistryPersistence();

  const agentRows = prismaHarness.snapshot('controlPlaneAgent');
  assert.equal(agentRows.length, 1);
  assert.equal(String(agentRows[0]?.id || ''), 'agent-row-2');
  assert.equal(String(agentRows[0]?.runtimeKey || ''), 'runtime-b');
});

test('control plane registry file mirror can exclude volatile slices while keeping db persistence active', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'servers';
  const prismaHarness = createPrismaHarness();
  const { repository, fileWrites } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertServer({
    tenantId: 'tenant-a',
    id: 'server-a',
    slug: 'server-a',
    name: 'Server A',
  }).ok, true);
  await repository.waitForControlPlaneRegistryPersistence();

  const writesAfterServer = fileWrites.length;
  assert.ok(writesAfterServer >= 1);

  assert.equal(repository.recordAgentSession({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    agentId: 'agent-a',
    runtimeKey: 'runtime-a',
    role: 'sync',
    scope: 'sync_only',
    sessionId: 'session-a',
    heartbeatAt: '2026-03-28T05:00:00.000Z',
  }).ok, true);
  await repository.waitForControlPlaneRegistryPersistence();

  assert.equal(prismaHarness.snapshot('controlPlaneAgentSession').length, 1);
  assert.equal(fileWrites.length, writesAfterServer);

  const lastMirrorSnapshot = fileWrites.at(-1)?.payload;
  assert.equal(lastMirrorSnapshot.servers.length, 1);
  assert.equal(lastMirrorSnapshot.agentSessions.length, 0);
  assert.equal(lastMirrorSnapshot.syncRuns.length, 0);
});

test('control plane registry can disable file mirror entirely while keeping db persistence active', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';
  const prismaHarness = createPrismaHarness();
  const { repository, fileWrites } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertServer({
    tenantId: 'tenant-a',
    id: 'server-a',
    slug: 'server-a',
    name: 'Server A',
  }).ok, true);
  await repository.waitForControlPlaneRegistryPersistence();

  assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 1);
  assert.equal(fileWrites.length, 0);
});

test('control plane registry does not silently fall back to file storage when db delegates are unavailable', async () => {
  const { repository, fileWrites } = loadRepositoryWithMocks(null);

  await assert.rejects(
    () => repository.initControlPlaneRegistryRepository(),
    /control-plane-registry-delegates-unavailable/,
  );

  assert.throws(
    () => repository.upsertServer({
      tenantId: 'tenant-a',
      id: 'server-a',
      slug: 'server-a',
      name: 'Server A',
    }),
    /control-plane-registry-delegates-unavailable/,
  );

  assert.equal(fileWrites.length, 0);
});

test('control plane registry does not import file state into an empty db unless explicitly enabled', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';
  const prismaHarness = createPrismaHarness();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-db-'));
  const filePath = path.join(tempDir, 'control-plane-registry.json');
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    updatedAt: '2026-03-28T05:00:00.000Z',
    servers: [{
      id: 'server-from-file',
      tenantId: 'tenant-a',
      slug: 'server-from-file',
      name: 'Server From File',
      status: 'active',
      locale: 'th',
      guildId: null,
      metadata: {},
      actor: 'system',
      createdAt: '2026-03-28T05:00:00.000Z',
      updatedAt: '2026-03-28T05:00:00.000Z',
    }],
    serverDiscordLinks: [],
    agents: [],
    agentTokenBindings: [],
    agentProvisioningTokens: [],
    agentDevices: [],
    agentCredentials: [],
    agentSessions: [],
    syncRuns: [],
    syncEvents: [],
  }), 'utf8');

  try {
    const { repository } = loadRepositoryWithMocks(prismaHarness, { filePath });
    await repository.initControlPlaneRegistryRepository();

    assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 0);
    assert.deepEqual(repository.listServers({ tenantId: 'tenant-a' }), []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry can explicitly import file state into an empty db for migration', async () => {
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';
  process.env.CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY = 'true';
  const prismaHarness = createPrismaHarness();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-import-'));
  const filePath = path.join(tempDir, 'control-plane-registry.json');
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    updatedAt: '2026-03-28T05:00:00.000Z',
    servers: [{
      id: 'server-from-file',
      tenantId: 'tenant-a',
      slug: 'server-from-file',
      name: 'Server From File',
      status: 'active',
      locale: 'th',
      guildId: null,
      metadata: {},
      actor: 'system',
      createdAt: '2026-03-28T05:00:00.000Z',
      updatedAt: '2026-03-28T05:00:00.000Z',
    }],
    serverDiscordLinks: [],
    agents: [],
    agentTokenBindings: [],
    agentProvisioningTokens: [],
    agentDevices: [],
    agentCredentials: [],
    agentSessions: [],
    syncRuns: [],
    syncEvents: [],
  }), 'utf8');

  try {
    const { repository } = loadRepositoryWithMocks(prismaHarness, { filePath });
    await repository.initControlPlaneRegistryRepository();

    assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 1);
    assert.equal(
      String(prismaHarness.snapshot('controlPlaneServer')[0]?.id || ''),
      'server-from-file',
    );
    assert.equal(
      String(repository.listServers({ tenantId: 'tenant-a' })[0]?.id || ''),
      'server-from-file',
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry requires db persistence when PERSIST_REQUIRE_DB is enabled even if file mode is requested', async () => {
  process.env.PERSIST_REQUIRE_DB = 'true';
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';
  const prismaHarness = createPrismaHarness();
  const { repository, fileWrites } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertServer({
    tenantId: 'tenant-a',
    id: 'server-a',
    slug: 'server-a',
    name: 'Server A',
    guildId: 'guild-a',
  }).ok, true);

  await repository.waitForControlPlaneRegistryPersistence();

  assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 1);
  assert.equal(fileWrites.length, 0);
});

test('control plane registry keeps db persistence on server-engine runtimes even when file mode is requested', async () => {
  process.env.DATABASE_URL = 'postgresql://codex:secret@127.0.0.1:5432/controlplane';
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';
  const prismaHarness = createPrismaHarness();
  const { repository, fileWrites } = loadRepositoryWithMocks(prismaHarness);

  await repository.initControlPlaneRegistryRepository();

  assert.equal(repository.upsertServer({
    tenantId: 'tenant-server-engine',
    id: 'server-server-engine',
    slug: 'server-server-engine',
    name: 'Server Server Engine',
    guildId: 'guild-server-engine',
  }).ok, true);

  await repository.waitForControlPlaneRegistryPersistence();

  assert.equal(prismaHarness.snapshot('controlPlaneServer').length, 1);
  assert.equal(fileWrites.length, 0);
});
