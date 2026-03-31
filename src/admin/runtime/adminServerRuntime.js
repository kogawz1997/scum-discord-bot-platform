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
    buildClearSessionCookie,
    invalidateSession,
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
    resolveTenantSessionAccessContext,
    resolveAdminSessionAccessContext,
  } = deps;

  function normalizeSurfaceApiPath(pathname) {
    const raw = String(pathname || '').trim();
    if (raw.startsWith('/owner/api/')) {
      return `/admin/api/${raw.slice('/owner/api/'.length)}`;
    }
    if (raw.startsWith('/tenant/api/')) {
      return `/admin/api/${raw.slice('/tenant/api/'.length)}`;
    }
    return raw;
  }

  function detectRequestedSurface(pathname) {
    const raw = String(pathname || '').trim();
    if (raw.startsWith('/owner/api/')) return 'owner';
    if (raw.startsWith('/tenant/api/')) return 'tenant';
    return 'admin';
  }

  function canAccessRequestedSurface(auth, requestedSurface) {
    const normalizedSurface = String(requestedSurface || 'admin').trim().toLowerCase();
    if (normalizedSurface === 'owner') {
      return Boolean(auth && String(auth.role || '').trim().toLowerCase() === 'owner' && !auth.tenantId);
    }
    if (normalizedSurface === 'tenant') {
      return Boolean(auth && String(auth.tenantId || '').trim());
    }
    return true;
  }

  function sendSurfaceAccessDenied(res, requestedSurface) {
    const normalizedSurface = String(requestedSurface || 'admin').trim().toLowerCase();
    const targetSurface = normalizedSurface === 'tenant' ? 'tenant' : 'owner';
    const message = normalizedSurface === 'tenant'
      ? 'Tenant-scoped access is required for this API surface.'
      : 'Platform owner access is required for this API surface.';
    return sendJson(res, 403, {
      ok: false,
      error: 'surface-access-denied',
      data: {
        surface: targetSurface,
        message,
      },
    });
  }

  async function getEffectiveAuth(req, res, urlObj) {
    const auth = getAuthContext(req, urlObj);
    if (!auth || auth.mode !== 'session') {
      return auth;
    }
    let resolved = null;
    let invalidReason = 'admin-session-invalid';
    let defaultAuthMethod = 'password-db';
    if (auth.tenantId) {
      if (typeof resolveTenantSessionAccessContext !== 'function') {
        return auth;
      }
      resolved = await resolveTenantSessionAccessContext({
        tenantId: auth.tenantId,
        userId: auth.userId,
        email: auth.primaryEmail || auth.user,
        authMethod: auth.authMethod,
      });
      invalidReason = 'tenant-session-invalid';
      defaultAuthMethod = 'platform-user-password';
    } else {
      if (typeof resolveAdminSessionAccessContext !== 'function') {
        return auth;
      }
      resolved = await resolveAdminSessionAccessContext({
        username: auth.user,
        authMethod: auth.authMethod,
      });
    }
    if (!resolved?.ok || !resolved?.authContext) {
      if (typeof invalidateSession === 'function' && auth.sessionId) {
        invalidateSession(auth.sessionId, {
          actor: auth.user || 'system',
          reason: resolved?.reason || invalidReason,
        });
      }
      req.__resolvedAdminAuthContext = null;
      if (typeof buildClearSessionCookie === 'function') {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Set-Cookie', buildClearSessionCookie(req));
        } else {
          res.headers = { ...(res.headers || {}), 'Set-Cookie': buildClearSessionCookie(req) };
        }
      }
      sendJson(res, 401, {
        ok: false,
        error: resolved?.reason || invalidReason,
      });
      return null;
    }
    const effectiveAuth = {
      ...auth,
      ...resolved.authContext,
      mode: auth.mode,
      sessionId: auth.sessionId,
      authMethod: auth.authMethod || resolved.authContext.authMethod || defaultAuthMethod,
    };
    req.__resolvedAdminAuthContext = effectiveAuth;
    setRequestMeta(req, {
      authMode: effectiveAuth.mode,
      sessionId: effectiveAuth.sessionId,
      user: effectiveAuth.user,
      role: effectiveAuth.role,
      tenantId: effectiveAuth.tenantId || null,
    });
    return effectiveAuth;
  }

  return async function handleAdminRequest(req, res) {
    const urlObj = new URL(req.url || '/', `http://${host}:${port}`);
    const { pathname } = urlObj;
    const normalizedPathname = normalizeSurfaceApiPath(pathname);
    const requestedSurface = detectRequestedSurface(pathname);
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
      routeGroup: deriveRouteGroup(normalizedPathname),
      ip: getClientIp(req),
      origin: getRequestOrigin(req) || null,
      userAgent: String(req.headers['user-agent'] || '').trim() || null,
      source: normalizedPathname.startsWith('/platform/api/') ? 'platform-api' : 'admin-web',
      note: requestedSurface !== 'admin' ? `surface:${requestedSurface}` : null,
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
        routeGroup: meta.routeGroup || deriveRouteGroup(normalizedPathname),
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

    if (
      normalizedPathname.startsWith('/admin/api/')
      && pathname !== '/tenant/api/auth/login'
    ) {
      try {
        const auth = await getEffectiveAuth(req, res, urlObj);
        if (res.writableEnded) return undefined;
        const isSessionMutation = (
          req.method === 'POST'
          && (normalizedPathname === '/admin/api/login' || normalizedPathname === '/admin/api/logout')
        );
        const isSessionIntrospection = (
          req.method === 'GET'
          && normalizedPathname === '/admin/api/me'
        );
        if (
          requestedSurface !== 'admin'
          && !isSessionMutation
          && !isSessionIntrospection
          && !canAccessRequestedSurface(auth, requestedSurface)
        ) {
          return sendSurfaceAccessDenied(res, requestedSurface);
        }

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

        if (isSessionMutation) {
          const authContext = normalizedPathname === '/admin/api/logout'
            ? auth
            : null;
          const body = normalizedPathname === '/admin/api/login'
            ? await readJsonBody(req)
            : {};
          return handleAdminAuthPostRoute({ req, pathname: normalizedPathname, body, res, auth: authContext });
        }

        if (
          (req.method === 'POST' || req.method === 'PATCH')
          && !shouldBypassRestoreMaintenance(normalizedPathname)
          && isAdminRestoreMaintenanceActive()
        ) {
          return sendRestoreMaintenanceUnavailable(res);
        }

        if (await handleAdminAuditRoute({ req, res, urlObj, pathname: normalizedPathname })) {
          return undefined;
        }

        if (
          req.method === 'GET'
          && await handleAdminGetRoute({ client, req, res, urlObj, pathname: normalizedPathname })
        ) {
          return undefined;
        }

        if (req.method === 'POST' || req.method === 'PATCH') {
          const permission = getAdminPermissionForPath(normalizedPathname, req.method);
          const requiredRole = permission?.minRole || requiredRoleForPostPath(normalizedPathname);
          const ensuredAuth = ensureRole(req, urlObj, requiredRole, res);
          if (!ensuredAuth) return undefined;
          if (requestedSurface !== 'admin' && !canAccessRequestedSurface(ensuredAuth, requestedSurface)) {
            return sendSurfaceAccessDenied(res, requestedSurface);
          }
          const body = await readJsonBody(req);
          const elevatedAuth = ensureStepUpAuth(req, res, ensuredAuth, body, permission);
          if (!elevatedAuth) return undefined;
          const out = await handleMutationAction(client, req, urlObj, normalizedPathname, body, res, elevatedAuth);
          if (
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            res.writableEnded &&
            normalizedPathname !== '/admin/api/login' &&
            normalizedPathname !== '/admin/api/logout'
          ) {
            publishAdminLiveUpdate('admin-action', {
              path: normalizedPathname,
              user: elevatedAuth.user,
              role: elevatedAuth.role,
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
