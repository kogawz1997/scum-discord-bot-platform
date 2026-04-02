'use strict';

function createPlatformDeliveryReconcileService(deps) {
  const {
    config,
    prisma,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    getTenantOperationalState,
    readAcrossDeliveryPersistenceScopes,
    readAcrossDeliveryPersistenceScopeBatch,
    dedupeDeliveryScopeRows,
    nowIso,
    trimText,
    asInt,
    parseDateOrNull,
    normalizeShopKind,
  } = deps;

  function buildAuditByCode(rows) {
    const auditByCode = new Map();
    for (const row of rows) {
      const code = trimText(row.purchaseCode, 120);
      if (!code) continue;
      const list = auditByCode.get(code) || [];
      list.push(row);
      auditByCode.set(code, list);
    }
    return auditByCode;
  }

  function collectPurchaseAnomalies(purchases, queueByCode, deadByCode, auditByCode, itemKinds, pendingOverdueMs) {
    const anomalies = [];
    for (const purchase of purchases) {
      const code = String(purchase.code || '');
      const queue = queueByCode.get(code) || null;
      const dead = deadByCode.get(code) || null;
      const audit = auditByCode.get(code) || [];
      const ageMs = Date.now() - new Date(purchase.createdAt).getTime();
      const itemKind = itemKinds.get(String(purchase.itemId || '')) || 'item';
      const expectsDeliveryRuntime = itemKind !== 'vip';

      if (purchase.status === 'delivered' && queue) {
        anomalies.push({ code, type: 'delivered-still-queued', severity: 'error', detail: 'Purchase is delivered but queue job still exists' });
      }
      if (expectsDeliveryRuntime && purchase.status === 'delivery_failed' && !dead) {
        anomalies.push({ code, type: 'failed-without-dead-letter', severity: 'warn', detail: 'Purchase is marked failed but no dead-letter record exists' });
      }
      if (expectsDeliveryRuntime && (purchase.status === 'pending' || purchase.status === 'delivering') && !queue && !dead && ageMs >= pendingOverdueMs) {
        anomalies.push({ code, type: 'stuck-without-runtime-state', severity: 'error', detail: 'Pending purchase has neither queue nor dead-letter state' });
      }
      if (expectsDeliveryRuntime && purchase.status === 'delivered' && audit.length === 0) {
        anomalies.push({ code, type: 'delivered-without-audit', severity: 'warn', detail: 'Delivered purchase has no delivery audit evidence' });
      }
    }
    return anomalies;
  }

  function collectAbuseFindings(purchases, since, antiAbuse) {
    const recentPurchases = purchases.filter((row) => new Date(row.createdAt) >= since);
    const ordersByUser = new Map();
    const userItemCounts = new Map();
    const failedByUser = new Map();
    for (const row of recentPurchases) {
      const userId = trimText(row.userId, 80) || 'unknown';
      ordersByUser.set(userId, (ordersByUser.get(userId) || 0) + 1);
      const itemKey = `${userId}:${trimText(row.itemId, 120) || 'unknown'}`;
      userItemCounts.set(itemKey, (userItemCounts.get(itemKey) || 0) + 1);
      if (row.status === 'delivery_failed') {
        failedByUser.set(userId, (failedByUser.get(userId) || 0) + 1);
      }
    }

    const abuseFindings = [];
    const maxOrdersPerUser = asInt(antiAbuse.maxOrdersPerUser, 8, 1);
    const maxSameItemPerUser = asInt(antiAbuse.maxSameItemPerUser, 4, 1);
    const failedDeliveriesThreshold = asInt(antiAbuse.failedDeliveriesThreshold, 3, 1);

    for (const [userId, count] of ordersByUser.entries()) {
      if (count > maxOrdersPerUser) {
        abuseFindings.push({ type: 'order-burst', userId, count, threshold: maxOrdersPerUser });
      }
    }
    for (const [key, count] of userItemCounts.entries()) {
      if (count > maxSameItemPerUser) {
        const [userId, itemId] = key.split(':');
        abuseFindings.push({ type: 'same-item-burst', userId, itemId, count, threshold: maxSameItemPerUser });
      }
    }
    for (const [userId, count] of failedByUser.entries()) {
      if (count >= failedDeliveriesThreshold) {
        abuseFindings.push({ type: 'repeated-delivery-failures', userId, count, threshold: failedDeliveriesThreshold });
      }
    }
    return abuseFindings;
  }

  async function reconcileScopedTenantState(scopedTenantId, pendingOverdueMs, since, antiAbuse, windowMs) {
    const scopedRows = await runWithOptionalTenantDbIsolation(scopedTenantId, async (db) => {
      const [tenantState, agentRows, webhookRows, purchases, queueJobs, deadLetters, auditRows] = await Promise.all([
        getTenantOperationalState(scopedTenantId, { db }),
        db.platformAgentRuntime.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        db.platformWebhookEndpoint.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        db.purchase.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        db.deliveryQueueJob.findMany({
          where: { tenantId: scopedTenantId },
        }),
        db.deliveryDeadLetter.findMany({
          where: { tenantId: scopedTenantId },
        }),
        db.deliveryAudit.findMany({
          where: { tenantId: scopedTenantId },
          orderBy: { createdAt: 'desc' },
          take: 2000,
        }),
      ]);
      const purchaseItemIds = [...new Set(
        purchases.map((row) => trimText(row.itemId, 120)).filter(Boolean),
      )];
      const shopItems = purchaseItemIds.length > 0
        ? await db.shopItem.findMany({
          where: {
            id: {
              in: purchaseItemIds,
            },
          },
          select: {
            id: true,
            kind: true,
          },
        })
        : [];
      return { tenantState, agentRows, webhookRows, purchases, queueJobs, deadLetters, auditRows, shopItems };
    });

    const queueByCode = new Map(scopedRows.queueJobs.map((row) => [String(row.purchaseCode), row]));
    const deadByCode = new Map(scopedRows.deadLetters.map((row) => [String(row.purchaseCode), row]));
    const auditByCode = buildAuditByCode(scopedRows.auditRows);
    const itemKinds = new Map(scopedRows.shopItems.map((row) => [String(row.id), normalizeShopKind(row.kind)]));

    const anomalies = [];
    if (!scopedRows.tenantState.ok) {
      anomalies.push({
        code: scopedTenantId,
        type: scopedRows.tenantState.reason,
        severity: 'error',
        detail: 'Tenant operational state is blocking public platform access',
      });
    }
    for (const runtime of scopedRows.agentRows) {
      if (String(runtime.status || '').trim().toLowerCase() === 'outdated') {
        anomalies.push({
          code: runtime.runtimeKey,
          type: 'agent-version-outdated',
          severity: 'warn',
          detail: `Runtime ${runtime.runtimeKey} is below ${runtime.minRequiredVersion || 'minimum version'}`,
        });
      }
      const lastSeenAt = parseDateOrNull(runtime.lastSeenAt);
      if (lastSeenAt && Date.now() - lastSeenAt.getTime() >= (config.platform?.monitoring?.agentStaleMs || 10 * 60 * 1000)) {
        anomalies.push({
          code: runtime.runtimeKey,
          type: 'agent-runtime-stale',
          severity: 'warn',
          detail: `Runtime ${runtime.runtimeKey} heartbeat is stale`,
        });
      }
    }
    for (const webhook of scopedRows.webhookRows) {
      if (webhook.enabled && webhook.lastError) {
        anomalies.push({
          code: webhook.id,
          type: 'webhook-last-error',
          severity: 'warn',
          detail: trimText(webhook.lastError, 240),
        });
      }
    }
    anomalies.push(
      ...collectPurchaseAnomalies(
        scopedRows.purchases,
        queueByCode,
        deadByCode,
        auditByCode,
        itemKinds,
        pendingOverdueMs,
      ),
    );

    const abuseFindings = collectAbuseFindings(scopedRows.purchases, since, antiAbuse);
    return {
      generatedAt: nowIso(),
      scope: {
        tenantId: scopedTenantId,
        mode: 'tenant-isolated',
        includesSharedCommerceTables: true,
      },
      notes: [
        'Tenant reconcile uses tenant-tagged purchase, queue, dead-letter, and audit rows.',
      ],
      summary: {
        purchases: scopedRows.purchases.length,
        queueJobs: scopedRows.queueJobs.length,
        deadLetters: scopedRows.deadLetters.length,
        anomalies: anomalies.length,
        abuseFindings: abuseFindings.length,
        windowMs,
      },
      anomalies,
      abuseFindings,
    };
  }

  async function reconcileGlobalState(aggregateTenantCommerce, tenantTopologyMode, pendingOverdueMs, since, antiAbuse, windowMs) {
    const [purchases, queueJobs, deadLetters, auditRows] = aggregateTenantCommerce
      ? await (async () => {
        const rows = await readAcrossDeliveryPersistenceScopeBatch({
          purchases: (db) => db.purchase.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
          }),
          queueJobs: (db) => db.deliveryQueueJob.findMany(),
          deadLetters: (db) => db.deliveryDeadLetter.findMany(),
          auditRows: (db) => db.deliveryAudit.findMany({
            orderBy: { createdAt: 'desc' },
            take: 2000,
          }),
        });
        return [
          rows.purchases,
          rows.queueJobs,
          rows.deadLetters,
          rows.auditRows,
        ];
      })()
      : await Promise.all([
        prisma.purchase.findMany({
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        prisma.deliveryQueueJob.findMany(),
        prisma.deliveryDeadLetter.findMany(),
        prisma.deliveryAudit.findMany({
          orderBy: { createdAt: 'desc' },
          take: 2000,
        }),
      ]);

    const normalizedPurchases = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(purchases, ['code'])
        .slice()
        .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
        .slice(0, 500)
      : purchases;
    const normalizedAuditRows = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(auditRows, ['id'])
        .slice()
        .sort((left, right) => new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0))
        .slice(0, 2000)
      : auditRows;
    const normalizedQueueJobs = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(queueJobs, ['purchaseCode'])
      : queueJobs;
    const normalizedDeadLetters = aggregateTenantCommerce
      ? dedupeDeliveryScopeRows(deadLetters, ['purchaseCode'])
      : deadLetters;

    const queueByCode = new Map(normalizedQueueJobs.map((row) => [String(row.purchaseCode), row]));
    const deadByCode = new Map(normalizedDeadLetters.map((row) => [String(row.purchaseCode), row]));
    const auditByCode = buildAuditByCode(normalizedAuditRows);
    const purchaseItemIds = [...new Set(
      normalizedPurchases.map((row) => trimText(row.itemId, 120)).filter(Boolean),
    )];
    const itemKinds = new Map();
    if (purchaseItemIds.length > 0) {
      const shopItems = aggregateTenantCommerce
        ? await readAcrossDeliveryPersistenceScopes((db) => db.shopItem.findMany({
          where: {
            id: {
              in: purchaseItemIds,
            },
          },
          select: {
            id: true,
            kind: true,
          },
        }))
        : await prisma.shopItem.findMany({
          where: {
            id: {
              in: purchaseItemIds,
            },
          },
          select: {
            id: true,
            kind: true,
          },
        });
      for (const row of shopItems) {
        itemKinds.set(String(row.id), normalizeShopKind(row.kind));
      }
    }

    const anomalies = collectPurchaseAnomalies(
      normalizedPurchases,
      queueByCode,
      deadByCode,
      auditByCode,
      itemKinds,
      pendingOverdueMs,
    );
    const abuseFindings = collectAbuseFindings(normalizedPurchases, since, antiAbuse);

    return {
      generatedAt: nowIso(),
      scope: {
        tenantId: null,
        mode: 'global',
        topology: aggregateTenantCommerce ? tenantTopologyMode : 'shared',
      },
      notes: [
        aggregateTenantCommerce
          ? 'Global reconcile aggregates purchase, queue, dead-letter, and audit rows across shared and tenant-scoped commerce topology.'
          : 'Global reconcile uses all purchase, queue, dead-letter, and audit rows.',
      ],
      summary: {
        purchases: normalizedPurchases.length,
        queueJobs: normalizedQueueJobs.length,
        deadLetters: normalizedDeadLetters.length,
        anomalies: anomalies.length,
        abuseFindings: abuseFindings.length,
        windowMs,
      },
      anomalies,
      abuseFindings,
    };
  }

  async function reconcileDeliveryState(options = {}) {
    const { tenantId: scopedTenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform delivery reconcile',
    });
    const tenantTopologyMode = getTenantDatabaseTopologyMode();
    const aggregateTenantCommerce = !scopedTenantId && tenantTopologyMode !== 'shared';
    const antiAbuse = config.platform?.antiAbuse || {};
    const windowMs = asInt(options.windowMs, antiAbuse.windowMs || (60 * 60 * 1000), 60 * 1000);
    const pendingOverdueMs = asInt(options.pendingOverdueMs, antiAbuse.pendingOverdueMs || (20 * 60 * 1000), 60 * 1000);
    const since = new Date(Date.now() - windowMs);

    if (scopedTenantId) {
      return reconcileScopedTenantState(scopedTenantId, pendingOverdueMs, since, antiAbuse, windowMs);
    }
    return reconcileGlobalState(aggregateTenantCommerce, tenantTopologyMode, pendingOverdueMs, since, antiAbuse, windowMs);
  }

  return {
    reconcileDeliveryState,
  };
}

module.exports = {
  createPlatformDeliveryReconcileService,
};
