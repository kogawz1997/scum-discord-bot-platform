const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/platformMonitoringService.js');
const configPath = path.resolve(__dirname, '../src/config.js');
const snapshotServicePath = path.resolve(__dirname, '../src/services/adminSnapshotService.js');
const liveBusPath = path.resolve(__dirname, '../src/services/adminLiveBus.js');
const runtimeSupervisorPath = path.resolve(__dirname, '../src/services/runtimeSupervisorService.js');
const platformServicePath = path.resolve(__dirname, '../src/services/platformService.js');
const opsStateStorePath = path.resolve(__dirname, '../src/store/platformOpsStateStore.js');
const restartServicePath = path.resolve(__dirname, '../src/services/platformRestartOrchestrationService.js');
const configServicePath = path.resolve(__dirname, '../src/services/platformServerConfigService.js');
const notificationStorePath = path.resolve(__dirname, '../src/store/adminNotificationStore.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(configPath);
  clearModule(snapshotServicePath);
  clearModule(liveBusPath);
  clearModule(runtimeSupervisorPath);
  clearModule(platformServicePath);
  clearModule(opsStateStorePath);
  clearModule(restartServicePath);
  clearModule(configServicePath);
  clearModule(notificationStorePath);
});

test('platform monitoring emits subscription-expiring alerts for near-term subscriptions', async () => {
  const published = [];
  let state = {
    lastAlertAtByKey: {},
    lastMonitoringAt: null,
    lastReconcileAt: null,
    lastAutoBackupAt: null,
  };

  installMock(configPath, {
    platform: {
      monitoring: {
        enabled: true,
        intervalMs: 60_000,
        reconcileEveryMs: 600_000,
        staleAgentMs: 900_000,
        alertCooldownMs: 600_000,
        subscriptionExpiringMs: 7 * 24 * 60 * 60 * 1000,
      },
      backups: {
        enabled: false,
      },
    },
  });
  installMock(snapshotServicePath, {
    createAdminBackup: async () => ({ ok: true }),
  });
  installMock(liveBusPath, {
    publishAdminLiveUpdate(type, payload) {
      published.push({ type, payload });
    },
  });
  installMock(runtimeSupervisorPath, {
    getRuntimeSupervisorSnapshot: async () => ({ items: [] }),
  });
  installMock(restartServicePath, {
    pruneRestartArtifacts: async () => ({ ok: true, removed: { plans: 0, announcements: 0, executions: 0 } }),
  });
  installMock(configServicePath, {
    createPlatformServerConfigService() {
      return {
        pruneServerConfigArtifacts: async () => ({ ok: true, removed: { jobs: 0, backups: 0 } }),
      };
    },
  });
  installMock(notificationStorePath, {
    pruneAdminNotifications() {
      return { removed: 0, remaining: 0 };
    },
  });
  installMock(platformServicePath, {
    listPlatformAgentRuntimes: async () => ([]),
    getPlatformAnalyticsOverview: async () => ({}),
    getTenantQuotaSnapshot: async () => ({ quotas: {} }),
    listPlatformTenants: async () => ([]),
    listPlatformSubscriptions: async () => ([
      {
        id: 'sub-expiring-1',
        tenantId: 'tenant-expiring-1',
        tenantName: 'Tenant Expiring',
        packageName: 'FULL_OPTION',
        lifecycleStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + (2 * 24 * 60 * 60 * 1000)).toISOString(),
      },
      {
        id: 'sub-far-future',
        tenantId: 'tenant-future',
        packageName: 'BOT_LOG',
        lifecycleStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + (20 * 24 * 60 * 60 * 1000)).toISOString(),
      },
    ]),
    reconcileDeliveryState: async () => ({
      summary: {
        anomalies: 0,
        abuseFindings: 0,
      },
      anomalies: [],
      abuseFindings: [],
    }),
  });
  installMock(opsStateStorePath, {
    async getPlatformOpsState() {
      return state;
    },
    async updatePlatformOpsState(patch = {}) {
      state = {
        ...state,
        ...patch,
      };
      return state;
    },
  });

  const {
    runPlatformMonitoringCycle,
  } = require(servicePath);

  const report = await runPlatformMonitoringCycle({ force: true });

  assert.equal(report.ok, true);
  assert.equal(Array.isArray(report.subscriptions?.expiring), true);
  assert.equal(report.subscriptions.expiring.length, 1);
  assert.equal(String(report.subscriptions.expiring[0]?.subscriptionId || ''), 'sub-expiring-1');
  assert.ok(
    published.some((entry) => entry.type === 'subscription-expiring'
      && String(entry.payload?.tenantId || '') === 'tenant-expiring-1'
      && String(entry.payload?.subscriptionId || '') === 'sub-expiring-1'),
  );
});

test('platform monitoring runs retention cleanup and reports removed artifact totals', async () => {
  const published = [];
  let state = {
    lastAlertAtByKey: {},
    lastMonitoringAt: null,
    lastReconcileAt: null,
    lastAutoBackupAt: null,
  };

  installMock(configPath, {
    platform: {
      monitoring: {
        enabled: true,
        intervalMs: 60_000,
        reconcileEveryMs: 600_000,
        staleAgentMs: 900_000,
        alertCooldownMs: 600_000,
        subscriptionExpiringMs: 7 * 24 * 60 * 60 * 1000,
        retention: {
          enabled: true,
          cleanupEveryMs: 60_000,
          notificationRetentionMs: 30 * 24 * 60 * 60 * 1000,
          restartRetentionMs: 30 * 24 * 60 * 60 * 1000,
          configJobRetentionMs: 30 * 24 * 60 * 60 * 1000,
          configBackupRetentionMs: 30 * 24 * 60 * 60 * 1000,
          keepLatestNotifications: 5,
          keepLatestRestartPlans: 0,
          keepLatestRestartAnnouncements: 0,
          keepLatestRestartExecutions: 0,
          keepLatestConfigJobs: 0,
          keepLatestConfigBackups: 0,
        },
      },
      backups: {
        enabled: false,
      },
    },
  });
  installMock(snapshotServicePath, {
    createAdminBackup: async () => ({ ok: true }),
  });
  installMock(liveBusPath, {
    publishAdminLiveUpdate(type, payload) {
      published.push({ type, payload });
    },
  });
  installMock(runtimeSupervisorPath, {
    getRuntimeSupervisorSnapshot: async () => ({ items: [] }),
  });
  installMock(restartServicePath, {
    pruneRestartArtifacts: async ({ tenantId }) => ({
      ok: true,
      tenantId,
      removed: { plans: 1, announcements: 2, executions: 3 },
    }),
  });
  installMock(configServicePath, {
    createPlatformServerConfigService() {
      return {
        pruneServerConfigArtifacts: async ({ tenantId }) => ({
          ok: true,
          tenantId,
          removed: { jobs: 4, backups: 5 },
        }),
      };
    },
  });
  installMock(notificationStorePath, {
    pruneAdminNotifications() {
      return { removed: 6, remaining: 2 };
    },
  });
  installMock(platformServicePath, {
    listPlatformAgentRuntimes: async () => ([]),
    getPlatformAnalyticsOverview: async () => ({}),
    getTenantQuotaSnapshot: async () => ({ quotas: {} }),
    listPlatformTenants: async () => ([
      { id: 'tenant-a', slug: 'tenant-a' },
      { id: 'tenant-b', slug: 'tenant-b' },
    ]),
    listPlatformSubscriptions: async () => ([]),
    reconcileDeliveryState: async () => ({
      summary: {
        anomalies: 0,
        abuseFindings: 0,
      },
      anomalies: [],
      abuseFindings: [],
    }),
  });
  installMock(opsStateStorePath, {
    async getPlatformOpsState() {
      return state;
    },
    async updatePlatformOpsState(patch = {}) {
      state = {
        ...state,
        ...patch,
      };
      return state;
    },
  });

  const { runPlatformMonitoringCycle } = require(servicePath);
  const report = await runPlatformMonitoringCycle({ force: true });

  assert.equal(report.ok, true);
  assert.equal(report.retention?.ok, true);
  assert.equal(report.retention?.notifications?.removed, 6);
  assert.equal(report.retention?.totals?.restartPlans, 2);
  assert.equal(report.retention?.totals?.restartAnnouncements, 4);
  assert.equal(report.retention?.totals?.restartExecutions, 6);
  assert.equal(report.retention?.totals?.configJobs, 8);
  assert.equal(report.retention?.totals?.configBackups, 10);
  assert.equal(String(state.lastAlertAtByKey?.['platform-retention-cleanup'] || '').length > 0, true);
  assert.equal(published.some((entry) => entry.payload?.kind === 'platform-retention-cleanup-failed'), false);
});
