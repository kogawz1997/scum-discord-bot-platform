const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const routingPath = path.resolve(__dirname, '../src/domain/delivery/agentExecutionRoutingService.js');

function freshModules(tempDir) {
  process.env.BOT_DATA_DIR = tempDir;
  for (const entry of [repositoryPath, persistPath, runtimeDataDirPath, routingPath]) {
    delete require.cache[entry];
  }
  return {
    repository: require(repositoryPath),
    routing: require(routingPath),
  };
}

test('agent execution routing resolves the correct execute agent per tenant/server/guild', () => {
  const previousDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-route-'));

  try {
    const { repository, routing } = freshModules(tempDir);
    repository.upsertServer({
      tenantId: 'tenant-a',
      id: 'server-a',
      slug: 'server-a',
      name: 'Server A',
      guildId: 'guild-a',
    });
    repository.upsertServerDiscordLink({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
    });

    repository.upsertAgent({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-sync',
      runtimeKey: 'sync-runtime',
      role: 'sync',
      scope: 'sync_only',
      status: 'active',
      baseUrl: 'http://127.0.0.1:3301',
    });
    repository.upsertAgent({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-exec',
      runtimeKey: 'exec-runtime',
      role: 'execute',
      scope: 'execute_only',
      status: 'active',
      baseUrl: 'http://127.0.0.1:3211',
      version: '2.0.0',
    });
    repository.recordAgentSession({
      tenantId: 'tenant-a',
      serverId: 'server-a',
      guildId: 'guild-a',
      agentId: 'agent-exec',
      runtimeKey: 'exec-runtime',
      role: 'execute',
      scope: 'execute_only',
      sessionId: 'session-exec',
      heartbeatAt: '2026-03-25T10:00:00.000Z',
      baseUrl: 'http://127.0.0.1:3211',
      version: '2.0.0',
    });

    const service = routing.createAgentExecutionRoutingService();
    const serverContext = service.resolveServerContext({
      tenantId: 'tenant-a',
      guildId: 'guild-a',
    });
    assert.equal(serverContext.serverId, 'server-a');

    const routeResult = service.resolveExecuteAgentRoute({
      tenantId: 'tenant-a',
      guildId: 'guild-a',
    });
    assert.equal(routeResult.ok, true);
    assert.equal(routeResult.route.agentId, 'agent-exec');
    assert.equal(routeResult.route.baseUrl, 'http://127.0.0.1:3211');
    assert.equal(routeResult.route.role, 'execute');
  } finally {
    process.env.BOT_DATA_DIR = previousDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
