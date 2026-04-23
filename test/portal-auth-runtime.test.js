const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPortalAuthRuntime,
} = require('../apps/web-portal-standalone/auth/portalAuthRuntime');

function createRuntime(overrides = {}) {
  return createPortalAuthRuntime({
    sessions: new Map(),
    oauthStates: new Map(),
    baseUrl: 'https://player.example.com',
    enforceOriginCheck: true,
    playerOpenAccess: true,
    requireGuildMember: false,
    allowedDiscordIds: new Set(),
    oauthStateTtlMs: 60_000,
    sessionTtlMs: 60_000,
    sessionCookieName: 'portal_session',
    sessionCookiePath: '/',
    sessionCookieSameSite: 'Lax',
    sessionCookieDomain: '',
    secureCookie: true,
    discordApiBase: 'https://discord.com/api/v10',
    discordClientId: 'client-id',
    discordClientSecret: 'client-secret',
    googleClientId: 'google-client-id',
    googleClientSecret: 'google-client-secret',
    discordGuildId: '',
    discordRedirectPath: '/auth/discord/callback',
    googleRedirectPath: '/auth/google/callback',
    sendJson(_res, _status, payload) {
      return payload;
    },
    upsertPlayerAccount: async () => {},
    ensurePlatformPlayerIdentity: async () => ({ ok: true, user: { id: 'platform-user-1' }, profile: { id: 'player-profile-1' } }),
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: {
        id: 'platform-user-1',
        primaryEmail: 'player@example.com',
      },
      profile: {
        id: 'player-profile-1',
        tenantId: 'tenant-1',
        discordUserId: '123456789012345678',
      },
      identitySummary: {
        linkedAccounts: {
          discord: {
            value: '123456789012345678',
          },
        },
        activeMembership: {
          tenantId: 'tenant-1',
        },
      },
    }),
    buildDiscordAvatarUrl: () => null,
    normalizeText(value) {
      return String(value || '').trim();
    },
    isDiscordId(value) {
      return /^\d{15,25}$/.test(String(value || '').trim());
    },
    logger: console,
    ...overrides,
  });
}

test('portal auth runtime creates and reads sessions from cookies', () => {
  const runtime = createRuntime();
  const sessionId = runtime.createSession({
    user: 'tester',
    discordId: '123456789012345',
    role: 'player',
  });
  const req = {
    headers: {
      cookie: `portal_session=${encodeURIComponent(sessionId)}`,
    },
  };

  const session = runtime.getSession(req);

  assert.equal(session.user, 'tester');
  assert.equal(session.discordId, '123456789012345');
});

test('portal auth runtime can restore a signed session cookie without in-memory state', () => {
  const runtime = createRuntime({
    sessionSecret: 'shared-player-session-secret',
  });
  const cookieValue = runtime.createSession({
    user: 'tester',
    discordId: '123456789012345',
    role: 'player',
    primaryEmail: 'tester@example.com',
  });

  const coldRuntime = createRuntime({
    sessionSecret: 'shared-player-session-secret',
  });
  const session = coldRuntime.getSession({
    headers: {
      cookie: `portal_session=${encodeURIComponent(cookieValue)}`,
    },
  });

  assert.equal(session?.user, 'tester');
  assert.equal(session?.discordId, '123456789012345');
  assert.equal(session?.primaryEmail, 'tester@example.com');
});

test('portal auth runtime preserves player server scope in signed sessions', () => {
  const runtime = createRuntime({
    sessionSecret: 'shared-player-session-secret',
  });
  const cookieValue = runtime.createSession({
    user: 'tester',
    discordId: '123456789012345',
    role: 'player',
    tenantId: 'tenant-prod-001',
    activeServerId: 'server-alpha',
    activeServerName: 'Server Alpha',
  });

  const coldRuntime = createRuntime({
    sessionSecret: 'shared-player-session-secret',
  });
  const session = coldRuntime.getSession({
    headers: {
      cookie: `portal_session=${encodeURIComponent(cookieValue)}`,
    },
  });

  assert.equal(session?.tenantId, 'tenant-prod-001');
  assert.equal(session?.activeServerId, 'server-alpha');
  assert.equal(session?.activeServerName, 'Server Alpha');
});

test('portal auth runtime can update the active player server on an existing session', () => {
  const runtime = createRuntime({
    sessionSecret: 'shared-player-session-secret',
  });
  const cookieValue = runtime.createSession({
    user: 'tester',
    discordId: '123456789012345',
    role: 'player',
    tenantId: 'tenant-prod-001',
  });
  const updatedCookie = runtime.updateSession({
    headers: {
      cookie: `portal_session=${encodeURIComponent(cookieValue)}`,
    },
  }, {
    activeServerId: 'server-bravo',
    activeServerName: 'Server Bravo',
  });

  const session = runtime.getSession({
    headers: {
      cookie: `portal_session=${encodeURIComponent(updatedCookie)}`,
    },
  });

  assert.equal(session?.activeServerId, 'server-bravo');
  assert.equal(session?.activeServerName, 'Server Bravo');
});

test('portal auth runtime enforces origin on unsafe methods', () => {
  const runtime = createRuntime();
  const allowed = runtime.verifyOrigin({
    method: 'POST',
    headers: {
      origin: 'https://player.example.com',
    },
  });
  const denied = runtime.verifyOrigin({
    method: 'POST',
    headers: {
      origin: 'https://evil.example.com',
    },
  });

  assert.equal(allowed, true);
  assert.equal(denied, false);
});

test('portal auth runtime allows loopback origin when request host is local', () => {
  const runtime = createRuntime();
  const allowed = runtime.verifyOrigin({
    method: 'POST',
    headers: {
      host: '127.0.0.1:3300',
      origin: 'http://127.0.0.1:3300',
    },
    socket: {
      encrypted: false,
    },
  });

  assert.equal(allowed, true);
});

test('portal auth runtime builds canonical redirect for mismatched host/proto', () => {
  const runtime = createRuntime();
  const url = runtime.getCanonicalRedirectUrl({
    url: '/player',
    headers: {
      host: 'admin.example.com',
      'x-forwarded-proto': 'http',
    },
    socket: {
      encrypted: false,
    },
  });

  assert.equal(url, 'https://player.example.com/player');
});

test('portal auth runtime allows local loopback access without canonical redirect', () => {
  const runtime = createRuntime();
  const url = runtime.getCanonicalRedirectUrl({
    url: '/player',
    headers: {
      host: '127.0.0.1:3300',
    },
    socket: {
      encrypted: false,
    },
  });

  assert.equal(url, null);
});

test('portal auth runtime builds local-safe cookie for loopback hosts', () => {
  const runtime = createRuntime({
    sessionCookieDomain: 'player.example.com',
    secureCookie: true,
  });

  const cookie = runtime.buildSessionCookie('session-1', {
    headers: {
      host: '127.0.0.1:3300',
    },
  });

  assert.match(cookie, /portal_session=session-1/);
  assert.doesNotMatch(cookie, /Domain=/);
  assert.doesNotMatch(cookie, /Secure/);
});

test('portal auth runtime syncs platform identity during discord callback', async () => {
  const calls = [];
  const runtime = createRuntime({
    upsertPlayerAccount: async () => {},
    ensurePlatformPlayerIdentity: async (payload) => {
      calls.push(payload);
      return {
        ok: true,
        user: { id: 'platform-user-42' },
        profile: { id: 'platform-profile-42' },
      };
    },
  });

  const startRes = {
    statusCode: 200,
    headers: {},
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end() {},
  };
  await runtime.handleDiscordStart({}, startRes);
  const location = String(startRes.headers.Location || '');
  const state = new URL(location).searchParams.get('state');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('/oauth2/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'discord-token' }),
      };
    }
    if (target.includes('/users/@me')) {
      return {
        ok: true,
        json: async () => ({
          id: '123456789012345678',
          username: 'tester',
          global_name: 'Tester',
        }),
      };
    }
    throw new Error(`Unexpected fetch ${target}`);
  };

  try {
    const callbackRes = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = { ...this.headers, ...headers };
      },
      end() {},
    };
    await runtime.handleDiscordCallback(
      {
        headers: {
          host: 'player.example.com',
        },
      },
      callbackRes,
      new URL(`https://player.example.com/auth/discord/callback?state=${encodeURIComponent(state)}&code=oauth-code`),
    );

    assert.equal(callbackRes.statusCode, 302);
    assert.equal(callbackRes.headers.Location, '/player');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].provider, 'discord');
    assert.equal(calls[0].providerUserId, '123456789012345678');

    const cookieHeader = String(callbackRes.headers['Set-Cookie'] || '');
    const sessionCookie = cookieHeader.split(';')[0];
    const session = runtime.getSession({
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(session.platformUserId, 'platform-user-42');
    assert.equal(session.platformProfileId, 'platform-profile-42');
  } finally {
    global.fetch = originalFetch;
  }
});

test('portal auth runtime syncs platform identity during google callback and resolves linked discord session', async () => {
  const calls = [];
  const runtime = createRuntime({
    ensurePlatformPlayerIdentity: async (payload) => {
      calls.push(payload);
      return {
        ok: true,
        user: { id: 'platform-user-99', primaryEmail: 'player@example.com' },
        profile: { id: 'player-profile-99', tenantId: 'tenant-prod-1' },
      };
    },
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: { id: 'platform-user-99', primaryEmail: 'player@example.com' },
      profile: {
        id: 'player-profile-99',
        tenantId: 'tenant-prod-1',
        discordUserId: '123456789012345678',
      },
      identitySummary: {
        linkedAccounts: {
          discord: {
            value: '123456789012345678',
          },
        },
        activeMembership: {
          tenantId: 'tenant-prod-1',
        },
      },
    }),
  });

  const startRes = {
    statusCode: 200,
    headers: {},
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end() {},
  };
  await runtime.handleGoogleStart({}, startRes);
  const location = String(startRes.headers.Location || '');
  const state = new URL(location).searchParams.get('state');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'google-token' }),
      };
    }
    if (target.includes('openidconnect.googleapis.com/v1/userinfo')) {
      return {
        ok: true,
        json: async () => ({
          sub: 'google-user-123',
          email: 'player@example.com',
          email_verified: true,
          name: 'Player Example',
          picture: 'https://images.example.com/player.png',
        }),
      };
    }
    throw new Error(`Unexpected fetch ${target}`);
  };

  try {
    const callbackRes = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = { ...this.headers, ...headers };
      },
      end() {},
    };
    await runtime.handleGoogleCallback(
      {
        headers: {
          host: 'player.example.com',
        },
      },
      callbackRes,
      new URL(`https://player.example.com/auth/google/callback?state=${encodeURIComponent(state)}&code=oauth-code`),
    );

    assert.equal(callbackRes.statusCode, 302);
    assert.equal(callbackRes.headers.Location, '/player');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].provider, 'google');
    assert.equal(calls[0].providerUserId, 'google-user-123');

    const cookieHeader = String(callbackRes.headers['Set-Cookie'] || '');
    const sessionCookie = cookieHeader.split(';')[0];
    const session = runtime.getSession({
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(session.discordId, '123456789012345678');
    assert.equal(session.authMethod, 'google-oauth');
    assert.equal(session.primaryEmail, 'player@example.com');
    assert.equal(session.platformUserId, 'platform-user-99');
    assert.equal(session.platformProfileId, 'player-profile-99');
    assert.equal(session.tenantId, 'tenant-prod-1');
  } finally {
    global.fetch = originalFetch;
  }
});

test('portal auth runtime rejects google callback when linked discord identity is missing', async () => {
  const runtime = createRuntime({
    getPlatformUserIdentitySummary: async () => ({
      ok: true,
      user: { id: 'platform-user-7', primaryEmail: 'player@example.com' },
      profile: { id: 'player-profile-7', tenantId: 'tenant-prod-1', discordUserId: null },
      identitySummary: {
        linkedAccounts: {
          discord: {
            value: null,
          },
        },
        activeMembership: {
          tenantId: 'tenant-prod-1',
        },
      },
    }),
  });

  const startRes = {
    statusCode: 200,
    headers: {},
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end() {},
  };
  await runtime.handleGoogleStart({}, startRes);
  const state = new URL(String(startRes.headers.Location || '')).searchParams.get('state');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'google-token' }),
      };
    }
    if (target.includes('openidconnect.googleapis.com/v1/userinfo')) {
      return {
        ok: true,
        json: async () => ({
          sub: 'google-user-456',
          email: 'player@example.com',
          email_verified: true,
          name: 'Player Example',
        }),
      };
    }
    throw new Error(`Unexpected fetch ${target}`);
  };

  try {
    const callbackRes = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = { ...this.headers, ...headers };
      },
      end() {},
    };
    await runtime.handleGoogleCallback(
      { headers: { host: 'player.example.com' } },
      callbackRes,
      new URL(`https://player.example.com/auth/google/callback?state=${encodeURIComponent(state)}&code=oauth-code`),
    );

    assert.equal(callbackRes.statusCode, 302);
    assert.equal(
      callbackRes.headers.Location,
      '/player/login?error=Google%20account%20must%20be%20linked%20to%20a%20Discord%20player%20identity',
    );
  } finally {
    global.fetch = originalFetch;
  }
});
