'use strict';

function createPlatformCommercialService(deps) {
  const {
    crypto,
    config,
    prisma,
    trimText,
    asInt,
    normalizeStatus,
    normalizeBillingCycle,
    normalizeCurrency,
    parseDateOrNull,
    stringifyMeta,
    createId,
    findPlanById,
    sanitizeSubscriptionRow,
    sanitizeLicenseRow,
    assertTenantDbIsolationScope,
    getTenantDatabaseTopologyMode,
    runWithOptionalTenantDbIsolation,
    readAcrossPlatformTenantScopes,
    sortRowsByTimestampDesc,
    buildPlatformRowScopeKey,
    getSharedTenantRegistryRow,
    resolvePackageForPlan,
    ensureBillingCustomer,
    createInvoiceDraft,
    recordSubscriptionEvent,
    emitPlatformEvent,
  } = deps;

  function generateLicenseKey() {
    const parts = [
      crypto.randomBytes(2).toString('hex'),
      crypto.randomBytes(2).toString('hex'),
      crypto.randomBytes(2).toString('hex'),
      crypto.randomBytes(2).toString('hex'),
    ];
    return parts.join('-').toUpperCase();
  }

  function normalizeCommercialSubscriptionStatus(value, fallback = 'active') {
    const requested = trimText(value, 40).toLowerCase();
    if (requested === 'trial') return 'trialing';
    if (requested === 'suspended') return 'suspended';
    return normalizeStatus(
      requested || fallback,
      ['active', 'trialing', 'paused', 'past_due', 'suspended', 'canceled', 'expired'],
    );
  }

  async function createSubscription(input = {}, actor = 'system') {
    const tenantId = trimText(input.tenantId, 120);
    if (!tenantId) return { ok: false, reason: 'tenant-required' };
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    const outcome = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      const plan = findPlanById(input.planId);
      const baseMetadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
        ? input.metadata
        : {};
      const resolvedPackage = resolvePackageForPlan(input.planId, baseMetadata);
      const metadata = {
        ...baseMetadata,
        packageId: trimText(input.packageId, 120) || resolvedPackage?.id || baseMetadata.packageId || null,
      };
      const startedAt = parseDateOrNull(input.startedAt) || new Date();
      const cycle = normalizeBillingCycle(input.billingCycle || plan?.billingCycle);
      const intervalDays = asInt(
        input.intervalDays,
        plan?.intervalDays || (cycle === 'yearly' ? 365 : cycle === 'quarterly' ? 90 : cycle === 'trial' ? 14 : 30),
        1,
      );
      const renewsAt = parseDateOrNull(input.renewsAt) || new Date(startedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      metadata.currentPeriodStart = startedAt.toISOString();
      metadata.currentPeriodEnd = renewsAt ? renewsAt.toISOString() : null;
      metadata.trialEndsAt = cycle === 'trial' ? (renewsAt ? renewsAt.toISOString() : null) : null;
      metadata.billingCycle = cycle;
      const row = await db.platformSubscription.create({
        data: {
          id: trimText(input.id, 120) || createId('sub'),
          tenantId,
          planId: trimText(input.planId, 120) || plan?.id || 'custom',
          billingCycle: cycle,
          status: normalizeCommercialSubscriptionStatus(
            input.status,
            cycle === 'trial' ? 'trialing' : 'active',
          ),
          currency: normalizeCurrency(input.currency || config.platform?.billing?.currency),
          amountCents: asInt(input.amountCents, plan?.amountCents || 0, 0),
          startedAt,
          renewsAt,
          canceledAt: parseDateOrNull(input.canceledAt),
          externalRef: trimText(input.externalRef, 180) || null,
          metadataJson: stringifyMeta(metadata),
        },
      });
      return {
        row,
        tenantProfile: {
          ownerEmail: trimText(tenant?.ownerEmail, 200) || null,
          ownerName: trimText(tenant?.ownerName, 200) || null,
        },
      };
    });
    if (!outcome?.row) return { ok: false, reason: 'tenant-not-found' };
    const row = outcome.row;
    let billingCustomer = null;
    let invoice = null;
    const invoiceStatus = String(row.status || '').trim().toLowerCase() === 'active' ? 'open' : 'draft';
    const fallbackInvoice = Number(row.amountCents || 0) > 0
      && String(row.billingCycle || '').trim().toLowerCase() !== 'trial'
      ? {
        id: null,
        tenantId,
        subscriptionId: row.id,
        customerId: null,
        status: invoiceStatus,
        currency: row.currency,
        amountCents: row.amountCents,
        dueAt: row.renewsAt ? new Date(row.renewsAt).toISOString() : null,
        paidAt: null,
        externalRef: null,
        metadata: {
          source: 'create-subscription-fallback',
          actor,
          planId: row.planId,
        },
      }
      : null;
    await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      let rowMetadata = {};
      try {
        rowMetadata = JSON.parse(row.metadataJson || '{}') || {};
      } catch {
        rowMetadata = {};
      }
      billingCustomer = await ensureBillingCustomer({
        tenantId,
        email: outcome.tenantProfile?.ownerEmail || null,
        displayName: outcome.tenantProfile?.ownerName || null,
        metadata: {
          source: 'create-subscription',
          actor,
          subscriptionId: row.id,
        },
      }, db).catch(() => null);
      const normalizedCreatedStatus = String(row.status || '').trim().toLowerCase();
      await recordSubscriptionEvent({
        tenantId,
        subscriptionId: row.id,
        eventType: normalizedCreatedStatus === 'trialing'
          ? 'subscription.trial-created'
          : 'subscription.created',
        billingStatus: row.status,
        actor,
        payload: {
          planId: row.planId,
          billingCycle: row.billingCycle,
          amountCents: row.amountCents,
          currency: row.currency,
          renewsAt: row.renewsAt ? new Date(row.renewsAt).toISOString() : null,
        },
      }, db).catch(() => null);
      const lifecycleEvents = [];
      if (rowMetadata.previewMode === true || String(rowMetadata.source || '').trim() === 'public-preview-signup') {
        lifecycleEvents.push('preview.created');
      }
      if (normalizedCreatedStatus === 'trialing') {
        lifecycleEvents.push('trial.started', 'entitlement.unlocked');
      }
      for (const eventType of lifecycleEvents) {
        await recordSubscriptionEvent({
          tenantId,
          subscriptionId: row.id,
          eventType,
          billingStatus: row.status,
          actor,
          payload: {
            planId: row.planId,
            billingCycle: row.billingCycle,
            packageId: rowMetadata.packageId || null,
            source: rowMetadata.source || null,
          },
        }, db).catch(() => null);
      }
      if (fallbackInvoice) {
        invoice = await createInvoiceDraft({
          tenantId,
          subscriptionId: row.id,
          customerId: billingCustomer?.customer?.id || null,
          status: invoiceStatus,
          currency: row.currency,
          amountCents: row.amountCents,
          dueAt: row.renewsAt || null,
          metadata: {
            source: 'create-subscription',
            actor,
            planId: row.planId,
          },
        }, db).catch(() => null);
      }
    }).catch(() => null);
    await emitPlatformEvent('platform.subscription.created', {
      tenantId,
      subscriptionId: row.id,
      planId: row.planId,
      actor,
    }, { tenantId });
    return {
      ok: true,
      subscription: sanitizeSubscriptionRow(row),
      billing: {
        customer: billingCustomer?.customer || null,
        invoice: invoice?.invoice || (fallbackInvoice
          ? {
            ...fallbackInvoice,
            customerId: billingCustomer?.customer?.id || null,
          }
          : null),
      },
    };
  }

  async function listPlatformSubscriptions(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform subscription listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = normalizeCommercialSubscriptionStatus(options.status, 'active');
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformSubscription.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          {
            allowGlobal: true,
            operation: 'platform subscription global aggregation',
            buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']),
          },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformSubscription.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map(sanitizeSubscriptionRow);
  }

  async function issuePlatformLicense(input = {}, actor = 'system') {
    const tenantId = trimText(input.tenantId, 120);
    if (!tenantId) return { ok: false, reason: 'tenant-required' };
    const tenant = await getSharedTenantRegistryRow(tenantId);
    if (!tenant) return { ok: false, reason: 'tenant-not-found' };
    const legalVersion = trimText(
      input.legalDocVersion || config.platform?.legal?.currentVersion,
      80,
    ) || null;
    const row = await runWithOptionalTenantDbIsolation(tenantId, async (db) => {
      return db.platformLicense.create({
        data: {
          id: trimText(input.id, 120) || createId('license'),
          tenantId,
          licenseKey: trimText(input.licenseKey, 80) || generateLicenseKey(),
          status: normalizeStatus(input.status, ['active', 'trialing', 'expired', 'revoked']),
          seats: asInt(input.seats, 1, 1),
          issuedAt: parseDateOrNull(input.issuedAt) || new Date(),
          expiresAt: parseDateOrNull(input.expiresAt),
          legalDocVersion: legalVersion,
          legalAcceptedAt: parseDateOrNull(input.legalAcceptedAt),
          metadataJson: stringifyMeta(input.metadata),
        },
      });
    });
    if (!row) return { ok: false, reason: 'tenant-not-found' };
    await emitPlatformEvent('platform.license.issued', {
      tenantId,
      licenseId: row.id,
      actor,
    }, { tenantId });
    return { ok: true, license: sanitizeLicenseRow(row, { exposeFullKey: true }) };
  }

  async function acceptPlatformLicenseLegal(input = {}, actor = 'system') {
    const licenseId = trimText(input.licenseId, 120);
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: trimText(input.tenantId, 120) || null,
      allowGlobal: input.allowGlobal === true,
      operation: 'platform license legal acceptance',
      env: input.env || process.env,
    });
    if (!licenseId) return { ok: false, reason: 'license-required' };
    let row = null;
    const updateData = {
      legalDocVersion: trimText(input.legalDocVersion || config.platform?.legal?.currentVersion, 80) || null,
      legalAcceptedAt: new Date(),
      metadataJson: stringifyMeta({
        ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
        acceptedBy: actor,
      }),
    };
    if (tenantId) {
      row = await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformLicense.update({
        where: { id: licenseId },
        data: updateData,
      })).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)));
    } else {
      const tenantRows = await prisma.platformTenant.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      }).catch(() => []);
      for (const tenant of tenantRows) {
        const candidateTenantId = trimText(tenant?.id, 120);
        if (!candidateTenantId) continue;
        row = await runWithOptionalTenantDbIsolation(candidateTenantId, (db) => db.platformLicense.update({
          where: { id: licenseId },
          data: updateData,
        })).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)));
        if (row) break;
      }
    }
    if (!row && !tenantId) {
      row = await prisma.platformLicense.update({
        where: { id: licenseId },
        data: updateData,
      }).catch((error) => (error?.code === 'P2025' ? null : Promise.reject(error)));
    }
    if (!row) return { ok: false, reason: 'license-not-found' };
    await emitPlatformEvent('platform.license.legal.accepted', {
      tenantId: row.tenantId,
      licenseId: row.id,
      actor,
    }, { tenantId: row.tenantId });
    return { ok: true, license: sanitizeLicenseRow(row) };
  }

  async function listPlatformLicenses(options = {}) {
    const { tenantId } = assertTenantDbIsolationScope({
      tenantId: options.tenantId,
      allowGlobal: options.allowGlobal === true,
      operation: 'platform license listing',
    });
    const take = Math.max(1, Math.min(500, asInt(options.limit, 100, 1)));
    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (options.status) where.status = normalizeStatus(options.status, ['active', 'trialing', 'expired', 'revoked']);
    const rows = !tenantId && getTenantDatabaseTopologyMode() !== 'shared'
      ? sortRowsByTimestampDesc(
        await readAcrossPlatformTenantScopes(
          (db) => db.platformLicense.findMany({ where, orderBy: { updatedAt: 'desc' }, take }),
          {
            allowGlobal: true,
            operation: 'platform license global aggregation',
            buildKey: (row) => buildPlatformRowScopeKey(row, ['id', 'tenantId']),
          },
        ),
      ).slice(0, take)
      : await runWithOptionalTenantDbIsolation(tenantId, (db) => db.platformLicense.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
      }));
    return rows.map((row) => sanitizeLicenseRow(row));
  }

  return {
    createSubscription,
    listPlatformSubscriptions,
    issuePlatformLicense,
    acceptPlatformLicenseLegal,
    listPlatformLicenses,
  };
}

module.exports = {
  createPlatformCommercialService,
};
