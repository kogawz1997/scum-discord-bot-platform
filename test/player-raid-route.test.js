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

test('player raid routes return requests, windows, and summaries when events are enabled', async () => {
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['event_module'],
    }),
    listRaidRequests: async () => ([{ id: 11, requestText: 'Open west compound', status: 'pending' }]),
    listRaidWindows: async () => ([{ id: 21, title: 'Friday window', status: 'scheduled' }]),
    listRaidSummaries: async () => ([{ id: 31, outcome: 'Raid completed' }]),
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/raids'),
    pathname: '/player/api/raids',
    method: 'GET',
    session: {
      discordId: '123456789012345678',
      user: 'MiraTH',
      role: 'player',
      tenantId: 'tenant-prod-001',
    },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.data.myRequests.length, 1);
  assert.equal(res.payload.data.windows.length, 1);
  assert.equal(res.payload.data.summaries.length, 1);
});

test('player raid request route creates a request when events are enabled', async () => {
  let capturedPayload = null;
  const route = createPlayerGeneralRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({
      requestText: 'Need a review for the west compound after warm-up.',
      preferredWindow: 'Friday 21:00 ICT',
    }),
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-prod-001',
      enabledFeatureKeys: ['event_module'],
    }),
    createRaidRequest: async (payload) => {
      capturedPayload = payload;
      return {
        ok: true,
        request: {
          id: 11,
          ...payload,
          status: 'pending',
        },
      };
    },
  });

  const res = createResponse();
  const handled = await route({
    req: {},
    res,
    urlObj: createUrl('/player/api/raids/request'),
    pathname: '/player/api/raids/request',
    method: 'POST',
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
  assert.equal(capturedPayload.requesterUserId, '123456789012345678');
  assert.equal(capturedPayload.requesterName, 'MiraTH');
  assert.equal(capturedPayload.preferredWindow, 'Friday 21:00 ICT');
});

test('player raid routes deny access when event feature is disabled', async () => {
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
    urlObj: createUrl('/player/api/raids'),
    pathname: '/player/api/raids',
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
