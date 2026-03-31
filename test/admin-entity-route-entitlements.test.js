const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminEntityPostRoutes,
} = require('../src/admin/api/adminEntityPostRoutes');
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
  return createAdminEntityPostRoutes({
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
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    claimSupportTicket: () => ({ ok: true }),
    closeSupportTicket: () => ({ ok: true }),
    tryNotifyTicket: async () => {},
    createBountyForUser: async () => ({ ok: true }),
    cancelBountyForUser: () => ({ ok: true }),
    createServerEvent: async () => ({ ok: true, event: { id: 1 } }),
    updateServerEvent: async () => ({ ok: true, event: { id: 1 } }),
    startServerEvent: async () => ({ ok: true, event: { id: 1 } }),
    finishServerEvent: async () => ({ ok: true, event: { id: 1 }, participants: [], rewardGranted: false }),
    joinServerEvent: async () => ({ ok: true, event: { id: 1 }, participantsCount: 1 }),
    bindSteamLinkForUser: async () => ({ ok: true }),
    removeSteamLink: () => ({ ok: true, removed: {} }),
    upsertPlayerAccount: async () => ({ ok: true, data: {} }),
    bindPlayerSteamId: async () => ({ ok: true, data: {} }),
    unbindPlayerSteamId: async () => ({ ok: true, data: {} }),
    grantVipForUser: async () => ({ ok: true, plan: { id: 'vip' }, expiresAt: null }),
    revokeVipForUser: async () => ({ ok: true }),
    createRedeemCodeForAdmin: () => ({ ok: true }),
    deleteRedeemCodeForAdmin: () => ({ ok: true, code: 'WELCOME' }),
    resetRedeemCodeUsageForAdmin: () => ({ ok: true, data: {} }),
    createPunishmentEntry: () => ({ ok: true, entry: {} }),
    revokeWelcomePackClaimForAdmin: () => ({ ok: true, userId: 'user-1' }),
    clearWelcomePackClaimsForAdmin: () => ({ ok: true }),
    addKillsForUser: () => ({ ok: true, stat: {} }),
    addDeathsForUser: () => ({ ok: true, stat: {} }),
    addPlaytimeForUser: () => ({ ok: true, stat: {} }),
    queueLeaderboardRefreshForAllGuilds: () => {},
    buildTenantProductEntitlements,
    ...overrides,
  });
}

test('admin entity event create route denies event action when event entitlement is locked', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    createServerEvent: async () => {
      called = true;
      return { ok: true, event: { id: 1 } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/event/create',
    body: {
      tenantId: 'tenant-1',
      name: 'Weekend Arena',
      time: '2026-04-01 20:00 ICT',
      reward: '5000 coins',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_manage_events');
});

test('admin entity link route denies player action when player entitlement is locked', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    bindSteamLinkForUser: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/link/set',
    body: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      steamId: 'steam-1',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_manage_players');
});
