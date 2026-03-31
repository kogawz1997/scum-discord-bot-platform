const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminCommerceDeliveryPostRoutes,
} = require('../src/admin/api/adminCommerceDeliveryPostRoutes');
const {
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = null) {
      this.ended = true;
      this.body = body;
    },
  };
}

function buildRoutes(overrides = {}) {
  return createAdminCommerceDeliveryPostRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    requiredString(value, key) {
      if (value && typeof value === 'object' && key) {
        return String(value[key] || '').trim();
      }
      return String(value || '').trim();
    },
    asInt(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
    parseStringArray: () => [],
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    listKnownPurchaseStatuses: () => [],
    setCoinsExact: async () => ({ ok: true }),
    creditCoins: async () => ({ ok: true }),
    debitCoins: async () => ({ ok: true }),
    addShopItemForAdmin: async () => ({ ok: true }),
    updateShopItemForAdmin: async () => ({ ok: true }),
    setShopItemPriceForAdmin: async () => ({ ok: true }),
    setShopItemStatusForAdmin: async () => ({ ok: true }),
    deleteShopItemForAdmin: async () => ({ ok: true }),
    updatePurchaseStatusForActor: async () => ({ ok: true }),
    queueLeaderboardRefreshForAllGuilds: () => {},
    parseDeliveryItemsBody: async () => [],
    enqueuePurchaseDeliveryByCode: async () => ({ ok: true }),
    retryDeliveryNow: async () => ({ ok: true }),
    retryDeliveryNowMany: async () => ({ ok: true }),
    retryDeliveryDeadLetter: async () => ({ ok: true }),
    retryDeliveryDeadLetterMany: async () => ({ ok: true }),
    removeDeliveryDeadLetter: async () => ({ ok: true }),
    cancelDeliveryJob: async () => ({ ok: true }),
    previewDeliveryCommands: async () => ({ ok: true }),
    getDeliveryPreflightReport: async () => ({ ok: true }),
    simulateDeliveryPlan: async () => ({ ok: true }),
    setDeliveryCommandOverride: async () => ({ ok: true }),
    sendTestDeliveryCommand: async () => ({ ok: true }),
    saveAdminCommandCapabilityPreset: async () => ({ ok: true }),
    getAdminCommandCapabilityPresetById: async () => null,
    deleteAdminCommandCapabilityPreset: async () => ({ ok: true }),
    testScumAdminCommandCapability: async () => ({ ok: true }),
    runRentBikeMidnightReset: async () => ({ ok: true }),
    getRentBikeRuntime: async () => ({ ok: true }),
    updateScumStatusForAdmin: async () => ({ ok: true }),
    getStatus: () => ({ ok: true }),
    buildTenantProductEntitlements,
    ...overrides,
  });
}

test('admin shop status route updates donation package status for the current tenant', async () => {
  const calls = [];
  const handler = buildRoutes({
    setShopItemStatusForAdmin: async (input) => {
      calls.push(input);
      return {
        ok: true,
        item: {
          id: input.idOrName,
          status: input.status,
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/shop/status',
    body: {
      tenantId: 'tenant-1',
      idOrName: 'starter-crate',
      status: 'disabled',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    tenantId: 'tenant-1',
    idOrName: 'starter-crate',
    status: 'disabled',
  });
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.status, 'disabled');
});

test('admin shop add route denies donation package creation when donation entitlement is locked', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    addShopItemForAdmin: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/shop/add',
    body: {
      tenantId: 'tenant-1',
      id: 'starter-crate',
      name: 'Starter Crate',
      price: 1000,
      description: 'Starter gear',
      kind: 'item',
      gameItemId: 'crate_a',
      quantity: 1,
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_manage_donations');
});

test('admin delivery retry route denies order action when orders entitlement is locked', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    retryDeliveryNow: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/delivery/retry',
    body: {
      tenantId: 'tenant-1',
      code: 'PUR-1001',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_manage_orders');
});
