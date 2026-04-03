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

test('public platform routes sign up real tenant owners and keep logout/reset endpoints working', async () => {
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
    buildAdminProductUrl: (pathname, search = '') => `https://admin.example.com${pathname}${search}`,
    registerTenantOwnerAccount: async () => ({
      ok: true,
      user: { id: 'platform-user-1', primaryEmail: 'demo@example.com' },
      tenant: { id: 'tenant-1' },
      subscription: { id: 'sub-1' },
      bootstrapToken: 'bootstrap-123',
    }),
    authenticatePreviewAccount: async () => ({ ok: false, reason: 'invalid-credentials' }),
    getPreviewState: async () => ({ ok: true, state: { account: { id: 'preview-1' } }, packageCatalog: [] }),
    requestEmailVerification: async () => ({ ok: true, requested: true, verificationTokenQueued: true }),
    completeEmailVerification: async () => ({ ok: true, nextUrl: '/login' }),
    requestPasswordReset: async () => ({ ok: true }),
    completePasswordReset: async () => ({ ok: true, nextUrl: '/login' }),
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
  assert.equal(signupRes.headers['Set-Cookie'], undefined);
  assert.equal(signupRes.headers['Cache-Control'], 'no-store');
  assert.equal(signupRes.payload.data.nextUrl, 'https://admin.example.com/tenant/onboarding');
  assert.equal(signupRes.payload.data.bootstrapToken, 'bootstrap-123');
  assert.equal(signupRes.payload.data.nextMethod, 'POST');

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

  const verificationRequestRes = createResponse();
  const handledVerificationRequest = await route({
    req: {},
    res: verificationRequestRes,
    pathname: '/api/public/email-verification-request',
    method: 'POST',
  });
  assert.equal(handledVerificationRequest, true);
  assert.equal(verificationRequestRes.statusCode, 200);
  assert.deepEqual(verificationRequestRes.payload.data, {
    queued: true,
  });

  const verificationCompleteRes = createResponse();
  const handledVerificationComplete = await route({
    req: {},
    res: verificationCompleteRes,
    pathname: '/api/public/email-verification-complete',
    method: 'POST',
  });
  assert.equal(handledVerificationComplete, true);
  assert.equal(verificationCompleteRes.statusCode, 200);

  const resetCompleteRes = createResponse();
  const handledResetComplete = await route({
    req: {},
    res: resetCompleteRes,
    pathname: '/api/public/password-reset-complete',
    method: 'POST',
  });
  assert.equal(handledResetComplete, true);
  assert.equal(resetCompleteRes.statusCode, 200);
});

test('public platform routes create and finalize checkout sessions for preview users', async () => {
  const route = createPublicPlatformRoutes({
    sendJson: createSendJson(),
    buildAdminProductUrl: (pathname, search = '') => `https://admin.example.com${pathname}${search}`,
    readJsonBody: async () => ({
      planId: 'platform-starter',
      action: 'paid',
      sessionToken: 'chk_test.token',
    }),
    getPlatformPublicOverview: async () => ({
      billing: {
        currency: 'THB',
        packages: [{ id: 'BOT_LOG_DELIVERY', title: 'Bot Log + Delivery' }],
        features: [],
        plans: [{ id: 'platform-starter', billingCycle: 'monthly', amountCents: 490000 }],
      },
    }),
    registerPreviewAccount: async () => ({ ok: false }),
    authenticatePreviewAccount: async () => ({ ok: false }),
    getPreviewState: async () => ({
      ok: true,
      state: {
        account: {
          id: 'preview-1',
          email: 'demo@example.com',
          tenantId: 'tenant-1',
          subscriptionId: 'sub-1',
          packageId: 'BOT_LOG_DELIVERY',
        },
        tenant: { tenantId: 'tenant-1' },
      },
      packageCatalog: [],
    }),
    requestEmailVerification: async () => ({ ok: true }),
    completeEmailVerification: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    completePasswordReset: async () => ({ ok: true }),
    createCheckoutSession: async () => ({
      ok: true,
      session: { sessionToken: 'chk_test.token', status: 'requires_action' },
      invoice: { id: 'inv-1' },
    }),
    getCheckoutSessionByToken: async () => ({
      sessionToken: 'chk_test.token',
      invoiceId: 'inv-1',
      status: 'requires_action',
    }),
    finalizeCheckoutSession: async () => ({
      ok: true,
      invoice: { id: 'inv-1', status: 'paid' },
      subscription: { id: 'sub-1', status: 'active' },
    }),
    processBillingWebhookEvent: async () => ({ ok: true }),
    billingWebhookSecret: 'secret',
    createPreviewSession: () => 'preview-session-1',
    getPreviewSession: () => ({ accountId: 'preview-1', tenantId: 'tenant-1' }),
    buildPreviewSessionCookie: () => 'preview_cookie=session; Path=/; HttpOnly',
    buildClearPreviewSessionCookie: () => 'preview_cookie=; Path=/; Max-Age=0',
    removePreviewSession: () => {},
  });

  const createRes = createResponse();
  const handledCreate = await route({
    req: { url: '/api/public/checkout/session' },
    res: createRes,
    pathname: '/api/public/checkout/session',
    method: 'POST',
  });
  assert.equal(handledCreate, true);
  assert.equal(createRes.statusCode, 200);
  assert.equal(createRes.payload.data.session.sessionToken, 'chk_test.token');

  const resolveRes = createResponse();
  const handledResolve = await route({
    req: { url: '/api/public/checkout/session/resolve' },
    res: resolveRes,
    pathname: '/api/public/checkout/session/resolve',
    method: 'POST',
  });
  assert.equal(handledResolve, true);
  assert.equal(resolveRes.statusCode, 200);
  assert.equal(resolveRes.payload.data.session.invoiceId, 'inv-1');

  const completeRes = createResponse();
  const handledComplete = await route({
    req: { url: '/api/public/checkout/complete' },
    res: completeRes,
    pathname: '/api/public/checkout/complete',
    method: 'POST',
  });
  assert.equal(handledComplete, true);
  assert.equal(completeRes.statusCode, 200);
  assert.equal(completeRes.payload.data.invoice.status, 'paid');
  assert.equal(completeRes.payload.data.nextUrl, 'https://admin.example.com/tenant/onboarding');

  const legacyGetRes = createResponse();
  const handledLegacyGet = await route({
    req: { url: '/api/public/checkout/session?token=chk_test.token' },
    res: legacyGetRes,
    pathname: '/api/public/checkout/session',
    method: 'GET',
  });
  assert.equal(handledLegacyGet, false);
  assert.equal(legacyGetRes.payload, null);

  const webhookRoute = createPublicPlatformRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({}),
    readRawBody: async () => Buffer.from('{"eventType":"invoice.paid"}', 'utf8'),
    getPlatformPublicOverview: async () => ({
      billing: {
        currency: 'THB',
        packages: [],
        features: [],
        plans: [],
      },
    }),
    registerPreviewAccount: async () => ({ ok: false }),
    authenticatePreviewAccount: async () => ({ ok: false }),
    getPreviewState: async () => ({ ok: false }),
    requestEmailVerification: async () => ({ ok: true }),
    completeEmailVerification: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    completePasswordReset: async () => ({ ok: true }),
    createCheckoutSession: async () => ({ ok: false }),
    getCheckoutSessionByToken: async () => null,
    finalizeCheckoutSession: async () => ({ ok: false }),
    processBillingWebhookEvent: async (input) => ({ ok: true, rawPayload: input.rawPayload, eventType: input.eventType }),
    billingWebhookSecret: 'secret',
    createPreviewSession: () => 'preview-session-1',
    getPreviewSession: () => ({ accountId: 'preview-1', tenantId: 'tenant-1' }),
    buildPreviewSessionCookie: () => 'preview_cookie=session; Path=/; HttpOnly',
    buildClearPreviewSessionCookie: () => 'preview_cookie=; Path=/; Max-Age=0',
    removePreviewSession: () => {},
  });
  const webhookRes = createResponse();
  const handledWebhook = await webhookRoute({
    req: {
      headers: {
        'x-platform-billing-signature': 'sig',
      },
    },
    res: webhookRes,
    pathname: '/api/public/billing/webhook',
    method: 'POST',
  });
  assert.equal(handledWebhook, true);
  assert.equal(webhookRes.statusCode, 200);
  assert.equal(webhookRes.payload.data.eventType, 'invoice.paid');
});

test('public platform routes expose tenant-isolated server workspace by slug', async () => {
  const route = createPublicPlatformRoutes({
    sendJson: createSendJson(),
    readJsonBody: async () => ({}),
    getPlatformPublicOverview: async () => ({ billing: { packages: [], features: [], plans: [] } }),
    getPlatformTenantBySlug: async (slug) => (
      slug === 'prime'
        ? { id: 'tenant-1', slug: 'prime', name: 'Prime SCUM' }
        : null
    ),
    getPlatformTenantConfig: async () => ({
      portalEnvPatch: {
        publicSiteName: 'Prime SCUM Public',
        publicSiteDetail: 'Official community server page',
        publicTheme: 'midnight-ops',
        publicPrimaryColor: '#3366ff',
      },
    }),
    listAllStats: () => ([
      { userId: 'alice', kills: 12, deaths: 3, playtimeMinutes: 240 },
      { userId: 'bob', kills: 7, deaths: 5, playtimeMinutes: 180 },
    ]),
    listShopItems: async () => ([
      { id: 'vip-gold', name: 'VIP Gold', description: 'Priority queue', kind: 'vip' },
      { id: 'kit-1', name: 'Starter Kit', description: 'Starter loadout', kind: 'item' },
    ]),
    filterShopItems: (rows, options = {}) => Array.isArray(rows)
      ? rows.slice(0, Number(options.limit || rows.length))
      : [],
    listServerEvents: async () => ([
      { id: 1, name: 'Weekend Raid', time: '2026-04-05T18:00:00Z', reward: 'Loot crate', status: 'scheduled' },
    ]),
    buildTenantDonationOverview: async () => ({
      summary: {
        supporterRevenueCoins30d: 9500,
        supporterPurchases30d: 4,
        lastPurchaseAt: '2026-04-02T12:30:00.000Z',
      },
      topPackages: [
        { itemName: 'VIP Gold', ordersCount: 4, revenueCoins: 9500 },
      ],
      recentPurchases: [
        { code: 'SUP-1', itemName: 'VIP Gold', price: 2500 },
      ],
      issues: [],
      readiness: { ready: true },
    }),
    listKillFeedEntries: async () => ([
      { killerName: 'Alice', victimName: 'Bob', weapon: 'AK-47' },
    ]),
    listServerRegistry: async () => ([
      { id: 'server-1', name: 'Prime EU #1', status: 'online', region: 'eu-west', guildLinks: [{ id: 'guild-link-1' }] },
    ]),
    registerPreviewAccount: async () => ({ ok: false }),
    authenticatePreviewAccount: async () => ({ ok: false }),
    getPreviewState: async () => ({ ok: false }),
    requestEmailVerification: async () => ({ ok: true }),
    completeEmailVerification: async () => ({ ok: true }),
    requestPasswordReset: async () => ({ ok: true }),
    completePasswordReset: async () => ({ ok: true }),
    createCheckoutSession: async () => ({ ok: false }),
    getCheckoutSessionByToken: async () => null,
    finalizeCheckoutSession: async () => ({ ok: false }),
    processBillingWebhookEvent: async () => ({ ok: true }),
    createPreviewSession: () => 'preview-session-1',
    getPreviewSession: () => null,
    buildPreviewSessionCookie: () => 'preview_cookie=session; Path=/; HttpOnly',
    buildClearPreviewSessionCookie: () => 'preview_cookie=; Path=/; Max-Age=0',
    removePreviewSession: () => {},
  });

  const workspaceRes = createResponse();
  const handledWorkspace = await route({
    req: {},
    res: workspaceRes,
    pathname: '/api/public/server/prime/workspace',
    method: 'GET',
  });

  assert.equal(handledWorkspace, true);
  assert.equal(workspaceRes.statusCode, 200);
  assert.equal(workspaceRes.payload.data.tenant.slug, 'prime');
  assert.equal(workspaceRes.payload.data.brand.siteName, 'Prime SCUM Public');
  assert.equal(workspaceRes.payload.data.overview.shopItemCount, 2);
  assert.equal(workspaceRes.payload.data.stats.topPlayers[0].userId, 'alice');
  assert.equal(workspaceRes.payload.data.events.total, 1);
  assert.equal(workspaceRes.payload.data.donate.summary.supporterRevenueCoins30d, 9500);

  const statsRes = createResponse();
  const handledStats = await route({
    req: {},
    res: statsRes,
    pathname: '/api/public/server/prime/stats',
    method: 'GET',
  });

  assert.equal(handledStats, true);
  assert.equal(statsRes.statusCode, 200);
  assert.equal(statsRes.payload.data.section, 'stats');
  assert.equal(statsRes.payload.data.stats.playersTracked, 2);

  const missingRes = createResponse();
  const handledMissing = await route({
    req: {},
    res: missingRes,
    pathname: '/api/public/server/missing/workspace',
    method: 'GET',
  });

  assert.equal(handledMissing, true);
  assert.equal(missingRes.statusCode, 404);
  assert.equal(missingRes.payload.error, 'tenant-not-found');
});
