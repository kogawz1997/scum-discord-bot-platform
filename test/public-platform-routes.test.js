const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPublicPlatformRoutes,
} = require('../apps/web-portal-standalone/api/publicPlatformRoutes');

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

test('public platform routes set preview session cookie on signup and clear it on logout', async () => {
  const route = createPublicPlatformRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({
      email: 'demo@example.com',
      password: 'strong-pass-123',
    }),
    getPlatformPublicOverview: async () => ({
      billing: {
        packages: [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }],
        features: [],
        plans: [],
      },
    }),
    registerPreviewAccount: async () => ({
      ok: true,
      account: { id: 'preview-1', email: 'demo@example.com', tenantId: 'tenant-1' },
      tenant: { id: 'tenant-1' },
      subscription: { id: 'sub-1' },
    }),
    authenticatePreviewAccount: async () => ({ ok: false, reason: 'invalid-credentials' }),
    getPreviewState: async () => ({ ok: true, state: { account: { id: 'preview-1' } }, packageCatalog: [] }),
    requestPasswordReset: async () => ({ ok: true }),
    createPreviewSession: () => 'preview-session-1',
    getPreviewSession: () => null,
    buildPreviewSessionCookie: () => 'preview_cookie=session; Path=/; HttpOnly',
    buildClearPreviewSessionCookie: () => 'preview_cookie=; Path=/; Max-Age=0',
    removePreviewSession: () => {},
  });

  const signupRes = createResponse();
  const handledSignup = await route({
    req: {},
    res: signupRes,
    pathname: '/api/public/signup',
    method: 'POST',
  });

  assert.equal(handledSignup, true);
  assert.equal(signupRes.statusCode, 200);
  assert.equal(signupRes.headers['Set-Cookie'], 'preview_cookie=session; Path=/; HttpOnly');
  assert.equal(signupRes.payload.data.nextUrl, '/preview');

  const loginRes = createResponse();
  const handledLogin = await route({
    req: {},
    res: loginRes,
    pathname: '/api/public/login',
    method: 'POST',
  });

  assert.equal(handledLogin, true);
  assert.equal(loginRes.statusCode, 401);
  assert.equal(loginRes.payload.error, 'invalid-credentials');

  const sessionRes = createResponse();
  const handledSession = await route({
    req: {},
    res: sessionRes,
    pathname: '/api/public/session',
    method: 'GET',
  });

  assert.equal(handledSession, true);
  assert.equal(sessionRes.statusCode, 200);
  assert.equal(sessionRes.payload.data.session, null);

  const logoutRes = createResponse();
  const handledLogout = await route({
    req: {},
    res: logoutRes,
    pathname: '/api/public/logout',
    method: 'POST',
  });

  assert.equal(handledLogout, true);
  assert.equal(logoutRes.statusCode, 200);
  assert.equal(logoutRes.headers['Set-Cookie'], 'preview_cookie=; Path=/; Max-Age=0');
});
