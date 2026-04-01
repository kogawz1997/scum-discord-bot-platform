function createAdminObservabilityGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    sendDownload,
    requiredString,
    asInt,
    jsonReplacer,
    clampMetricsWindowMs,
    parseMetricsSeriesKeys,
    getCurrentObservabilitySnapshot,
    getAdminRequestLogMetrics,
    listAdminRequestLogs,
    buildObservabilityCsv,
    buildObservabilityExportPayload,
  } = deps;

  return async function handleAdminObservabilityGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/observability') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getCurrentObservabilitySnapshot({
          windowMs: clampMetricsWindowMs(urlObj.searchParams.get('windowMs')),
          seriesKeys: parseMetricsSeriesKeys(urlObj.searchParams.get('series')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/observability/requests') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          metrics: getAdminRequestLogMetrics({
            windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
          }),
          items: listAdminRequestLogs({
            limit: asInt(urlObj.searchParams.get('limit'), 200) || 200,
            windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
            statusClass: requiredString(urlObj.searchParams.get('statusClass')),
            routeGroup: requiredString(urlObj.searchParams.get('routeGroup')),
            authMode: requiredString(urlObj.searchParams.get('authMode')),
            requestId: requiredString(urlObj.searchParams.get('requestId')),
            tenantId: requiredString(urlObj.searchParams.get('tenantId')),
            pathContains: requiredString(urlObj.searchParams.get('path')),
            onlyErrors:
              String(urlObj.searchParams.get('onlyErrors') || '').trim().toLowerCase() === 'true',
          }),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/observability/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const data = await getCurrentObservabilitySnapshot({
        windowMs: clampMetricsWindowMs(urlObj.searchParams.get('windowMs')),
        seriesKeys: parseMetricsSeriesKeys(urlObj.searchParams.get('series')),
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildObservabilityCsv(data),
          {
            filename: `observability-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(buildObservabilityExportPayload(data), jsonReplacer, 2)}\n`,
        {
          filename: `observability-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminObservabilityGetRouteHandler,
};
