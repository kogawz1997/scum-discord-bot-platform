'use strict';

/**
 * Keep admin observability snapshot assembly out of the HTTP entry file.
 */

function createAdminObservabilityRuntime(deps = {}) {
  const {
    buildAdminObservabilitySnapshot,
    captureMetricsSeries,
    getAdminRequestLogMetrics,
    getCachedRuntimeSupervisorSnapshot,
    getDeliveryMetricsSnapshot,
    getDeliveryRuntimeStatus,
    getLoginFailureMetrics,
    getPlatformOpsState,
    getWebhookMetricsSnapshot,
    listAdminRequestLogs,
    listDeliveryQueue,
    listMetricsSeries,
    metricsSeriesRetentionMs,
  } = deps;

  async function getCurrentObservabilitySnapshot(options = {}) {
    const snapshot = buildAdminObservabilitySnapshot({
      windowMs: options.windowMs,
      seriesKeys: Array.isArray(options.seriesKeys) ? options.seriesKeys : [],
      retentionMs: metricsSeriesRetentionMs,
      captureSeries: () => captureMetricsSeries(),
      getDeliveryMetricsSnapshot,
      getLoginFailureMetrics,
      getWebhookMetricsSnapshot,
      getAdminRequestLogMetrics,
      listAdminRequestLogs,
      listDeliveryQueue,
      listSeries: ({ windowMs, keys }) => listMetricsSeries({ windowMs, keys }),
    });
    snapshot.deliveryRuntime = await getDeliveryRuntimeStatus();
    snapshot.runtimeSupervisor = getCachedRuntimeSupervisorSnapshot();
    snapshot.platformOps = await getPlatformOpsState();
    return snapshot;
  }

  return {
    getCurrentObservabilitySnapshot,
  };
}

module.exports = {
  createAdminObservabilityRuntime,
};
