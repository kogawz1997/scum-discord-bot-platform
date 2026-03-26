'use strict';

/**
 * Public SaaS preview/trial flow built on top of the existing platform tenant
 * and subscription logic. This keeps public preview accounts separate from
 * admin/player auth until the broader identity model is migrated.
 */

const crypto = require('node:crypto');
const {
  createTenant,
  createSubscription,
  getTenantFeatureAccess,
  getTenantQuotaSnapshot,
} = require('./platformService');
const {
  getPackageById,
  getPackageCatalog,
  resolveFeatureAccess,
} = require('../domain/billing/packageCatalogService');
const {
  createPreviewAccount,
  getPreviewAccountByEmail,
  getPreviewAccountById,
  updatePreviewAccount,
} = require('../store/publicPreviewAccountStore');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeEmail(value) {
  return trimText(value, 200).toLowerCase();
}

function normalizeLocale(value) {
  const normalized = trimText(value, 16).toLowerCase();
  return ['th', 'en'].includes(normalized) ? normalized : 'en';
}

function normalizePackageId(value) {
  const requested = trimText(value, 120).toUpperCase();
  if (requested && getPackageById(requested)) return requested;
  return 'BOT_LOG_DELIVERY';
}

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'scum-community';
}

function createId(prefix = 'preview') {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPasswordHash(password, passwordHash) {
  const text = trimText(passwordHash, 512);
  if (!text.startsWith('scrypt$')) return false;
  const [, salt, digest] = text.split('$');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = crypto.scryptSync(String(password || ''), salt, expected.length);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function sanitizePreviewState(account, tenantSnapshot, featureAccess) {
  return {
    account: account
      ? {
          id: account.id,
          email: account.email,
          displayName: account.displayName,
          communityName: account.communityName,
          locale: account.locale,
          packageId: account.packageId,
          accountState: account.accountState,
          verificationState: account.verificationState,
          linkedIdentities: account.linkedIdentities,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
          lastLoginAt: account.lastLoginAt,
        }
      : null,
    tenant: tenantSnapshot
      ? {
          tenantId: tenantSnapshot.tenantId || account?.tenantId || null,
          plan: tenantSnapshot.plan || null,
          package: tenantSnapshot.package || null,
          quotas: tenantSnapshot.quotas || {},
          usage: tenantSnapshot.usage || {},
          status: tenantSnapshot.tenantStatus || 'trialing',
          locale: tenantSnapshot.locale || account?.locale || 'en',
        }
      : null,
    entitlements: {
      enabledFeatureKeys: Array.isArray(featureAccess?.enabledFeatureKeys)
        ? featureAccess.enabledFeatureKeys
        : [],
      package: featureAccess?.package || null,
      features: Array.isArray(featureAccess?.features) ? featureAccess.features : [],
    },
  };
}

function buildFallbackFeatureAccess(packageId) {
  const resolved = resolveFeatureAccess({
    planId: 'trial-14d',
    packageId,
  });
  return {
    package: resolved.package || null,
    enabledFeatureKeys: Array.isArray(resolved.enabledFeatureKeys) ? resolved.enabledFeatureKeys : [],
    features: Array.isArray(resolved.catalog) ? resolved.catalog : [],
  };
}

function buildFallbackTenantSnapshot(account, featureAccess) {
  const enabledFeatures = Array.isArray(featureAccess?.enabledFeatureKeys)
    ? featureAccess.enabledFeatureKeys
    : [];
  return {
    tenantId: account?.tenantId || null,
    plan: {
      id: 'trial-14d',
      name: 'Trial 14 วัน',
      billingCycle: 'trial',
    },
    package: featureAccess?.package || getPackageById(account?.packageId) || null,
    quotas: {
      apiKeys: 1,
      webhooks: 2,
      agentRuntimes: enabledFeatures.includes('execute_agent') && enabledFeatures.includes('sync_agent')
        ? 2
        : 1,
      marketplaceOffers: 2,
      purchases30d: 200,
    },
    usage: {
      apiKeys: 0,
      webhooks: 0,
      agentRuntimes: 0,
      marketplaceOffers: 0,
      purchases30d: 0,
    },
    tenantStatus: 'preview',
    locale: account?.locale || 'en',
  };
}

function createPublicPreviewService(deps = {}) {
  const createTenantImpl = deps.createTenant || createTenant;
  const createSubscriptionImpl = deps.createSubscription || createSubscription;
  const getTenantFeatureAccessImpl = deps.getTenantFeatureAccess || getTenantFeatureAccess;
  const getTenantQuotaSnapshotImpl = deps.getTenantQuotaSnapshot || getTenantQuotaSnapshot;
  const getPackageCatalogImpl = deps.getPackageCatalog || getPackageCatalog;
  const getPreviewAccountByEmailImpl = deps.getPreviewAccountByEmail || getPreviewAccountByEmail;
  const getPreviewAccountByIdImpl = deps.getPreviewAccountById || getPreviewAccountById;
  const createPreviewAccountImpl = deps.createPreviewAccount || createPreviewAccount;
  const updatePreviewAccountImpl = deps.updatePreviewAccount || updatePreviewAccount;

  async function registerPreviewAccount(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const displayName = trimText(input.displayName || input.ownerName, 180) || trimText(email.split('@')[0], 120);
    const communityName = trimText(input.communityName || input.serverName, 180);
    const locale = normalizeLocale(input.locale);
    const packageId = normalizePackageId(input.packageId);

    if (!validateEmail(email)) {
      return { ok: false, reason: 'invalid-email' };
    }
    if (password.length < 8) {
      return { ok: false, reason: 'weak-password' };
    }
    if (!communityName) {
      return { ok: false, reason: 'community-required' };
    }
    if (getPreviewAccountByEmailImpl(email)) {
      return { ok: false, reason: 'email-exists' };
    }

    const baseSlug = slugify(communityName);
    let tenantResult = null;
    let subscriptionResult = null;
    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
        tenantResult = await createTenantImpl(
          {
            id: createId('tenant-preview'),
            slug: `${baseSlug}${suffix}`,
            name: communityName,
            type: 'trial',
            status: 'trialing',
            locale,
            ownerName: displayName,
            ownerEmail: email,
            metadata: {
              source: 'public-preview-signup',
              packageId,
              previewMode: true,
            },
          },
          'public-preview-signup',
        );
        if (tenantResult?.ok) break;
        if (tenantResult?.reason !== 'tenant-slug-conflict') {
          tenantResult = null;
          break;
        }
      }

      if (tenantResult?.ok) {
        subscriptionResult = await createSubscriptionImpl(
          {
            tenantId: tenantResult.tenant.id,
            planId: 'trial-14d',
            packageId,
            status: 'trialing',
            billingCycle: 'trial',
            amountCents: 0,
            intervalDays: 14,
            metadata: {
              source: 'public-preview-signup',
              packageId,
              previewMode: true,
            },
          },
          'public-preview-signup',
        );
        if (!subscriptionResult?.ok) {
          subscriptionResult = null;
        }
      }
    } catch {
      tenantResult = null;
      subscriptionResult = null;
    }

    const account = createPreviewAccountImpl({
      email,
      passwordHash: createPasswordHash(password),
      displayName,
      communityName,
      locale,
      packageId,
      accountState: 'preview',
      verificationState: 'email_verified',
      tenantId: tenantResult?.tenant?.id || null,
      subscriptionId: subscriptionResult?.subscription?.id || null,
      linkedIdentities: {
        discordLinked: false,
        discordVerified: false,
        steamLinked: false,
        playerMatched: false,
        fullyVerified: false,
      },
    });

    return {
      ok: true,
      account,
      tenant: tenantResult?.tenant || null,
      subscription: subscriptionResult?.subscription || null,
    };
  }

  async function authenticatePreviewAccount(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const account = getPreviewAccountByEmailImpl(email);
    if (!account) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    const stored = getPreviewAccountByIdImpl(account.id);
    if (!stored || !verifyPasswordHash(password, stored.passwordHash)) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    const updated = updatePreviewAccountImpl(account.id, {
      lastLoginAt: new Date().toISOString(),
    });
    return { ok: true, account: updated || account };
  }

  async function getPreviewState(accountId) {
    const account = getPreviewAccountByIdImpl(accountId);
    if (!account) {
      return { ok: false, reason: 'account-not-found' };
    }

    const [tenantSnapshotRaw, featureAccessRaw] = await Promise.all([
      account.tenantId ? getTenantQuotaSnapshotImpl(account.tenantId).catch(() => null) : Promise.resolve(null),
      account.tenantId ? getTenantFeatureAccessImpl(account.tenantId).catch(() => null) : Promise.resolve(null),
    ]);
    const featureAccess = featureAccessRaw && Array.isArray(featureAccessRaw.enabledFeatureKeys)
      && featureAccessRaw.enabledFeatureKeys.length > 0
      ? featureAccessRaw
      : buildFallbackFeatureAccess(account.packageId);
    const tenantSnapshot = tenantSnapshotRaw || buildFallbackTenantSnapshot(account, featureAccess);

    return {
      ok: true,
      state: sanitizePreviewState(account, tenantSnapshot, featureAccess),
      packageCatalog: getPackageCatalogImpl(),
    };
  }

  async function requestPasswordReset(input = {}) {
    const email = normalizeEmail(input.email);
    if (!validateEmail(email)) {
      return { ok: false, reason: 'invalid-email' };
    }
    return {
      ok: true,
      requested: Boolean(getPreviewAccountByEmailImpl(email)),
    };
  }

  return {
    authenticatePreviewAccount,
    getPreviewState,
    registerPreviewAccount,
    requestPasswordReset,
  };
}

const publicPreviewService = createPublicPreviewService();

module.exports = {
  createPublicPreviewService,
  publicPreviewService,
};
