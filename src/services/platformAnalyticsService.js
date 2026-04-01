'use strict';

function createPlatformAnalyticsService(deps) {
  const {
    config,
    prisma,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    readAcrossPlatformTenantScopesBatch,
    readAcrossDeliveryPersistenceScopeBatch,
    dedupePlatformRows,
    buildPlatformRowScopeKey,
    dedupeDeliveryScopeRows,
    getTenantQuotaSnapshot,
    nowIso,
    trimText,
    asInt,
    normalizeShopKind,
    getPlanCatalog,
    getFeatureCatalogSummary,
    getPackageCatalogSummary,
    listPersistedPackageCatalog,
    listMarketplaceOffers,
  } = deps;

  async function getPlatformAnalyticsOverview(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform analytics overview',
    });
    const tenantTopologyMode = getTenantDatabaseTopologyMode();
    const aggregateTenantCommerce = !tenantId && tenantTopologyMode !== 'shared';
    const tenantWhere = tenantId ? { tenantId } : {};
    const purchaseWhere = {
      ...(tenantId ? { tenantId } : {}),
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    };
    const analyticsRows = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      const [
        tenantRows,
        subscriptionRows,
        licenseRows,
        apiKeyRows,
        webhookRows,
        agentRows,
        offerRows,
        purchaseCount30d,
        deliveredCount,
        failedCount,
        queueJobsCount,
        deadLettersCount,
        auditRowsCount,
        quota,
      ] = await Promise.all([
        prisma.platformTenant.findMany(tenantId ? { where: { id: tenantId } } : {}),
        db.platformSubscription.findMany({ where: tenantWhere }),
        db.platformLicense.findMany({ where: tenantWhere }),
        db.platformApiKey.findMany({ where: tenantWhere }),
        db.platformWebhookEndpoint.findMany({ where: tenantWhere }),
        db.platformAgentRuntime.findMany({ where: tenantWhere }),
        db.platformMarketplaceOffer.findMany({ where: tenantWhere }),
        aggregateTenantCommerce
          ? Promise.resolve(null)
          : db.purchase.count({ where: purchaseWhere }),
        aggregateTenantCommerce
          ? Promise.resolve(null)
          : db.purchase.count({
            where: {
              ...purchaseWhere,
              status: 'delivered',
            },
          }),
        aggregateTenantCommerce
          ? Promise.resolve(null)
          : db.purchase.count({
            where: {
              ...purchaseWhere,
              status: 'delivery_failed',
            },
          }),
        aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryQueueJob.count({ where: tenantWhere }),
        aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryDeadLetter.count({ where: tenantWhere }),
        aggregateTenantCommerce ? Promise.resolve(null) : db.deliveryAudit.count({ where: tenantWhere }),
        tenantId ? getTenantQuotaSnapshot(tenantId, { db }).catch(() => null) : Promise.resolve(null),
      ]);
      return {
        tenantRows,
        subscriptionRows,
        licenseRows,
        apiKeyRows,
        webhookRows,
        agentRows,
        offerRows,
        purchaseCount30d,
        deliveredCount,
        failedCount,
        queueJobsCount,
        deadLettersCount,
        auditRowsCount,
        quota,
      };
    });
    const {
      tenantRows,
      subscriptionRows,
      licenseRows,
      apiKeyRows,
      webhookRows,
      agentRows,
      offerRows,
      purchaseCount30d,
      deliveredCount,
      failedCount,
      queueJobsCount,
      deadLettersCount,
      auditRowsCount,
      quota,
    } = analyticsRows;

    const [
      aggregatedSubscriptionRows,
      aggregatedLicenseRows,
      aggregatedApiKeyRows,
      aggregatedWebhookRows,
      aggregatedAgentRows,
      aggregatedOfferRows,
    ] = aggregateTenantCommerce
      ? await (async () => {
        const rows = await readAcrossPlatformTenantScopesBatch({
          subscriptionRows: (db) => db.platformSubscription.findMany({ where: tenantWhere }),
          licenseRows: (db) => db.platformLicense.findMany({ where: tenantWhere }),
          apiKeyRows: (db) => db.platformApiKey.findMany({ where: tenantWhere }),
          webhookRows: (db) => db.platformWebhookEndpoint.findMany({ where: tenantWhere }),
          agentRows: (db) => db.platformAgentRuntime.findMany({ where: tenantWhere }),
          offerRows: (db) => db.platformMarketplaceOffer.findMany({ where: tenantWhere }),
        });
        return [
          dedupePlatformRows(rows.subscriptionRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
          dedupePlatformRows(rows.licenseRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
          dedupePlatformRows(rows.apiKeyRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
          dedupePlatformRows(rows.webhookRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
          dedupePlatformRows(rows.agentRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
          dedupePlatformRows(rows.offerRows, (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId'])),
        ];
      })()
      : [
        subscriptionRows,
        licenseRows,
        apiKeyRows,
        webhookRows,
        agentRows,
        offerRows,
      ];

    const [
      purchaseRows30d,
      deliveredRows30d,
      failedRows30d,
      queueJobs,
      deadLetters,
      auditRows,
    ] = aggregateTenantCommerce
      ? await (async () => {
        const rows = await readAcrossDeliveryPersistenceScopeBatch({
          purchaseRows30d: (db) => db.purchase.findMany({
            where: purchaseWhere,
            select: { code: true, tenantId: true },
          }),
          deliveredRows30d: (db) => db.purchase.findMany({
            where: {
              ...purchaseWhere,
              status: 'delivered',
            },
            select: { code: true, tenantId: true },
          }),
          failedRows30d: (db) => db.purchase.findMany({
            where: {
              ...purchaseWhere,
              status: 'delivery_failed',
            },
            select: { code: true, tenantId: true },
          }),
          queueJobs: (db) => db.deliveryQueueJob.findMany({
            select: { purchaseCode: true, tenantId: true },
          }),
          deadLetters: (db) => db.deliveryDeadLetter.findMany({
            select: { purchaseCode: true, tenantId: true },
          }),
          auditRows: (db) => db.deliveryAudit.findMany({
            select: { id: true, tenantId: true },
          }),
        });
        return [
          rows.purchaseRows30d,
          rows.deliveredRows30d,
          rows.failedRows30d,
          rows.queueJobs,
          rows.deadLetters,
          rows.auditRows,
        ];
      })()
      : [null, null, null, null, null, null];

    const dedupedPurchaseRows30d = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(purchaseRows30d, ['code'])
      : null;
    const dedupedDeliveredRows30d = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(deliveredRows30d, ['code'])
      : null;
    const dedupedFailedRows30d = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(failedRows30d, ['code'])
      : null;
    const dedupedQueueJobs = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(queueJobs, ['purchaseCode'])
      : null;
    const dedupedDeadLetters = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(deadLetters, ['purchaseCode'])
      : null;
    const dedupedAuditRows = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(auditRows, ['id'])
      : null;

    const resolvedPurchaseCount30d = aggregateTenantCommerce ? dedupedPurchaseRows30d.length : purchaseCount30d;
    const resolvedDeliveredCount = aggregateTenantCommerce ? dedupedDeliveredRows30d.length : deliveredCount;
    const resolvedFailedCount = aggregateTenantCommerce ? dedupedFailedRows30d.length : failedCount;
    const resolvedQueueJobsCount = aggregateTenantCommerce ? dedupedQueueJobs.length : queueJobsCount;
    const resolvedDeadLettersCount = aggregateTenantCommerce ? dedupedDeadLetters.length : deadLettersCount;
    const resolvedAuditRowsCount = aggregateTenantCommerce ? dedupedAuditRows.length : auditRowsCount;

    const effectiveSubscriptionRows = aggregatedSubscriptionRows;
    const effectiveLicenseRows = aggregatedLicenseRows;
    const effectiveApiKeyRows = aggregatedApiKeyRows;
    const effectiveWebhookRows = aggregatedWebhookRows;
    const effectiveAgentRows = aggregatedAgentRows;
    const effectiveOfferRows = aggregatedOfferRows;

    const mrrCents = effectiveSubscriptionRows
      .filter((row) => row.status === 'active' || row.status === 'trialing')
      .reduce((sum, row) => {
        if (row.billingCycle === 'yearly') return sum + Math.round(row.amountCents / 12);
        if (row.billingCycle === 'quarterly') return sum + Math.round(row.amountCents / 3);
        if (row.billingCycle === 'one-time' || row.billingCycle === 'trial') return sum;
        return sum + row.amountCents;
      }, 0);

    const successRate = resolvedPurchaseCount30d > 0
      ? Number((resolvedDeliveredCount / resolvedPurchaseCount30d).toFixed(4))
      : 0;

    return {
      generatedAt: nowIso(),
      scope: tenantId
        ? {
          tenantId,
          mode: 'tenant-isolated',
          deliveryMetricsScoped: true,
        }
        : {
          tenantId: null,
          mode: 'global',
          deliveryMetricsScoped: true,
        },
      tenants: {
        total: tenantRows.length,
        active: tenantRows.filter((row) => row.status === 'active').length,
        trialing: tenantRows.filter((row) => row.type === 'trial' || row.status === 'trialing').length,
        reseller: tenantRows.filter((row) => row.type === 'reseller').length,
      },
      subscriptions: {
        total: effectiveSubscriptionRows.length,
        active: effectiveSubscriptionRows.filter((row) => row.status === 'active').length,
        mrrCents,
      },
      licenses: {
        total: effectiveLicenseRows.length,
        active: effectiveLicenseRows.filter((row) => row.status === 'active').length,
        acceptedLegal: effectiveLicenseRows.filter((row) => row.legalAcceptedAt).length,
      },
      api: {
        apiKeys: effectiveApiKeyRows.filter((row) => row.status === 'active').length,
        webhooks: effectiveWebhookRows.filter((row) => row.enabled).length,
      },
      agent: {
        runtimes: effectiveAgentRows.length,
        outdated: effectiveAgentRows.filter((row) => row.status === 'outdated').length,
      },
      marketplace: {
        offers: effectiveOfferRows.filter((row) => row.status === 'active').length,
        draftOffers: effectiveOfferRows.filter((row) => row.status === 'draft').length,
      },
      delivery: {
        purchaseCount30d: resolvedPurchaseCount30d,
        deliveredCount: resolvedDeliveredCount,
        failedCount: resolvedFailedCount,
        successRate,
        queueJobs: resolvedQueueJobsCount,
        deadLetters: resolvedDeadLettersCount,
        auditEvents: resolvedAuditRowsCount,
        note: tenantId
          ? 'Tenant analytics include only tenant-tagged commerce rows; legacy rows without tenantId stay out of tenant views'
          : (aggregateTenantCommerce ? 'Global analytics aggregate delivery and purchase rows across shared and tenant-scoped commerce topology' : null),
      },
      quota: quota?.ok ? quota : null,
    };
  }

  async function getPlatformPublicOverview() {
    const analytics = await getPlatformAnalyticsOverview({ allowGlobal: true }).catch(() => ({
      overview: {
        activeTenants: 0,
        activeSubscriptions: 0,
        activeLicenses: 0,
        activeApiKeys: 0,
        activeWebhooks: 0,
        onlineAgentRuntimes: 0,
        totalAgentRuntimes: 0,
        totalEvents: 0,
        totalActivity: 0,
        totalTickets: 0,
        totalRevenueCents: 0,
        currency: config.platform?.billing?.currency || 'THB',
      },
      trends: {
        windowDays: 7,
        timeline: [],
      },
      posture: {
        expiringSubscriptions: [],
        expiringLicenses: [],
        recentlyRevokedApiKeys: [],
        failedWebhooks: [],
        unresolvedTickets: [],
        offlineAgentRuntimes: [],
      },
    }));
    const legalDocs = Array.isArray(config.platform?.legal?.docs)
      ? config.platform.legal.docs.map((doc) => {
        const pathValue = trimText(doc.path, 260) || null;
        const fileName = pathValue ? pathValue.split(/[\\/]/).pop() : null;
        return {
          id: trimText(doc.id, 80) || null,
          version: trimText(doc.version, 80) || null,
          title: trimText(doc.title, 180) || fileName || 'Document',
          path: pathValue,
          url: trimText(doc.url, 260) || (fileName ? `/docs/${fileName}` : null),
        };
      })
      : [];
    return {
      generatedAt: nowIso(),
      brand: {
        name: config.serverInfo?.name || 'SCUM Ops Platform',
        description:
          'SCUM platform with delivery runtime, admin control plane, player portal, monitoring, API/webhooks, and tenant-ready operations.',
      },
      localization: config.platform?.localization || {},
      billing: {
        currency: config.platform?.billing?.currency || 'THB',
        plans: getPlanCatalog(),
        packages: await listPersistedPackageCatalog({ status: 'active' }).catch(() => getPackageCatalogSummary({ status: 'active' })),
        features: getFeatureCatalogSummary(),
      },
      trial: config.platform?.demo?.trialEnabled === true ? { enabled: true, cta: '/trial' } : { enabled: false },
      marketplace: {
        enabled: config.platform?.marketplace?.enabled === true,
        offers: await listMarketplaceOffers({ status: 'active', limit: 20, allowGlobal: true }).catch(() => []),
      },
      analytics,
      legal: {
        currentVersion: config.platform?.legal?.currentVersion || null,
        docs: legalDocs,
      },
    };
  }

  return {
    getPlatformAnalyticsOverview,
    getPlatformPublicOverview,
  };
}

module.exports = {
  createPlatformAnalyticsService,
};
