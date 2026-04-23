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

function buildRoute(overrides = {}) {
  return createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({}),
    normalizeText(value) {
      return String(value || '').trim();
    },
    getTenantFeatureAccess: async () => ({
      enabledFeatureKeys: ['support_module'],
      sections: {
        support: { enabled: true },
      },
      pages: {},
    }),
    ...overrides,
  });
}

test('player support ticket routes use platform user id fallback and list tickets', async () => {
  let received = null;
  const route = buildRoute({
    listSupportTicketsForUser(input) {
      received = input;
      return [{
        channelId: 'portal-ticket-1',
        category: 'support',
        reason: 'Need help',
        status: 'open',
      }];
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/support/tickets?limit=5'),
    pathname: '/player/api/support/tickets',
    method: 'GET',
    session: {
      user: 'MiraTH',
      role: 'player',
      discordId: 'discord-user-1',
      tenantId: 'tenant-prod-001',
      platformUserId: 'platform-user-1',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(received.userId, 'platform-user-1');
  assert.equal(received.tenantId, 'tenant-prod-001');
  assert.equal(res.payload.data.total, 1);
});

test('player support ticket create route opens a ticket from portal profile context', async () => {
  let created = null;
  const route = buildRoute({
    readJsonBody: async () => ({
      category: 'identity',
      reason: 'Please help verify my profile.',
    }),
    resolveSessionSteamLink: async () => ({
      linked: true,
      steamId: 'steam-76561198000000001',
      inGameName: 'MiraTH',
    }),
    getPlatformUserIdentitySummary: async () => ({
      identitySummary: {
        verificationState: 'email_verified',
        linkedAccounts: {
          email: {
            linked: true,
            verified: true,
            value: 'mira@example.com',
          },
          discord: {
            linked: true,
            verified: true,
            value: 'discord-user-1',
          },
          steam: {
            linked: true,
            verified: true,
            value: 'steam-76561198000000001',
          },
          inGame: {
            linked: true,
            verified: false,
            value: 'MiraTH',
          },
        },
      },
    }),
    listUserPurchases: async () => ([
      {
        purchaseCode: 'PUR-100',
        itemName: 'Starter Pack',
        status: 'delivering',
        createdAt: '2026-04-05T12:00:00Z',
      },
      {
        purchaseCode: 'PUR-099',
        itemName: 'Ammo Box',
        status: 'delivered',
        createdAt: '2026-04-04T12:00:00Z',
      },
    ]),
    createPlayerSupportTicket(input) {
      created = input;
      return {
        ok: true,
        ticket: {
          channelId: 'portal-ticket-1',
          category: 'identity',
          status: 'open',
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/support/tickets'),
    pathname: '/player/api/support/tickets',
    method: 'POST',
    session: {
      user: 'MiraTH',
      role: 'player',
      discordId: 'discord-user-1',
      tenantId: 'tenant-prod-001',
      platformUserId: 'platform-user-1',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(created.userId, 'platform-user-1');
  assert.equal(created.category, 'identity');
  assert.match(created.reason, /Please help verify my profile\./);
  assert.match(created.reason, /Portal context:/);
  assert.match(created.reason, /- Tenant: tenant-prod-001/);
  assert.match(created.reason, /- Verification: email_verified/);
  assert.match(created.reason, /- Email: linked, verified \(mira@example\.com\)/);
  assert.match(created.reason, /- Steam: linked, verified \(steam-76561198000000001\)/);
  assert.match(created.reason, /- In-game: linked, review needed \(MiraTH\)/);
  assert.match(created.reason, /- Orders: 2 total, 1 active, latest PUR-100 - Starter Pack \[delivering\]/);
  assert.equal(res.payload.data.ticket.channelId, 'portal-ticket-1');
});

test('player support ticket close route closes only the current player ticket', async () => {
  let closed = null;
  const route = buildRoute({
    readJsonBody: async () => ({
      channelId: 'portal-ticket-1',
    }),
    closeSupportTicketForUser(input) {
      closed = input;
      return {
        ok: true,
        ticket: {
          channelId: 'portal-ticket-1',
          status: 'closed',
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/support/tickets/close'),
    pathname: '/player/api/support/tickets/close',
    method: 'POST',
    session: {
      user: 'MiraTH',
      role: 'player',
      tenantId: 'tenant-prod-001',
      platformUserId: 'platform-user-1',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(closed.userId, 'platform-user-1');
  assert.equal(closed.channelId, 'portal-ticket-1');
  assert.equal(res.payload.data.ticket.status, 'closed');
});
