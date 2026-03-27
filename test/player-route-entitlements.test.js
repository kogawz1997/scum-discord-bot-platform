const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlayerGeneralRoutes,
} = require('../apps/web-portal-standalone/api/playerGeneralRoutes');
const {
  createPlayerCommerceRoutes,
} = require('../apps/web-portal-standalone/api/playerCommerceRoutes');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body) {
      this.payload = body;
    },
  };
}

function createSendJson() {
  return (res, statusCode, payload, extraHeaders = {}) => {
    res.writeHead(statusCode, extraHeaders);
    res.end(payload);
  };
}

function createUrl(pathname) {
  return new URL(`http://localhost${pathname}`);
}

test('player general routes expose normalized feature access for the current tenant', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      package: { code: 'FULL_OPTION' },
      enabledFeatureKeys: ['shop_module', 'wallet_module', 'ranking_module'],
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/feature-access'),
    pathname: '/player/api/feature-access',
    method: 'GET',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.data.enabledFeatureKeys, ['shop_module', 'wallet_module', 'ranking_module']);
  assert.equal(res.payload.data.pages.commerce.enabled, true);
  assert.equal(res.payload.data.pages.stats.enabled, true);
});

test('player general routes deny wallet access when wallet feature is disabled', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['shop_module'],
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/wallet/ledger?limit=20'),
    pathname: '/player/api/wallet/ledger',
    method: 'GET',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'feature-not-enabled');
  assert.deepEqual(res.payload.data.requiredFeatures, ['wallet_module']);
});

test('player commerce routes deny shop access when shop feature is disabled', async () => {
  let purchaseCalled = false;
  const route = createPlayerCommerceRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ item: 'starter-pack' }),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['orders_module'],
    }),
    purchaseShopItemForUser: async () => {
      purchaseCalled = true;
      return { ok: true };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/shop/buy'),
    pathname: '/player/api/shop/buy',
    method: 'POST',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'feature-not-enabled');
  assert.equal(purchaseCalled, false);
});
