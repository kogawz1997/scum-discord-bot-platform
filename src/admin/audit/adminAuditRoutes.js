/**
 * Admin audit routes kept outside the main HTTP entry file.
 */

function createAdminAuditRoutes(deps) {
  const {
    ensureRole,
    sendJson,
    sendDownload,
    requiredString,
    resolveScopedTenantId,
    readJsonBody,
    buildAuditDatasetService,
    buildAuditExportPayloadService,
    buildAuditCsvService,
    listAuditPresetsService,
    saveAuditPresetService,
    deleteAuditPresetService,
    listAdminSecurityEventsService,
    prisma,
    listEvents,
    getParticipants,
    jsonReplacer,
  } = deps;

  return async function handleAdminAuditRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (req.method === 'GET' && pathname === '/admin/api/audit/query') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const data = await buildAuditDatasetService({
        prisma,
        listEvents,
        getParticipants,
        tenantId,
        allowGlobal: !tenantId,
        view: urlObj.searchParams.get('view'),
        query: urlObj.searchParams.get('q'),
        userId: urlObj.searchParams.get('userId'),
        reason: urlObj.searchParams.get('reason'),
        status: urlObj.searchParams.get('status'),
        statusMode: urlObj.searchParams.get('statusMode'),
        actor: urlObj.searchParams.get('actor'),
        actorMode: urlObj.searchParams.get('actorMode'),
        reference: urlObj.searchParams.get('reference'),
        referenceMode: urlObj.searchParams.get('referenceMode'),
        actionType: urlObj.searchParams.get('actionType'),
        targetType: urlObj.searchParams.get('targetType'),
        targetId: urlObj.searchParams.get('targetId'),
        serverId: urlObj.searchParams.get('serverId'),
        runtimeKey: urlObj.searchParams.get('runtimeKey'),
        requestId: urlObj.searchParams.get('requestId') || urlObj.searchParams.get('correlationId'),
        correlationId: urlObj.searchParams.get('correlationId'),
        jobId: urlObj.searchParams.get('jobId'),
        windowMs: urlObj.searchParams.get('windowMs'),
        dateFrom: urlObj.searchParams.get('dateFrom'),
        dateTo: urlObj.searchParams.get('dateTo'),
        sortBy: urlObj.searchParams.get('sortBy'),
        sortOrder: urlObj.searchParams.get('sortOrder'),
        cursor: urlObj.searchParams.get('cursor'),
        page: urlObj.searchParams.get('page'),
        pageSize: urlObj.searchParams.get('pageSize') || urlObj.searchParams.get('limit'),
        listAdminSecurityEvents: listAdminSecurityEventsService,
      });
      sendJson(res, 200, {
        ok: true,
        data: {
          ...data,
          exportPayload: buildAuditExportPayloadService(data),
        },
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/admin/api/audit/presets') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const data = await listAuditPresetsService({
        prisma,
        authUser: auth.user,
        authRole: auth.role,
      });
      sendJson(res, 200, { ok: true, data });
      return true;
    }

    if (req.method === 'POST' && pathname === '/admin/api/audit/presets') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const body = await readJsonBody(req);
      try {
        const data = await saveAuditPresetService({
          prisma,
          actor: `admin-web:${auth?.user || 'unknown'}`,
          authUser: auth.user,
          authRole: auth.role,
          id: body?.id,
          payload: body,
        });
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          error: String(error?.message || 'Invalid request payload'),
        });
      }
      return true;
    }

    if (req.method === 'POST' && pathname === '/admin/api/audit/presets/delete') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const body = await readJsonBody(req);
      try {
        const removed = await deleteAuditPresetService({
          prisma,
          id: body?.id,
          authUser: auth.user,
          authRole: auth.role,
        });
        if (!removed) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
        sendJson(res, 200, {
          ok: true,
          data: { id: String(body?.id || '').trim() },
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 400), {
          ok: false,
          error: String(error?.message || 'Invalid request payload'),
        });
      }
      return true;
    }

    if (req.method === 'GET' && pathname === '/admin/api/audit/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const data = await buildAuditDatasetService({
        prisma,
        listEvents,
        getParticipants,
        tenantId,
        allowGlobal: !tenantId,
        view: urlObj.searchParams.get('view'),
        query: urlObj.searchParams.get('q'),
        userId: urlObj.searchParams.get('userId'),
        reason: urlObj.searchParams.get('reason'),
        status: urlObj.searchParams.get('status'),
        statusMode: urlObj.searchParams.get('statusMode'),
        actor: urlObj.searchParams.get('actor'),
        actorMode: urlObj.searchParams.get('actorMode'),
        reference: urlObj.searchParams.get('reference'),
        referenceMode: urlObj.searchParams.get('referenceMode'),
        actionType: urlObj.searchParams.get('actionType'),
        targetType: urlObj.searchParams.get('targetType'),
        targetId: urlObj.searchParams.get('targetId'),
        serverId: urlObj.searchParams.get('serverId'),
        runtimeKey: urlObj.searchParams.get('runtimeKey'),
        requestId: urlObj.searchParams.get('requestId') || urlObj.searchParams.get('correlationId'),
        correlationId: urlObj.searchParams.get('correlationId'),
        jobId: urlObj.searchParams.get('jobId'),
        windowMs: urlObj.searchParams.get('windowMs'),
        dateFrom: urlObj.searchParams.get('dateFrom'),
        dateTo: urlObj.searchParams.get('dateTo'),
        sortBy: urlObj.searchParams.get('sortBy'),
        sortOrder: urlObj.searchParams.get('sortOrder'),
        exportAll: true,
        pageSize: 5000,
        listAdminSecurityEvents: listAdminSecurityEventsService,
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(res, 200, buildAuditCsvService(data), {
          filename: `audit-${data.view}-${timestamp}.csv`,
          contentType: 'text/csv; charset=utf-8',
        });
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(buildAuditExportPayloadService(data), jsonReplacer, 2)}\n`,
        {
          filename: `audit-${data.view}-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminAuditRoutes,
};
