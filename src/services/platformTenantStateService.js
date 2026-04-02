'use strict';

function createPlatformTenantStateService(deps) {
  const {
    prisma,
    trimText,
    getPlatformTenantConfig,
    resolveFeatureAccess,
    findPlanById,
    normalizePlanQuotas,
    buildQuotaEntry,
    sanitizeTenantRow,
    sanitizeSubscriptionRow,
    sanitizeLicenseRow,
    isTenantRuntimeStatusAllowed,
    isSubscriptionOperational,
    isLicenseOperational,
    getSharedTenantRegistryRow,
    loadTenantSubscriptionAndLicense,
    safePreviewScopedCount,
    runWithTenantScopePreference,
    shouldUsePreviewScopedFallback,
    isPreviewScopedTransactionAbort,
    isScopedTransactionTimeout,
    isPreviewTenantId,
  } = deps;

  async function getTenantOperationalStateInternal(db, tenantId) {
    const id = trimText(tenantId, 120);
    if (!id) {
      return { ok: false, reason: 'tenant-required', tenant: null, subscription: null, license: null };
    }
    const tenant = await getSharedTenantRegistryRow(id);
    if (!tenant) {
      return { ok: false, reason: 'tenant-not-found', tenant: null, subscription: null, license: null };
    }

    const {
      subscription,
      license,
      missingScopedSchema,
    } = await loadTenantSubscriptionAndLicense(db, id);

    if (!isTenantRuntimeStatusAllowed(tenant.status)) {
      return {
        ok: false,
        reason: 'tenant-access-suspended',
        tenant: sanitizeTenantRow(tenant),
        subscription: sanitizeSubscriptionRow(subscription),
        license: sanitizeLicenseRow(license),
      };
    }
    if (missingScopedSchema) {
      return {
        ok: false,
        reason: 'tenant-preview-provisioning-pending',
        tenant: sanitizeTenantRow(tenant),
        subscription: null,
        license: null,
      };
    }
    if (!isSubscriptionOperational(subscription)) {
      return {
        ok: false,
        reason: 'tenant-subscription-inactive',
        tenant: sanitizeTenantRow(tenant),
        subscription: sanitizeSubscriptionRow(subscription),
        license: sanitizeLicenseRow(license),
      };
    }
    if (!isLicenseOperational(license)) {
      return {
        ok: false,
        reason: 'tenant-license-inactive',
        tenant: sanitizeTenantRow(tenant),
        subscription: sanitizeSubscriptionRow(subscription),
        license: sanitizeLicenseRow(license),
      };
    }

    return {
      ok: true,
      reason: 'ready',
      tenant: sanitizeTenantRow(tenant),
      subscription: sanitizeSubscriptionRow(subscription),
      license: sanitizeLicenseRow(license),
    };
  }

  async function getTenantOperationalState(tenantId, options = {}) {
    const id = trimText(tenantId, 120);
    if (!id) {
      return { ok: false, reason: 'tenant-required', tenant: null, subscription: null, license: null };
    }
    if (options.db) {
      return getTenantOperationalStateInternal(options.db, id);
    }
    return runWithTenantScopePreference(id, (db) => getTenantOperationalStateInternal(db, id), options);
  }

  async function getTenantQuotaSnapshotInternal(db, tenantId) {
    const id = trimText(tenantId, 120);
    const tenantConfig = id ? await getPlatformTenantConfig(id).catch(() => null) : null;
    if (!id) {
      return {
        ok: false,
        reason: 'tenant-required',
        tenantId: null,
        plan: null,
        subscription: null,
        license: null,
        package: null,
        features: [],
        enabledFeatureKeys: [],
        featureOverrides: { enabled: [], disabled: [] },
        quotas: {},
      };
    }

    const tenantState = await getTenantOperationalStateInternal(db, id);
    const activeState = tenantState.ok
      ? tenantState
      : await (async () => {
        const tenant = await getSharedTenantRegistryRow(id);
        if (!tenant) return tenantState;
        const { subscription, license } = await loadTenantSubscriptionAndLicense(db, id);
        return {
          ok: false,
          reason: tenantState.reason || 'tenant-not-ready',
          tenant: sanitizeTenantRow(tenant),
          subscription: sanitizeSubscriptionRow(subscription),
          license: sanitizeLicenseRow(license),
        };
      })();

    if (!activeState.tenant) {
      const featureAccess = resolveFeatureAccess({
        planId: activeState.subscription?.planId || null,
        featureFlags: tenantConfig?.featureFlags || null,
        metadata: activeState.subscription?.metadata || null,
      });
      return {
        ok: false,
        reason: activeState.reason || 'tenant-not-found',
        tenantId: id,
        tenant: null,
        plan: null,
        subscription: null,
        license: null,
        package: featureAccess.package,
        features: featureAccess.catalog,
        enabledFeatureKeys: featureAccess.enabledFeatureKeys,
        featureOverrides: featureAccess.overrides,
        quotas: {},
      };
    }

    const plan = findPlanById(activeState.subscription?.planId);
    const featureAccess = resolveFeatureAccess({
      planId: activeState.subscription?.planId || null,
      featureFlags: tenantConfig?.featureFlags || null,
      metadata: activeState.subscription?.metadata || null,
    });
    const quotas = normalizePlanQuotas(plan?.quotas);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      apiKeysUsed,
      webhooksUsed,
      agentRuntimesUsed,
      marketplaceOffersUsed,
      purchases30dUsed,
    ] = await Promise.all([
      safePreviewScopedCount(db, 'platformApiKey', {
        where: {
          tenantId: id,
          status: 'active',
          revokedAt: null,
        },
      }, id),
      safePreviewScopedCount(db, 'platformWebhookEndpoint', {
        where: {
          tenantId: id,
          enabled: true,
        },
      }, id),
      safePreviewScopedCount(db, 'platformAgentRuntime', {
        where: {
          tenantId: id,
        },
      }, id),
      safePreviewScopedCount(db, 'platformMarketplaceOffer', {
        where: {
          tenantId: id,
          status: {
            not: 'archived',
          },
        },
      }, id),
      safePreviewScopedCount(db, 'purchase', {
        where: {
          tenantId: id,
          createdAt: {
            gte: since30d,
          },
        },
      }, id),
    ]);

    return {
      ok: true,
      reason: activeState.ok ? 'ready' : activeState.reason || 'tenant-not-ready',
      tenantId: id,
      tenant: activeState.tenant,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        billingCycle: plan.billingCycle,
        quotas: plan.quotas,
      } : null,
      subscription: activeState.subscription || null,
      license: activeState.license || null,
      package: featureAccess.package,
      features: featureAccess.catalog,
      enabledFeatureKeys: featureAccess.enabledFeatureKeys,
      featureOverrides: featureAccess.overrides,
      quotas: {
        apiKeys: buildQuotaEntry(quotas.apiKeys, apiKeysUsed),
        webhooks: buildQuotaEntry(quotas.webhooks, webhooksUsed),
        agentRuntimes: buildQuotaEntry(quotas.agentRuntimes, agentRuntimesUsed),
        marketplaceOffers: buildQuotaEntry(quotas.marketplaceOffers, marketplaceOffersUsed),
        purchases30d: buildQuotaEntry(quotas.purchases30d, purchases30dUsed),
      },
    };
  }

  async function getTenantQuotaSnapshot(tenantId, options = {}) {
    const id = trimText(tenantId, 120);
    const tenantConfig = id ? await getPlatformTenantConfig(id).catch(() => null) : null;
    if (!id) {
      return {
        ok: false,
        reason: 'tenant-required',
        tenantId: null,
        plan: null,
        subscription: null,
        license: null,
        package: null,
        features: [],
        enabledFeatureKeys: [],
        featureOverrides: { enabled: [], disabled: [] },
        quotas: {},
      };
    }
    if (options.db) {
      return getTenantQuotaSnapshotInternal(options.db, id);
    }
    try {
      return await runWithTenantScopePreference(id, (db) => getTenantQuotaSnapshotInternal(db, id), options);
    } catch (error) {
      if (
        !shouldUsePreviewScopedFallback(error, id)
        && !isPreviewScopedTransactionAbort(error, id)
        && !isScopedTransactionTimeout(error)
      ) {
        throw error;
      }

      if (isScopedTransactionTimeout(error) && !isPreviewTenantId(id)) {
        return getTenantQuotaSnapshotInternal(prisma, id);
      }

      let tenant = null;
      let subscription = null;
      let license = null;
      try {
        tenant = await getSharedTenantRegistryRow(id);
        ({ subscription, license } = await loadTenantSubscriptionAndLicense(prisma, id));
      } catch {
        tenant = tenant || null;
      }

      const featureAccess = resolveFeatureAccess({
        planId: subscription?.planId || null,
        featureFlags: tenantConfig?.featureFlags || null,
        metadata: subscription?.metadata || null,
      });
      const plan = findPlanById(subscription?.planId);

      return {
        ok: false,
        reason: 'tenant-preview-provisioning-pending',
        tenantId: id,
        tenant: sanitizeTenantRow(tenant),
        plan: plan ? {
          id: plan.id,
          name: plan.name,
          billingCycle: plan.billingCycle,
          quotas: plan.quotas,
        } : null,
        subscription: sanitizeSubscriptionRow(subscription),
        license: sanitizeLicenseRow(license),
        package: featureAccess.package,
        features: featureAccess.catalog,
        enabledFeatureKeys: featureAccess.enabledFeatureKeys,
        featureOverrides: featureAccess.overrides,
        quotas: {},
      };
    }
  }

  async function assertTenantQuotaAvailable(tenantId, quotaKey, nextUsageIncrement = 1) {
    const normalizedQuotaKey = trimText(quotaKey, 80);
    const increment = Math.max(1, Number.isFinite(Number(nextUsageIncrement))
      ? Math.max(1, Math.trunc(Number(nextUsageIncrement)))
      : 1);
    const snapshot = await getTenantQuotaSnapshot(tenantId);
    if (!snapshot.ok && !snapshot.tenant) {
      return {
        ok: false,
        reason: snapshot.reason || 'tenant-required',
        quotaKey: normalizedQuotaKey || null,
        snapshot,
      };
    }
    const entry = snapshot.quotas?.[normalizedQuotaKey];
    if (!entry) {
      return {
        ok: false,
        reason: 'unknown-quota-key',
        quotaKey: normalizedQuotaKey || null,
        snapshot,
      };
    }
    if (entry.unlimited) {
      return {
        ok: true,
        quotaKey: normalizedQuotaKey,
        quota: {
          ...entry,
          projectedUsed: entry.used + increment,
        },
        snapshot,
      };
    }
    if (entry.used + increment > entry.limit) {
      return {
        ok: false,
        reason: 'tenant-quota-exceeded',
        quotaKey: normalizedQuotaKey,
        quota: {
          ...entry,
          projectedUsed: entry.used + increment,
        },
        snapshot,
      };
    }
    return {
      ok: true,
      quotaKey: normalizedQuotaKey,
      quota: {
        ...entry,
        projectedUsed: entry.used + increment,
      },
      snapshot,
    };
  }

  return {
    getTenantOperationalState,
    getTenantQuotaSnapshot,
    assertTenantQuotaAvailable,
  };
}

module.exports = {
  createPlatformTenantStateService,
};
