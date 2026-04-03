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
const {
  completeEmailVerification,
  completePasswordReset,
  ensurePlatformUserIdentity,
  getIdentitySummaryForPreviewAccount,
  issueEmailVerificationToken,
  issuePasswordResetToken,
} = require('./platformIdentityService');

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
    identity: account?.identity || null,
  };
}

function buildPreviewIdentityPayload(identitySummary) {
  if (!identitySummary || typeof identitySummary !== 'object') return null;
  const summary = identitySummary.identitySummary && typeof identitySummary.identitySummary === 'object'
    ? identitySummary.identitySummary
    : null;
  return {
    userId: identitySummary.user?.id || null,
    providers: Array.isArray(identitySummary.identities)
      ? identitySummary.identities.map((entry) => entry.provider).filter(Boolean)
      : [],
    memberships: Array.isArray(identitySummary.memberships)
      ? identitySummary.memberships.map((entry) => ({
        tenantId: entry.tenantId,
        role: entry.role,
        membershipType: entry.membershipType,
        status: entry.status || null,
      }))
      : [],
    identitySummary: summary,
  };
}

function derivePreviewLinkedIdentities(account, identitySummary) {
  const summary = identitySummary?.identitySummary && typeof identitySummary.identitySummary === 'object'
    ? identitySummary.identitySummary
    : null;
  const fallback = account?.linkedIdentities && typeof account.linkedIdentities === 'object'
    ? account.linkedIdentities
    : {};
  if (!summary) {
    return {
      discordLinked: fallback.discordLinked === true,
      discordVerified: fallback.discordVerified === true,
      steamLinked: fallback.steamLinked === true,
      playerMatched: fallback.playerMatched === true,
      fullyVerified: fallback.fullyVerified === true,
    };
  }
  return {
    discordLinked: summary.linkedAccounts?.discord?.linked === true,
    discordVerified: summary.linkedAccounts?.discord?.verified === true,
    steamLinked: summary.linkedAccounts?.steam?.linked === true,
    playerMatched: summary.linkedAccounts?.inGame?.linked === true,
    fullyVerified: summary.readiness?.fullyVerified === true,
  };
}

function derivePreviewVerificationState(account, identitySummary) {
  const current = trimText(account?.verificationState, 80) || 'pending_email_verification';
  const summary = identitySummary?.identitySummary && typeof identitySummary.identitySummary === 'object'
    ? identitySummary.identitySummary
    : null;
  if (summary?.linkedAccounts?.email?.verified) {
    return 'email_verified';
  }
  return current;
}

function arePreviewLinkedIdentitiesEqual(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};
  return (
    a.discordLinked === b.discordLinked
    && a.discordVerified === b.discordVerified
    && a.steamLinked === b.steamLinked
    && a.playerMatched === b.playerMatched
    && a.fullyVerified === b.fullyVerified
  );
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
  const ensurePlatformUserIdentityImpl = deps.ensurePlatformUserIdentity || ensurePlatformUserIdentity;
  const getIdentitySummaryForPreviewAccountImpl =
    deps.getIdentitySummaryForPreviewAccount || getIdentitySummaryForPreviewAccount;
  const issueEmailVerificationTokenImpl =
    deps.issueEmailVerificationToken || issueEmailVerificationToken;
  const issuePasswordResetTokenImpl = deps.issuePasswordResetToken || issuePasswordResetToken;
  const completeEmailVerificationImpl =
    deps.completeEmailVerification || completeEmailVerification;
  const completePasswordResetImpl =
    deps.completePasswordReset || completePasswordReset;
  const exposeDebugTokens = deps.exposeDebugTokens === true || String(process.env.PUBLIC_PREVIEW_DEBUG_TOKENS || '').trim().toLowerCase() === 'true';

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
    if (await getPreviewAccountByEmailImpl(email)) {
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

    const account = await createPreviewAccountImpl({
      email,
      passwordHash: createPasswordHash(password),
      displayName,
      communityName,
      locale,
      packageId,
      accountState: 'preview',
      verificationState: 'pending_email_verification',
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

    const identity = await ensurePlatformUserIdentityImpl({
      provider: 'email_preview',
      providerUserId: account.id || email,
      email,
      displayName,
      locale,
      tenantId: tenantResult?.tenant?.id || null,
      role: 'owner',
      membershipType: tenantResult?.tenant?.id ? 'tenant' : 'preview',
      identityMetadata: {
        source: 'public-preview-signup',
        previewAccountId: account.id,
      },
      membershipMetadata: {
        source: 'public-preview-signup',
        previewAccountId: account.id,
        subscriptionId: subscriptionResult?.subscription?.id || null,
      },
      verifiedAt: null,
    }).catch(() => null);
    const verification = await issueEmailVerificationTokenImpl({
      email,
      userId: identity?.user?.id || null,
      previewAccountId: account.id,
      metadata: {
        source: 'public-preview-signup',
        tenantId: tenantResult?.tenant?.id || null,
      },
    }).catch(() => null);

    return {
      ok: true,
      account: {
        ...account,
        identity: identity?.ok
          ? {
            userId: identity.user?.id || null,
            providers: Array.isArray(identity.identities)
              ? identity.identities.map((entry) => entry.provider).filter(Boolean)
              : [],
          }
          : null,
        verificationQueued: Boolean(verification?.ok),
        verificationTokenPreview: exposeDebugTokens ? verification?.rawToken || null : null,
      },
      tenant: tenantResult?.tenant || null,
      subscription: subscriptionResult?.subscription || null,
    };
  }

  async function authenticatePreviewAccount(input = {}) {
    const email = normalizeEmail(input.email);
    const password = String(input.password || '');
    const account = await getPreviewAccountByEmailImpl(email);
    if (!account) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    const stored = await getPreviewAccountByIdImpl(account.id);
    if (!stored || !verifyPasswordHash(password, stored.passwordHash)) {
      return { ok: false, reason: 'invalid-credentials' };
    }
    const updated = await updatePreviewAccountImpl(account.id, {
      lastLoginAt: new Date().toISOString(),
    });
    const identity = await ensurePlatformUserIdentityImpl({
      provider: 'email_preview',
      providerUserId: account.id || email,
      email,
      displayName: account.displayName,
      locale: account.locale,
      tenantId: account.tenantId,
      role: 'owner',
      membershipType: account.tenantId ? 'tenant' : 'preview',
      identityMetadata: {
        source: 'public-preview-login',
        previewAccountId: account.id,
      },
      verifiedAt: String(account.verificationState || '').trim().toLowerCase() === 'email_verified'
        ? new Date().toISOString()
        : null,
    }).catch(() => null);
    const identitySummary = await getIdentitySummaryForPreviewAccountImpl(updated || account).catch(() => null);
    return {
      ok: true,
      account: {
        ...(updated || account),
        identity: buildPreviewIdentityPayload(identitySummary)
          || (identity?.ok
            ? {
              userId: identity.user?.id || null,
              providers: Array.isArray(identity.identities)
                ? identity.identities.map((entry) => entry.provider).filter(Boolean)
                : [],
            }
            : null),
      },
    };
  }

  async function getPreviewState(accountId) {
    const account = await getPreviewAccountByIdImpl(accountId);
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
    const identitySummary = await getIdentitySummaryForPreviewAccountImpl(account).catch(() => null);
    const nextLinkedIdentities = derivePreviewLinkedIdentities(account, identitySummary);
    const nextVerificationState = derivePreviewVerificationState(account, identitySummary);
    let accountForState = account;
    if (
      !arePreviewLinkedIdentitiesEqual(account.linkedIdentities, nextLinkedIdentities)
      || trimText(account.verificationState, 80) !== nextVerificationState
    ) {
      accountForState = await updatePreviewAccountImpl(account.id, {
        linkedIdentities: nextLinkedIdentities,
        verificationState: nextVerificationState,
      }) || {
        ...account,
        linkedIdentities: nextLinkedIdentities,
        verificationState: nextVerificationState,
      };
    }

    return {
      ok: true,
      state: sanitizePreviewState({
        ...accountForState,
        identity: buildPreviewIdentityPayload(identitySummary),
      }, tenantSnapshot, featureAccess),
      packageCatalog: getPackageCatalogImpl(),
    };
  }

  async function requestPasswordReset(input = {}) {
    const email = normalizeEmail(input.email);
    if (!validateEmail(email)) {
      return { ok: false, reason: 'invalid-email' };
    }
    const account = await getPreviewAccountByEmailImpl(email);
    if (account) {
      const identity = await ensurePlatformUserIdentityImpl({
        provider: 'email_preview',
        providerUserId: account.id || email,
        email,
        displayName: account.displayName,
        locale: account.locale,
        tenantId: account.tenantId,
        role: 'owner',
        membershipType: account.tenantId ? 'tenant' : 'preview',
        identityMetadata: {
          source: 'public-preview-password-reset',
          previewAccountId: account.id,
        },
      }).catch(() => null);
      const token = await issuePasswordResetTokenImpl({
        email,
        userId: identity?.user?.id || null,
        previewAccountId: account.id,
        metadata: {
          source: 'public-preview-password-reset',
          tenantId: account.tenantId || null,
        },
      }).catch(() => null);
      return {
        ok: true,
        requested: true,
        resetTokenQueued: Boolean(token?.ok),
        resetTokenPreview: exposeDebugTokens ? token?.rawToken || null : null,
      };
    }
    return {
      ok: true,
      requested: false,
      resetTokenQueued: false,
      resetTokenPreview: null,
    };
  }

  async function requestEmailVerification(input = {}) {
    const email = normalizeEmail(input.email);
    if (!validateEmail(email)) {
      return { ok: false, reason: 'invalid-email' };
    }
    const account = await getPreviewAccountByEmailImpl(email);
    if (!account) {
      return {
        ok: true,
        requested: false,
        verificationTokenQueued: false,
        verificationTokenPreview: null,
      };
    }
    const currentIdentitySummary = await getIdentitySummaryForPreviewAccountImpl(account).catch(() => null);
    if (
      trimText(account.verificationState, 80).toLowerCase() === 'email_verified'
      || currentIdentitySummary?.identitySummary?.linkedAccounts?.email?.verified === true
    ) {
      return {
        ok: true,
        requested: false,
        alreadyVerified: true,
        verificationTokenQueued: false,
        verificationTokenPreview: null,
      };
    }
    const identity = await ensurePlatformUserIdentityImpl({
      provider: 'email_preview',
      providerUserId: account.id || email,
      email,
      displayName: account.displayName,
      locale: account.locale,
      tenantId: account.tenantId,
      role: 'owner',
      membershipType: account.tenantId ? 'tenant' : 'preview',
      identityMetadata: {
        source: 'public-preview-email-verification',
        previewAccountId: account.id,
      },
      verifiedAt: String(account.verificationState || '').trim().toLowerCase() === 'email_verified'
        ? new Date().toISOString()
        : null,
    }).catch(() => null);
    const token = await issueEmailVerificationTokenImpl({
      email,
      userId: identity?.user?.id || null,
      previewAccountId: account.id,
      metadata: {
        source: 'public-preview-email-verification',
        tenantId: account.tenantId || null,
      },
    }).catch(() => null);
    return {
      ok: true,
      requested: true,
      verificationTokenQueued: Boolean(token?.ok),
      verificationTokenPreview: exposeDebugTokens ? token?.rawToken || null : null,
    };
  }

  async function completeEmailVerificationFlow(input = {}) {
    const token = trimText(input.token, 512);
    if (!token) {
      return { ok: false, reason: 'token-required' };
    }
    const completed = await completeEmailVerificationImpl({
      token,
      email: input.email,
    }).catch(() => null);
    if (!completed?.ok || !completed.verification) {
      return completed || { ok: false, reason: 'verification-failed' };
    }
    const account = completed.verification.previewAccountId
      ? await getPreviewAccountByIdImpl(completed.verification.previewAccountId)
      : await getPreviewAccountByEmailImpl(completed.verification.email);
    if (!account) {
      return { ok: false, reason: 'account-not-found' };
    }
    const updated = await updatePreviewAccountImpl(account.id, {
      verificationState: 'email_verified',
    });
    const identity = await ensurePlatformUserIdentityImpl({
      provider: 'email_preview',
      providerUserId: account.id || account.email,
      email: account.email,
      displayName: account.displayName,
      locale: account.locale,
      tenantId: account.tenantId,
      role: 'owner',
      membershipType: account.tenantId ? 'tenant' : 'preview',
      identityMetadata: {
        source: 'public-preview-email-verified',
        previewAccountId: account.id,
      },
      verifiedAt: new Date().toISOString(),
    }).catch(() => null);
    const refreshedIdentitySummary = await getIdentitySummaryForPreviewAccountImpl(updated || account).catch(() => null);
    return {
      ok: true,
      account: {
        ...(updated || account),
        identity: buildPreviewIdentityPayload(refreshedIdentitySummary)
          || (identity?.ok
            ? {
              userId: identity.user?.id || null,
              providers: Array.isArray(identity.identities)
                ? identity.identities.map((entry) => entry.provider).filter(Boolean)
                : [],
            }
            : null),
      },
      nextUrl: '/login',
    };
  }

  async function completePasswordResetFlow(input = {}) {
    const token = trimText(input.token, 512);
    const nextPassword = String(input.password || '');
    if (!token) {
      return { ok: false, reason: 'token-required' };
    }
    if (nextPassword.length < 8) {
      return { ok: false, reason: 'weak-password' };
    }
    const completed = await completePasswordResetImpl({
      token,
      email: input.email,
    }).catch(() => null);
    if (!completed?.ok || !completed.token) {
      return completed || { ok: false, reason: 'password-reset-failed' };
    }
    const account = completed.token.previewAccountId
      ? await getPreviewAccountByIdImpl(completed.token.previewAccountId)
      : await getPreviewAccountByEmailImpl(completed.token.email);
    if (!account) {
      return { ok: false, reason: 'account-not-found' };
    }
    const updated = await updatePreviewAccountImpl(account.id, {
      passwordHash: createPasswordHash(nextPassword),
    });
    return {
      ok: true,
      account: updated || account,
      nextUrl: '/login',
    };
  }

  return {
    authenticatePreviewAccount,
    completeEmailVerification: completeEmailVerificationFlow,
    completePasswordReset: completePasswordResetFlow,
    getPreviewState,
    registerPreviewAccount,
    requestEmailVerification,
    requestPasswordReset,
  };
}

const publicPreviewService = createPublicPreviewService();

module.exports = {
  createPublicPreviewService,
  publicPreviewService,
};
