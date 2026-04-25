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
  listAdminSecurityEvents,
  waitForAdminSecurityEventPersistence,
} = require('../src/store/adminSecurityEventStore');
const {
  mutateRegistry,
  waitForControlPlaneRegistryPersistence,
} = require('../src/data/repositories/controlPlaneRegistryRepository');
const {
  resetPlatformOpsState,
} = require('../src/store/platformOpsStateStore');
const {
  replaceDeliveryQueue,
  replaceDeliveryDeadLetters,
  flushDeliveryPersistenceWrites,
} = require('../src/services/rconDelivery');
const {
  recordRestartExecution,
  scheduleRestartPlan,
} = require('../src/services/platformRestartOrchestrationService');

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

async function replaceControlPlaneRegistryFixtures(rowsBySlice = {}) {
  mutateRegistry((registry) => ({
    ...registry,
    ...rowsBySlice,
  }));
  await waitForControlPlaneRegistryPersistence().catch(() => null);
}

async function clearControlPlaneRegistryTenantFixtures(tenantIds) {
  const scopedTenantIds = new Set(
    Array.isArray(tenantIds)
      ? tenantIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [],
  );
  if (scopedTenantIds.size === 0) return;
  mutateRegistry((registry) => ({
    ...registry,
    servers: (registry.servers || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    serverDiscordLinks: (registry.serverDiscordLinks || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agents: (registry.agents || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agentTokenBindings: (registry.agentTokenBindings || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agentProvisioningTokens: (registry.agentProvisioningTokens || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agentDevices: (registry.agentDevices || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agentCredentials: (registry.agentCredentials || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    agentSessions: (registry.agentSessions || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    syncRuns: (registry.syncRuns || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
    syncEvents: (registry.syncEvents || []).filter((row) => !scopedTenantIds.has(String(row?.tenantId || '').trim())),
  }));
  await waitForControlPlaneRegistryPersistence().catch(() => null);
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
    await clearControlPlaneRegistryTenantFixtures([tenantId, otherTenantId]).catch(() => null);
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

  async function assertTenantScopedPlatformList(pathname, cookie, expectedTenantId) {
    const scoped = await request(pathname, 'GET', null, cookie);
    assert.equal(scoped.res.status, 200);
    assert.ok(Array.isArray(scoped.data.data));
    assert.ok(scoped.data.data.length >= 1);
    assert.ok(
      scoped.data.data.every((row) => String(row?.tenantId || '') === expectedTenantId),
    );
  }

  async function assertCrossTenantPlatformListForbidden(pathname, cookie, scopedTenantId) {
    const crossTenant = await request(
      `${pathname}?tenantId=${encodeURIComponent(scopedTenantId)}`,
      'GET',
      null,
      cookie,
    );
    assert.equal(crossTenant.res.status, 403);
    assert.equal(String(crossTenant.data.error || ''), 'Forbidden: tenant scope mismatch');
  }

  async function assertOwnerGlobalPlatformList(pathname, cookie, expectedTenantIds) {
    const ownerList = await request(pathname, 'GET', null, cookie);
    assert.equal(ownerList.res.status, 200);
    assert.ok(Array.isArray(ownerList.data.data));
    assert.deepEqual(
      Array.from(new Set(ownerList.data.data.map((row) => String(row?.tenantId || '')))).sort(),
      expectedTenantIds.slice().sort(),
    );
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
  ], { tenantId });
  replaceDeliveryQueue([
    {
      purchaseCode: otherTenantPurchaseCode,
      tenantId: otherTenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      nextAttemptAt: Date.now() + 60_000,
    },
  ], { tenantId: otherTenantId });
  replaceDeliveryDeadLetters([
    {
      purchaseCode: sameTenantPurchaseCode,
      tenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      reason: 'tenant-test',
    },
  ], { tenantId });
  replaceDeliveryDeadLetters([
    {
      purchaseCode: otherTenantPurchaseCode,
      tenantId: otherTenantId,
      userId: scopedPurchaseUserId,
      itemId: 'tenant-boundary-item',
      attempts: 1,
      reason: 'tenant-test',
    },
  ], { tenantId: otherTenantId });
  await flushDeliveryPersistenceWrites();

  const registrySeedTimestamp = new Date().toISOString();
  await replaceControlPlaneRegistryFixtures({
    servers: [
      {
        id: `srv-${tenantId}`,
        tenantId,
        slug: `srv-${tenantId}`,
        name: 'Scoped Server',
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `srv-${otherTenantId}`,
        tenantId: otherTenantId,
        slug: `srv-${otherTenantId}`,
        name: 'Other Server',
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
    ],
    serverDiscordLinks: [
      {
        id: `link-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        guildId: `guild-${tenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `link-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        guildId: `guild-${otherTenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
    ],
    agents: [
      {
        id: `agent-row-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        runtimeKey: `runtime-${tenantId}`,
        role: 'execute_only',
        scope: 'tenant',
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `agent-row-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        runtimeKey: `runtime-${otherTenantId}`,
        role: 'sync_only',
        scope: 'tenant',
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
    ],
    agentProvisioningTokens: [
      {
        id: `token-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        tokenPrefix: `pref-${tenantId}`,
        tokenHash: `hash-${tenantId}`,
        role: 'execute_only',
        scope: 'tenant',
        status: 'pending_activation',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `token-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        tokenPrefix: `pref-${otherTenantId}`,
        tokenHash: `hash-${otherTenantId}`,
        role: 'sync_only',
        scope: 'tenant',
        status: 'pending_activation',
        updatedAt: registrySeedTimestamp,
      },
    ],
    agentDevices: [
      {
        id: `device-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `device-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
    ],
    agentCredentials: [
      {
        id: `cred-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        apiKeyId: `api-${tenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `cred-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        apiKeyId: `api-${otherTenantId}`,
        status: 'active',
        updatedAt: registrySeedTimestamp,
      },
    ],
    agentSessions: [
      {
        id: `session-${tenantId}`,
        sessionId: `session-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        heartbeatAt: registrySeedTimestamp,
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `session-${otherTenantId}`,
        sessionId: `session-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        heartbeatAt: registrySeedTimestamp,
        updatedAt: registrySeedTimestamp,
      },
    ],
    syncRuns: [
      {
        id: `sync-run-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        status: 'completed',
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `sync-run-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        status: 'completed',
        updatedAt: registrySeedTimestamp,
      },
    ],
    syncEvents: [
      {
        id: `sync-event-${tenantId}`,
        syncRunId: `sync-run-${tenantId}`,
        tenantId,
        serverId: `srv-${tenantId}`,
        agentId: `agent-${tenantId}`,
        kind: 'sync.completed',
        createdAt: registrySeedTimestamp,
        updatedAt: registrySeedTimestamp,
      },
      {
        id: `sync-event-${otherTenantId}`,
        syncRunId: `sync-run-${otherTenantId}`,
        tenantId: otherTenantId,
        serverId: `srv-${otherTenantId}`,
        agentId: `agent-${otherTenantId}`,
        kind: 'sync.completed',
        createdAt: registrySeedTimestamp,
        updatedAt: registrySeedTimestamp,
      },
    ],
  });

  const sameTenantRestartPlan = await scheduleRestartPlan({
    tenantId,
    serverId: `srv-${tenantId}`,
    restartMode: 'delayed',
    delaySeconds: 0,
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'boundary-test');
  assert.equal(sameTenantRestartPlan.ok, true);
  const otherTenantRestartPlan = await scheduleRestartPlan({
    tenantId: otherTenantId,
    serverId: `srv-${otherTenantId}`,
    restartMode: 'delayed',
    delaySeconds: 0,
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'boundary-test');
  assert.equal(otherTenantRestartPlan.ok, true);
  const sameTenantRestartExecution = await recordRestartExecution({
    planId: sameTenantRestartPlan.plan.id,
    tenantId,
    serverId: `srv-${tenantId}`,
    runtimeKey: `runtime-${tenantId}`,
    resultStatus: 'succeeded',
    action: 'restart',
  });
  assert.equal(sameTenantRestartExecution.ok, true);
  const otherTenantRestartExecution = await recordRestartExecution({
    planId: otherTenantRestartPlan.plan.id,
    tenantId: otherTenantId,
    serverId: `srv-${otherTenantId}`,
    runtimeKey: `runtime-${otherTenantId}`,
    resultStatus: 'succeeded',
    action: 'restart',
  });
  assert.equal(otherTenantRestartExecution.ok, true);

  const scopedQuota = await request(`/admin/api/platform/quota?tenantId=${encodeURIComponent(tenantId)}`, 'GET', null, tenantCookie);
  assert.equal(scopedQuota.res.status, 200);

  const scopedQuotaNoQuery = await request('/admin/api/platform/quota', 'GET', null, tenantCookie);
  assert.equal(scopedQuotaNoQuery.res.status, 200);

  const scopedTenants = await request('/admin/api/platform/tenants', 'GET', null, tenantCookie);
  assert.equal(scopedTenants.res.status, 200);
  assert.deepEqual(
    Array.isArray(scopedTenants.data.data) ? scopedTenants.data.data.map((row) => String(row?.id || '')) : [],
    [tenantId],
  );

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

  const scopedOverview = await request('/admin/api/platform/overview', 'GET', null, tenantCookie);
  assert.equal(scopedOverview.res.status, 200);
  assert.equal(String(scopedOverview.data.data?.analytics?.scope?.tenantId || ''), tenantId);
  assert.equal(Number(scopedOverview.data.data?.analytics?.tenants?.total || 0), 1);

  const scopedTenantFeatureAccess = await request('/admin/api/platform/tenant-feature-access', 'GET', null, tenantCookie);
  assert.equal(scopedTenantFeatureAccess.res.status, 200);
  assert.equal(String(scopedTenantFeatureAccess.data.data?.tenantId || ''), tenantId);

  const crossTenantFeatureAccess = await request(
    `/admin/api/platform/tenant-feature-access?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantFeatureAccess.res.status, 403);
  assert.equal(String(crossTenantFeatureAccess.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedTenantStaff = await request('/admin/api/platform/tenant-staff', 'GET', null, tenantCookie);
  assert.equal(scopedTenantStaff.res.status, 200);
  assert.ok(Array.isArray(scopedTenantStaff.data.data));

  const crossTenantStaff = await request(
    `/admin/api/platform/tenant-staff?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossTenantStaff.res.status, 403);
  assert.equal(String(crossTenantStaff.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedDiagnostics = await request('/admin/api/platform/tenant-diagnostics', 'GET', null, tenantCookie);
  assert.equal(scopedDiagnostics.res.status, 200);
  assert.equal(String(scopedDiagnostics.data.data?.tenantId || ''), tenantId);

  const crossDiagnostics = await request(
    `/admin/api/platform/tenant-diagnostics?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossDiagnostics.res.status, 403);
  assert.equal(String(crossDiagnostics.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedDeliveryLifecycle = await request('/admin/api/delivery/lifecycle', 'GET', null, tenantCookie);
  assert.equal(scopedDeliveryLifecycle.res.status, 200);
  assert.equal(String(scopedDeliveryLifecycle.data.data?.tenantId || ''), tenantId);

  const crossDeliveryLifecycle = await request(
    `/admin/api/delivery/lifecycle?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossDeliveryLifecycle.res.status, 403);
  assert.equal(String(crossDeliveryLifecycle.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedDonationOverview = await request('/admin/api/donations/overview', 'GET', null, tenantCookie);
  assert.equal(scopedDonationOverview.res.status, 200);
  assert.equal(String(scopedDonationOverview.data.data?.tenantId || ''), tenantId);

  const crossDonationOverview = await request(
    `/admin/api/donations/overview?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossDonationOverview.res.status, 403);
  assert.equal(String(crossDonationOverview.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedModuleOverview = await request('/admin/api/modules/overview', 'GET', null, tenantCookie);
  assert.equal(scopedModuleOverview.res.status, 200);
  assert.equal(String(scopedModuleOverview.data.data?.tenantId || ''), tenantId);

  const crossModuleOverview = await request(
    `/admin/api/modules/overview?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossModuleOverview.res.status, 403);
  assert.equal(String(crossModuleOverview.data.error || ''), 'Forbidden: tenant scope mismatch');

  const crossOverview = await request(
    `/admin/api/platform/overview?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossOverview.res.status, 403);
  assert.equal(String(crossOverview.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedBillingOverview = await request('/admin/api/platform/billing/overview', 'GET', null, tenantCookie);
  assert.equal(scopedBillingOverview.res.status, 200);
  assert.equal(scopedBillingOverview.data.ok, true);

  const crossBillingOverview = await request(
    `/admin/api/platform/billing/overview?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossBillingOverview.res.status, 403);
  assert.equal(String(crossBillingOverview.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedBillingInvoices = await request('/admin/api/platform/billing/invoices', 'GET', null, tenantCookie);
  assert.equal(scopedBillingInvoices.res.status, 200);
  assert.equal(scopedBillingInvoices.data.ok, true);
  assert.ok(Array.isArray(scopedBillingInvoices.data.data));

  const crossBillingInvoices = await request(
    `/admin/api/platform/billing/invoices?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossBillingInvoices.res.status, 403);
  assert.equal(String(crossBillingInvoices.data.error || ''), 'Forbidden: tenant scope mismatch');

  const scopedBillingAttempts = await request('/admin/api/platform/billing/payment-attempts', 'GET', null, tenantCookie);
  assert.equal(scopedBillingAttempts.res.status, 200);
  assert.equal(scopedBillingAttempts.data.ok, true);
  assert.ok(Array.isArray(scopedBillingAttempts.data.data));

  const crossBillingAttempts = await request(
    `/admin/api/platform/billing/payment-attempts?tenantId=${encodeURIComponent(otherTenantId)}`,
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(crossBillingAttempts.res.status, 403);
  assert.equal(String(crossBillingAttempts.data.error || ''), 'Forbidden: tenant scope mismatch');

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

  const scopedTenantConfigNoQuery = await request(
    '/admin/api/platform/tenant-config',
    'GET',
    null,
    tenantCookie,
  );
  assert.equal(scopedTenantConfigNoQuery.res.status, 200);
  assert.equal(String(scopedTenantConfigNoQuery.data.data?.tenantId || ''), tenantId);

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

  await assertTenantScopedPlatformList('/admin/api/platform/restart-plans', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/restart-executions', tenantCookie, tenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/restart-plans', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/restart-executions', tenantCookie, otherTenantId);

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

  await assertTenantScopedPlatformList('/admin/api/platform/subscriptions', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/licenses', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/apikeys', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/webhooks', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agents', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-runtimes', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/marketplace', tenantCookie, tenantId);

  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-runtimes', tenantCookie, otherTenantId);

  await assertTenantScopedPlatformList('/admin/api/platform/servers', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/server-discord-links', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-registry', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-provisioning', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-devices', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-credentials', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/agent-sessions', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/sync-runs', tenantCookie, tenantId);
  await assertTenantScopedPlatformList('/admin/api/platform/sync-events', tenantCookie, tenantId);

  await assertCrossTenantPlatformListForbidden('/admin/api/platform/servers', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/server-discord-links', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-registry', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-provisioning', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-devices', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-credentials', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/agent-sessions', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/sync-runs', tenantCookie, otherTenantId);
  await assertCrossTenantPlatformListForbidden('/admin/api/platform/sync-events', tenantCookie, otherTenantId);

  await assertOwnerGlobalPlatformList('/admin/api/platform/servers', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/server-discord-links', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/agent-registry', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/agent-provisioning', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/agent-devices', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/agent-credentials', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/agent-sessions', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/sync-runs', ownerCookie, [tenantId, otherTenantId]);
  await assertOwnerGlobalPlatformList('/admin/api/platform/sync-events', ownerCookie, [tenantId, otherTenantId]);

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

  const scopedReconcile = await request('/admin/api/platform/reconcile', 'GET', null, tenantCookie);
  assert.equal(scopedReconcile.res.status, 200);
  assert.equal(String(scopedReconcile.data.data?.scope?.tenantId || ''), tenantId);

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

  await waitForAdminSecurityEventPersistence();
  const securityEvents = await listAdminSecurityEvents({ limit: 100 });
  assert.ok(
    securityEvents.some((entry) => {
      return String(entry?.type || '') === 'tenant-scope-mismatch'
        && String(entry?.actor || '') === tenantAdminUser
        && String(entry?.reason || '') === 'tenant-scope-mismatch'
        && String(entry?.data?.authTenantId || '') === tenantId
        && String(entry?.data?.requestedTenantId || '') === otherTenantId;
    }),
  );
});
