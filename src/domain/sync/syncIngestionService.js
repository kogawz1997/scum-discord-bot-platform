'use strict';

const {
  listAgents,
  listAgentTokenBindings,
  listServers,
  recordSyncPayload,
  resolveServerByGuild,
} = require('../../data/repositories/controlPlaneRegistryRepository');
const { normalizeAgentSyncPayload, trimText } = require('../../contracts/agent/agentContracts');

function createSyncIngestionService(deps = {}) {
  const {
    emitPlatformEvent,
  } = deps;

  async function ingestPayload(input = {}, auth = {}, actor = 'platform-agent') {
    const normalized = normalizeAgentSyncPayload({
      ...input,
      tenantId: input.tenantId || auth.tenantId,
    });
    if (!normalized.tenantId || !normalized.agentId || !normalized.runtimeKey) {
      return { ok: false, reason: 'invalid-sync-payload' };
    }

    let resolvedServerId = trimText(normalized.serverId, 120);
    let resolvedGuildId = trimText(normalized.guildId, 120);
    if (!resolvedServerId && resolvedGuildId) {
      const mapped = resolveServerByGuild({
        tenantId: normalized.tenantId,
        guildId: resolvedGuildId,
      });
      if (mapped?.server?.id) {
        resolvedServerId = mapped.server.id;
      }
    }

    const binding = listAgentTokenBindings({
      apiKeyId: auth.apiKeyId,
      tenantId: normalized.tenantId,
    })[0] || null;
    if (!binding) return { ok: false, reason: 'agent-token-binding-not-found' };

    const agent = listAgents({
      tenantId: normalized.tenantId,
      serverId: resolvedServerId || binding.serverId,
      agentId: normalized.agentId || binding.agentId,
    })[0] || null;
    const server = listServers({
      tenantId: normalized.tenantId,
      serverId: resolvedServerId || binding.serverId,
    })[0] || null;
    if (!server) return { ok: false, reason: 'server-not-found' };
    if (!agent) return { ok: false, reason: 'agent-not-registered' };
    if (String(agent.role || '') !== 'sync' || String(agent.scope || '') !== 'sync_only') {
      return { ok: false, reason: 'agent-sync-role-required' };
    }
    const result = recordSyncPayload({
      ...normalized,
      tenantId: normalized.tenantId,
      serverId: server.id,
      guildId: resolvedGuildId || server.guildId || binding.guildId || null,
      role: agent.role,
      scope: agent.scope,
      agentId: agent.agentId,
      runtimeKey: normalized.runtimeKey || agent.runtimeKey,
    }, actor);
    if (!result.ok) return result;
    await emitPlatformEvent?.('platform.sync.ingested', {
      tenantId: normalized.tenantId,
      serverId: server.id,
      guildId: resolvedGuildId || server.guildId || binding.guildId || null,
      agentId: agent.agentId,
      runtimeKey: normalized.runtimeKey || agent.runtimeKey,
      syncRunId: result.syncRun?.id || null,
      eventCount: result.syncRun?.eventCount || 0,
      sourceType: result.syncRun?.sourceType || 'log',
      freshnessAt: result.syncRun?.freshnessAt || null,
    }, { tenantId: normalized.tenantId });
    return {
      ok: true,
      syncRun: result.syncRun,
      syncEvents: result.syncEvents,
      server,
      agent,
    };
  }

  return {
    ingestPayload,
  };
}

module.exports = {
  createSyncIngestionService,
};
