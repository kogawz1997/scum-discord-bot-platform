/**
 * Admin config and runtime mutation routes. These paths change environment,
 * runtime control, and config state that should stay grouped for review.
 */

const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function getRequestId(req) {
  return trimText(
    req?.__adminRequestMeta?.requestId
      || req?.headers?.['x-request-id']
      || req?.headers?.['X-Request-ID'],
    160,
  ) || null;
}

function getAdminActorId(auth) {
  return `admin-web:${trimText(auth?.user, 160) || 'unknown'}`;
}

function createAdminConfigPostRoutes(deps) {
  const {
    sendJson,
    requiredString,
    parseStringArray,
    getAuthTenantId,
    buildControlPanelEnvPatch,
    buildControlPanelEnvApplySummary,
    updateEnvFile,
    getRootEnvFilePath,
    getPortalEnvFilePath,
    recordAdminSecuritySignal,
    getClientIp,
    upsertAdminUserInDb,
    revokeSessionsForUser,
    buildClearSessionCookie,
    restartManagedRuntimeServices,
    config,
    resolveScopedTenantId,
    getPlatformTenantById,
    upsertPlatformTenantConfig,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
  } = deps;

  return async function handleAdminConfigPostRoute(context) {
    const {
      req,
      pathname,
      body,
      res,
      auth,
    } = context;

    if (pathname === '/admin/api/control-panel/env') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot modify global environment settings',
        });
        return true;
      }
      const envPatch = buildControlPanelEnvPatch(body);
      const hasRootPatch = Object.keys(envPatch.root).length > 0;
      const hasPortalPatch = Object.keys(envPatch.portal).length > 0;
      if (!hasRootPatch && !hasPortalPatch) {
        sendJson(res, 400, { ok: false, error: 'No allowed environment settings were provided' });
        return true;
      }

      const rootWrite = hasRootPatch
        ? updateEnvFile(getRootEnvFilePath(), envPatch.root)
        : { changedKeys: [] };
      const portalWrite = hasPortalPatch
        ? updateEnvFile(getPortalEnvFilePath(), envPatch.portal)
        : { changedKeys: [] };
      const applySummary = buildControlPanelEnvApplySummary({
        root: rootWrite.changedKeys,
        portal: portalWrite.changedKeys,
      });
      Object.assign(process.env, envPatch.root, envPatch.portal);

      recordAdminSecuritySignal('control-panel-env-updated', {
        actor: auth?.user || null,
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: getClientIp(req),
        path: pathname,
        detail: 'Control panel environment settings updated',
        data: {
          governance: true,
          actionType: 'control_panel.env.update',
          targetType: 'control_panel_env',
          targetId: 'control-panel-env',
          actorId: getAdminActorId(auth),
          actorRole: auth?.role || null,
          requestId: getRequestId(req),
          correlationId: getRequestId(req),
          resultStatus: 'updated',
          rootChanged: rootWrite.changedKeys,
          portalChanged: portalWrite.changedKeys,
          applySummary,
        },
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          rootChanged: rootWrite.changedKeys,
          portalChanged: portalWrite.changedKeys,
          reloadRequired: applySummary.restartRequired,
          applySummary,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/auth/user') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot manage global admin users',
        });
        return true;
      }
      const username = requiredString(body, 'username');
      const role = requiredString(body, 'role') || 'mod';
      const password = String(body?.password || '').trim();
      const isActive = body?.isActive !== false;
      const tenantId = requiredString(body, 'tenantId') || null;
      const saved = await upsertAdminUserInDb({
        username,
        role,
        password,
        isActive,
        tenantId,
      });
      const revokedSessions = typeof revokeSessionsForUser === 'function'
        ? revokeSessionsForUser(saved?.username || username, {
          actor: auth?.user || 'unknown',
          reason: 'admin-user-updated',
        })
        : [];
      const currentSessionRevoked = revokedSessions.some((entry) => entry?.id === auth?.sessionId);

      recordAdminSecuritySignal('admin-user-updated', {
        actor: auth?.user || null,
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: getClientIp(req),
        path: pathname,
        targetUser: saved?.username || username,
        detail: 'Admin user credentials or role updated',
        data: {
          governance: true,
          actionType: 'admin.user.update',
          targetType: 'admin_user',
          targetId: saved?.username || username,
          actorId: getAdminActorId(auth),
          actorRole: auth?.role || null,
          requestId: getRequestId(req),
          correlationId: getRequestId(req),
          resultStatus: 'updated',
          username: saved?.username || username,
          role: saved?.role || role,
          tenantId: saved?.tenantId || tenantId,
          isActive: saved?.isActive ?? isActive,
          passwordUpdated: Boolean(password),
          revokedSessionCount: revokedSessions.length,
        },
        notify: true,
        title: 'Admin User Updated',
      });

      sendJson(res, 200, {
        ok: true,
        data: {
          ...saved,
          revokedSessionCount: revokedSessions.length,
        },
      }, currentSessionRevoked ? {
        'Set-Cookie': typeof buildClearSessionCookie === 'function'
          ? buildClearSessionCookie(req)
          : 'scum_admin_session=; Max-Age=0',
      } : undefined);
      return true;
    }

    if (pathname === '/admin/api/runtime/restart-service') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot restart shared runtime services',
        });
        return true;
      }
      const requestedServices = parseStringArray(body?.services);
      const singleService = requiredString(body, 'service');
      const services = requestedServices.length > 0
        ? requestedServices
        : singleService
          ? [singleService]
          : [];
      if (services.length === 0) {
        sendJson(res, 400, { ok: false, error: 'service or services is required' });
        return true;
      }
      const restartResult = await restartManagedRuntimeServices(services);
      recordAdminSecuritySignal('runtime-service-restarted', {
        actor: auth?.user || null,
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: getClientIp(req),
        path: pathname,
        detail: restartResult.ok
          ? 'Managed runtime services restarted'
          : 'Managed runtime service restart failed',
        data: {
          governance: true,
          actionType: 'runtime.service.restart',
          targetType: 'runtime_service',
          targetId: services.join(','),
          actorId: getAdminActorId(auth),
          actorRole: auth?.role || null,
          requestId: getRequestId(req),
          correlationId: getRequestId(req),
          resultStatus: restartResult.ok ? 'restarted' : 'failed',
          services: restartResult.services,
          exitCode: restartResult.exitCode,
        },
        severity: restartResult.ok ? 'info' : 'warn',
        notify: restartResult.ok !== true,
        title: restartResult.ok ? 'Runtime Restart' : 'Runtime Restart Failed',
      });
      if (!restartResult.ok) {
        sendJson(res, 500, {
          ok: false,
          error: 'Service restart failed',
          data: restartResult,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: restartResult,
      });
      return true;
    }

    if (pathname === '/admin/api/config/patch') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot patch global config directly',
        });
        return true;
      }
      const patch = body?.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (typeof config.updateConfigPatch !== 'function') {
        sendJson(res, 500, { ok: false, error: 'Operation is not available' });
        return true;
      }
      const next = config.updateConfigPatch(patch);
      sendJson(res, 200, { ok: true, data: next });
      return true;
    }

    if (pathname === '/admin/api/config/set') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot replace global config directly',
        });
        return true;
      }
      const nextConfig = body?.config;
      if (!nextConfig || typeof nextConfig !== 'object' || Array.isArray(nextConfig)) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (typeof config.setFullConfig !== 'function') {
        sendJson(res, 500, { ok: false, error: 'Operation is not available' });
        return true;
      }
      const next = config.setFullConfig(nextConfig);
      sendJson(res, 200, { ok: true, data: next });
      return true;
    }

    if (pathname === '/admin/api/config/reset') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot reset global config directly',
        });
        return true;
      }
      if (typeof config.resetConfigToDefault !== 'function') {
        sendJson(res, 500, { ok: false, error: 'Operation is not available' });
        return true;
      }
      const next = config.resetConfigToDefault();
      sendJson(res, 200, { ok: true, data: next });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-config') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const updateScope = requiredString(body, 'updateScope') || 'settings';
      const permissionCheck = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: updateScope === 'modules' ? 'manage_runtimes' : 'edit_config',
        message: updateScope === 'modules'
          ? 'Your tenant role cannot change bot modules.'
          : 'Your tenant role cannot change tenant settings.',
      });
      if (!permissionCheck.allowed) return true;
      if (getAuthTenantId(auth)) {
        const actionKey = updateScope === 'modules'
          ? 'can_use_modules'
          : 'can_edit_config';
        const entitlementCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey,
          message: actionKey === 'can_use_modules'
            ? 'Module changes are locked until the current package includes module controls.'
            : 'Tenant settings changes are locked until the current package includes config editing.',
        });
        if (!entitlementCheck.allowed) {
          return true;
        }
      }
      const tenant = await getPlatformTenantById(tenantId);
      if (!tenant) {
        sendJson(res, 404, { ok: false, error: 'tenant-not-found' });
        return true;
      }
      const result = await upsertPlatformTenantConfig({
        tenantId,
        configPatch: body?.configPatch,
        portalEnvPatch: body?.portalEnvPatch,
        featureFlags: body?.featureFlags,
        updatedBy: auth?.user || null,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'tenant-config-failed' });
        return true;
      }
      recordAdminSecuritySignal('tenant.config.update', {
        actor: auth?.user || null,
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: getClientIp(req),
        path: pathname,
        detail: updateScope === 'modules'
          ? 'Tenant module configuration updated'
          : 'Tenant settings configuration updated',
        data: {
          governance: true,
          actionType: 'tenant.config.update',
          tenantId,
          targetType: 'tenant_config',
          targetId: tenantId,
          actorId: getAdminActorId(auth),
          actorRole: auth?.role || null,
          requestId: getRequestId(req),
          correlationId: getRequestId(req),
          reason: requiredString(body, 'reason') || null,
          resultStatus: 'updated',
          afterState: {
            updateScope,
            configPatchKeys: Object.keys(body?.configPatch || {}),
            portalEnvPatchKeys: Object.keys(body?.portalEnvPatch || {}),
            featureFlagKeys: Object.keys(body?.featureFlags || {}),
          },
        },
      });
      sendJson(res, 200, { ok: true, data: result.data });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminConfigPostRoutes,
};
