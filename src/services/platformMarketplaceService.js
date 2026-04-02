'use strict';

function createPlatformMarketplaceService(deps) {
  const {
    trimText,
    asInt,
    normalizeStatus,
    normalizeCurrency,
    normalizeLocale,
    stringifyMeta,
    toIso,
    createId,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow,
    assertTenantQuotaAvailable,
    emitPlatformEvent,
  } = deps;

  function sanitizeMarketplaceRow(row) {
    if (!row) return null;
    return {
      ...row,
      meta: safeMeta(row),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  function safeMeta(row) {
    try {
      return row?.metaJson ? JSON.parse(row.metaJson) : {};
    } catch {
      return {};
    }
  }

  async function createMarketplaceOffer(input = {}, actor = 'system') {
    const tenantId = trimText(input.tenantId, 120);
    const title = trimText(input.title, 180);
    if (!tenantId || !title) return { ok: false, reason: 'invalid-marketplace-offer' };
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    const quotaCheck = await assertTenantQuotaAvailable(tenantId, 'marketplaceOffers', 1);
    if (!quotaCheck.ok) {
      return {
        ok: false,
        reason: quotaCheck.reason || 'tenant-quota-exceeded',
        quotaKey: quotaCheck.quotaKey || 'marketplaceOffers',
        quota: quotaCheck.quota || null,
        snapshot: quotaCheck.snapshot || null,
      };
    }
    const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      return db.platformMarketplaceOffer.create({
        data: {
          id: trimText(input.id, 120) || createId('offer'),
          tenantId,
          title,
          kind: trimText(input.kind, 80) || 'service',
          priceCents: asInt(input.priceCents, 0, 0),
          currency: normalizeCurrency(input.currency),
          status: normalizeStatus(input.status, ['active', 'draft', 'archived']),
          locale: normalizeLocale(input.locale),
          metaJson: stringifyMeta(input.meta),
        },
      });
    });
    if (!row) return { ok: false, reason: 'tenant-not-found' };
    await emitPlatformEvent('platform.marketplace.offer.created', {
      tenantId,
      offerId: row.id,
      actor,
    }, { tenantId });
    return { ok: true, offer: sanitizeMarketplaceRow(row) };
  }

  async function listMarketplaceOffers(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform marketplace listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = normalizeStatus(options.status, ['active', 'draft', 'archived']);
    if (options.locale) where.locale = normalizeLocale(options.locale);
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformMarketplaceOffer.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          { buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']) },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformMarketplaceOffer.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map(sanitizeMarketplaceRow);
  }

  return {
    createMarketplaceOffer,
    listMarketplaceOffers,
  };
}

module.exports = {
  createPlatformMarketplaceService,
};
