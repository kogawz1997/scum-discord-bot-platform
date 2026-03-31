const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPortalRequestRuntime,
} = require('../apps/web-portal-standalone/runtime/portalRequestRuntime');

function createResponse() {
  return {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    payload: null,
  };
}

function createSendJson(res) {
  return (target, statusCode, payload) => {
    const output = target || res;
    output.statusCode = statusCode;
    output.payload = payload;
    output.headersSent = true;
    output.writableEnded = true;
    return output;
  };
}

test('portal request runtime rejects cross-site player api requests', async () => {
  const res = createResponse();
  const runtime = createPortalRequestRuntime({
    sendJson: createSendJson(res),
    verifyOrigin: () => false,
    getSession: () => ({ discordId: '123456789012345678' }),
    isDiscordId: () => true,
    handlePortalPageRoute: async () => false,
    handlePlayerGeneralRoute: async () => false,
    handlePlayerCommerceRoute: async () => false,
    cleanupRuntimeState: () => {},
    cleanupIntervalMs: 1000,
  });

  await runtime.handlePlayerApi(
    { method: 'POST', url: '/player/api/me' },
    res,
    new URL('http://player.local/player/api/me'),
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    ok: false,
    error: 'Cross-site request denied',
  });
});

test('portal request runtime returns 404 for unknown non-api routes', async () => {
  const res = createResponse();
  const runtime = createPortalRequestRuntime({
    sendJson: createSendJson(res),
    verifyOrigin: () => true,
    getSession: () => null,
    isDiscordId: () => false,
    handlePortalPageRoute: async () => false,
    handlePlayerGeneralRoute: async () => false,
    handlePlayerCommerceRoute: async () => false,
    cleanupRuntimeState: () => {},
    cleanupIntervalMs: 1000,
  });

  await runtime.requestHandler({ method: 'GET', url: '/missing' }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.payload, {
    ok: false,
    error: 'Not found',
  });
});

test('portal request runtime converts player api exceptions into 500 responses', async () => {
  const res = createResponse();
  const runtime = createPortalRequestRuntime({
    sendJson: createSendJson(res),
    verifyOrigin: () => true,
    getSession: () => ({ discordId: '123456789012345678' }),
    isDiscordId: () => true,
    handlePortalPageRoute: async () => false,
    handlePlayerGeneralRoute: async () => {
      throw new Error('boom');
    },
    handlePlayerCommerceRoute: async () => false,
    cleanupRuntimeState: () => {},
    cleanupIntervalMs: 1000,
  });

  await runtime.requestHandler({ method: 'GET', url: '/player/api/me' }, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, {
    ok: false,
    error: 'Internal server error',
  });
});

test('portal request runtime allows unauthenticated player email auth request routes', async () => {
  const res = createResponse();
  const calls = [];
  const runtime = createPortalRequestRuntime({
    sendJson: createSendJson(res),
    verifyOrigin: () => true,
    getSession: () => null,
    isDiscordId: () => false,
    handlePortalPageRoute: async () => false,
    handlePlayerGeneralRoute: async (context) => {
      calls.push({
        pathname: context.pathname,
        method: context.method,
        session: context.session,
      });
      context.res.statusCode = 200;
      context.res.payload = {
        ok: true,
        data: { requested: true },
      };
      context.res.headersSent = true;
      context.res.writableEnded = true;
      return true;
    },
    handlePlayerCommerceRoute: async () => false,
    cleanupRuntimeState: () => {},
    cleanupIntervalMs: 1000,
  });

  await runtime.requestHandler(
    {
      method: 'POST',
      url: '/player/api/auth/email/request',
      headers: {
        host: '127.0.0.1:3300',
        origin: 'http://127.0.0.1:3300',
      },
      socket: {
        encrypted: false,
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    ok: true,
    data: { requested: true },
  });
  assert.deepEqual(calls, [
    {
      pathname: '/player/api/auth/email/request',
      method: 'POST',
      session: null,
    },
  ]);
});

test('portal request runtime rejects cross-site public api writes', async () => {
  const res = createResponse();
  const runtime = createPortalRequestRuntime({
    sendJson: createSendJson(res),
    verifyOrigin: () => false,
    getSession: () => null,
    isDiscordId: () => false,
    handlePublicApiRoute: async () => true,
    handlePortalPageRoute: async () => false,
    handlePlayerGeneralRoute: async () => false,
    handlePlayerCommerceRoute: async () => false,
    cleanupRuntimeState: () => {},
    cleanupIntervalMs: 1000,
  });

  await runtime.requestHandler({ method: 'POST', url: '/api/public/signup' }, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    ok: false,
    error: 'Cross-site request denied',
  });
});
