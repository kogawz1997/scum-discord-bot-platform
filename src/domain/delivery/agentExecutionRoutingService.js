'use strict';

const {
  listAgents,
  listAgentSessions,
  listServers,
  resolveServerByGuild,
} = require('../../data/repositories/controlPlaneRegistryRepository');
const { trimText } = require('../../contracts/agent/agentContracts');

function sortSessionsByFreshness(rows = []) {
  return [...rows].sort((left, right) => {
    return new Date(right?.heartbeatAt || right?.updatedAt || 0).getTime()
      - new Date(left?.heartbeatAt || left?.updatedAt || 0).getTime();
  });
}

function createAgentExecutionRoutingService() {
  function resolveServerContext(input = {}) {
    const tenantId = trimText(input.tenantId, 120);
    const serverId = trimText(input.serverId, 120);
    const guildId = trimText(input.guildId, 120);
    if (tenantId && serverId) {
      const server = listServers({ tenantId, serverId })[0] || null;
      return server ? { tenantId, serverId: server.id, guildId: guildId || server.guildId || null, server } : null;
    }
    if (tenantId && guildId) {
      const mapped = resolveServerByGuild({ tenantId, guildId });
      if (mapped?.server) {
        return {
          tenantId,
          serverId: mapped.server.id,
          guildId,
          server: mapped.server,
          link: mapped.link,
        };
      }
    }
    return null;
  }

  function resolveExecuteAgentRoute(input = {}) {
    const tenantId = trimText(input.tenantId, 120);
    if (!tenantId) return { ok: false, reason: 'tenant-required' };
    const serverContext = resolveServerContext(input);
    if (!serverContext) {
      return {
        ok: false,
        reason: 'server-routing-not-found',
      };
    }
    const agents = listAgents({
      tenantId,
      serverId: serverContext.serverId,
    }).filter((row) => String(row?.role || '') === 'execute' && String(row?.scope || '') === 'execute_only');
    if (agents.length === 0) {
      return {
        ok: false,
        reason: 'execute-agent-not-found',
        context: serverContext,
      };
    }
    const enriched = agents.map((agent) => {
      const sessions = sortSessionsByFreshness(listAgentSessions({
        tenantId,
        serverId: serverContext.serverId,
        agentId: agent.agentId,
      }));
      const latestSession = sessions[0] || null;
      const baseUrl = trimText(
        latestSession?.baseUrl
          || agent.baseUrl
          || agent.metadata?.baseUrl
          || agent.meta?.baseUrl,
        400,
      ) || null;
      return {
        ...agent,
        latestSession,
        baseUrl,
      };
    });
    const onlineCandidates = enriched.filter((row) => row.baseUrl && String(row.status || '').toLowerCase() !== 'revoked');
    const chosen = sortSessionsByFreshness(onlineCandidates.map((row) => ({
      ...row,
      heartbeatAt: row.latestSession?.heartbeatAt || row.lastSeenAt || row.updatedAt || null,
    })))[0] || null;
    if (!chosen) {
      return {
        ok: false,
        reason: 'execute-agent-endpoint-missing',
        context: serverContext,
        candidates: enriched,
      };
    }
    return {
      ok: true,
      route: {
        tenantId,
        serverId: serverContext.serverId,
        guildId: serverContext.guildId || null,
        agentId: chosen.agentId,
        runtimeKey: chosen.runtimeKey,
        role: chosen.role,
        scope: chosen.scope,
        baseUrl: chosen.baseUrl.replace(/\/+$/, ''),
        version: chosen.version || chosen.latestSession?.version || null,
        minimumVersion: chosen.minimumVersion || null,
      },
      context: serverContext,
      candidates: enriched,
    };
  }

  return {
    resolveExecuteAgentRoute,
    resolveServerContext,
  };
}

module.exports = {
  createAgentExecutionRoutingService,
};
