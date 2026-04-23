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
    reviewRaidRequest: async () => ({ ok: true, request: { id: 11 } }),
    createRaidWindow: async () => ({ ok: true, window: { id: 21 } }),
    createRaidSummary: async () => ({ ok: true, summary: { id: 31 } }),
    bindSteamLinkForUser: async () => ({ ok: true }),
    removeSteamLink: async () => ({ ok: true, removed: {} }),
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
    emitPlatformEvent: async () => {},
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

test('admin entity player steam bind route uses link service workflow', async () => {
  const calls = [];
  let directPlayerStoreCalled = false;
  const events = [];
  const handler = buildRoutes({
    bindSteamLinkForUser: async (input) => {
      calls.push(input);
      return {
        ok: true,
        steamId: input.steamId,
        userId: input.userId,
        identitySummary: { linked: true },
      };
    },
    bindPlayerSteamId: async () => {
      directPlayerStoreCalled = true;
      return { ok: true, data: {} };
    },
    emitPlatformEvent: async (eventType, payload) => {
      events.push({ eventType, payload });
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/player/steam/bind',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      steamId: '76561198000000001',
      inGameName: 'Scum Survivor',
      supportIntent: 'relink',
      supportOutcome: 'pending-verification',
      supportReason: 'Steam mismatch needs relink verification.',
      supportSource: 'owner',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(directPlayerStoreCalled, false);
  assert.deepEqual(calls, [{
    steamId: '76561198000000001',
    userId: '123456789012345678',
    inGameName: 'Scum Survivor',
    allowReplace: true,
    allowSteamReuse: true,
    tenantId: 'tenant-1',
  }]);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.userId, '123456789012345678');
  assert.deepEqual(payload.data.identitySummary, { linked: true });
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'platform.player.identity.support');
  assert.equal(events[0].payload.userId, '123456789012345678');
  assert.equal(events[0].payload.supportIntent, 'relink');
  assert.equal(events[0].payload.supportOutcome, 'pending-verification');
  assert.equal(events[0].payload.supportSource, 'owner');
});

test('admin entity player steam unbind route uses link service workflow', async () => {
  const calls = [];
  let directPlayerStoreCalled = false;
  const events = [];
  const handler = buildRoutes({
    removeSteamLink: async (input) => {
      calls.push(input);
      return {
        ok: true,
        removed: {
          userId: input.userId,
          steamId: input.steamId,
        },
        identitySummary: { linked: false },
      };
    },
    unbindPlayerSteamId: async () => {
      directPlayerStoreCalled = true;
      return { ok: true, data: {} };
    },
    emitPlatformEvent: async (eventType, payload) => {
      events.push({ eventType, payload });
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/player/steam/unbind',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      steamId: '76561198000000001',
      supportIntent: 'relink',
      supportOutcome: 'pending-player-reply',
      supportReason: 'Old Steam link removed while waiting for player confirmation.',
      supportSource: 'tenant',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(directPlayerStoreCalled, false);
  assert.deepEqual(calls, [{
    steamId: '76561198000000001',
    userId: '123456789012345678',
    tenantId: 'tenant-1',
  }]);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.removed, {
    userId: '123456789012345678',
    steamId: '76561198000000001',
  });
  assert.deepEqual(payload.data.identitySummary, { linked: false });
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'platform.player.identity.support');
  assert.equal(events[0].payload.action, 'unlink');
  assert.equal(events[0].payload.supportIntent, 'relink');
  assert.equal(events[0].payload.supportOutcome, 'pending-player-reply');
  assert.equal(events[0].payload.followupAction, 'bind');
});

test('admin entity identity review route records non-destructive support trail', async () => {
  let bindCalled = false;
  let unbindCalled = false;
  const events = [];
  const handler = buildRoutes({
    bindSteamLinkForUser: async () => {
      bindCalled = true;
      return { ok: true };
    },
    removeSteamLink: async () => {
      unbindCalled = true;
      return { ok: true, removed: {} };
    },
    emitPlatformEvent: async (eventType, payload) => {
      events.push({ eventType, payload });
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/player/identity/review',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      steamId: '76561198000000001',
      supportIntent: 'conflict',
      supportOutcome: 'pending-player-reply',
      supportReason: 'Support needs the player to confirm which Steam account is correct.',
      supportSource: 'owner',
      followupAction: 'relink',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(bindCalled, false);
  assert.equal(unbindCalled, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.action, 'review');
  assert.equal(payload.data.supportIntent, 'conflict');
  assert.equal(payload.data.followupAction, 'relink');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'platform.player.identity.support');
  assert.equal(events[0].payload.action, 'review');
  assert.equal(events[0].payload.supportIntent, 'conflict');
  assert.equal(events[0].payload.supportOutcome, 'pending-player-reply');
  assert.equal(events[0].payload.followupAction, 'relink');
});

test('admin entity identity review route allows owner support follow-up within tenant scope', async () => {
  const events = [];
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: ['player_module'],
    }),
    emitPlatformEvent: async (eventType, payload) => {
      events.push({ eventType, payload });
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/player/identity/review',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      supportIntent: 'conflict',
      supportOutcome: 'resolved',
      supportReason: 'Owner resolved the identity follow-up from the support workspace.',
      supportSource: 'owner',
      followupAction: 'relink',
    },
    res,
    auth: { user: 'owner-global', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.supportOutcome, 'resolved');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'platform.player.identity.support');
  assert.equal(events[0].payload.tenantId, 'tenant-1');
  assert.equal(events[0].payload.actorRole, 'owner');
  assert.equal(events[0].payload.supportOutcome, 'resolved');
});

test('admin entity legacy link remove route awaits async link removal', async () => {
  let serviceResolved = false;
  const handler = buildRoutes({
    removeSteamLink: async ({ userId }) => {
      await Promise.resolve();
      serviceResolved = true;
      return {
        ok: true,
        removed: {
          userId,
          steamId: '76561198000000001',
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/link/remove',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(serviceResolved, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.deepEqual(payload.data, {
    userId: '123456789012345678',
    steamId: '76561198000000001',
  });
});

test('admin entity legacy link routes also emit identity support trail metadata', async () => {
  const events = [];
  const handler = buildRoutes({
    bindSteamLinkForUser: async (input) => ({
      ok: true,
      userId: input.userId,
      steamId: input.steamId,
    }),
    removeSteamLink: async (input) => ({
      ok: true,
      removed: {
        userId: input.userId,
        steamId: input.steamId,
      },
    }),
    emitPlatformEvent: async (eventType, payload) => {
      events.push({ eventType, payload });
    },
  });

  const bindRes = createMockRes();
  await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/link/set',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      steamId: '76561198000000001',
      supportIntent: 'bind',
      supportOutcome: 'resolved',
      supportReason: 'Legacy support bind completed.',
      supportSource: 'tenant-console',
    },
    res: bindRes,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  const removeRes = createMockRes();
  await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/link/remove',
    body: {
      tenantId: 'tenant-1',
      userId: '123456789012345678',
      steamId: '76561198000000001',
      supportIntent: 'relink',
      supportOutcome: 'pending-player-reply',
      supportReason: 'Legacy support unlink waiting for player response.',
      supportSource: 'tenant-console',
    },
    res: removeRes,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(bindRes.statusCode, 200);
  assert.equal(removeRes.statusCode, 200);
  assert.equal(events.length, 2);
  assert.equal(events[0].eventType, 'platform.player.identity.support');
  assert.equal(events[0].payload.supportOutcome, 'resolved');
  assert.equal(events[0].payload.supportSource, 'tenant-console');
  assert.equal(events[1].payload.action, 'unlink');
  assert.equal(events[1].payload.followupAction, 'bind');
  assert.equal(events[1].payload.supportIntent, 'relink');
});

test('admin entity raid review route denies raid action when event entitlement is locked', async () => {
  let called = false;
  const handler = buildRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    reviewRaidRequest: async () => {
      called = true;
      return { ok: true, request: { id: 11 } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/raid/request/review',
    body: {
      tenantId: 'tenant-1',
      id: 11,
      status: 'approved',
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
