const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminPlatformPostRoutes,
} = require('../src/admin/api/adminPlatformPostRoutes');
const {
  createAdminGetRoutes,
} = require('../src/admin/api/adminGetRoutes');
const {
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');
const {
  buildTenantActorAccessSummary,
  buildTenantRoleMatrix,
} = require('../src/services/platformTenantAccessService');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = null) {
      this.ended = true;
      this.body = body;
    },
  };
}

function buildPostRoutes(overrides = {}) {
  return createAdminPlatformPostRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    requiredString(value, key) {
      if (value && typeof value === 'object' && key) {
        return String(value[key] || '').trim();
      }
      return String(value || '').trim();
    },
    parseStringArray: () => [],
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    createAdminBackup: async () => ({}),
    previewAdminBackupRestore: async () => ({}),
    restoreAdminBackup: async () => ({}),
    getCurrentObservabilitySnapshot: async () => ({}),
    publishAdminLiveUpdate: () => {},
    createTenant: async () => ({ ok: true }),
    createPackageCatalogEntry: async (payload) => ({ ok: true, package: { ...payload, id: payload.id || 'PKG_TEST' } }),
    createSubscription: async () => ({ ok: true }),
    createCheckoutSession: async () => ({ ok: true, session: { checkoutUrl: 'https://checkout.example/session-1' }, invoice: { id: 'inv-1' } }),
    findPlanById: (planId) => {
      if (String(planId || '').trim() === 'platform-growth') {
        return { id: 'platform-growth', amountCents: 1290000, billingCycle: 'monthly', currency: 'THB' };
      }
      if (String(planId || '').trim() === 'platform-starter') {
        return { id: 'platform-starter', amountCents: 490000, billingCycle: 'monthly', currency: 'THB' };
      }
      return null;
    },
    resolvePackageForPlan: (planId) => ({ id: String(planId || '').trim() === 'platform-growth' ? 'FULL_OPTION' : 'BOT_LOG_DELIVERY' }),
    deletePackageCatalogEntry: async () => ({ ok: true, deletedPackageId: 'PKG_TEST' }),
    updateInvoiceStatus: async () => ({ ok: true, invoice: { id: 'inv-1', status: 'paid' } }),
    updatePaymentAttempt: async () => ({ ok: true, attempt: { id: 'pay-1', status: 'succeeded' } }),
    updateSubscriptionBillingState: async () => ({ ok: true, subscription: { id: 'sub-1' } }),
    issuePlatformLicense: async () => ({ ok: true }),
    listPlatformSubscriptions: async () => ([]),
    listPlatformLicenses: async () => ([]),
    acceptPlatformLicenseLegal: async () => ({ ok: true }),
    createPlatformApiKey: async () => ({ ok: true }),
    createPlatformWebhookEndpoint: async () => ({ ok: true }),
    getServerConfigJob: async () => ({
      id: 'cfgjob-1',
      tenantId: 'tenant-1',
      serverId: 'server-1',
      jobType: 'config_update',
      applyMode: 'save_only',
      status: 'failed',
      retryable: true,
    }),
    retryServerConfigJob: async () => ({ ok: true, job: { id: 'cfgjob-retry-1', status: 'queued' } }),
    dispatchPlatformWebhookEvent: async () => ([]),
    createMarketplaceOffer: async () => ({ ok: true }),
    reconcileDeliveryState: async () => ({ ok: true }),
    revokePlatformAgentRuntime: async () => ({ ok: true }),
    runPlatformMonitoringCycle: async () => ({ ok: true }),
    runPlatformAutomationCycle: async () => ({ ok: true, evaluated: [] }),
    acknowledgeAdminNotifications: () => ({}),
    clearAdminNotifications: () => ({}),
    buildTenantProductEntitlements,
    consumeAdminActionRateLimit: () => ({ limited: false, retryAfterMs: 0 }),
    getClientIp: () => '127.0.0.1',
    updatePackageCatalogEntry: async (payload) => ({ ok: true, package: payload }),
    prepareTransientDownload: (payload) => ({
      ok: true,
      token: 'download-token-1',
      filename: String(payload?.filename || 'download.txt').trim() || 'download.txt',
      expiresAt: '2026-03-30T00:00:00.000Z',
    }),
    ...overrides,
  });
}

function buildGetRoutes(overrides = {}) {
  return createAdminGetRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    sendDownload(res, statusCode, content, options = {}) {
      res.writeHead(statusCode, {
        'content-type': options.contentType || 'application/octet-stream',
        'content-disposition': options.filename
          ? `attachment; filename=\"${String(options.filename).replace(/"/g, '')}\"`
          : 'attachment',
      });
      res.end(content);
    },
    readJsonBody: async (req) => req?.body || {},
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    getAuthTenantId: (auth) => auth?.tenantId || null,
    resolveScopedTenantId: (_req, _res, auth, requestedTenantId) => requestedTenantId || auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    getPlatformAnalyticsOverview: async () => ({ subscriptions: { mrrCents: 0 } }),
    getPlatformPublicOverview: async () => ({ tenants: 0 }),
    getPlatformPermissionCatalog: () => [],
    getPlanCatalog: () => [],
    getPlatformOpsState: () => ({ lastMonitoringAt: '2026-03-19T00:00:00.000Z' }),
    getPlatformAutomationState: () => ({ lastAutomationAt: '2026-03-19T00:01:00.000Z' }),
    getPlatformAutomationConfig: () => ({ enabled: true, maxActionsPerCycle: 1, restartServices: ['worker'] }),
    getPlatformTenantConfig: async () => null,
    listServerConfigJobs: async () => [],
    listRestartPlans: async () => [],
    listRestartExecutions: async () => [],
    listBillingInvoices: async () => [],
    listBillingPaymentAttempts: async () => [],
    getBillingProviderConfigSummary: () => ({ provider: 'platform_local', mode: 'platform_local' }),
    listPlatformAgentRegistry: async () => [],
    listPlatformAgentProvisioningTokens: async () => [],
    listPlatformAgentDevices: async () => [],
    listPlatformAgentCredentials: async () => [],
    listAdminNotifications: () => [],
    getRuntimeSupervisorSnapshot: async () => null,
    getAdminRestoreState: () => ({}),
    jsonReplacer: null,
    filterRowsByTenantScope: (rows) => rows,
    consumeTransientDownload: () => null,
    ...overrides,
  });
}

test('admin platform automation route blocks tenant-scoped auth', async () => {
  const handler = buildPostRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/automation/run',
    body: {},
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.body || ''), /Tenant-scoped admin cannot run shared platform automation directly/i);
});

test('admin platform automation route forwards force and dry-run flags', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    runPlatformAutomationCycle: async (options) => {
      calls.push(options);
      return {
        ok: true,
        dryRun: options?.dryRun === true,
        evaluated: [],
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: { user: { id: 'client-1' } },
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/automation/run',
    body: { force: true, dryRun: true },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].force, true);
  assert.equal(calls[0].dryRun, true);
  assert.ok(calls[0].client);
});

test('admin platform package create route is owner-only and returns created package', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    createPackageCatalogEntry: async (payload) => {
      calls.push(payload);
      return {
        ok: true,
        package: {
          id: payload.id,
          title: payload.title,
          status: payload.status,
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/package',
    body: {
      id: 'PKG_OWNER',
      title: 'Owner Package',
      status: 'draft',
      description: 'Package from owner route test',
      features: ['sync_agent', 'analytics_module'],
      price: 99000,
      currency: 'THB',
      billingCycle: 'monthly',
      planId: 'owner-monthly',
      trialPlanId: 'owner-trial',
      limits: { agentRuntimes: 2 },
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 'PKG_OWNER');
  assert.deepEqual(calls[0].features, ['sync_agent', 'analytics_module']);
  assert.equal(calls[0].price, 99000);
  assert.equal(calls[0].planId, 'owner-monthly');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.id, 'PKG_OWNER');
});

test('admin platform package delete route blocks packages still in use', async () => {
  const handler = buildPostRoutes({
    listPlatformSubscriptions: async () => ([{
      id: 'sub-1',
      metadata: { packageId: 'PKG_IN_USE' },
    }]),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/package/delete',
    body: {
      packageId: 'PKG_IN_USE',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 409);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'package-in-use');
});

test('admin platform overview exposes automation state alongside ops state', async () => {
  const handler = buildGetRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/overview'),
    pathname: '/admin/api/platform/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.data?.opsState, 'object');
  assert.equal(typeof payload.data?.automationState, 'object');
  assert.equal(typeof payload.data?.automationConfig, 'object');
});

test('admin platform ops-state route includes automation details', async () => {
  const handler = buildGetRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/ops-state'),
    pathname: '/admin/api/platform/ops-state',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.data?.automation, 'object');
  assert.equal(typeof payload.data?.automationConfig, 'object');
});

test('admin platform restart plan route exposes filtered restart plans', async () => {
  const handler = buildGetRoutes({
    listRestartPlans: async (filters) => ([{
      id: 'rplan-1',
      tenantId: filters.tenantId,
      serverId: filters.serverId,
      status: filters.status || 'scheduled',
    }]),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/restart-plans?tenantId=tenant-1&serverId=server-1&status=scheduled'),
    pathname: '/admin/api/platform/restart-plans',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].tenantId, 'tenant-1');
  assert.equal(payload.data[0].serverId, 'server-1');
});

test('admin platform restart execution route exposes filtered execution history', async () => {
  const handler = buildGetRoutes({
    listRestartExecutions: async (filters) => ([{
      id: 'rexec-1',
      planId: filters.planId || 'rplan-1',
      tenantId: filters.tenantId,
      serverId: filters.serverId,
      resultStatus: filters.status || 'succeeded',
    }]),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/restart-executions?tenantId=tenant-1&serverId=server-1&planId=rplan-1&status=succeeded'),
    pathname: '/admin/api/platform/restart-executions',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].planId, 'rplan-1');
  assert.equal(payload.data[0].resultStatus, 'succeeded');
});

test('admin platform server config jobs route exposes filtered config jobs', async () => {
  const handler = buildGetRoutes({
    listServerConfigJobs: async (filters) => ([{
      id: 'cfgjob-1',
      tenantId: filters.tenantId,
      serverId: filters.serverId,
      status: 'failed',
      queueStatus: filters.queueStatus || 'failed',
    }]),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/servers/server-1/config/jobs?tenantId=tenant-1&queueStatus=failed&limit=12'),
    pathname: '/admin/api/platform/servers/server-1/config/jobs',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].serverId, 'server-1');
  assert.equal(payload.data[0].queueStatus, 'failed');
});

test('admin billing overview route falls back to empty summary when billing storage is unavailable', async () => {
  const handler = buildGetRoutes({
    listBillingInvoices: async () => {
      throw new Error('billing invoice store offline');
    },
    listBillingPaymentAttempts: async () => {
      throw new Error('billing attempts store offline');
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/overview'),
    pathname: '/admin/api/platform/billing/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.summary.invoiceCount, 0);
  assert.equal(payload.data.summary.failedAttemptCount, 0);
  assert.equal(payload.data.provider.provider, 'platform_local');
});

test('admin agent registry route falls back to empty list when registry readers are unavailable', async () => {
  const handler = buildGetRoutes({
    listPlatformAgentRegistry: async () => {
      throw new Error('control-plane registry offline');
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/agent-registry'),
    pathname: '/admin/api/platform/agent-registry',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data, []);
});

test('admin platform server control route queues start action for tenant scope', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    createServerBotActionJob: async (input, actor) => {
      calls.push({ input, actor });
      return { ok: true, job: { id: 'cfgjob-start-1', jobType: input.jobType } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-1/control/start',
    body: { tenantId: 'tenant-1' },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.tenantId, 'tenant-1');
  assert.equal(calls[0].input.serverId, 'server-1');
  assert.equal(calls[0].input.jobType, 'server_start');
  assert.match(calls[0].actor, /admin-web:tenant-admin/);
});

test('admin platform server restart route returns 429 when restart actions are rate limited', async () => {
  let scheduled = false;
  const handler = buildPostRoutes({
    consumeAdminActionRateLimit: () => ({
      limited: true,
      retryAfterMs: 30_000,
    }),
    scheduleRestartPlan: async () => {
      scheduled = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-1/restart',
    body: { tenantId: 'tenant-1', runtimeKey: 'server-bot-main' },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 429);
  assert.equal(scheduled, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, false);
  assert.equal(payload.retryAfterSec, 30);
});

test('admin platform server control route denies tenant action when restart entitlement is locked', async () => {
  let called = false;
  const handler = buildPostRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    createServerBotActionJob: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-1/control/start',
    body: { tenantId: 'tenant-1' },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_restart_server');
});

test('admin platform server probe route queues restart probe for tenant scope', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    createServerBotActionJob: async (input, actor) => {
      calls.push({ input, actor });
      return { ok: true, job: { id: 'cfgjob-probe-1', jobType: input.jobType } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-2/probes/restart',
    body: { tenantId: 'tenant-2' },
    res,
    auth: { user: 'tenant-owner', role: 'owner', tenantId: 'tenant-2' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.tenantId, 'tenant-2');
  assert.equal(calls[0].input.serverId, 'server-2');
  assert.equal(calls[0].input.jobType, 'probe_restart');
  assert.match(calls[0].actor, /admin-web:tenant-owner/);
});

test('admin platform config job retry route retries a failed config job', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    getServerConfigJob: async (input) => ({
      id: input.jobId,
      tenantId: input.tenantId,
      serverId: input.serverId,
      jobType: 'config_update',
      applyMode: 'save_restart',
      status: 'failed',
      retryable: true,
    }),
    retryServerConfigJob: async (input, actor) => {
      calls.push({ input, actor });
      return { ok: true, job: { id: 'cfgjob-retry-1', status: 'queued' } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-1/config/jobs/cfgjob-1/retry',
    body: { tenantId: 'tenant-1' },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.tenantId, 'tenant-1');
  assert.equal(calls[0].input.serverId, 'server-1');
  assert.equal(calls[0].input.jobId, 'cfgjob-1');
  assert.match(calls[0].actor, /admin-web:tenant-admin/);
});

test('admin platform config apply route rejects invalid apply modes', async () => {
  let created = false;
  const handler = buildPostRoutes({
    createServerConfigApplyJob: async () => {
      created = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/servers/server-1/config/apply',
    body: {
      tenantId: 'tenant-1',
      applyMode: 'unsafe_mode',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.equal(created, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'Invalid applyMode');
});

test('admin platform agent provision route denies Server Bot creation when sync entitlement is locked', async () => {
  let called = false;
  const handler = buildPostRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    createPlatformAgentProvisioningToken: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/agent-provision',
    body: {
      tenantId: 'tenant-1',
      role: 'sync',
      scope: 'sync_only',
      runtimeKind: 'server-bots',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_create_server_bot');
});

test('admin platform agent provision route rejects hybrid runtime profiles', async () => {
  let called = false;
  const handler = buildPostRoutes({
    createPlatformAgentProvisioningToken: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/agent-provision',
    body: {
      tenantId: 'tenant-1',
      serverId: 'server-1',
      agentId: 'agent-1',
      runtimeKey: 'agent-1',
      role: 'hybrid',
      scope: 'sync_execute',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'strict-agent-role-scope-required');
});

test('admin platform runtime revoke route forwards tenant-scoped runtime references', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    revokePlatformAgentRuntime: async (input, actor) => {
      calls.push({ input, actor });
      return { ok: true, revoked: { deviceId: input.deviceId, apiKeyId: input.apiKeyId } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/agent-runtime/revoke',
    body: {
      tenantId: 'tenant-1',
      runtimeKind: 'server-bots',
      deviceId: 'device-1',
      apiKeyId: 'apikey-1',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.tenantId, 'tenant-1');
  assert.equal(calls[0].input.runtimeKind, 'server-bots');
  assert.equal(calls[0].input.deviceId, 'device-1');
  assert.equal(calls[0].input.apiKeyId, 'apikey-1');
  assert.match(calls[0].actor, /admin-web:tenant-admin/);
});

test('admin platform runtime download prepare route returns a signed download URL', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    prepareTransientDownload: (payload, context) => {
      calls.push({ payload, context });
      return {
        ok: true,
        token: 'download-token-42',
        filename: payload.filename,
        expiresAt: '2026-03-30T12:00:00.000Z',
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/runtime-download/prepare',
    body: {
      tenantId: 'tenant-1',
      filename: 'server-bot-server-bot.ps1',
      content: 'Write-Host hello',
      mimeType: 'text/plain;charset=utf-8',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.filename, 'server-bot-server-bot.ps1');
  assert.equal(calls[0].context.user, 'tenant-admin');
  assert.equal(calls[0].context.tenantId, 'tenant-1');
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.downloadEndpoint, '/admin/api/platform/runtime-download');
  assert.equal(payload.data.downloadMethod, 'POST');
  assert.equal(payload.data.downloadToken, 'download-token-42');
});

test('admin platform runtime download route streams attachment with filename', async () => {
  const handler = buildGetRoutes({
    consumeTransientDownload: (token, context) => {
      assert.equal(token, 'download-token-42');
      assert.equal(context.user, 'tenant-admin');
      assert.equal(context.tenantId, 'tenant-1');
      return {
        body: Buffer.from('Write-Host hello', 'utf8'),
        filename: 'server-bot-server-bot.ps1',
        contentType: 'text/plain;charset=utf-8',
      };
    },
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {}, body: { token: 'download-token-42' } },
    res,
    urlObj: new URL('https://tenant.example.com/admin/api/platform/runtime-download'),
    pathname: '/admin/api/platform/runtime-download',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'text/plain;charset=utf-8');
  assert.match(String(res.headers['content-disposition'] || ''), /server-bot-server-bot\.ps1/);
  assert.equal(String(res.body || ''), 'Write-Host hello');
});

test('admin platform subscription update route allows owner to change package assignment', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    updateSubscriptionBillingState: async (input) => {
      calls.push(input);
      return {
        ok: true,
        subscription: {
          id: input.subscriptionId || 'sub-1',
          tenantId: input.tenantId,
          planId: input.planId,
          status: input.status,
          metadata: input.metadata,
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/subscription/update',
    body: {
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      planId: 'pro-monthly',
      status: 'active',
      packageId: 'PRO',
      metadata: { source: 'owner-panel' },
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantId, 'tenant-1');
  assert.equal(calls[0].metadata.packageId, 'PRO');
  assert.equal(calls[0].actor, 'owner-web:owner');
});

test('admin platform subscription create route forwards package assignment into billing lifecycle', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    createSubscription: async (input) => {
      calls.push(input);
      return {
        ok: true,
        subscription: {
          id: input.id || 'sub-1',
          tenantId: input.tenantId,
          planId: input.planId,
          packageId: input.packageId,
          metadata: input.metadata,
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/subscription',
    body: {
      id: 'sub-new-1',
      tenantId: 'tenant-1',
      planId: 'platform-starter',
      packageId: 'BOT_LOG_DELIVERY',
      billingCycle: 'monthly',
      status: 'active',
      currency: 'THB',
      amountCents: 490000,
      metadata: { source: 'owner-create' },
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].packageId, 'BOT_LOG_DELIVERY');
  assert.equal(calls[0].metadata.packageId, 'BOT_LOG_DELIVERY');
});

test('admin platform agent provision route denies Server Bot creation when subscription is expired', async () => {
  let called = false;
  const handler = buildPostRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      subscriptionStatus: 'expired',
      enabledFeatureKeys: ['sync_agent'],
    }),
    createPlatformAgentProvisioningToken: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/agent-provision',
    body: {
      tenantId: 'tenant-1',
      role: 'sync',
      scope: 'sync_only',
      runtimeKind: 'server-bots',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'feature-not-enabled');
  assert.equal(payload.data.actionKey, 'can_create_server_bot');
});

test('admin platform subscription update route blocks tenant-scoped admin', async () => {
  const handler = buildPostRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/subscription/update',
    body: {
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      planId: 'pro-monthly',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.body || ''), /cannot change platform subscriptions directly/i);
});

test('admin platform invoice update route allows owner billing actions', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    updateInvoiceStatus: async (input) => {
      calls.push(input);
      return { ok: true, invoice: { id: input.invoiceId, status: input.status } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/billing/invoice/update',
    body: {
      tenantId: 'tenant-1',
      invoiceId: 'inv-1',
      status: 'paid',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].invoiceId, 'inv-1');
  assert.equal(calls[0].status, 'paid');
  assert.equal(calls[0].actor, 'owner-web:owner');
});

test('admin platform invoice update route blocks tenant-scoped admin', async () => {
  const handler = buildPostRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/billing/invoice/update',
    body: {
      tenantId: 'tenant-1',
      invoiceId: 'inv-1',
      status: 'paid',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.match(String(res.body || ''), /cannot change platform invoices directly/i);
});

test('admin platform payment attempt update route allows owner billing actions', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    updatePaymentAttempt: async (input) => {
      calls.push(input);
      return { ok: true, attempt: { id: input.attemptId, status: input.status } };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/billing/payment-attempt/update',
    body: {
      tenantId: 'tenant-1',
      attemptId: 'pay-1',
      status: 'failed',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].attemptId, 'pay-1');
  assert.equal(calls[0].status, 'failed');
  assert.equal(calls[0].actor, 'owner-web:owner');
});

test('admin platform checkout session route allows owner to retry checkout', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    createCheckoutSession: async (input) => {
      calls.push(input);
      return {
        ok: true,
        session: { checkoutUrl: 'https://checkout.example/retry' },
        invoice: { id: input.invoiceId || 'inv-1' },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/billing/checkout-session',
    body: {
      tenantId: 'tenant-1',
      idempotencyKey: 'idem-owner-checkout',
      invoiceId: 'inv-1',
      subscriptionId: 'sub-1',
      packageId: 'PRO',
      planId: 'pro-monthly',
      billingCycle: 'monthly',
      amountCents: 99000,
      currency: 'THB',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantId, 'tenant-1');
  assert.equal(calls[0].invoiceId, 'inv-1');
  assert.equal(calls[0].idempotencyKey, 'idem-owner-checkout');
  assert.equal(calls[0].planId, 'pro-monthly');
});

test('admin platform checkout session route allows tenant self-service upgrade', async () => {
  const calls = [];
  const handler = buildPostRoutes({
    listPlatformSubscriptions: async () => ([
      {
        id: 'sub-tenant-1',
        tenantId: 'tenant-1',
        planId: 'platform-starter',
        packageId: 'BOT_LOG_DELIVERY',
      },
    ]),
    createCheckoutSession: async (input) => {
      calls.push(input);
      return {
        ok: true,
        session: { checkoutUrl: 'https://checkout.example/tenant-upgrade' },
        invoice: { id: 'inv-upgrade' },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/billing/checkout-session',
    body: {
      tenantId: 'tenant-1',
      idempotencyKey: 'idem-tenant-upgrade',
      planId: 'platform-growth',
    },
    res,
    auth: { user: 'tenant-admin', role: 'admin', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantId, 'tenant-1');
  assert.equal(calls[0].subscriptionId, 'sub-tenant-1');
  assert.equal(calls[0].idempotencyKey, 'idem-tenant-upgrade');
  assert.equal(calls[0].planId, 'platform-growth');
  assert.equal(calls[0].packageId, 'FULL_OPTION');
  assert.equal(calls[0].amountCents, 1290000);
});

test('admin platform agent provision route allows owner without tenant entitlement checks', async () => {
  let called = false;
  const handler = buildPostRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: [],
    }),
    createPlatformAgentProvisioningToken: async () => {
      called = true;
      return {
        ok: true,
        rawSetupToken: 'stp_demo.token',
        bootstrap: {
          runtimeKey: 'sync-runtime',
          agentId: 'sync-1',
        },
      };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/agent-provision',
    body: {
      tenantId: 'tenant-1',
      serverId: 'server-1',
      guildId: 'guild-1',
      agentId: 'sync-1',
      runtimeKey: 'sync-runtime',
      role: 'sync',
      scope: 'sync_only',
      runtimeKind: 'server-bots',
    },
    res,
    auth: { user: 'owner', role: 'owner', tenantId: null },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(called, true);
});

test('admin platform tenant role matrix route returns fixed tenant role definitions', async () => {
  const handler = buildGetRoutes({
    buildTenantActorAccessSummary,
    buildTenantRoleMatrix,
    ensureRole: () => ({ user: 'tenant-admin@example.com', role: 'admin', tenantId: 'tenant-1' }),
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://tenant.example.com/admin/api/platform/tenant-role-matrix?tenantId=tenant-1'),
    pathname: '/admin/api/platform/tenant-role-matrix',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, 'tenant-1');
  assert.equal(payload.data.currentAccess.role, 'admin');
  assert.deepEqual(payload.data.roles.map((entry) => entry.role), ['owner', 'admin', 'staff', 'viewer']);
});

test('admin platform tenant staff route denies viewer role from inviting tenant users', async () => {
  let called = false;
  const handler = buildPostRoutes({
    getTenantFeatureAccess: async () => ({
      tenantId: 'tenant-1',
      enabledFeatureKeys: ['staff_roles'],
    }),
    inviteTenantStaff: async () => {
      called = true;
      return { ok: true };
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'POST', headers: {} },
    pathname: '/admin/api/platform/tenant-staff',
    body: {
      tenantId: 'tenant-1',
      email: 'viewer-target@example.com',
      role: 'viewer',
    },
    res,
    auth: { user: 'tenant-viewer@example.com', role: 'viewer', tenantId: 'tenant-1' },
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.error, 'permission-denied');
  assert.equal(payload.data.permissionKey, 'manage_staff');
});
