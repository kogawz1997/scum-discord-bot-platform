const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');

const { prisma } = require('../src/prisma');
const {
  setAdminRestoreState,
} = require('../src/store/adminRestoreStateStore');
const {
  clearAdminRequestLogs,
} = require('../src/store/adminRequestLogStore');
const {
  clearAdminSecurityEvents,
} = require('../src/store/adminSecurityEventStore');
const {
  resetPlatformOpsState,
} = require('../src/store/platformOpsStateStore');
const {
  replaceDeliveryQueue,
  replaceDeliveryDeadLetters,
  flushDeliveryPersistenceWrites,
} = require('../src/services/rconDelivery');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');

function freshAdminWebServerModule() {
  delete require.cache[adminWebServerPath];
  return require(adminWebServerPath);
}

function randomPort(base = 40100, span = 500) {
  return base + Math.floor(Math.random() * span);
}

function resetAdminIntegrationRuntimeState() {
  setAdminRestoreState({
    status: 'idle',
    active: false,
    maintenance: false,
    backup: null,
    confirmBackup: null,
    rollbackBackup: null,
    actor: null,
    role: null,
    startedAt: null,
    endedAt: null,
    updatedAt: new Date().toISOString(),
    lastCompletedAt: null,
    durationMs: null,
    lastError: null,
    rollbackStatus: 'none',
    rollbackError: null,
    counts: null,
    currentCounts: null,
    diff: null,
    warnings: [],
    previewToken: null,
    previewBackup: null,
    previewIssuedAt: null,
    previewExpiresAt: null,
  });
  resetPlatformOpsState();
  clearAdminRequestLogs();
  clearAdminSecurityEvents();
  process.env.ADMIN_WEB_SSO_DISCORD_ENABLED = 'false';
  process.env.ADMIN_WEB_2FA_ENABLED = 'false';
}

test('tenant-scoped admin cannot cross tenant boundaries on platform read/write routes', async (t) => {
  resetAdminIntegrationRuntimeState();
  const port = randomPort();
  const ownerUser = `owner_boundary_${Date.now()}`;
  const tenantAdminUser = `tenant_admin_${Date.now()}`;
  const tenantOwnerUser = `tenant_owner_${Date.now()}`;
  const tenantId = `tenant-boundary-${Date.now()}`;
  const otherTenantId = `tenant-boundary-other-${Date.now()}`;
  const scopedPurchaseUserId = `tenant_purchase_user_${Date.now()}`;
  const sameTenantPurchaseCode = `P-TENANT-${Date.now()}`;
  const otherTenantPurchaseCode = `P-OTHER-${Date.now()}`;

  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_USER = ownerUser;
  process.env.ADMIN_WEB_PASSWORD = 'pass_boundary_owner';
  process.env.ADMIN_WEB_TOKEN = 'token_boundary_owner';
  process.env.ADMIN_WEB_USERS_JSON = '';

  const fakeClient = {
    guilds: { cache: new Map() },
    channels: { fetch: async () => null },
  };

  const { startAdminWebServer } = freshAdminWebServerModule();
  const server = startAdminWebServer(fakeClient);
  if (!server.listening) {
    await once(server, 'listening');
  }

  t.after(async () => {
    replaceDeliveryQueue([]);
    replaceDeliveryDeadLetters([]);
    await flushDeliveryPersistenceWrites().catch(() => null);
    await new Promise((resolve) => server.close(resolve));
    await prisma.platformMarketplaceOffer.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.platformApiKey.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.platformLicense.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.platformSubscription.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.platformWebhookEndpoint.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.purchaseStatusHistory.deleteMany({
      where: {
        purchaseCode: {
          in: [sameTenantPurchaseCode, otherTenantPurchaseCode],
        },
      },
    }).catch(() => null);
    await prisma.purchase.deleteMany({
      where: {
        code: {
          in: [sameTenantPurchaseCode, otherTenantPurchaseCode],
        },
      },
    }).catch(() => null);
    await prisma.platformTenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => null);
    await prisma.$executeRawUnsafe(
      'DELETE FROM admin_web_users WHERE username IN ($1, $2, $3)',
      tenantAdminUser,
      tenantOwnerUser,
      ownerUser,
    ).catch(() => null);
    resetAdminIntegrationRuntimeState();
    delete require.cache[adminWebServerPath];
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  async function request(pathname, method = 'GET', body = null, cookie = '') {
    const headers = {};
    if (body != null) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  const ownerLogin = await request('/admin/api/login', 'POST', {
    username: ownerUser,
    password: 'pass_boundary_owner',
  });
  assert.equal(ownerLogin.res.status, 200);
  const ownerCookie = String(ownerLogin.res.headers.get('set-cookie') || '').split(';')[0];

  for (const id of [tenantId, otherTenantId]) {
    const tenantRes = await request('/admin/api/platform/tenant', 'POST', {
      id,
      name: id,
      slug: id,
      type: 'trial',
      status: 'active',
      locale: 'th',
      ownerEmail: `${id}@example.com`,
    }, ownerCookie);
    assert.equal(tenantRes.res.status, 200);
  }

  const tenantUserRes = await request('/admin/api/auth/user', 'POST', {
    username: tenantAdminUser,
    role: 'admin',
    password: 'pass_boundary_tenant',
    isActive: true,
    tenantId,
  }, ownerCookie);
  assert.equal(tenantUserRes.res.status, 200);
  assert.equal(String(tenantUserRes.data.data?.tenantId || ''), tenantId);

  const tenantOwnerRes = await request('/admin/api/auth/user', 'POST', {
    username: tenantOwnerUser,
    role: 'owner',
    password: 'pass_boundary_tenant_owner',
    isActive: true,
    tenantId,
  }, ownerCookie);
  assert.equal(tenantOwnerRes.res.status, 200);
  assert.equal(String(tenantOwnerRes.data.data?.tenantId || ''), tenantId);

  const tenantLogin = await request('/admin/api/login', 'POST', {
    username: tenantAdminUser,
    password: 'pass_boundary_tenant',
  });
  assert.equal(tenantLogin.res.status, 200);
  const tenantCookie = String(tenantLogin.res.headers.get('set-cookie') || '').split(';')[0];

  const tenantOwnerLogin = await request('/admin/api/login', 'POST', {
    username: tenantOwnerUser,
    password: 'pass_boundary_tenant_owner',
  });
  assert.equal(tenantOwnerLogin.res.status, 200);
  const tenantOwnerCookie = String(tenantOwnerLogin.res.headers.get('set-cookie') || '').split(';')[0];

  const scopedSnapshot = await request('/admin/api/snapshot', 'GET', null, tenantCookie);
  assert.equal(scopedSnapshot.res.status, 403);
  assert.match(String(scopedSnapshot.data.error || ''), /shared runtime snapshots/i);

  const scopedSnapshotExport = await request('/admin/api/snapshot/export', 'GET', null, tenantCookie);
  assert.equal(scopedSnapshotExport.res.status, 403);
  assert.match(String(scopedSnapshotExport.data.error || ''), /shared runtime snapshots/i);

  const scopedBackupList = await request('/admin/api/backup/list', 'GET', null, tenantOwnerCookie);
  assert.equal(scopedBackupList.res.status, 403);
  assert.match(String(scopedBackupList.data.error || ''), /shared backups/i);

  const scopedBackupStatus = await request('/admin/api/backup/restore/status', 'GET', null, tenantOwnerCookie);
  assert.equal(scopedBackupStatus.res.status, 403);
  assert.match(String(scopedBackupStatus.data.error || ''), /shared backups/i);

  const scopedBackupHistory = await request('/admin/api/backup/restore/history', 'GET', null, tenantOwnerCookie);
  assert.equal(scopedBackupHistory.res.status, 403);
  assert.match(String(scopedBackupHistory.data.error || ''), /shared restore history/i);

  const scopedBackupCreate = await request('/admin/api/backup/create', 'POST', {
    note: 'tenant-scoped-should-fail',
  }, tenantOwnerCookie);
  assert.equal(scopedBackupCreate.res.status, 403);
  assert.match(String(scopedBackupCreate.data.error || ''), /shared backups/i);

  const scopedBackupRestore = await request('/admin/api/backup/restore', 'POST', {
    backup: 'tenant-scoped-should-fail',
    dryRun: true,
  }, tenantOwnerCookie);
  assert.equal(scopedBackupRestore.res.status, 403);
  assert.match(String(scopedBackupRestore.data.error || ''), /shared backups/i);

  const tenantConfigUpsert = await request('/admin/api/platform/tenant-config', 'POST', {
    tenantId,
    featureFlags: {
      tenantBoundaryTest: true,
    },
    configPatch: {
      platform: {
        tenantBoundaryTest: true,
      },
    },
  }, ownerCookie);
  assert.equal(tenantConfigUpsert.res.status, 200);

  await prisma.purchase.createMany({
    data: [
      {
        code: sameTenantPurchaseCode,
        tenantId,
        userId: scopedPurchaseUserId,
        itemId: 'tenant-boundary-item',
        price: 100,
        status: 'pending',
      },
      {
        code: otherTenantPurchaseCode,
        tenantId: otherTenantId,
        userId: scopedPurchaseUserId,
        itemId: 'tenant-boundary-item',
        price: 100,
        status: 'pending',
      },
    ],
  });
  await prisma.purchaseStatusHistory.createMany({
    data: [
      {
        purchaseCode: sameTenantPurchaseCode,
        fromStatus: null,
        toStatus: 'pending',
        reason: 'seed',
        actor: 'test-suite',
      },
      {
        purchaseCode: otherTenantPurchaseCode,
        fromStatus: null,
        toStatus: 'pending',
        reason: 'seed',
        actor: 'test-suite',
      },
    ],
  });

  replaceDeliveryQueue([
    {
      purchaseCode: sameTenantPurchaseCode,
      tenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      nextAttemptAt: Date.now() + 60_000,
    },
    {
      purchaseCode: otherTenantPurchaseCode,
      tenantId: otherTenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      nextAttemptAt: Date.now() + 60_000,
    },
  ]);
  replaceDeliveryDeadLetters([
    {
      purchaseCode: sameTenantPurchaseCode,
      tenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      reason: 'tenant-test',
    },
    {
      purchaseCode: otherTenantPurchaseCode,
      tenantId: otherTenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      reason: 'tenant-test',
    },
  ]);
  await flushDeliveryPersistenceWrites();

  const scopedQuota = await request(`/admin/api/platform/quota?tenantId=${encodeURIComponent(tenantId)}`, 'GET', null, tenantCookie);
  assert.equal(scopedQuota.res.status, 200);

  const scopedPurchaseList = await request(
    `/admin/api/purchase/list?userId=${encodeURIComponent(scopedPurchaseUserId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(scopedPurchaseList.res.status, 200);
  assert.ok(
    Array.isArray(scopedPurchaseList.data.data?.items)
      && scopedPurchaseList.data.data.items.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const scopedQueue = await request('/admin/api/delivery/queue', 'GET', null, tenantCookie);
  assert.equal(scopedQueue.res.status, 200);
  assert.deepEqual(
    Array.isArray(scopedQueue.data.data) ? scopedQueue.data.data.map((row) => String(row?.tenantId || '')) : [],
    [tenantId],
  );

  const scopedDeadLetter = await request('/admin/api/delivery/dead-letter', 'GET', null, tenantCookie);
  assert.equal(scopedDeadLetter.res.status, 200);
  assert.deepEqual(
    Array.isArray(scopedDeadLetter.data.data) ? scopedDeadLetter.data.data.map((row) => String(row?.tenantId || '')) : [],
    [tenantId],
  );

  const crossTenantPurchaseDetail = await request(
    `/admin/api/delivery/detail?code=${encodeURIComponent(otherTenantPurchaseCode)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantPurchaseDetail.res.status, 404);

  const crossTenantPurchaseStatus = await request('/admin/api/purchase/status', 'POST', {
    code: otherTenantPurchaseCode,
    status: 'delivered',
  }, tenantCookie);
  assert.equal(crossTenantPurchaseStatus.res.status, 404);

  const crossTenantRetry = await request('/admin/api/delivery/retry', 'POST', {
    code: otherTenantPurchaseCode,
  }, tenantCookie);
  assert.equal(crossTenantRetry.res.status, 404);

  const crossTenantDeadLetterDelete = await request('/admin/api/delivery/dead-letter/delete', 'POST', {
    code: otherTenantPurchaseCode,
  }, tenantCookie);
  assert.equal(crossTenantDeadLetterDelete.res.status, 404);

  const sameTenantSubscription = await request('/admin/api/platform/subscription', 'POST', {
    tenantId,
    id: `sub-${tenantId}`,
    planId: 'platform-starter',
    amountCents: 490000,
  }, ownerCookie);
  assert.equal(sameTenantSubscription.res.status, 200);

  const otherTenantSubscription = await request('/admin/api/platform/subscription', 'POST', {
    tenantId: otherTenantId,
    id: `sub-${otherTenantId}`,
    planId: 'platform-starter',
    amountCents: 490000,
  }, ownerCookie);
  assert.equal(otherTenantSubscription.res.status, 200);

  const sameTenantLicense = await request('/admin/api/platform/license', 'POST', {
    tenantId,
    id: `license-${tenantId}`,
    licenseKey: `LIC-${tenantId}`,
    seats: 2,
  }, ownerCookie);
  assert.equal(sameTenantLicense.res.status, 200);

  const otherTenantLicense = await request('/admin/api/platform/license', 'POST', {
    tenantId: otherTenantId,
    id: `license-${otherTenantId}`,
    licenseKey: `LIC-${otherTenantId}`,
    seats: 2,
  }, ownerCookie);
  assert.equal(otherTenantLicense.res.status, 200);

  const sameTenantApiKey = await request('/admin/api/platform/apikey', 'POST', {
    tenantId,
    id: `apikey-${tenantId}`,
    name: `key-${tenantId}`,
    scopes: ['tenant:read'],
  }, ownerCookie);
  assert.equal(sameTenantApiKey.res.status, 200);

  const otherTenantApiKey = await request('/admin/api/platform/apikey', 'POST', {
    tenantId: otherTenantId,
    id: `apikey-${otherTenantId}`,
    name: `key-${otherTenantId}`,
    scopes: ['tenant:read'],
  }, ownerCookie);
  assert.equal(otherTenantApiKey.res.status, 200);

  const sameTenantWebhook = await request('/admin/api/platform/webhook', 'POST', {
    tenantId,
    id: `webhook-${tenantId}`,
    name: `hook-${tenantId}`,
    eventType: 'platform.boundary.test',
    targetUrl: 'https://example.com/tenant-a',
    secretValue: 'secret-a',
  }, ownerCookie);
  assert.equal(sameTenantWebhook.res.status, 200);

  const otherTenantWebhook = await request('/admin/api/platform/webhook', 'POST', {
    tenantId: otherTenantId,
    id: `webhook-${otherTenantId}`,
    name: `hook-${otherTenantId}`,
    eventType: 'platform.boundary.test',
    targetUrl: 'https://example.com/tenant-b',
    secretValue: 'secret-b',
  }, ownerCookie);
  assert.equal(otherTenantWebhook.res.status, 200);

  const sameTenantMarketplace = await request('/admin/api/platform/marketplace', 'POST', {
    tenantId,
    id: `offer-${tenantId}`,
    title: `offer-${tenantId}`,
    kind: 'service',
    priceCents: 1000,
  }, ownerCookie);
  assert.equal(sameTenantMarketplace.res.status, 200);

  const otherTenantMarketplace = await request('/admin/api/platform/marketplace', 'POST', {
    tenantId: otherTenantId,
    id: `offer-${otherTenantId}`,
    title: `offer-${otherTenantId}`,
    kind: 'service',
    priceCents: 1000,
  }, ownerCookie);
  assert.equal(otherTenantMarketplace.res.status, 200);

  await prisma.platformAgentRuntime.createMany({
    data: [
      {
        id: `agent-${tenantId}`,
        tenantId,
        runtimeKey: `runtime-${tenantId}`,
        version: '1.0.0',
        status: 'online',
      },
      {
        id: `agent-${otherTenantId}`,
        tenantId: otherTenantId,
        runtimeKey: `runtime-${otherTenantId}`,
        version: '1.0.0',
        status: 'online',
      },
    ],
  });

  const crossQuota = await request(`/admin/api/platform/quota?tenantId=${encodeURIComponent(otherTenantId)}`, 'GET', null, tenantCookie);
  assert.equal(crossQuota.res.status, 403);
  assert.equal(String(crossQuota.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedWebhookTest = await request('/admin/api/platform/webhook/test', 'POST', {
    tenantId,
    eventType: 'platform.boundary.test',
    payload: { scope: 'same-tenant' },
  }, tenantCookie);
  assert.equal(scopedWebhookTest.res.status, 200);
  assert.equal(String(scopedWebhookTest.data.data?.tenantId || ''), tenantId);

  const crossWebhookTest = await request('/admin/api/platform/webhook/test', 'POST', {
    tenantId: otherTenantId,
    eventType: 'platform.boundary.test',
    payload: { scope: 'other-tenant' },
  }, tenantCookie);
  assert.equal(crossWebhookTest.res.status, 403);
  assert.equal(String(crossWebhookTest.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedControlPanel = await request('/admin/api/control-panel/settings', 'GET', null, tenantCookie);
  assert.equal(scopedControlPanel.res.status, 200);
  assert.equal(String(scopedControlPanel.data.data?.tenantScope?.tenantId || ''), tenantId);
  assert.deepEqual(scopedControlPanel.data.data?.env?.root || {}, {});
  assert.deepEqual(scopedControlPanel.data.data?.envCatalog?.root || [], []);

  const crossControlPanel = await request(
    `/admin/api/control-panel/settings?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossControlPanel.res.status, 403);
  assert.equal(String(crossControlPanel.data.error || ''), 'Forbidden: tenant scope mismatch');

  const tenantEnvWrite = await request('/admin/api/control-panel/env', 'POST', {
    root: {
      DISCORD_GUILD_ID: '999999999999999999',
    },
  }, tenantOwnerCookie);
  assert.equal(tenantEnvWrite.res.status, 403);
  assert.equal(
    String(tenantEnvWrite.data.error || ''),
    'Tenant-scoped admin cannot modify global environment settings',
  );

  const tenantConfigPatch = await request('/admin/api/config/patch', 'POST', {
    patch: {
      commands: {
        disabled: ['buy'],
      },
    },
  }, tenantOwnerCookie);
  assert.equal(tenantConfigPatch.res.status, 403);
  assert.equal(
    String(tenantConfigPatch.data.error || ''),
    'Tenant-scoped admin cannot patch global config directly',
  );

  const tenantRestart = await request('/admin/api/runtime/restart-service', 'POST', {
    service: 'worker',
  }, tenantOwnerCookie);
  assert.equal(tenantRestart.res.status, 403);
  assert.equal(
    String(tenantRestart.data.error || ''),
    'Tenant-scoped admin cannot restart shared runtime services',
  );

  const scopedTenantConfig = await request(
    `/admin/api/platform/tenant-config?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(scopedTenantConfig.res.status, 200);
  assert.equal(String(scopedTenantConfig.data.data?.tenantId || ''), tenantId);

  const crossTenantConfig = await request(
    `/admin/api/platform/tenant-config?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantConfig.res.status, 403);
  assert.equal(String(crossTenantConfig.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedTenantConfigList = await request('/admin/api/platform/tenant-configs', 'GET', null, tenantCookie);
  assert.equal(scopedTenantConfigList.res.status, 200);
  assert.ok(
    Array.isArray(scopedTenantConfigList.data.data)
      && scopedTenantConfigList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantConfigList = await request(
    `/admin/api/platform/tenant-configs?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantConfigList.res.status, 403);
  assert.equal(String(crossTenantConfigList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantWebhookList = await request(
    `/admin/api/platform/webhooks?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantWebhookList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantWebhookList.data.data)
      && sameTenantWebhookList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const sameTenantWebhookListOwner = await request(
    `/admin/api/platform/webhooks?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantOwnerCookie,
  );
  assert.equal(sameTenantWebhookListOwner.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantWebhookListOwner.data.data)
      && sameTenantWebhookListOwner.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantWebhookList = await request(
    `/admin/api/platform/webhooks?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantOwnerCookie,
  );
  assert.equal(crossTenantWebhookList.res.status, 403);
  assert.equal(String(crossTenantWebhookList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantSubscriptionList = await request(
    `/admin/api/platform/subscriptions?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantSubscriptionList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantSubscriptionList.data.data)
      && sameTenantSubscriptionList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantSubscriptionList = await request(
    `/admin/api/platform/subscriptions?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantSubscriptionList.res.status, 403);
  assert.equal(String(crossTenantSubscriptionList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantLicenseList = await request(
    `/admin/api/platform/licenses?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantLicenseList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantLicenseList.data.data)
      && sameTenantLicenseList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantLicenseList = await request(
    `/admin/api/platform/licenses?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantLicenseList.res.status, 403);
  assert.equal(String(crossTenantLicenseList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantApiKeyList = await request(
    `/admin/api/platform/apikeys?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantApiKeyList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantApiKeyList.data.data)
      && sameTenantApiKeyList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const sameTenantApiKeyListOwner = await request(
    `/admin/api/platform/apikeys?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantOwnerCookie,
  );
  assert.equal(sameTenantApiKeyListOwner.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantApiKeyListOwner.data.data)
      && sameTenantApiKeyListOwner.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantApiKeyList = await request(
    `/admin/api/platform/apikeys?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantOwnerCookie,
  );
  assert.equal(crossTenantApiKeyList.res.status, 403);
  assert.equal(String(crossTenantApiKeyList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantAgentList = await request(
    `/admin/api/platform/agents?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantAgentList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantAgentList.data.data)
      && sameTenantAgentList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantAgentList = await request(
    `/admin/api/platform/agents?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantAgentList.res.status, 403);
  assert.equal(String(crossTenantAgentList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantMarketplaceList = await request(
    `/admin/api/platform/marketplace?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantMarketplaceList.res.status, 200);
  assert.ok(
    Array.isArray(sameTenantMarketplaceList.data.data)
      && sameTenantMarketplaceList.data.data.every((row) => String(row?.tenantId || '') === tenantId),
  );

  const crossTenantMarketplaceList = await request(
    `/admin/api/platform/marketplace?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantMarketplaceList.res.status, 403);
  assert.equal(String(crossTenantMarketplaceList.data.error || ''), 'Forbidden: tenant scope mismatch');

  const sameTenantReconcile = await request(
    `/admin/api/platform/reconcile?tenantId=${encodeURIComponent(tenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(sameTenantReconcile.res.status, 200);
  assert.equal(String(sameTenantReconcile.data.data?.scope?.tenantId || ''), tenantId);

  const crossTenantReconcile = await request(
    `/admin/api/platform/reconcile?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantReconcile.res.status, 403);
  assert.equal(String(crossTenantReconcile.data.error || ''), 'Forbidden: tenant scope mismatch');

  const monitoringRes = await request('/admin/api/platform/monitoring/run', 'POST', {
  }, tenantCookie);
  assert.equal(monitoringRes.res.status, 403);
  assert.equal(
    String(monitoringRes.data.error || ''),
    'Tenant-scoped admin cannot run shared platform monitoring directly',
  );
});
