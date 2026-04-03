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
      identitySummary: {
        linkedProviders: ['email_preview', 'discord', 'steam'],
        verificationState: 'fully_verified',
        memberships: [
          {
            tenantId: 'tenant-prod-001',
            membershipType: 'tenant',
            role: 'player',
            status: 'active',
          },
        ],
        linkedAccounts: {
          email: { linked: true, verified: true, value: 'mira@example.com' },
          discord: { linked: true, verified: true, value: '123456789012345678' },
          steam: { linked: true, verified: true, value: '76561199012345678' },
          inGame: { linked: true, verified: true, value: 'MiraTH' },
        },
        activeMembership: {
          tenantId: 'tenant-prod-001',
          membershipType: 'tenant',
          role: 'player',
          status: 'active',
        },
        readiness: {
          emailVerified: true,
          discordLinked: true,
          steamLinked: true,
          playerMatched: true,
          fullyVerified: true,
        },
        nextSteps: [],
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
  assert.deepEqual(res.payload.data.identitySummary.nextSteps, []);
});

test('player me route exposes tenant branding for the player portal shell', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getPlayerAccount: async () => ({
      avatarUrl: 'https://cdn.example.com/avatar.png',
      isActive: true,
    }),
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: '76561199012345678',
      inGameName: 'MiraTH',
    }),
    getPlatformTenantById: async () => ({
      id: 'tenant-prod-001',
      slug: 'prime-scum',
      name: 'Prime SCUM',
    }),
    getPlatformTenantConfig: async () => ({
      portalEnvPatch: {
        siteName: 'Prime SCUM Network',
        siteDescription: 'Official player community',
        logoUrl: 'https://cdn.example.com/prime-logo.png',
        bannerUrl: '/branding/prime-banner.jpg',
        primaryColor: '#3366ff',
        accentColor: '#99ddaa',
        publicTheme: 'midnight-ops',
      },
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/me'),
    pathname: '/player/api/me',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      primaryEmail: 'mira@example.com',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.branding.siteName, 'Prime SCUM Network');
  assert.equal(res.payload.data.branding.logoUrl, 'https://cdn.example.com/prime-logo.png');
  assert.equal(res.payload.data.branding.bannerUrl, '/branding/prime-banner.jpg');
  assert.equal(res.payload.data.branding.themeTokens.primary, '#3366ff');
});
