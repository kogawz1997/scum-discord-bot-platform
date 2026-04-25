const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL
  || `file:${path.resolve(__dirname, '../prisma/prisma/test.db').replace(/\\/g, '/')}`;
process.env.PRISMA_TEST_DATABASE_PROVIDER = process.env.PRISMA_TEST_DATABASE_PROVIDER || 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = process.env.PRISMA_TEST_DATABASE_PROVIDER;
process.env.PRISMA_SCHEMA_PROVIDER = process.env.PRISMA_TEST_DATABASE_PROVIDER;
require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { once } = require('node:events');

const { prisma } = require('../src/prisma');
const { cleanupPlatformTenantFixtures } = require('./helpers/platformTestCleanup');
const {
  createPlatformAgentPresenceService,
} = require('../src/services/platformAgentPresenceService');
const {
  createPlatformServerConfigService,
} = require('../src/services/platformServerConfigService');
const {
  listRestartExecutions,
  listRestartPlans,
  verifyRestartPlanHealth,
} = require('../src/services/platformRestartOrchestrationService');

const adminWebServerPath = path.resolve(__dirname, '../src/adminWebServer.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const registryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');

function freshAdminWebServerModule() {
  for (const entry of [adminWebServerPath, persistPath, runtimeDataDirPath, registryPath]) {
    delete require.cache[entry];
  }
  return require(adminWebServerPath);
}

function randomPort() {
  return 41100 + Math.floor(Math.random() * 500);
}

async function cleanupGoldenPathFixtures(tenantId) {
  await prisma.$executeRaw`DELETE FROM platform_restart_announcements WHERE tenant_id = ${tenantId}`.catch(() => null);
  await prisma.$executeRaw`DELETE FROM platform_restart_executions WHERE tenant_id = ${tenantId}`.catch(() => null);
  await prisma.$executeRaw`DELETE FROM platform_restart_plans WHERE tenant_id = ${tenantId}`.catch(() => null);
  await prisma.$executeRaw`DELETE FROM platform_server_config_backups WHERE tenant_id = ${tenantId}`.catch(() => null);
  await prisma.$executeRaw`DELETE FROM platform_server_config_jobs WHERE tenant_id = ${tenantId}`.catch(() => null);
  await prisma.$executeRaw`DELETE FROM platform_server_config_snapshots WHERE tenant_id = ${tenantId}`.catch(() => null);
  await cleanupPlatformTenantFixtures({
    tenantIds: [tenantId],
  });
}

test('platform golden path covers tenant provisioning, runtime activation, config apply, restart, and health verification', { concurrency: false }, async (t) => {
  const suffix = String(Date.now());
  const tenantId = `tenant-golden-path-${suffix}`;
  const serverId = `server-golden-path-${suffix}`;
  const guildId = `guild-golden-path-${suffix}`;
  const syncAgentId = `server-bot-golden-${suffix}`;
  const executeAgentId = `delivery-agent-golden-${suffix}`;
  const syncRuntimeKey = `server-bot-runtime-${suffix}`;
  const executeRuntimeKey = `delivery-runtime-${suffix}`;
  const syncSessionId = `sync-session-${suffix}`;
  const executeSessionId = `execute-session-${suffix}`;

  await cleanupGoldenPathFixtures(tenantId);

  const previousDataDir = process.env.BOT_DATA_DIR;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-golden-path-'));
  process.env.BOT_DATA_DIR = tempDir;

  const port = randomPort();
  process.env.ADMIN_WEB_HOST = '127.0.0.1';
  process.env.ADMIN_WEB_PORT = String(port);
  process.env.ADMIN_WEB_USER = `golden_owner_${suffix}`;
  process.env.ADMIN_WEB_PASSWORD = `golden_pass_${suffix}`;
  process.env.ADMIN_WEB_USERS_JSON = '';
  process.env.ADMIN_WEB_2FA_ENABLED = 'false';

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
    await new Promise((resolve) => server.close(resolve));
    process.env.BOT_DATA_DIR = previousDataDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
    await cleanupGoldenPathFixtures(tenantId);
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  async function request(pathname, method = 'GET', body = null, cookie = '', extraHeaders = {}) {
    const headers = { ...extraHeaders };
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

  const login = await request('/admin/api/login', 'POST', {
    username: process.env.ADMIN_WEB_USER,
    password: process.env.ADMIN_WEB_PASSWORD,
  });
  assert.equal(login.res.status, 200);
  const cookie = String(login.res.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie);

  const tenantCreate = await request('/admin/api/platform/tenant', 'POST', {
    id: tenantId,
    slug: tenantId,
    name: `Golden Tenant ${suffix}`,
    type: 'direct',
    ownerEmail: `golden-${suffix}@example.com`,
  }, cookie);
  assert.equal(tenantCreate.res.status, 200);

  const subscriptionCreate = await request('/admin/api/platform/subscription', 'POST', {
    tenantId,
    planId: 'platform-growth',
    amountCents: 990000,
  }, cookie);
  assert.equal(subscriptionCreate.res.status, 200);

  const serverCreate = await request('/admin/api/platform/server', 'POST', {
    tenantId,
    id: serverId,
    slug: serverId,
    name: `Golden Server ${suffix}`,
    guildId,
  }, cookie);
  assert.equal(serverCreate.res.status, 200);

  const guildLink = await request('/admin/api/platform/server-discord-link', 'POST', {
    tenantId,
    serverId,
    guildId,
  }, cookie);
  assert.equal(guildLink.res.status, 200);

  const syncProvision = await request('/admin/api/platform/agent-provision', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId: syncAgentId,
    runtimeKey: syncRuntimeKey,
    role: 'sync',
    scope: 'sync_only',
    minimumVersion: '3.0.0',
    expiresAt: '2026-12-31T00:00:00.000Z',
  }, cookie);
  assert.equal(syncProvision.res.status, 200);
  const syncSetupToken = String(syncProvision.data.data?.rawSetupToken || '');
  assert.match(syncSetupToken, /^stp_[a-f0-9]+\.[a-f0-9]+$/);

  const executeProvision = await request('/admin/api/platform/agent-provision', 'POST', {
    tenantId,
    serverId,
    guildId,
    agentId: executeAgentId,
    runtimeKey: executeRuntimeKey,
    role: 'execute',
    scope: 'execute_only',
    minimumVersion: '3.0.0',
    expiresAt: '2026-12-31T00:00:00.000Z',
  }, cookie);
  assert.equal(executeProvision.res.status, 200);
  const executeSetupToken = String(executeProvision.data.data?.rawSetupToken || '');
  assert.match(executeSetupToken, /^stp_[a-f0-9]+\.[a-f0-9]+$/);

  const serverBotPresence = createPlatformAgentPresenceService({
    baseUrl,
    env: {
      PLATFORM_AGENT_SETUP_TOKEN: syncSetupToken,
      PLATFORM_AGENT_STATE_PERSIST: 'false',
    },
    tenantId,
    serverId,
    guildId,
    agentId: syncAgentId,
    runtimeKey: syncRuntimeKey,
    role: 'sync',
    scope: 'sync_only',
    version: '3.0.1',
    localBaseUrl: 'http://127.0.0.1:3211',
    hostname: 'golden-sync-host',
    machineFingerprint: 'golden-sync-machine',
  });
  const deliveryPresence = createPlatformAgentPresenceService({
    baseUrl,
    env: {
      PLATFORM_AGENT_SETUP_TOKEN: executeSetupToken,
      PLATFORM_AGENT_STATE_PERSIST: 'false',
    },
    tenantId,
    serverId,
    guildId,
    agentId: executeAgentId,
    runtimeKey: executeRuntimeKey,
    role: 'execute',
    scope: 'execute_only',
    version: '3.0.1',
    localBaseUrl: 'http://127.0.0.1:3212',
    hostname: 'golden-execute-host',
    machineFingerprint: 'golden-execute-machine',
  });

  const syncActivation = await serverBotPresence.ensureActivated();
  assert.equal(syncActivation.ok, true);
  const syncRegister = await serverBotPresence.register();
  assert.equal(syncRegister.ok, true);
  const syncSession = await serverBotPresence.sendSession({
    sessionId: syncSessionId,
    diagnostics: {
      configRoot: 'C:\\SCUM\\Config',
      backupRoot: 'C:\\SCUM\\Config\\.control-plane-backups',
    },
  });
  assert.equal(syncSession.ok, true);

  const executeActivation = await deliveryPresence.ensureActivated();
  assert.equal(executeActivation.ok, true);
  const executeRegister = await deliveryPresence.register();
  assert.equal(executeRegister.ok, true);
  const executeSession = await deliveryPresence.sendSession({
    sessionId: executeSessionId,
    diagnostics: {
      worker: 'delivery',
      queue: 'healthy',
    },
  });
  assert.equal(executeSession.ok, true);

  const runtimes = await request(`/admin/api/platform/agent-runtimes?tenantId=${encodeURIComponent(tenantId)}&limit=20`, 'GET', null, cookie);
  assert.equal(runtimes.res.status, 200);
  assert.ok(runtimes.data.data.some((row) => String(row.runtimeKey || '') === syncRuntimeKey));
  assert.ok(runtimes.data.data.some((row) => String(row.runtimeKey || '') === executeRuntimeKey));

  const snapshotUpload = await serverBotPresence.uploadServerConfigSnapshot({
    status: 'ready',
    collectedAt: '2026-04-04T01:00:00.000Z',
    files: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Golden Path Server',
      },
    ],
  });
  assert.equal(snapshotUpload.ok, true);

  const saveConfig = await request(
    `/admin/api/platform/servers/${encodeURIComponent(serverId)}/config/save`,
    'POST',
    {
      tenantId,
      applyMode: 'save_restart',
      changes: [
        {
          file: 'ServerSettings.ini',
          section: 'General',
          key: 'ServerName',
          value: 'Golden Path Ready',
        },
      ],
    },
    cookie,
  );
  assert.equal(saveConfig.res.status, 200, JSON.stringify(saveConfig.data));
  assert.equal(saveConfig.data.ok, true);
  const configJobId = String(saveConfig.data.data?.job?.id || '');
  assert.ok(configJobId);

  const configService = createPlatformServerConfigService({
    async listServerRegistry({ tenantId: requestedTenantId, serverId: requestedServerId }) {
      if (requestedTenantId !== tenantId || requestedServerId !== serverId) {
        return [];
      }
      return [{
        tenantId,
        id: serverId,
        guildId,
        name: `Golden Server ${suffix}`,
      }];
    },
  });

  const claimedJob = await serverBotPresence.claimNextServerConfigJob();
  assert.equal(claimedJob.ok, true, JSON.stringify(claimedJob));
  assert.equal(String(claimedJob.data?.job?.id || ''), configJobId);
  assert.equal(String(claimedJob.data?.job?.status || ''), 'processing');

  const completedJob = await serverBotPresence.reportServerConfigJobResult({
    jobId: configJobId,
    status: 'succeeded',
    result: {
      detail: 'Golden path config apply completed.',
    },
    backups: [
      {
        id: `cfgbak-${suffix}`,
        file: 'ServerSettings.ini',
        backupPath: `C:/backups/${serverId}-ServerSettings.ini.bak`,
      },
    ],
    snapshot: {
      status: 'ready',
      collectedAt: '2026-04-04T01:05:00.000Z',
      files: [
        {
          file: 'ServerSettings.ini',
          section: 'General',
          key: 'ServerName',
          value: 'Golden Path Ready',
        },
      ],
    },
  });
  assert.equal(completedJob.ok, true);

  const workspace = await configService.getServerConfigWorkspace({
    tenantId,
    serverId,
    limit: 10,
  });
  assert.equal(String(workspace.snapshotStatus || ''), 'ready');
  assert.ok(Array.isArray(workspace.backups));
  assert.ok(workspace.backups.some((entry) => String(entry.id || '') === `cfgbak-${suffix}`));

  const jobs = await configService.listServerConfigJobs({
    tenantId,
    serverId,
    limit: 10,
  });
  assert.equal(jobs.length >= 1, true);
  const completedConfigJob = jobs.find((entry) => String(entry.id || '') === configJobId);
  assert.ok(completedConfigJob);
  assert.equal(String(completedConfigJob.status || ''), 'succeeded');

  const restartPlans = await listRestartPlans({
    tenantId,
    serverId,
    limit: 10,
  });
  assert.equal(restartPlans.length >= 1, true);
  const restartPlan = restartPlans.find((entry) => String(entry.payload?.metadata?.requestKey || '').length > 0);
  assert.ok(restartPlan);
  assert.equal(String(restartPlan.status || ''), 'completed');
  assert.equal(String(restartPlan.healthStatus || ''), 'pending_verification');

  const verifiedPlan = await verifyRestartPlanHealth({
    planId: restartPlan.id,
    status: 'completed',
    actor: 'golden-path-test',
    checks: [
      { key: 'server-bot-session', status: 'online' },
      { key: 'delivery-agent-session', status: 'online' },
      { key: 'config-snapshot', status: 'healthy' },
    ],
  });
  assert.equal(verifiedPlan.ok, true);
  assert.equal(String(verifiedPlan.plan?.status || ''), 'completed');
  assert.equal(String(verifiedPlan.plan?.healthStatus || ''), 'verified');

  const restartExecutions = await listRestartExecutions({
    tenantId,
    serverId,
    planId: restartPlan.id,
    limit: 10,
  });
  assert.equal(restartExecutions.length, 1);
  assert.equal(String(restartExecutions[0]?.resultStatus || ''), 'succeeded');

  const runtimeSessions = await request(`/admin/api/platform/agent-sessions?tenantId=${encodeURIComponent(tenantId)}&limit=20`, 'GET', null, cookie);
  assert.equal(runtimeSessions.res.status, 200);
  assert.ok(runtimeSessions.data.data.some((row) => String(row.runtimeKey || '') === syncRuntimeKey));
  assert.ok(runtimeSessions.data.data.some((row) => String(row.runtimeKey || '') === executeRuntimeKey));
});
