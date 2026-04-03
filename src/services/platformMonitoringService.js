const config = require('../config');
const { createAdminBackup } = require('./adminSnapshotService');
const { publishAdminLiveUpdate } = require('./adminLiveBus');
const { getRuntimeSupervisorSnapshot } = require('./runtimeSupervisorService');
const { pruneAdminNotifications } = require('../store/adminNotificationStore');
const {
  listPlatformAgentRuntimes,
  getPlatformAnalyticsOverview,
  getTenantQuotaSnapshot,
  listPlatformSubscriptions,
  listPlatformTenants,
  reconcileDeliveryState,
} = require('./platformService');
const { pruneRestartArtifacts } = require('./platformRestartOrchestrationService');
const { createPlatformServerConfigService } = require('./platformServerConfigService');
const {
  getPlatformOpsState,
  updatePlatformOpsState,
} = require('../store/platformOpsStateStore');

let monitorTimer = null;
let cyclePromise = null;
const platformServerConfigService = createPlatformServerConfigService();

function nowIso() {
  return new Date().toISOString();
}

function asInt(value, fallback, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function elapsedMsSince(value) {
  const date = toDate(value);
  if (!date) return Number.POSITIVE_INFINITY;
  return Date.now() - date.getTime();
}

function shouldRunInterval(lastAt, everyMs) {
  if (!everyMs || everyMs <= 0) return false;
  return elapsedMsSince(lastAt) >= everyMs;
}

function trimText(value, maxLen = 300) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function getMonitoringConfig() {
  return {
    enabled: config.platform?.monitoring?.enabled === true,
    intervalMs: asInt(config.platform?.monitoring?.intervalMs, 5 * 60 * 1000, 30 * 1000),
    alertCooldownMs: asInt(config.platform?.monitoring?.alertCooldownMs, 30 * 60 * 1000, 60 * 1000),
    reconcileEveryMs: asInt(config.platform?.monitoring?.reconcileEveryMs, 10 * 60 * 1000, 60 * 1000),
    agentStaleMs: asInt(
      config.platform?.monitoring?.staleAgentMs || config.platform?.monitoring?.agentStaleMs,
      10 * 60 * 1000,
      60 * 1000,
    ),
    subscriptionExpiringMs: asInt(
      config.platform?.monitoring?.subscriptionExpiringMs,
      7 * 24 * 60 * 60 * 1000,
      60 * 60 * 1000,
    ),
    backups: {
      enabled: config.platform?.backups?.enabled === true,
      intervalMs: asInt(config.platform?.backups?.intervalMs, 6 * 60 * 60 * 1000, 5 * 60 * 1000),
      note: trimText(config.platform?.backups?.note || 'platform-auto-backup', 160) || 'platform-auto-backup',
      includeSnapshot: config.platform?.backups?.includeSnapshot !== false,
    },
    retention: {
      enabled: config.platform?.monitoring?.retention?.enabled !== false,
      cleanupEveryMs: asInt(config.platform?.monitoring?.retention?.cleanupEveryMs, 12 * 60 * 60 * 1000, 5 * 60 * 1000),
      notificationRetentionMs: asInt(config.platform?.monitoring?.retention?.notificationRetentionMs, 30 * 24 * 60 * 60 * 1000, 60 * 60 * 1000),
      restartRetentionMs: asInt(config.platform?.monitoring?.retention?.restartRetentionMs, 30 * 24 * 60 * 60 * 1000, 60 * 60 * 1000),
      configJobRetentionMs: asInt(config.platform?.monitoring?.retention?.configJobRetentionMs, 30 * 24 * 60 * 60 * 1000, 60 * 60 * 1000),
      configBackupRetentionMs: asInt(config.platform?.monitoring?.retention?.configBackupRetentionMs, 30 * 24 * 60 * 60 * 1000, 60 * 60 * 1000),
      keepLatestNotifications: asInt(config.platform?.monitoring?.retention?.keepLatestNotifications, 100, 0),
      keepLatestRestartPlans: asInt(config.platform?.monitoring?.retention?.keepLatestRestartPlans, 20, 0),
      keepLatestRestartAnnouncements: asInt(config.platform?.monitoring?.retention?.keepLatestRestartAnnouncements, 20, 0),
      keepLatestRestartExecutions: asInt(config.platform?.monitoring?.retention?.keepLatestRestartExecutions, 20, 0),
      keepLatestConfigJobs: asInt(config.platform?.monitoring?.retention?.keepLatestConfigJobs, 20, 0),
      keepLatestConfigBackups: asInt(config.platform?.monitoring?.retention?.keepLatestConfigBackups, 20, 0),
    },
  };
}

function cooldownAllowsAlert(state, key, cooldownMs) {
  const last = state?.lastAlertAtByKey?.[key];
  if (!last) return true;
  return elapsedMsSince(last) >= cooldownMs;
}

function markAlert(state, key) {
  return {
    ...(state?.lastAlertAtByKey || {}),
    [key]: nowIso(),
  };
}

function getSubscriptionExpiryAt(subscription) {
  return toDate(
    subscription?.currentPeriodEnd
    || subscription?.trialEndsAt
    || subscription?.renewsAt
    || subscription?.metadata?.currentPeriodEnd
    || subscription?.metadata?.trialEndsAt,
  );
}

// Monitoring emits actionable alerts on a cadence so operators do not have to keep
// a dashboard tab open just to notice drift, stale runtimes, or failed backups.
async function runPlatformMonitoringCycle({ client = null, force = false } = {}) {
  const monitoring = getMonitoringConfig();
  if (!monitoring.enabled && !force) {
    return {
      ok: true,
      skipped: true,
      reason: 'platform-monitoring-disabled',
    };
  }
  if (cyclePromise && !force) {
    return cyclePromise;
  }

  cyclePromise = (async () => {
    const state = await getPlatformOpsState();
    const updatedAlertMap = { ...(state.lastAlertAtByKey || {}) };
    const generatedAt = nowIso();
    const report = {
      ok: true,
      generatedAt,
      autoBackup: null,
      analytics: null,
      reconcile: null,
      runtimeSupervisor: null,
      agents: null,
      alerts: [],
      stateBefore: state,
    };

    try {
      if (
        monitoring.backups.enabled
        && (force || shouldRunInterval(state.lastAutoBackupAt, monitoring.backups.intervalMs))
      ) {
        try {
          const saved = await createAdminBackup({
            client,
            actor: 'platform-monitor',
            role: 'system',
            note: monitoring.backups.note,
            includeSnapshot: monitoring.backups.includeSnapshot,
          });
          report.autoBackup = {
            ok: true,
            backupId: saved?.id || saved?.file || null,
            createdAt: saved?.createdAt || generatedAt,
          };
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-monitor',
            kind: 'platform-auto-backup-created',
            backup: saved?.id || saved?.file || null,
            note: monitoring.backups.note,
          });
          updatedAlertMap['platform-auto-backup-created'] = generatedAt;
          await updatePlatformOpsState({
            lastAutoBackupAt: generatedAt,
            lastAlertAtByKey: updatedAlertMap,
          });
        } catch (error) {
          report.autoBackup = {
            ok: false,
            error: trimText(error?.message || error, 240),
          };
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-monitor',
            kind: 'platform-auto-backup-failed',
            error: trimText(error?.message || error, 240),
          });
          updatedAlertMap['platform-auto-backup-failed'] = generatedAt;
        }
      }

      const shouldReconcile =
        force || shouldRunInterval(state.lastReconcileAt, monitoring.reconcileEveryMs);
      const analytics = await getPlatformAnalyticsOverview({ allowGlobal: true });
      const reconcile = shouldReconcile
        ? await reconcileDeliveryState({ allowGlobal: true })
        : null;
      const [runtimeSupervisor, agentRuntimes, tenants, subscriptions] = await Promise.all([
        getRuntimeSupervisorSnapshot({ forceRefresh: true }).catch(() => null),
        listPlatformAgentRuntimes({ limit: 500, allowGlobal: true }),
        listPlatformTenants({ limit: 500 }),
        listPlatformSubscriptions({ limit: 500, allowGlobal: true }).catch(() => []),
      ]);

      report.analytics = analytics;
      report.reconcile = reconcile;
      report.runtimeSupervisor = runtimeSupervisor;
      report.agents = {
        total: agentRuntimes.length,
        items: agentRuntimes,
      };
      report.subscriptions = {
        total: Array.isArray(subscriptions) ? subscriptions.length : 0,
        expiring: [],
      };
      report.retention = null;
      report.quota = {
        tenants: 0,
        exceeded: [],
        nearLimit: [],
      };

      if (reconcile?.summary?.anomalies > 0) {
        const alertKey = 'delivery-reconcile-anomaly';
        if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-monitor',
            kind: alertKey,
            count: reconcile.summary.anomalies,
            sample: reconcile.anomalies.slice(0, 10),
          });
          updatedAlertMap[alertKey] = generatedAt;
          report.alerts.push(alertKey);
        }
      }

      if (reconcile?.summary?.abuseFindings > 0) {
        const alertKey = 'delivery-abuse-suspected';
        if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-monitor',
            kind: alertKey,
            count: reconcile.summary.abuseFindings,
            sample: reconcile.abuseFindings.slice(0, 10),
          });
          updatedAlertMap[alertKey] = generatedAt;
          report.alerts.push(alertKey);
        }
      }

      for (const runtime of agentRuntimes) {
        const runtimeLabel = `${runtime.tenantId}:${runtime.runtimeKey}`;
        if (runtime.status === 'outdated') {
          const alertKey = `agent-version-outdated:${runtimeLabel}`;
          if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
            publishAdminLiveUpdate('ops-alert', {
              source: 'platform-monitor',
              kind: 'agent-version-outdated',
              tenantId: runtime.tenantId,
              runtimeKey: runtime.runtimeKey,
              version: runtime.version,
              minimumVersion: runtime.minRequiredVersion,
            });
            updatedAlertMap[alertKey] = generatedAt;
            report.alerts.push(alertKey);
          }
        }
        if (elapsedMsSince(runtime.lastSeenAt) >= monitoring.agentStaleMs) {
          const alertKey = `agent-runtime-stale:${runtimeLabel}`;
          if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
            publishAdminLiveUpdate('ops-alert', {
              source: 'platform-monitor',
              kind: 'agent-runtime-stale',
              tenantId: runtime.tenantId,
              runtimeKey: runtime.runtimeKey,
              lastSeenAt: runtime.lastSeenAt,
              staleMs: elapsedMsSince(runtime.lastSeenAt),
            });
            updatedAlertMap[alertKey] = generatedAt;
            report.alerts.push(alertKey);
          }
        }
      }

      for (const tenant of tenants) {
        const quotaSnapshot = await getTenantQuotaSnapshot(tenant.id).catch(() => null);
        if (!quotaSnapshot?.quotas) continue;
        report.quota.tenants += 1;
        for (const [quotaKey, quota] of Object.entries(quotaSnapshot.quotas)) {
          if (!quota || quota.unlimited) continue;
          const entry = {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            quotaKey,
            used: quota.used,
            limit: quota.limit,
            remaining: quota.remaining,
          };
          if (quota.exceeded) {
            report.quota.exceeded.push(entry);
            const alertKey = `tenant-quota-exceeded:${tenant.id}:${quotaKey}`;
            if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
              publishAdminLiveUpdate('ops-alert', {
                source: 'platform-monitor',
                kind: 'tenant-quota-exceeded',
                ...entry,
              });
              updatedAlertMap[alertKey] = generatedAt;
              report.alerts.push(alertKey);
            }
            continue;
          }
          if (Number(quota.remaining) <= 1) {
            report.quota.nearLimit.push(entry);
            const alertKey = `tenant-quota-near-limit:${tenant.id}:${quotaKey}`;
            if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
              publishAdminLiveUpdate('ops-alert', {
                source: 'platform-monitor',
                kind: 'tenant-quota-near-limit',
                ...entry,
              });
              updatedAlertMap[alertKey] = generatedAt;
              report.alerts.push(alertKey);
            }
          }
        }
      }

      for (const subscription of Array.isArray(subscriptions) ? subscriptions : []) {
        const tenantId = trimText(subscription?.tenantId, 160) || null;
        const subscriptionId = trimText(subscription?.id, 160) || null;
        const lifecycleStatus = trimText(
          subscription?.lifecycleStatus || subscription?.status,
          80,
        ).toLowerCase() || 'active';
        const expiresAt = getSubscriptionExpiryAt(subscription);
        if (!tenantId || !subscriptionId || !expiresAt) continue;
        if (['expired', 'canceled', 'cancelled', 'suspended'].includes(lifecycleStatus)) continue;
        const remainingMs = expiresAt.getTime() - Date.now();
        if (remainingMs <= 0 || remainingMs > monitoring.subscriptionExpiringMs) continue;

        report.subscriptions.expiring.push({
          tenantId,
          subscriptionId,
          packageId: trimText(subscription?.packageId || subscription?.planId, 160) || null,
          packageName: trimText(subscription?.packageName || subscription?.planId, 160) || null,
          lifecycleStatus,
          currentPeriodEnd: expiresAt.toISOString(),
          daysRemaining: Number((remainingMs / (24 * 60 * 60 * 1000)).toFixed(1)),
        });

        const alertKey = `subscription-expiring:${tenantId}:${subscriptionId}`;
        if (force || cooldownAllowsAlert(state, alertKey, monitoring.alertCooldownMs)) {
          publishAdminLiveUpdate('subscription-expiring', {
            source: 'platform-monitor',
            tenantId,
            tenantSlug: trimText(subscription?.tenantSlug, 160) || null,
            tenantLabel: trimText(subscription?.tenantName, 160) || null,
            subscriptionId,
            packageId: trimText(subscription?.packageId || subscription?.planId, 160) || null,
            packageName: trimText(subscription?.packageName || subscription?.planId, 160) || null,
            lifecycleStatus,
            currentPeriodEnd: expiresAt.toISOString(),
            trialEndsAt: trimText(subscription?.trialEndsAt, 160) || null,
            daysRemaining: Number((remainingMs / (24 * 60 * 60 * 1000)).toFixed(1)),
          });
          updatedAlertMap[alertKey] = generatedAt;
          report.alerts.push(alertKey);
        }
      }

      const shouldRunRetentionCleanup =
        monitoring.retention.enabled
        && (force || shouldRunInterval(state.lastAlertAtByKey?.['platform-retention-cleanup'], monitoring.retention.cleanupEveryMs));
      if (shouldRunRetentionCleanup) {
        const retentionReport = {
          ok: true,
          notifications: null,
          tenants: [],
          totals: {
            restartPlans: 0,
            restartAnnouncements: 0,
            restartExecutions: 0,
            configJobs: 0,
            configBackups: 0,
          },
        };
        try {
          retentionReport.notifications = pruneAdminNotifications({
            now: generatedAt,
            olderThanMs: monitoring.retention.notificationRetentionMs,
            keepLatest: monitoring.retention.keepLatestNotifications,
          });
          for (const tenant of tenants) {
            const tenantId = trimText(tenant?.id, 160) || null;
            if (!tenantId) continue;
            const [restartCleanup, configCleanup] = await Promise.all([
              pruneRestartArtifacts({
                tenantId,
                now: generatedAt,
                olderThanMs: monitoring.retention.restartRetentionMs,
                keepLatestPlans: monitoring.retention.keepLatestRestartPlans,
                keepLatestAnnouncements: monitoring.retention.keepLatestRestartAnnouncements,
                keepLatestExecutions: monitoring.retention.keepLatestRestartExecutions,
              }, client || undefined).catch((error) => ({ ok: false, error: trimText(error?.message || error, 240) })),
              platformServerConfigService.pruneServerConfigArtifacts({
                tenantId,
                now: generatedAt,
                jobRetentionMs: monitoring.retention.configJobRetentionMs,
                backupRetentionMs: monitoring.retention.configBackupRetentionMs,
                keepLatestJobs: monitoring.retention.keepLatestConfigJobs,
                keepLatestBackups: monitoring.retention.keepLatestConfigBackups,
              }).catch((error) => ({ ok: false, error: trimText(error?.message || error, 240) })),
            ]);
            retentionReport.tenants.push({
              tenantId,
              restart: restartCleanup,
              config: configCleanup,
            });
            if (restartCleanup?.ok) {
              retentionReport.totals.restartPlans += Number(restartCleanup.removed?.plans || 0);
              retentionReport.totals.restartAnnouncements += Number(restartCleanup.removed?.announcements || 0);
              retentionReport.totals.restartExecutions += Number(restartCleanup.removed?.executions || 0);
            } else {
              retentionReport.ok = false;
            }
            if (configCleanup?.ok) {
              retentionReport.totals.configJobs += Number(configCleanup.removed?.jobs || 0);
              retentionReport.totals.configBackups += Number(configCleanup.removed?.backups || 0);
            } else {
              retentionReport.ok = false;
            }
          }
        } catch (error) {
          retentionReport.ok = false;
          retentionReport.error = trimText(error?.message || error, 240);
        }
        report.retention = retentionReport;
        updatedAlertMap['platform-retention-cleanup'] = generatedAt;
        if (!retentionReport.ok) {
          publishAdminLiveUpdate('ops-alert', {
            source: 'platform-monitor',
            kind: 'platform-retention-cleanup-failed',
            detail: retentionReport.error || 'Retention cleanup reported one or more failures',
          });
        }
      }

      await updatePlatformOpsState({
        lastMonitoringAt: generatedAt,
        lastReconcileAt: shouldReconcile ? generatedAt : state.lastReconcileAt,
        lastAlertAtByKey: updatedAlertMap,
      });
      report.stateAfter = await getPlatformOpsState();
      return report;
    } finally {
      cyclePromise = null;
    }
  })();

  return cyclePromise;
}

function startPlatformMonitoring({ client = null } = {}) {
  const monitoring = getMonitoringConfig();
  if (!monitoring.enabled) return false;
  if (monitorTimer) return true;
  void runPlatformMonitoringCycle({ client }).catch(() => null);
  monitorTimer = setInterval(() => {
    void runPlatformMonitoringCycle({ client }).catch((error) => {
      console.error('[platform-monitor] cycle failed:', error.message);
    });
  }, monitoring.intervalMs);
  if (typeof monitorTimer.unref === 'function') {
    monitorTimer.unref();
  }
  return true;
}

function stopPlatformMonitoring() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}

module.exports = {
  getMonitoringConfig,
  runPlatformMonitoringCycle,
  startPlatformMonitoring,
  stopPlatformMonitoring,
};
