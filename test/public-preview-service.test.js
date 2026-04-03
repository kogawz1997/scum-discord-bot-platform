const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/publicPreviewService.js');
const platformServicePath = path.resolve(__dirname, '../src/services/platformService.js');
const packageCatalogServicePath = path.resolve(__dirname, '../src/domain/billing/packageCatalogService.js');
const previewStorePath = path.resolve(__dirname, '../src/store/publicPreviewAccountStore.js');
const identityServicePath = path.resolve(__dirname, '../src/services/platformIdentityService.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function loadCreatePublicPreviewService() {
  clearModule(servicePath);
  installMock(platformServicePath, {
    createTenant: async () => ({ ok: false, reason: 'not-mocked' }),
    createSubscription: async () => ({ ok: false, reason: 'not-mocked' }),
    getTenantFeatureAccess: async () => null,
    getTenantQuotaSnapshot: async () => null,
  });
  installMock(packageCatalogServicePath, {
    getPackageById(packageId) {
      if (String(packageId || '').toUpperCase() === 'BOT_LOG_DELIVERY') {
        return { id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' };
      }
      return null;
    },
    getPackageCatalog() {
      return [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }];
    },
    resolveFeatureAccess() {
      return {
        package: { id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' },
        enabledFeatureKeys: ['bot_delivery', 'execute_agent', 'sync_agent'],
        catalog: [
          { key: 'bot_delivery', title: 'Bot Delivery', enabled: true },
          { key: 'execute_agent', title: 'Execute Agent', enabled: true },
          { key: 'sync_agent', title: 'Sync Agent', enabled: true },
        ],
      };
    },
  });
  installMock(previewStorePath, {
    createPreviewAccount: async () => { throw new Error('not-mocked'); },
    getPreviewAccountByEmail: async () => null,
    getPreviewAccountById: async () => null,
    updatePreviewAccount: async () => null,
  });
  installMock(identityServicePath, {
    completeEmailVerification: async () => ({ ok: false, reason: 'not-mocked' }),
    completePasswordReset: async () => ({ ok: false, reason: 'not-mocked' }),
    ensurePlatformUserIdentity: async () => ({ ok: false, reason: 'not-mocked' }),
    getIdentitySummaryForPreviewAccount: async () => null,
    issueEmailVerificationToken: async () => ({ ok: false, reason: 'not-mocked' }),
    issuePasswordResetToken: async () => ({ ok: false, reason: 'not-mocked' }),
  });
  return require(servicePath).createPublicPreviewService;
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(platformServicePath);
  clearModule(packageCatalogServicePath);
  clearModule(previewStorePath);
  clearModule(identityServicePath);
});

function createStoreHarness() {
  const byId = new Map();
  const byEmail = new Map();

  return {
    createPreviewAccount(input) {
      const account = {
        id: input.id || 'preview-account-1',
        createdAt: '2026-03-25T00:00:00.000Z',
        updatedAt: '2026-03-25T00:00:00.000Z',
        lastLoginAt: null,
        ...input,
      };
      byId.set(account.id, { ...account });
      byEmail.set(String(account.email || '').toLowerCase(), { ...account });
      return {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        communityName: account.communityName,
        locale: account.locale,
        packageId: account.packageId,
        accountState: account.accountState,
        verificationState: account.verificationState,
        tenantId: account.tenantId,
        subscriptionId: account.subscriptionId,
        linkedIdentities: account.linkedIdentities,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastLoginAt: account.lastLoginAt,
      };
    },
    getPreviewAccountByEmail(email) {
      const row = byEmail.get(String(email || '').toLowerCase());
      return row ? { ...row } : null;
    },
    getPreviewAccountById(id) {
      const row = byId.get(String(id || ''));
      return row ? { ...row } : null;
    },
    updatePreviewAccount(id, patch) {
      const current = byId.get(String(id || ''));
      if (!current) return null;
      const next = { ...current, ...patch };
      byId.set(next.id, next);
      byEmail.set(String(next.email || '').toLowerCase(), next);
      return {
        id: next.id,
        email: next.email,
        displayName: next.displayName,
        communityName: next.communityName,
        locale: next.locale,
        packageId: next.packageId,
        accountState: next.accountState,
        verificationState: next.verificationState,
        tenantId: next.tenantId,
        subscriptionId: next.subscriptionId,
        linkedIdentities: next.linkedIdentities,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
        lastLoginAt: next.lastLoginAt,
      };
    },
  };
}

test('public preview service validates signup input and creates preview tenant state', async () => {
  const createPublicPreviewService = loadCreatePublicPreviewService();
  const store = createStoreHarness();
  const issuedResetTokens = [];
  const issuedVerificationTokens = [];
  const service = createPublicPreviewService({
    createTenant: async (input) => ({
      ok: true,
      tenant: { id: input.id, slug: input.slug, name: input.name },
    }),
    createSubscription: async (input) => ({
      ok: true,
      subscription: { id: 'sub-1', tenantId: input.tenantId, planId: input.planId },
    }),
    getTenantFeatureAccess: async () => ({
      enabledFeatureKeys: ['bot_log', 'shop_module'],
      features: [
        { key: 'bot_log', title: 'Bot Log', enabled: true },
        { key: 'shop_module', title: 'Shop Module', enabled: true },
      ],
      package: { id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' },
    }),
    getTenantQuotaSnapshot: async () => ({
      tenantId: 'tenant-preview-1',
      quotas: { apiKeys: 2, agentRuntimes: 1 },
      usage: { apiKeys: 0, agentRuntimes: 0 },
      tenantStatus: 'trialing',
      locale: 'th',
    }),
    getPackageCatalog: () => [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }],
    ensurePlatformUserIdentity: async (input) => ({
      ok: true,
      user: { id: `user-${input.providerUserId}` },
      identities: [{ provider: input.provider }],
      memberships: input.tenantId ? [{ tenantId: input.tenantId, role: input.role || 'owner', membershipType: 'tenant' }] : [],
    }),
    getIdentitySummaryForPreviewAccount: async (account) => ({
      user: { id: `user-${account.id}` },
      identities: [{ provider: 'email_preview' }],
      memberships: account.tenantId ? [{ tenantId: account.tenantId, role: 'owner', membershipType: 'tenant' }] : [],
      identitySummary: {
        linkedProviders: ['email_preview'],
        verificationState: null,
        linkedAccounts: {
          email: { linked: true, verified: false, value: account.email },
          discord: { linked: false, verified: false, value: null },
          steam: { linked: false, verified: false, value: null },
          inGame: { linked: false, verified: false, value: null },
        },
        activeMembership: account.tenantId
          ? { tenantId: account.tenantId, role: 'owner', membershipType: 'tenant', status: 'active' }
          : null,
        readiness: {
          emailVerified: false,
          discordLinked: false,
          steamLinked: false,
          playerMatched: false,
          fullyVerified: false,
        },
        nextSteps: [
          { key: 'verify-email', blocking: true },
          { key: 'link-discord', blocking: true },
          { key: 'link-steam', blocking: true },
        ],
      },
    }),
    issuePasswordResetToken: async (input) => {
      issuedResetTokens.push(input);
      return {
        ok: true,
        rawToken: 'rst_test.token',
        token: { id: 'rst-1', email: input.email },
      };
    },
    issueEmailVerificationToken: async (input) => {
      issuedVerificationTokens.push(input);
      return {
        ok: true,
        rawToken: 'vfy_test.token',
        token: { id: 'vfy-1', email: input.email },
      };
    },
    completeEmailVerification: async () => ({
      ok: true,
      verification: {
        previewAccountId: 'preview-account-1',
        email: 'demo@example.com',
      },
    }),
    completePasswordReset: async () => ({
      ok: true,
      token: {
        previewAccountId: 'preview-account-1',
        email: 'demo@example.com',
      },
    }),
    exposeDebugTokens: true,
    ...store,
  });

  assert.deepEqual(
    await service.registerPreviewAccount({
      email: 'nope',
      password: '12345678',
      communityName: 'Test',
    }),
    { ok: false, reason: 'invalid-email' },
  );

  assert.deepEqual(
    await service.registerPreviewAccount({
      email: 'demo@example.com',
      password: '123',
      communityName: 'Test',
    }),
    { ok: false, reason: 'weak-password' },
  );

  const result = await service.registerPreviewAccount({
    displayName: 'Demo User',
    email: 'demo@example.com',
    password: 'strong-pass-123',
    communityName: 'Demo Community',
    packageId: 'BOT_LOG_DELIVERY',
    locale: 'th',
  });

  assert.equal(result.ok, true);
  assert.equal(result.account.email, 'demo@example.com');
  assert.equal(result.account.accountState, 'preview');
  assert.equal(result.account.verificationState, 'pending_email_verification');
  assert.equal(String(result.account.identity?.userId || ''), 'user-preview-account-1');
  assert.equal(result.account.verificationQueued, true);
  assert.equal(result.account.verificationTokenPreview, 'vfy_test.token');
  assert.equal(result.tenant.name, 'Demo Community');
  assert.equal(result.subscription.planId, 'trial-14d');
  assert.equal(issuedVerificationTokens.length, 1);

  const auth = await service.authenticatePreviewAccount({
    email: 'demo@example.com',
    password: 'strong-pass-123',
  });
  assert.equal(auth.ok, true);
  assert.ok(auth.account.lastLoginAt);
  assert.deepEqual(auth.account.identity?.providers, ['email_preview']);

  const state = await service.getPreviewState(result.account.id);
  assert.equal(state.ok, true);
  assert.equal(state.state.account.email, 'demo@example.com');
  assert.deepEqual(state.state.entitlements.enabledFeatureKeys, ['bot_log', 'shop_module']);
  assert.equal(String(state.state.identity?.userId || ''), 'user-preview-account-1');
  assert.equal(state.state.identity?.identitySummary?.linkedAccounts?.email?.linked, true);
  assert.equal(state.state.account.linkedIdentities.steamLinked, false);
  assert.deepEqual(
    state.state.identity?.identitySummary?.nextSteps?.map((entry) => entry.key),
    ['verify-email', 'link-discord', 'link-steam'],
  );

  const reset = await service.requestPasswordReset({
    email: 'demo@example.com',
  });
  assert.equal(reset.ok, true);
  assert.equal(reset.requested, true);
  assert.equal(reset.resetTokenQueued, true);
  assert.equal(reset.resetTokenPreview, 'rst_test.token');
  assert.equal(issuedResetTokens.length, 1);

  const verificationRequest = await service.requestEmailVerification({
    email: 'demo@example.com',
  });
  assert.equal(verificationRequest.ok, true);
  assert.equal(verificationRequest.requested, true);
  assert.equal(verificationRequest.verificationTokenQueued, true);
  assert.equal(verificationRequest.verificationTokenPreview, 'vfy_test.token');

  const verified = await service.completeEmailVerification({
    token: 'vfy_test.token',
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.account.verificationState, 'email_verified');
  assert.equal(verified.account.identity?.identitySummary?.linkedAccounts?.email?.linked, true);

  const resetComplete = await service.completePasswordReset({
    token: 'rst_test.token',
    password: 'new-strong-pass-456',
  });
  assert.equal(resetComplete.ok, true);

  const reauth = await service.authenticatePreviewAccount({
    email: 'demo@example.com',
    password: 'new-strong-pass-456',
  });
  assert.equal(reauth.ok, true);
});

test('public preview service falls back to lightweight preview state when tenant bootstrap fails', async () => {
  const createPublicPreviewService = loadCreatePublicPreviewService();
  const store = createStoreHarness();
  const service = createPublicPreviewService({
    createTenant: async () => {
      throw new Error('db-unavailable');
    },
    createSubscription: async () => {
      throw new Error('subscription-unavailable');
    },
    getPackageCatalog: () => [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }],
    ensurePlatformUserIdentity: async (input) => ({
      ok: true,
      user: { id: `user-${input.providerUserId}` },
      identities: [{ provider: input.provider }],
      memberships: [],
    }),
    issueEmailVerificationToken: async () => ({
      ok: true,
      rawToken: 'vfy_fallback.token',
      token: { id: 'vfy-1', email: 'fallback@example.com' },
    }),
    getIdentitySummaryForPreviewAccount: async (account) => ({
      user: { id: `user-${account.id}` },
      identities: [{ provider: 'email_preview' }],
      memberships: [],
      identitySummary: {
        linkedProviders: ['email_preview'],
        verificationState: null,
        linkedAccounts: {
          email: { linked: true, verified: false, value: account.email },
          discord: { linked: false, verified: false, value: null },
          steam: { linked: false, verified: false, value: null },
          inGame: { linked: false, verified: false, value: null },
        },
        activeMembership: null,
        readiness: {
          emailVerified: false,
          discordLinked: false,
          steamLinked: false,
          playerMatched: false,
          fullyVerified: false,
        },
        nextSteps: [
          { key: 'verify-email', blocking: true },
          { key: 'link-discord', blocking: true },
          { key: 'link-steam', blocking: true },
          { key: 'membership-pending', blocking: false },
        ],
      },
    }),
    ...store,
  });

  const result = await service.registerPreviewAccount({
    displayName: 'Fallback User',
    email: 'fallback@example.com',
    password: 'strong-pass-123',
    communityName: 'Fallback Community',
    packageId: 'BOT_LOG_DELIVERY',
    locale: 'en',
  });

  assert.equal(result.ok, true);
  assert.equal(result.account.tenantId, null);
  assert.equal(result.account.subscriptionId, null);
  assert.equal(result.tenant, null);
  assert.equal(result.subscription, null);

  const state = await service.getPreviewState(result.account.id);
  assert.equal(state.ok, true);
  assert.equal(state.state.tenant.status, 'preview');
  assert.ok(state.state.entitlements.enabledFeatureKeys.includes('bot_delivery'));
  assert.ok(state.state.entitlements.enabledFeatureKeys.includes('execute_agent'));
  assert.equal(String(state.state.identity?.userId || ''), 'user-preview-account-1');
  assert.deepEqual(
    state.state.identity?.identitySummary?.nextSteps?.map((entry) => entry.key),
    ['verify-email', 'link-discord', 'link-steam', 'membership-pending'],
  );
});

test('public preview service skips issuing verification token when email is already verified centrally', async () => {
  const createPublicPreviewService = loadCreatePublicPreviewService();
  const store = createStoreHarness();
  const service = createPublicPreviewService({
    ensurePlatformUserIdentity: async () => ({ ok: true, user: { id: 'user-preview-account-1' }, identities: [] }),
    getIdentitySummaryForPreviewAccount: async (account) => ({
      user: { id: `user-${account.id}` },
      identities: [{ provider: 'email_preview', providerEmail: account.email, verifiedAt: '2026-04-01T10:00:00.000Z' }],
      memberships: [],
      identitySummary: {
        linkedProviders: ['email_preview'],
        verificationState: null,
        linkedAccounts: {
          email: { linked: true, verified: true, value: account.email },
          discord: { linked: false, verified: false, value: null },
          steam: { linked: false, verified: false, value: null },
          inGame: { linked: false, verified: false, value: null },
        },
        activeMembership: null,
        readiness: {
          emailVerified: true,
          discordLinked: false,
          steamLinked: false,
          playerMatched: false,
          fullyVerified: false,
        },
        nextSteps: [
          { key: 'link-discord', blocking: true },
          { key: 'link-steam', blocking: true },
          { key: 'membership-pending', blocking: false },
        ],
      },
    }),
    issueEmailVerificationToken: async () => {
      throw new Error('should-not-issue-token');
    },
    ...store,
  });

  await service.registerPreviewAccount({
    displayName: 'Verified User',
    email: 'verified@example.com',
    password: 'strong-pass-123',
    communityName: 'Verified Community',
    packageId: 'BOT_LOG_DELIVERY',
    locale: 'en',
  });

  const result = await service.requestEmailVerification({
    email: 'verified@example.com',
  });
  assert.equal(result.ok, true);
  assert.equal(result.requested, false);
  assert.equal(result.alreadyVerified, true);
  assert.equal(result.verificationTokenQueued, false);
});
