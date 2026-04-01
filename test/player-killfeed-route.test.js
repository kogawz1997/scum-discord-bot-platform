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

test('player killfeed route returns recent combat entries and marks player involvement', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['event_module'],
    }),
    listKillFeedEntries: async () => ([
      {
        id: 91,
        killerName: 'MiraTH',
        killerUserId: '123456789012345678',
        victimName: 'BanditX',
        victimUserId: '222222222222222222',
        weapon: 'AK-47',
        sector: 'B2',
        occurredAt: '2026-04-01T12:00:00.000Z',
      },
      {
        id: 92,
        killerName: 'HunterZ',
        killerUserId: '333333333333333333',
        victimName: 'MiraTH',
        victimUserId: '123456789012345678',
        weapon: 'M9',
        sector: 'C3',
        occurredAt: '2026-04-01T12:05:00.000Z',
      },
    ]),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/killfeed?limit=10'),
    pathname: '/player/api/killfeed',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      tenantId: 'tenant-prod-001',
      activeServerId: 'server-alpha',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.items.length, 2);
  assert.equal(res.payload.data.items[0].involvesPlayer, true);
  assert.equal(res.payload.data.items[0].playerRole, 'killer');
  assert.equal(res.payload.data.items[1].playerRole, 'victim');
});

test('player killfeed route denies access when event feature is disabled', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: [],
    }),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/killfeed'),
    pathname: '/player/api/killfeed',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'feature-not-enabled');
});
