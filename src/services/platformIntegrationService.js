'use strict';

function createPlatformIntegrationService(deps) {
  const {
    crypto,
    prisma,
    scopeGroups,
    trimText,
    asInt,
    normalizeStatus,
    parseJsonOrFallback,
    toIso,
    createId,
    sha256,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    dedupePlatformRows,
    annotatePlatformScopeRow,
    getSharedTenantRegistryRow,
    assertTenantQuotaAvailable,
    emitPlatformEvent,
    getTenantOperationalState,
  } = deps;

  const allowedScopes = new Set(
    Array.isArray(scopeGroups)
      ? scopeGroups.flatMap((group) => (Array.isArray(group?.scopes) ? group.scopes : []))
      : [],
  );

  function generateApiKey() {
    const prefix = `sk_${crypto.randomBytes(6).toString('hex')}`;
    const secret = crypto.randomBytes(24).toString('hex');
    return `${prefix}.${secret}`;
  }

  function maskSecret(value, visible = 6) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= visible) return text;
    return `${text.slice(0, visible)}***`;
  }

  function buildApiKeyScopes(scopes) {
    return Array.from(
      new Set(
        (Array.isArray(scopes) ? scopes : [scopes])
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter((entry) => allowedScopes.has(entry)),
      ),
    );
  }

  function sanitizeApiKeyRow(row) {
    if (!row) return null;
    return {
      ...row,
      scopes: parseJsonOrFallback(row.scopesJson, []),
      keyHash: undefined,
      lastUsedAt: toIso(row.lastUsedAt),
      revokedAt: toIso(row.revokedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  function sanitizeWebhookRow(row, options = {}) {
    if (!row) return null;
    const includeSecret = options.includeSecret === true;
    return {
      ...row,
      secretValue: includeSecret ? row.secretValue : maskSecret(row.secretValue),
      lastSuccessAt: toIso(row.lastSuccessAt),
      lastFailureAt: toIso(row.lastFailureAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  async function countActiveTenantApiKeys(tenantId) {
    const id = trimText(tenantId, 120);
    if (!id) return 0;
    const rows = await listPlatformApiKeys({
      tenantId: id,
      limit: 500,
    }).catch(() => []);
    return rows.filter((row) => (
      trimText(row?.tenantId, 120) === id
      && normalizeStatus(row?.status, ['active', 'revoked', 'disabled']) === 'active'
      && !row?.revokedAt
    )).length;
  }

  async function listPlatformApiKeyCandidates(options = {}) {
    const keyPrefix = trimText(options.keyPrefix, 120);
    if (!keyPrefix) return [];
    const take = Math.max(1, Math.min(50, asInt(options.limit, 10, 1)));
    const rows = [];
    const sharedRows = await prisma.platformApiKey.findMany({
      where: { keyPrefix },
      take,
    }).catch(() => []);
    if (Array.isArray(sharedRows)) {
      rows.push(...sharedRows.map((row) => annotatePlatformScopeRow(row, null)));
    }
    const tenantRows = await prisma.platformTenant.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    }).catch(() => []);
    const seenTenantIds = new Set();
    for (const tenant of tenantRows) {
      const tenantId = trimText(tenant?.id, 120);
      if (!tenantId || seenTenantIds.has(tenantId)) continue;
      seenTenantIds.add(tenantId);
      const scopedRows = await runWithOptionalTenantDbIsolation(
        tenantId,
        (db) => db.platformApiKey.findMany({
          where: { keyPrefix },
          take,
        }),
        { cache: false },
      ).catch(() => []);
      if (Array.isArray(scopedRows)) {
        rows.push(...scopedRows.map((row) => annotatePlatformScopeRow(row, tenantId)));
      }
    }
    return dedupePlatformRows(
      rows,
      (row) => [
        trimText(row?.tenantId, 120) || '__shared__',
        trimText(row?.keyPrefix, 120),
        trimText(row?.keyHash, 240),
      ].join(':'),
    );
  }

  async function createPlatformApiKey(input = {}, actor = 'system') {
    const tenantId = trimText(input.tenantId, 120);
    const name = trimText(input.name, 160);
    if (!tenantId || !name) return { ok: false, reason: 'invalid-api-key' };
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'apiKeys', 1);
    if (!quotaCheck.ok) {
      return {
        ok: false,
        reason: quotaCheck.reason || 'tenant-quota-exceeded',
        quotaKey: quotaCheck.quotaKey || 'apiKeys',
        quota: quotaCheck.quota || null,
        snapshot: quotaCheck.snapshot || null,
      };
    }
    const apiKeyLimit = !quotaCheck.quota?.unlimited && Number.isFinite(Number(quotaCheck.quota?.limit))
      ? Math.max(0, Math.trunc(Number(quotaCheck.quota.limit)))
      : null;
    if (apiKeyLimit != null) {
      const visibleActiveCount = await countActiveTenantApiKeys(tenantId).catch(() => 0);
      if (visibleActiveCount + 1 > apiKeyLimit) {
        return {
          ok: false,
          reason: 'tenant-quota-exceeded',
          quotaKey: quotaCheck.quotaKey || 'apiKeys',
          quota: {
            ...quotaCheck.quota,
            used: visibleActiveCount,
            projectedUsed: visibleActiveCount + 1,
          },
          snapshot: quotaCheck.snapshot || null,
        };
      }
    }
    const rawKey = generateApiKey();
    const scopes = buildApiKeyScopes(input.scopes);
    let quotaOverflow = null;
    const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      if (apiKeyLimit != null) {
        const activeCount = await db.platformApiKey.count({
          where: {
            tenantId,
            status: 'active',
            revokedAt: null,
          },
        });
        if (activeCount + 1 > apiKeyLimit) {
          quotaOverflow = {
            used: activeCount,
            projectedUsed: activeCount + 1,
          };
          return null;
        }
      }
      return db.platformApiKey.create({
        data: {
          id: trimText(input.id, 120) || createId('apikey'),
          tenantId,
          name,
          keyPrefix: rawKey.slice(0, 16),
          keyHash: sha256(rawKey),
          scopesJson: JSON.stringify(scopes),
          status: normalizeStatus(input.status, ['active', 'revoked', 'disabled']),
        },
      });
    });
    if (quotaOverflow) {
      return {
        ok: false,
        reason: 'tenant-quota-exceeded',
        quotaKey: quotaCheck.quotaKey || 'apiKeys',
        quota: {
          ...quotaCheck.quota,
          ...quotaOverflow,
        },
        snapshot: quotaCheck.snapshot || null,
      };
    }
    if (!row) return { ok: false, reason: 'tenant-not-found' };
    await emitPlatformEvent('platform.apikey.created', {
      tenantId,
      apiKeyId: row.id,
      actor,
    }, { tenantId });
    return {
      ok: true,
      apiKey: sanitizeApiKeyRow(row),
      rawKey,
    };
  }

  async function listPlatformApiKeys(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform API key listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = normalizeStatus(options.status, ['active', 'revoked', 'disabled']);
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformApiKey.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformApiKey.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map(sanitizeApiKeyRow);
  }

  async function revokePlatformApiKey(apiKeyId, actor = 'system') {
    const id = trimText(apiKeyId, 120);
    if (!id) return { ok: false, reason: 'invalid-api-key-id' };
    const rows = await listPlatformApiKeys({ allowGlobal: true, limit: 1000 });
    const target = rows.find((row) => String(row?.id || '') === id) || null;
    if (!target) return { ok: false, reason: 'platform-apikey-not-found' };
    const row = await runWithOptionalTenantDbIsolation(target.tenantId, (db) => db.platformApiKey.update({
      where: { id },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    })).catch(() => null);
    if (!row) return { ok: false, reason: 'platform-apikey-revoke-failed' };
    await emitPlatformEvent('platform.apikey.revoked', {
      tenantId: target.tenantId,
      apiKeyId: id,
      actor,
    }, { tenantId: target.tenantId });
    return {
      ok: true,
      apiKey: sanitizeApiKeyRow(row),
    };
  }

  async function rotatePlatformApiKey(input = {}, actor = 'system') {
    const apiKeyId = trimText(input.apiKeyId, 120);
    if (!apiKeyId) return { ok: false, reason: 'invalid-api-key-id' };
    const rows = await listPlatformApiKeys({ allowGlobal: true, limit: 1000 });
    const target = rows.find((row) => String(row?.id || '') === apiKeyId) || null;
    if (!target) return { ok: false, reason: 'platform-apikey-not-found' };
    const created = await createPlatformApiKey({
      tenantId: target.tenantId,
      name: trimText(input.name, 160) || target.name,
      scopes: Array.isArray(target.scopes) ? target.scopes : [],
      status: 'active',
    }, actor);
    if (!created.ok) return created;
    await revokePlatformApiKey(apiKeyId, actor).catch(() => null);
    return {
      ok: true,
      apiKey: created.apiKey,
      rawKey: created.rawKey,
      rotatedFrom: apiKeyId,
    };
  }

  async function verifyPlatformApiKey(rawKey, requiredScopes = []) {
    const key = trimText(rawKey, 500);
    if (!key) return { ok: false, reason: 'missing-api-key' };
    const keyPrefix = key.slice(0, 16);
    const rows = await listPlatformApiKeyCandidates({ keyPrefix, limit: 10 });
    const matched = rows.find((row) => sha256(key) === row.keyHash) || null;
    if (!matched || matched.status !== 'active' || matched.revokedAt) {
      return { ok: false, reason: 'invalid-api-key' };
    }
    const scopes = parseJsonOrFallback(matched.scopesJson, []);
    const missingScopes = buildApiKeyScopes(requiredScopes).filter((scope) => !scopes.includes(scope));
    if (missingScopes.length > 0) {
      return { ok: false, reason: 'insufficient-scope', missingScopes };
    }
    await runWithOptionalTenantDbIsolation(
      matched.tenantId,
      (db) => db.platformApiKey.update({
        where: { id: matched.id },
        data: {
          lastUsedAt: new Date(),
        },
      }),
    ).catch(() => null);
    const tenantState = await getTenantOperationalState(matched.tenantId);
    if (!tenantState.ok) {
      return {
        ok: false,
        reason: tenantState.reason,
        tenant: tenantState.tenant || null,
        subscription: tenantState.subscription || null,
        license: tenantState.license || null,
      };
    }
    return {
      ok: true,
      apiKey: sanitizeApiKeyRow({
        ...matched,
        lastUsedAt: new Date(),
      }),
      tenant: tenantState.tenant,
      subscription: tenantState.subscription || null,
      license: tenantState.license || null,
      scopes,
    };
  }

  async function createPlatformWebhookEndpoint(input = {}, actor = 'system') {
    const tenantId = trimText(input.tenantId, 120);
    const name = trimText(input.name, 160);
    const targetUrl = trimText(input.targetUrl, 400);
    const eventType = trimText(input.eventType, 120) || '*';
    if (!tenantId || !name || !targetUrl) {
      return { ok: false, reason: 'invalid-webhook' };
    }
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    try {
      new URL(targetUrl);
    } catch {
      return { ok: false, reason: 'invalid-webhook-url' };
    }
    const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'webhooks', 1);
    if (!quotaCheck.ok) {
      return {
        ok: false,
        reason: quotaCheck.reason || 'tenant-quota-exceeded',
        quotaKey: quotaCheck.quotaKey || 'webhooks',
        quota: quotaCheck.quota || null,
        snapshot: quotaCheck.snapshot || null,
      };
    }
    const secretValue = trimText(input.secretValue, 200) || crypto.randomBytes(18).toString('hex');
    const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      return db.platformWebhookEndpoint.create({
        data: {
          id: trimText(input.id, 120) || createId('hook'),
          tenantId,
          name,
          eventType,
          targetUrl,
          secretValue,
          enabled: input.enabled !== false,
        },
      });
    });
    if (!row) return { ok: false, reason: 'tenant-not-found' };
    await emitPlatformEvent('platform.webhook.created', {
      tenantId,
      webhookId: row.id,
      actor,
    }, { tenantId });
    return {
      ok: true,
      webhook: sanitizeWebhookRow(row, { includeSecret: true }),
    };
  }

  async function listPlatformWebhookEndpoints(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform webhook listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.eventType) where.eventType = trimText(options.eventType, 120);
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformWebhookEndpoint.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformWebhookEndpoint.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map((row) => sanitizeWebhookRow(row));
  }

  return {
    createPlatformApiKey,
    listPlatformApiKeys,
    revokePlatformApiKey,
    rotatePlatformApiKey,
    verifyPlatformApiKey,
    createPlatformWebhookEndpoint,
    listPlatformWebhookEndpoints,
  };
}

module.exports = {
  createPlatformIntegrationService,
};
