const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEmptyRegistry,
  upsertAgent,
  upsertAgentTokenBinding,
  writeRegistry,
} = require('../src/data/repositories/controlPlaneRegistryRepository');
const { createSyncIngestionService } = require('../src/domain/sync/syncIngestionService');

test('sync ingestion can fall back to binding and agent scope when server registry row is absent', async () => {
  writeRegistry(buildEmptyRegistry());

  try {
    upsertAgentTokenBinding({
      id: 'binding-sync-fallback',
      apiKeyId: 'binding-sync-fallback',
      tenantId: 'tenant-sync-fallback',
      serverId: 'server-sync-fallback',
      guildId: 'guild-sync-fallback',
      agentId: 'agent-sync-fallback',
      role: 'sync',
      scope: 'sync_only',
      status: 'active',
    }, 'test');

    upsertAgent({
      tenantId: 'tenant-sync-fallback',
      serverId: 'server-sync-fallback',
      guildId: 'guild-sync-fallback',
      agentId: 'agent-sync-fallback',
      runtimeKey: 'sync-fallback-runtime',
      role: 'sync',
      scope: 'sync_only',
      status: 'active',
    }, 'test');

    const emitted = [];
    const service = createSyncIngestionService({
      emitPlatformEvent: async (name, payload, options) => {
        emitted.push({ name, payload, options });
      },
    });

    const result = await service.ingestPayload({
      tenantId: 'tenant-sync-fallback',
      agentId: 'agent-sync-fallback',
      runtimeKey: 'sync-fallback-runtime',
      syncRunId: 'sync-run-fallback',
      events: [{ type: 'join', playerName: 'Tester' }],
    }, {
      tenantId: 'tenant-sync-fallback',
      apiKeyId: 'binding-sync-fallback',
    }, 'test');

    assert.equal(result.ok, true);
    assert.equal(result.server.id, 'server-sync-fallback');
    assert.equal(result.server.guildId, 'guild-sync-fallback');
    assert.equal(result.syncRun.serverId, 'server-sync-fallback');
    assert.equal(result.syncEvents.length, 1);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].name, 'platform.sync.ingested');
    assert.equal(emitted[0].payload.serverId, 'server-sync-fallback');
  } finally {
    writeRegistry(buildEmptyRegistry());
  }
});
