const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPublicPreviewService,
} = require('../src/services/publicPreviewService');

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
  const store = createStoreHarness();
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
  assert.equal(result.tenant.name, 'Demo Community');
  assert.equal(result.subscription.planId, 'trial-14d');

  const auth = await service.authenticatePreviewAccount({
    email: 'demo@example.com',
    password: 'strong-pass-123',
  });
  assert.equal(auth.ok, true);
  assert.ok(auth.account.lastLoginAt);

  const state = await service.getPreviewState(result.account.id);
  assert.equal(state.ok, true);
  assert.equal(state.state.account.email, 'demo@example.com');
  assert.deepEqual(state.state.entitlements.enabledFeatureKeys, ['bot_log', 'shop_module']);
});

test('public preview service falls back to lightweight preview state when tenant bootstrap fails', async () => {
  const store = createStoreHarness();
  const service = createPublicPreviewService({
    createTenant: async () => {
      throw new Error('db-unavailable');
    },
    createSubscription: async () => {
      throw new Error('subscription-unavailable');
    },
    getPackageCatalog: () => [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }],
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
});
