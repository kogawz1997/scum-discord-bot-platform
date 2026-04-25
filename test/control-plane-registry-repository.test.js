const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');

function freshRepository(tempDir) {
  process.env.BOT_DATA_DIR = tempDir;
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
  delete require.cache[repositoryPath];
  delete require.cache[persistPath];
  delete require.cache[runtimeDataDirPath];
  return require(repositoryPath);
}

function restoreEnvVar(key, previousValue) {
  if (previousValue == null) {
    delete process.env[key];
    return;
  }
  process.env[key] = previousValue;
}

test('control plane registry persists servers, links, agents, sessions, and sync events', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-'));

  try {
    const repository = freshRepository(tempDir);
    const serverResult = repository.upsertServer({
      tenantId: 'tenant-a',
      id: 'server-a',
      slug: 'server-a',
      name: 'Server A',
      guildId: 'guild-a',
    });
    assert.equal(serverResult.ok, true);

    const linkResult = repository.upsertServerDiscordLink({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
    });
    assert.equal(linkResult.ok, true);

    const agentResult = repository.upsertAgent({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-exec',
      runtimeKey: 'runtime-exec',
      role: 'execute',
      scope: 'execute_only',
      baseUrl: 'http://127.0.0.1:3211',
      version: '1.2.3',
    });
    assert.equal(agentResult.ok, true);

    const bindingResult = repository.upsertAgentTokenBinding({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-exec',
      apiKeyId: 'apikey-1',
      role: 'execute',
      scope: 'execute_only',
    });
    assert.equal(bindingResult.ok, true);

    const sessionResult = repository.recordAgentSession({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-exec',
      runtimeKey: 'runtime-exec',
      role: 'execute',
      scope: 'execute_only',
      sessionId: 'session-1',
      heartbeatAt: '2026-03-25T00:00:00.000Z',
      baseUrl: 'http://127.0.0.1:3211',
    });
    assert.equal(sessionResult.ok, true);

    const syncResult = repository.recordSyncPayload({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-sync',
      runtimeKey: 'runtime-sync',
      role: 'sync',
      scope: 'sync_only',
      syncRunId: 'sync-1',
      events: [{ type: 'join', playerName: 'Tester' }],
    });
    assert.equal(syncResult.ok, true);
    assert.equal(syncResult.syncEvents.length, 1);

    const mapped = repository.resolveServerByGuild({
      tenantId: 'tenant-a',
      guildId: 'guild-a',
    });
    assert.equal(mapped.server.id, 'server-a');
    assert.equal(repository.listAgents({ tenantId: 'tenant-a', serverId: 'server-a' }).length, 1);
    assert.equal(repository.listAgentSessions({ tenantId: 'tenant-a', serverId: 'server-a' }).length, 1);
    assert.equal(repository.listSyncRuns({ tenantId: 'tenant-a', serverId: 'server-a' }).length, 1);
    assert.equal(repository.listSyncEvents({ tenantId: 'tenant-a', serverId: 'server-a' }).length, 1);
  } finally {
    restoreEnvVar('BOT_DATA_DIR', previousDir);
    delete process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry rejects legacy hybrid runtime boundaries', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-invalid-'));

  try {
    const repository = freshRepository(tempDir);
    const result = repository.upsertAgent({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-legacy',
      runtimeKey: 'legacy-runtime',
      role: 'hybrid',
      scope: 'sync_execute',
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, 'strict-agent-role-scope-required');
  } finally {
    restoreEnvVar('BOT_DATA_DIR', previousDir);
    delete process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry readiness allows file mode when database persistence is not required', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const previousStoreMode = process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  const previousRequireDb = process.env.PERSIST_REQUIRE_DB;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-ready-'));

  try {
    process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
    process.env.PERSIST_REQUIRE_DB = 'false';
    const repository = freshRepository(tempDir);
    const result = repository.assertControlPlaneRegistryPersistenceReady();
    assert.equal(result.ok, true);
    assert.equal(result.persistenceMode, 'file');
    assert.equal(result.requireDb, false);
  } finally {
    restoreEnvVar('BOT_DATA_DIR', previousDir);
    restoreEnvVar('CONTROL_PLANE_REGISTRY_STORE_MODE', previousStoreMode);
    restoreEnvVar('PERSIST_REQUIRE_DB', previousRequireDb);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry readiness resolves to db mode when database persistence is required', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const previousStoreMode = process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  const previousRequireDb = process.env.PERSIST_REQUIRE_DB;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-ready-db-'));

  try {
    process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
    process.env.PERSIST_REQUIRE_DB = 'true';
    const repository = freshRepository(tempDir);
    const result = repository.assertControlPlaneRegistryPersistenceReady();
    assert.equal(result.ok, true);
    assert.equal(result.persistenceMode, 'db');
    assert.equal(result.requireDb, true);
  } finally {
    restoreEnvVar('BOT_DATA_DIR', previousDir);
    restoreEnvVar('CONTROL_PLANE_REGISTRY_STORE_MODE', previousStoreMode);
    restoreEnvVar('PERSIST_REQUIRE_DB', previousRequireDb);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('control plane registry readiness forbids file import bootstrap when database persistence is required', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const previousStoreMode = process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  const previousRequireDb = process.env.PERSIST_REQUIRE_DB;
  const previousImportOnEmpty = process.env.CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-registry-ready-import-'));

  try {
    process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
    process.env.PERSIST_REQUIRE_DB = 'true';
    process.env.CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY = 'true';
    const repository = freshRepository(tempDir);
    assert.throws(
      () => repository.assertControlPlaneRegistryPersistenceReady(),
      /IMPORT_FILE_ON_EMPTY/i,
    );
  } finally {
    restoreEnvVar('BOT_DATA_DIR', previousDir);
    restoreEnvVar('CONTROL_PLANE_REGISTRY_STORE_MODE', previousStoreMode);
    restoreEnvVar('PERSIST_REQUIRE_DB', previousRequireDb);
    restoreEnvVar('CONTROL_PLANE_REGISTRY_IMPORT_FILE_ON_EMPTY', previousImportOnEmpty);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
