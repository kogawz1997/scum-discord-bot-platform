'use strict';

function createAdminRequestHandler(deps) {
  const {
    crypto,
    client,
    host,
    port,
    allowedOrigins,
    setRequestMeta,
    deriveRouteGroup,
    getClientIp,
    getRequestOrigin,
    recordAdminRequestLog,
    handleAdminPublicRoute,
    hasValidSession,
    isSafeHttpMethod,
    violatesBrowserOriginPolicy,
    sendJson,
    getAuthContext,
    readJsonBody,
    handleAdminAuthPostRoute,
    shouldBypassRestoreMaintenance,
    isAdminRestoreMaintenanceActive,
    sendRestoreMaintenanceUnavailable,
    handleAdminAuditRoute,
    handleAdminGetRoute,
    getAdminPermissionForPath,
    requiredRoleForPostPath,
    ensureRole,
    ensureStepUpAuth,
    handleMutationAction,
    publishAdminLiveUpdate,
    sendText,
  } = deps;

  return async function handleAdminRequest(req, res) {
    const urlObj = new URL(req.url || '/', `http://${host}:${port}`);
    const { pathname } = urlObj;
    const requestStartedAt = Date.now();
    const requestId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : crypto.randomBytes(12).toString('hex');
    res.setHeader('X-Request-ID', requestId);
    setRequestMeta(req, {
      requestId,
      method: String(req.method || 'GET').toUpperCase(),
      path: pathname,
      routeGroup: deriveRouteGroup(pathname),
      ip: getClientIp(req),
      origin: getRequestOrigin(req) || null,
      userAgent: String(req.headers['user-agent'] || '').trim() || null,
      source: pathname.startsWith('/platform/api/') ? 'platform-api' : 'admin-web',
    });
    res.once('finish', () => {
      const meta = req.__adminRequestMeta && typeof req.__adminRequestMeta === 'object'
        ? req.__adminRequestMeta
        : {};
      recordAdminRequestLog({
        id: meta.requestId || requestId,
        at: new Date().toISOString(),
        method: meta.method || req.method,
        path: meta.path || pathname,
        routeGroup: meta.routeGroup || deriveRouteGroup(pathname),
        statusCode: res.statusCode,
        latencyMs: Date.now() - requestStartedAt,
        authMode: meta.authMode || null,
        user: meta.user || null,
        role: meta.role || null,
        tenantId: meta.tenantId || null,
        ip: meta.ip || null,
        origin: meta.origin || null,
        userAgent: meta.userAgent || null,
        source: meta.source || null,
        note: meta.note || null,
        error: meta.error || null,
      });
    });

    if (await handleAdminPublicRoute({ client, req, res, urlObj, pathname, host, port })) {
      return;
    }

    if (pathname.startsWith('/admin/api/')) {
      try {
        if (
          hasValidSession(req) &&
          !isSafeHttpMethod(req.method) &&
          violatesBrowserOriginPolicy(req, allowedOrigins)
        ) {
          return sendJson(res, 403, {
            ok: false,
            error: 'Cross-site request denied',
          });
        }

        if (
          req.method === 'POST' &&
          (pathname === '/admin/api/login' || pathname === '/admin/api/logout')
        ) {
          const auth = pathname === '/admin/api/logout'
            ? getAuthContext(req, urlObj)
            : null;
          const body = pathname === '/admin/api/login'
            ? await readJsonBody(req)
            : {};
          return handleAdminAuthPostRoute({ req, pathname, body, res, auth });
        }

        if (
          (req.method === 'POST' || req.method === 'PATCH')
          && !shouldBypassRestoreMaintenance(pathname)
          && isAdminRestoreMaintenanceActive()
        ) {
          return sendRestoreMaintenanceUnavailable(res);
        }

        if (await handleAdminAuditRoute({ req, res, urlObj, pathname })) {
          return undefined;
        }

        if (
          req.method === 'GET'
          && await handleAdminGetRoute({ client, req, res, urlObj, pathname })
        ) {
          return undefined;
        }

        if (req.method === 'POST' || req.method === 'PATCH') {
          const permission = getAdminPermissionForPath(pathname, req.method);
          const requiredRole = permission?.minRole || requiredRoleForPostPath(pathname);
          const auth = ensureRole(req, urlObj, requiredRole, res);
          if (!auth) return undefined;
          const body = await readJsonBody(req);
          const elevatedAuth = ensureStepUpAuth(req, res, auth, body, permission);
          if (!elevatedAuth) return undefined;
          const out = await handleMutationAction(client, req, urlObj, pathname, body, res, auth);
          if (
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            res.writableEnded &&
            pathname !== '/admin/api/login' &&
            pathname !== '/admin/api/logout'
          ) {
            publishAdminLiveUpdate('admin-action', {
              path: pathname,
              user: auth.user,
              role: auth.role,
            });
          }
          return out;
        }

        return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      } catch (error) {
        const statusCode = Number(error?.statusCode || 500);
        setRequestMeta(req, {
          error: String(error?.message || error),
        });
        if (statusCode >= 500) {
          console.error('[admin-web] คำขอผิดพลาด', error);
        } else {
          console.warn('[admin-web] invalid request', error?.message || error);
        }
        return sendJson(res, statusCode, {
          ok: false,
          error:
            statusCode >= 500
              ? 'เซิร์ฟเวอร์ภายในผิดพลาด'
              : String(error?.message || 'คำขอไม่ถูกต้อง'),
        });
      }
    }

    return sendText(res, 404, 'ไม่พบหน้า');
  };
}

module.exports = {
  createAdminRequestHandler,
};
