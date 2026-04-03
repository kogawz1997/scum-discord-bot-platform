const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const servicePath = path.join(rootDir, 'src', 'services', 'platformMonitoringService.js');
const configPath = path.join(rootDir, 'src', 'config.js');
const adminSnapshotServicePath = path.join(rootDir, 'src', 'services', 'adminSnapshotService.js');
const adminLiveBusPath = path.join(rootDir, 'src', 'services', 'adminLiveBus.js');
const runtimeSupervisorPath = path.join(rootDir, 'src', 'services', 'runtimeSupervisorService.js');
const platformServicePath = path.join(rootDir, 'src', 'services', 'platformService.js');
const opsStateStorePath = path.join(rootDir, 'src', 'store', 'platformOpsStateStore.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function loadMonitoringService(options = {}) {
  const liveEvents = [];
  let state = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    lastMonitoringAt: null,
    lastReconcileAt: null,
    lastAutoBackupAt: null,
    lastAlertAtByKey: {},
    ...(options.initialState || {}),
  };

  installMock(configPath, {
    platform: {
      monitoring: {
        enabled: options.enabled !== false,
        intervalMs: 60_000,
        alertCooldownMs: 5_000,
        reconcileEveryMs: 60_000,
        agentStaleMs: 60_000,
        subscriptionRenewalSoonMs: 3 * 24 * 60 * 60 * 1000,
      },
      backups: {
        enabled: false,
      },
    },
  });
  installMock(adminSnapshotServicePath, {
    createAdminBackup: async () => ({ ok: true }),
  });
  installMock(adminLiveBusPath, {
    publishAdminLiveUpdate: (type, payload) => {
      liveEvents.push({ type, payload });
    },
  });
  installMock(runtimeSupervisorPath, {
    getRuntimeSupervisorSnapshot: async () => ({
      overall: 'ready',
      counts: { total: 0, required: 0, ready: 0, degraded: 0, offline: 0, disabled: 0 },
      items: [],
    }),
  });
  installMock(platformServicePath, {
    listPlatformAgentRuntimes: async () => [],
    getPlatformAnalyticsOverview: async () => ({ ok: true }),
    getTenantQuotaSnapshot: async () => ({ quotas: {} }),
    listPlatformSubscriptions: async () => (options.subscriptions || []),
    listPlatformTenants: async () => [],
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
    getPlatformOpsState: async () => ({
      ...state,
      lastAlertAtByKey: { ...(state.lastAlertAtByKey || {}) },
    }),
    updatePlatformOpsState: async (patch) => {
      state = {
        ...state,
        ...(patch || {}),
        lastAlertAtByKey: {
          ...(state.lastAlertAtByKey || {}),
          ...((patch && patch.lastAlertAtByKey) || {}),
        },
      };
      return {
        ...state,
        lastAlertAtByKey: { ...(state.lastAlertAtByKey || {}) },
      };
    },
  });

  delete require.cache[servicePath];
  const service = require(servicePath);
  return {
    ...service,
    liveEvents,
    getState: () => state,
  };
}

test.afterEach(() => {
  delete require.cache[servicePath];
  delete require.cache[configPath];
  delete require.cache[adminSnapshotServicePath];
  delete require.cache[adminLiveBusPath];
  delete require.cache[runtimeSupervisorPath];
  delete require.cache[platformServicePath];
  delete require.cache[opsStateStorePath];
});

test('platform monitoring emits commercial lifecycle alerts for expiring, past-due, suspended, and expired subscriptions', async () => {
  const now = Date.now();
  const { runPlatformMonitoringCycle, liveEvents, getState } = loadMonitoringService({
    subscriptions: [
      {
        id: 'sub-expiring',
        tenantId: 'tenant-1',
        planId: 'platform-starter',
        status: 'active',
        renewsAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'sub-past-due',
        tenantId: 'tenant-2',
        planId: 'platform-starter',
        status: 'past_due',
        renewsAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'sub-suspended',
        tenantId: 'tenant-3',
        planId: 'platform-pro',
        status: 'suspended',
        renewsAt: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'sub-expired',
        tenantId: 'tenant-4',
        planId: 'platform-pro',
        status: 'expired',
        renewsAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  });

  const result = await runPlatformMonitoringCycle({ force: true });

  assert.equal(result.ok, true);
  assert.equal(result.subscriptions.expiringSoon.length, 1);
  assert.equal(result.subscriptions.pastDue.length, 1);
  assert.equal(result.subscriptions.suspended.length, 1);
  assert.equal(result.subscriptions.expired.length, 1);
  assert.ok(liveEvents.some((entry) => entry.payload?.kind === 'subscription-expiring-soon'));
  assert.ok(liveEvents.some((entry) => entry.payload?.kind === 'subscription-past-due'));
  assert.ok(liveEvents.some((entry) => entry.payload?.kind === 'subscription-suspended'));
  assert.ok(liveEvents.some((entry) => entry.payload?.kind === 'subscription-expired'));
  assert.ok(getState().lastMonitoringAt);
});
