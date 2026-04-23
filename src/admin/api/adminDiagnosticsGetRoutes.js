function createAdminDiagnosticsGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    sendDownload,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    jsonReplacer,
    listPlatformSyncEvents,
    buildTenantDiagnosticsBundle,
    buildTenantDiagnosticsCsv,
    buildTenantSupportCaseBundle,
    buildTenantSupportCaseCsv,
    buildDeliveryLifecycleReport,
    buildDeliveryLifecycleCsv,
  } = deps;

  return async function handleAdminDiagnosticsGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/platform/sync-events') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: false },
      );
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformSyncEvents({
          tenantId,
          allowGlobal: !tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-diagnostics') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildTenantDiagnosticsBundle(tenantId, {
          limit: asInt(urlObj.searchParams.get('limit'), 25) || 25,
          windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
          pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-diagnostics/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const data = await buildTenantDiagnosticsBundle(tenantId, {
        limit: asInt(urlObj.searchParams.get('limit'), 25) || 25,
        windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
        pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildTenantDiagnosticsCsv(data),
          {
            filename: `tenant-diagnostics-${tenantId}-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(data, jsonReplacer, 2)}\n`,
        {
          filename: `tenant-diagnostics-${tenantId}-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-support-case') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildTenantSupportCaseBundle(tenantId, {
          orderCode: requiredString(urlObj.searchParams.get('orderCode')),
          playerId: requiredString(urlObj.searchParams.get('playerId')),
          purchaseId: requiredString(urlObj.searchParams.get('purchaseId')),
          includeAudit: String(urlObj.searchParams.get('includeAudit') || '').trim().toLowerCase() !== 'false',
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-support-case/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const data = await buildTenantSupportCaseBundle(tenantId, {
        orderCode: requiredString(urlObj.searchParams.get('orderCode')),
        playerId: requiredString(urlObj.searchParams.get('playerId')),
        purchaseId: requiredString(urlObj.searchParams.get('purchaseId')),
        includeAudit: String(urlObj.searchParams.get('includeAudit') || '').trim().toLowerCase() !== 'false',
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildTenantSupportCaseCsv(data),
          {
            filename: `tenant-support-case-${tenantId}-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(data, jsonReplacer, 2)}\n`,
        {
          filename: `tenant-support-case-${tenantId}-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/delivery/lifecycle') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const scopedTenantId = tenantId || getAuthTenantId(auth) || undefined;
      sendJson(res, 200, {
        ok: true,
        data: await buildDeliveryLifecycleReport({
          tenantId: scopedTenantId,
          allowGlobal: !scopedTenantId,
          limit: asInt(urlObj.searchParams.get('limit'), 120) || 120,
          pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
          retryHeavyAttempts: asInt(urlObj.searchParams.get('retryHeavyAttempts'), null),
          poisonAttempts: asInt(urlObj.searchParams.get('poisonAttempts'), null),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/lifecycle/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const scopedTenantId = tenantId || getAuthTenantId(auth) || undefined;
      const data = await buildDeliveryLifecycleReport({
        tenantId: scopedTenantId,
        allowGlobal: !scopedTenantId,
        limit: asInt(urlObj.searchParams.get('limit'), 120) || 120,
        pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
        retryHeavyAttempts: asInt(urlObj.searchParams.get('retryHeavyAttempts'), null),
        poisonAttempts: asInt(urlObj.searchParams.get('poisonAttempts'), null),
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scopeLabel = scopedTenantId || 'global';
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildDeliveryLifecycleCsv(data),
          {
            filename: `delivery-lifecycle-${scopeLabel}-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(data, jsonReplacer, 2)}\n`,
        {
          filename: `delivery-lifecycle-${scopeLabel}-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminDiagnosticsGetRouteHandler,
};
