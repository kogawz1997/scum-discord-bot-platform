'use strict';

function createPlatformAgentRuntimeService(deps) {
  const {
    config,
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    stringifyMeta,
    createId,
    compareVersions,
    sanitizeAgentRow,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow,
    assertTenantQuotaAvailable,
    mergeAgentRuntimeProfile,
    normalizeAgentRuntimeProfile,
    publishAdminLiveUpdate,
    emitPlatformEvent,
  } = deps;

  async function recordPlatformAgentHeartbeat(input = {}, actor = 'platform-api') {
    const tenantId = trimText(input.tenantId, 120);
    const runtimeKey = trimText(input.runtimeKey, 160);
    const version = trimText(input.version, 80);
    if (!tenantId || !runtimeKey || !version) {
      return { ok: false, reason: 'invalid-agent-heartbeat' };
    }
    const tenantExists = await getSharedTenantRegistryRow(tenantId);
    if (!tenantExists) return { ok: false, reason: 'tenant-not-found' };
    const existingRuntime = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.findUnique({
      where: {
        tenantId_runtimeKey: {
          tenantId,
          runtimeKey,
        },
      },
    }));
    if (!existingRuntime) {
      const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'agentRuntimes', 1);
      if (!quotaCheck.ok) {
        return {
          ok: false,
          reason: quotaCheck.reason || 'tenant-quota-exceeded',
          quotaKey: quotaCheck.quotaKey || 'agentRuntimes',
          quota: quotaCheck.quota || null,
          snapshot: quotaCheck.snapshot || null,
        };
      }
    }
    const minimumVersion = trimText(
      input.minRequiredVersion || config.platform?.agent?.minimumVersion || '1.0.0',
      80,
    ) || '1.0.0';
    const status =
      compareVersions(version, minimumVersion) < 0
        ? 'outdated'
        : normalizeStatus(input.status, ['online', 'degraded', 'outdated', 'offline']);
    const channel = trimText(input.channel, 80) || null;
    const inputMeta =
      input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
        ? input.meta
        : typeof input.meta === 'string'
          ? parseJsonOrFallback(input.meta, null)
          : null;
    const runtimeProfile = normalizeAgentRuntimeProfile({
      runtimeKey,
      channel,
      meta: inputMeta,
    });
    const storedMeta = inputMeta ? mergeAgentRuntimeProfile(inputMeta, runtimeProfile) : null;
    const metaJson = storedMeta ? stringifyMeta(storedMeta) : stringifyMeta(input.meta);
    const row = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.upsert({
      where: {
        tenantId_runtimeKey: {
          tenantId,
          runtimeKey,
        },
      },
      update: {
        channel,
        version,
        minRequiredVersion: minimumVersion,
        status,
        lastSeenAt: new Date(),
        metaJson,
      },
      create: {
        id: createId('agent'),
        tenantId,
        runtimeKey,
        channel,
        version,
        minRequiredVersion: minimumVersion,
        status,
        lastSeenAt: new Date(),
        metaJson,
      },
    }));
    if (status === 'outdated') {
      publishAdminLiveUpdate('ops-alert', {
        source: 'platform-agent',
        kind: 'agent-version-outdated',
        tenantId,
        runtimeKey,
        version,
        minimumVersion,
      });
    }
    await emitPlatformEvent('platform.agent.heartbeat', {
      tenantId,
      runtimeKey,
      version,
      status,
      actor,
    }, { tenantId });
    return { ok: true, runtime: sanitizeAgentRow(row) };
  }

  async function listPlatformAgentRuntimes(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform agent runtime listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = normalizeStatus(options.status, ['online', 'degraded', 'outdated', 'offline']);
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformAgentRuntime.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformAgentRuntime.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map(sanitizeAgentRow);
  }

  return {
    recordPlatformAgentHeartbeat,
    listPlatformAgentRuntimes,
  };
}

module.exports = {
  createPlatformAgentRuntimeService,
};
