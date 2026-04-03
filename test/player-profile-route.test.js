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

test('player email verification request queues a verification token for an unverified linked email', async () => {
  const issued = [];
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
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
      },
      identitySummary: {
        verificationState: 'partially_verified',
        linkedAccounts: {
          email: { linked: true, verified: false, value: 'mira@example.com' },
          discord: { linked: true, verified: true, value: '123456789012345678' },
          steam: { linked: true, verified: true, value: '76561199012345678' },
          inGame: { linked: true, verified: true, value: 'MiraTH' },
        },
        nextSteps: [
          {
            key: 'verify-email',
            title: 'Verify email',
            detail: 'Confirm your email before asking staff to review account issues.',
            blocking: true,
          },
        ],
      },
    }),
    issueEmailVerificationToken: async (payload) => {
      issued.push(payload);
      return { ok: true };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    },
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
  assert.equal(res.payload.data.queued, true);
  assert.equal(issued.length, 1);
  assert.deepEqual(issued[0], {
    email: 'mira@example.com',
    userId: 'platform-user-1',
    metadata: {
      source: 'player-profile-email-verification',
      tenantId: 'tenant-prod-001',
      discordUserId: '123456789012345678',
      profileId: 'platform-profile-1',
    },
  });
});

test('player email verification request enforces the profile rate limit', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    normalizeText(value) {
      return String(value || '').trim();
    },
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
          email: { linked: true, verified: false, value: 'mira@example.com' },
        },
      },
    }),
    issueEmailVerificationToken: async () => ({ ok: true }),
  });

  const attempt = async () => {
    const res = createResponse();
    await route({
      req: {
        headers: {
          'x-forwarded-for': '203.0.113.11',
        },
      },
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
    return res;
  };

  const first = await attempt();
  const second = await attempt();
  const third = await attempt();
  const fourth = await attempt();

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 200);
  assert.equal(fourth.statusCode, 429);
  assert.equal(fourth.headers['Retry-After'], '900');
  assert.match(fourth.payload.error, /too many email verification requests/i);
});
