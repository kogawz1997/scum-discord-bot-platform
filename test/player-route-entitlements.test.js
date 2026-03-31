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
  assert.equal(res.payload.data.pages.shop.enabled, true);
  assert.equal(res.payload.data.pages.orders.enabled, false);
  assert.equal(res.payload.data.pages.profile.enabled, true);
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

test('player general routes support email magic-link request without a session', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ email: 'player@example.com' }),
    requestPlayerMagicLink: async ({ email }) => ({
      ok: true,
      requested: true,
      queued: true,
      debugToken: `tok-for-${email}`,
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/auth/email/request'),
    pathname: '/player/api/auth/email/request',
    method: 'POST',
    session: null,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    ok: true,
    data: {
      requested: true,
      queued: true,
      debugUrl: '/player/login?token=tok-for-player%40example.com',
    },
  });
});

test('player general routes persist primary email into email magic-link sessions', async () => {
  let capturedSession = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ email: 'player@example.com', token: 'player-token' }),
    consumePlayerMagicLink: async () => ({
      ok: true,
      discordUserId: '123456789012345678',
      user: {
        id: 'user-1',
        primaryEmail: 'player@example.com',
        displayName: 'Player Example',
      },
      profile: {
        id: 'profile-1',
        tenantId: 'tenant-prod-001',
      },
    }),
    createSession(payload) {
      capturedSession = payload;
      return 'session-1';
    },
    buildSessionCookie() {
      return 'scum_portal_session=session-1';
    },
    normalizeText(value) {
      return String(value || '').trim();
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/auth/email/complete'),
    pathname: '/player/api/auth/email/complete',
    method: 'POST',
    session: null,
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(capturedSession.primaryEmail, 'player@example.com');
  assert.equal(capturedSession.tenantId, 'tenant-prod-001');
});

test('player general routes expose server scope choices for the current tenant', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizeAmount(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    },
    listServerRegistry: async () => ([
      { id: 'server-alpha', name: 'Server Alpha', status: 'active', guildLinks: [{ guildId: 'guild-1' }] },
      { id: 'server-bravo', name: 'Server Bravo', status: 'maintenance', guildLinks: [] },
    ]),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/servers'),
    pathname: '/player/api/servers',
    method: 'GET',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.count, 2);
  assert.equal(res.payload.data.selectionRequired, true);
  assert.equal(res.payload.data.activeServerId, null);
  assert.equal(res.payload.data.effectiveServerId, 'server-alpha');
  assert.deepEqual(
    res.payload.data.items.map((item) => ({ id: item.id, status: item.status })),
    [
      { id: 'server-alpha', status: 'active' },
      { id: 'server-bravo', status: 'maintenance' },
    ],
  );
});

test('player general routes can switch the active player server in session scope', async () => {
  let updatedPayload = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ serverId: 'server-bravo' }),
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizeAmount(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    },
    listServerRegistry: async () => ([
      { id: 'server-alpha', name: 'Server Alpha', status: 'active', guildLinks: [] },
      { id: 'server-bravo', name: 'Server Bravo', status: 'active', guildLinks: [] },
    ]),
    updateSession(_req, payload) {
      updatedPayload = payload;
      return 'updated-session-cookie';
    },
    buildSessionCookie(value) {
      return `scum_portal_session=${value}`;
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/session/server'),
    pathname: '/player/api/session/server',
    method: 'POST',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(updatedPayload.activeServerId, 'server-bravo');
  assert.equal(updatedPayload.activeServerName, 'Server Bravo');
  assert.equal(res.headers['Set-Cookie'], 'scum_portal_session=updated-session-cookie');
  assert.equal(res.payload.data.activeServerId, 'server-bravo');
  assert.equal(res.payload.data.selectionRequired, false);
});

test('player general routes tolerate unavailable server info readers', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    config: {
      serverInfo: {
        name: 'SCUM TH',
        description: 'Community server',
      },
      raidTimes: ['20:00 - 22:00'],
    },
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizeAmount(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    },
    getStatus() {
      throw new Error('status store offline');
    },
    getEconomyConfig() {
      throw new Error('economy config offline');
    },
    getLuckyWheelConfig() {
      throw new Error('wheel config offline');
    },
    getMapPortalConfig() {
      throw new Error('map config offline');
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/server/info'),
    pathname: '/player/api/server/info',
    method: 'GET',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.serverInfo.name, 'SCUM TH');
  assert.equal(res.payload.data.status.onlinePlayers, 0);
  assert.equal(res.payload.data.economy.currencySymbol, 'Coins');
  assert.equal(res.payload.data.luckyWheel.enabled, false);
  assert.equal(res.payload.data.mapPortal.enabled, false);
});

test('player general routes return a safe wheel state when the runtime reader fails', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['event_module'],
    }),
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizeAmount(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    getLuckyWheelConfig() {
      return {
        enabled: true,
        cooldownMs: 60000,
        rewards: [
          { id: 'coin-100', label: '100 Coins', type: 'coins', amount: 100, weight: 1 },
        ],
        tips: ['One tip'],
      };
    },
    buildWheelStatePayload: async () => {
      throw new Error('wheel storage unavailable');
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/wheel/state?limit=10'),
    pathname: '/player/api/wheel/state',
    method: 'GET',
    session: {
      tenantId: 'tenant-prod-001',
      discordId: 'user-1',
      user: 'Mira',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.enabled, true);
  assert.equal(res.payload.data.canSpin, false);
  assert.deepEqual(res.payload.data.history, []);
  assert.equal(res.payload.data.rewards.length, 1);
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
