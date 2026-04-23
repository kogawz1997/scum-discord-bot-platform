const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPlayerGeneralRoutes,
} = require('../apps/web-portal-standalone/api/playerGeneralRoutes');

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

test('player profile route exposes linked account and membership readiness summary', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getPlayerAccount: async () => ({
      username: 'mira',
      displayName: 'MiraTH',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      isActive: true,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:05:00.000Z',
    }),
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: {
        id: 'platform-user-1',
        primaryEmail: 'mira@example.com',
      },
      profile: {
        id: 'platform-profile-1',
        steamId: '76561199012345678',
        inGameName: 'MiraTH',
        verificationState: 'fully_verified',
      },
      identities: [
        {
          provider: 'email_preview',
          providerEmail: 'mira@example.com',
          verifiedAt: '2026-04-01T10:00:00.000Z',
        },
        {
          provider: 'discord',
          providerUserId: '123456789012345678',
          verifiedAt: '2026-04-01T10:01:00.000Z',
        },
        {
          provider: 'steam',
          providerUserId: '76561199012345678',
          verifiedAt: '2026-04-01T10:02:00.000Z',
        },
      ],
      memberships: [
        {
          tenantId: 'tenant-prod-001',
          membershipType: 'tenant',
          role: 'player',
          status: 'active',
        },
      ],
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/profile'),
    pathname: '/player/api/profile',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      platformProfileId: 'platform-profile-1',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.platformUserId, 'platform-user-1');
  assert.equal(res.payload.data.platformProfileId, 'platform-profile-1');
  assert.equal(res.payload.data.identitySummary.verificationState, 'fully_verified');
  assert.equal(res.payload.data.identitySummary.linkedAccounts.email.linked, true);
  assert.equal(res.payload.data.identitySummary.linkedAccounts.email.value, 'mira@example.com');
  assert.equal(res.payload.data.identitySummary.linkedAccounts.discord.linked, true);
  assert.equal(res.payload.data.identitySummary.linkedAccounts.steam.linked, true);
  assert.equal(res.payload.data.identitySummary.linkedAccounts.inGame.value, 'MiraTH');
  assert.equal(res.payload.data.identitySummary.activeMembership.role, 'player');
});

test('player profile route prefers centralized identity summary when service provides one', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getPlayerAccount: async () => ({
      username: 'mira',
      displayName: 'MiraTH',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      isActive: true,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:05:00.000Z',
    }),
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: {
        id: 'platform-user-1',
        primaryEmail: 'mira@example.com',
      },
      profile: {
        id: 'platform-profile-1',
      },
      identities: [],
      memberships: [],
      identitySummary: {
        linkedProviders: ['discord', 'steam'],
        verificationState: 'steam_linked',
        memberships: [],
        linkedAccounts: {
          email: { linked: true, verified: true, value: 'mira@example.com' },
          discord: { linked: true, verified: true, value: '123456789012345678' },
          steam: { linked: true, verified: true, value: '76561199012345678' },
          inGame: { linked: true, verified: false, value: 'MiraTH' },
        },
        activeMembership: {
          tenantId: 'tenant-prod-001',
          membershipType: 'tenant',
          role: 'player',
          status: 'active',
        },
        readiness: {
          hasEmail: true,
          hasDiscord: true,
          hasSteam: true,
          hasInGameProfile: true,
          hasActiveMembership: true,
        },
      },
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/profile'),
    pathname: '/player/api/profile',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      platformProfileId: 'platform-profile-1',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.identitySummary.readiness.hasSteam, true);
  assert.equal(res.payload.data.identitySummary.linkedAccounts.steam.verified, true);
  assert.equal(res.payload.data.identitySummary.activeMembership.status, 'active');
});

test('player profile route passes allowGlobal for no-tenant identity summary lookups', async () => {
  let seenAllowGlobal = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getPlayerAccount: async () => ({
      username: 'mira',
      displayName: 'MiraTH',
      isActive: true,
    }),
    resolveSessionSteamLink: async () => ({
      linked: false,
      steamId: null,
      inGameName: null,
    }),
    getPlatformUserIdentitySummary: async (input = {}) => {
      seenAllowGlobal = input.allowGlobal === true;
      return {
        ok: true,
        user: {
          id: 'platform-user-1',
          primaryEmail: 'mira@example.com',
        },
        profile: null,
        identities: [],
        memberships: [],
        identitySummary: {
          linkedProviders: [],
          verificationState: null,
          memberships: [],
          linkedAccounts: {
            email: { linked: true, verified: true, value: 'mira@example.com' },
            discord: { linked: true, verified: true, value: '123456789012345678' },
            steam: { linked: false, verified: false, value: null },
            inGame: { linked: false, verified: false, value: null },
          },
          activeMembership: null,
          readiness: {
            hasEmail: true,
            hasDiscord: true,
            hasSteam: false,
            hasInGameProfile: false,
            hasActiveMembership: false,
          },
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/profile'),
    pathname: '/player/api/profile',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      platformProfileId: null,
      tenantId: null,
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seenAllowGlobal, true);
});

test('player profile email verification request queues a token for an unverified linked email', async () => {
  let issuedPayload = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ email: 'mira@example.com' }),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getPlayerAccount: async () => ({
      username: 'mira',
      displayName: 'MiraTH',
      isActive: true,
    }),
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: {
        id: 'platform-user-1',
        primaryEmail: 'mira@example.com',
      },
      profile: {
        id: 'platform-profile-1',
      },
      identitySummary: {
        linkedAccounts: {
          email: {
            linked: true,
            verified: false,
            value: 'mira@example.com',
          },
        },
      },
    }),
    issueEmailVerificationToken: async (input) => {
      issuedPayload = input;
      return { ok: true, token: { id: 'vfy-1' } };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/profile/email-verification/request'),
    pathname: '/player/api/profile/email-verification/request',
    method: 'POST',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      platformProfileId: 'platform-profile-1',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.requested, true);
  assert.equal(issuedPayload.email, 'mira@example.com');
  assert.equal(issuedPayload.userId, 'platform-user-1');
  assert.equal(issuedPayload.metadata.source, 'player-profile-email-verification');
});

test('player linksteam set uses centralized bind flow when available', async () => {
  let bindPayload = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({ steamId: '76561199012345678' }),
    normalizeText(value) {
      return String(value || '').trim();
    },
    resolveSessionSteamLink: async () => ({ linked: false }),
    getLinkBySteamId: () => null,
    setLink: () => ({ ok: false, reason: 'should-not-be-used' }),
    bindSteamLinkForUser: async (input) => {
      bindPayload = input;
      return {
        ok: true,
        steamId: input.steamId,
        identitySummary: {
          linkedAccounts: {
            inGame: {
              linked: true,
              value: 'MiraTH',
            },
          },
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/linksteam/set'),
    pathname: '/player/api/linksteam/set',
    method: 'POST',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(bindPayload.userId, '123456789012345678');
  assert.equal(bindPayload.tenantId, 'tenant-prod-001');
  assert.equal(res.payload.data.identitySummary.linkedAccounts.inGame.value, 'MiraTH');
});

test('player linksteam unset requires a verified email before disconnecting steam', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizePurchaseStatus(value) {
      return String(value || '').trim();
    },
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      identitySummary: {
        linkedAccounts: {
          email: {
            linked: true,
            verified: false,
            value: 'mira@example.com',
          },
        },
      },
    }),
    listUserPurchases: async () => [],
    removeSteamLink: async () => ({ ok: true }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/linksteam/unset'),
    pathname: '/player/api/linksteam/unset',
    method: 'POST',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'email-verification-required');
});

test('player linksteam unset disconnects steam when recovery guards pass', async () => {
  let removePayload = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    normalizePurchaseStatus(value) {
      return String(value || '').trim();
    },
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      identitySummary: {
        linkedAccounts: {
          email: {
            linked: true,
            verified: true,
            value: 'mira@example.com',
          },
        },
      },
    }),
    listUserPurchases: async () => [
      {
        purchaseCode: 'P-100',
        status: 'delivered',
      },
    ],
    removeSteamLink: async (input) => {
      removePayload = input;
      return {
        ok: true,
        identitySummary: {
          linkedAccounts: {
            steam: {
              linked: false,
              verified: false,
              value: null,
            },
          },
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/linksteam/unset'),
    pathname: '/player/api/linksteam/unset',
    method: 'POST',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      platformUserId: 'platform-user-1',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(removePayload.userId, '123456789012345678');
  assert.equal(removePayload.tenantId, 'tenant-prod-001');
  assert.equal(res.payload.data.linked, false);
  assert.equal(res.payload.data.identitySummary.linkedAccounts.steam.linked, false);
});
