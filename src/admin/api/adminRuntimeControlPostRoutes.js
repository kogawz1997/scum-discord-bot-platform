const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');

function createAdminRuntimeControlPostRouteHandler(deps) {
  const {
    sendJson,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerConfigSaveJob,
    scheduleRestartPlan,
    createServerBotActionJob,
  } = deps;

  return async function handleAdminRuntimeControlPostRoute(context) {
    const {
      req,
      res,
      pathname,
      body,
      auth,
    } = context;

    const serverConfigApplyMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/apply$/);
    if (req?.method === 'POST' && serverConfigApplyMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const applyMode = requiredString(body, 'applyMode') || 'save_apply';
      const editPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'edit_config',
        message: 'Your tenant role cannot apply server config changes.',
      });
      if (!editPermission.allowed) return true;
      const editCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_edit_config',
        message: 'Config apply is locked until the current package includes config editing.',
      });
      if (!editCheck.allowed) return true;
      if (applyMode === 'save_restart') {
        const restartPermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: 'restart_server',
          message: 'Your tenant role cannot run restart-required config actions.',
        });
        if (!restartPermission.allowed) return true;
        const restartCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_restart_server',
          message: 'Save and Restart is locked until the current package includes restart control.',
        });
        if (!restartCheck.allowed) return true;
      }
      const result = await createServerConfigApplyJob?.({
        tenantId,
        serverId: serverConfigApplyMatch[1],
        applyMode,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-apply-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    const serverConfigRollbackMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/rollback$/);
    if (req?.method === 'POST' && serverConfigRollbackMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const applyMode = requiredString(body, 'applyMode') || 'save_restart';
      const editPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'edit_config',
        message: 'Your tenant role cannot roll back server config changes.',
      });
      if (!editPermission.allowed) return true;
      const editCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_edit_config',
        message: 'Rollback is locked until the current package includes config editing.',
      });
      if (!editCheck.allowed) return true;
      if (applyMode === 'save_restart') {
        const restartPermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: 'restart_server',
          message: 'Your tenant role cannot run rollback with restart.',
        });
        if (!restartPermission.allowed) return true;
        const restartCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_restart_server',
          message: 'Rollback with restart is locked until the current package includes restart control.',
        });
        if (!restartCheck.allowed) return true;
      }
      const result = await createServerConfigRollbackJob?.({
        tenantId,
        serverId: serverConfigRollbackMatch[1],
        backupId: requiredString(body, 'backupId'),
        applyMode,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-rollback-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    const serverConfigPatchMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/save$/);
    if (req?.method === 'POST' && serverConfigPatchMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const applyMode = requiredString(body, 'applyMode') || 'save_only';
      const editPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'edit_config',
        message: 'Your tenant role cannot save server config changes.',
      });
      if (!editPermission.allowed) return true;
      const editCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_edit_config',
        message: 'Server Config save is locked until the current package includes config editing.',
      });
      if (!editCheck.allowed) return true;
      if (applyMode === 'save_restart') {
        const restartPermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: 'restart_server',
          message: 'Your tenant role cannot save and restart the server.',
        });
        if (!restartPermission.allowed) return true;
        const restartCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_restart_server',
          message: 'Save and Restart is locked until the current package includes restart control.',
        });
        if (!restartCheck.allowed) return true;
      }
      const result = await createServerConfigSaveJob?.({
        tenantId,
        serverId: serverConfigPatchMatch[1],
        changes: Array.isArray(body?.changes) ? body.changes : [],
        applyMode,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-save-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    const serverRestartMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/restart$/);
    if (req?.method === 'POST' && serverRestartMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const restartPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'restart_server',
        message: 'Your tenant role cannot queue server restarts.',
      });
      if (!restartPermission.allowed) return true;
      const restartCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_restart_server',
        message: 'Restart actions are locked until the current package includes restart control.',
      });
      if (!restartCheck.allowed) return true;
      const restartMode = requiredString(body, 'restartMode') || 'safe_restart';
      const delaySeconds = Number(body?.delaySeconds);
      const normalizedDelaySeconds = Number.isFinite(delaySeconds) ? Math.max(0, Math.trunc(delaySeconds)) : 0;
      const result = await scheduleRestartPlan?.({
        tenantId,
        serverId: serverRestartMatch[1],
        guildId: requiredString(body, 'guildId') || requiredString(body, 'serverId') || serverRestartMatch[1],
        runtimeKey: requiredString(body, 'runtimeKey'),
        requestedBy: requiredString(body, 'requestedBy') || `admin-web:${auth?.user || 'unknown'}`,
        restartMode,
        controlMode: requiredString(body, 'controlMode') || 'service',
        delaySeconds: normalizedDelaySeconds,
        reason: requiredString(body, 'reason') || 'tenant-ui-restart',
        announcementPlan: Array.isArray(body?.announcementPlan) ? body.announcementPlan : [],
        metadata: body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? body.metadata
          : {},
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'restart-plan-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    const serverControlMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/control\/(start|stop)$/);
    if (req?.method === 'POST' && serverControlMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const controlPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'restart_server',
        message: 'Your tenant role cannot control server start and stop actions.',
      });
      if (!controlPermission.allowed) return true;
      const controlCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_restart_server',
        message: 'Server control is locked until the current package includes restart control.',
      });
      if (!controlCheck.allowed) return true;
      const controlAction = String(serverControlMatch[2] || '').trim().toLowerCase();
      const result = await createServerBotActionJob?.({
        tenantId,
        serverId: serverControlMatch[1],
        runtimeKey: requiredString(body, 'runtimeKey'),
        jobType: controlAction === 'start' ? 'server_start' : 'server_stop',
        displayName: controlAction === 'start' ? 'Start server' : 'Stop server',
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-control-job-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    const serverProbeMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/probes\/(sync|config-access|restart)$/);
    if (req?.method === 'POST' && serverProbeMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot run Server Bot probe actions.',
      });
      if (!runtimePermission.allowed) return true;
      const probeType = String(serverProbeMatch[2] || '').trim().toLowerCase();
      const actionKey = probeType === 'sync'
        ? 'can_view_sync_status'
        : probeType === 'config-access'
          ? 'can_edit_config'
          : 'can_restart_server';
      const probeCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey,
        message: probeType === 'sync'
          ? 'Sync tests are locked until the current package includes sync visibility.'
          : probeType === 'config-access'
            ? 'Config access tests are locked until the current package includes config editing.'
            : 'Restart tests are locked until the current package includes restart control.',
      });
      if (!probeCheck.allowed) return true;
      const jobType = probeType === 'sync'
        ? 'probe_sync'
        : probeType === 'config-access'
          ? 'probe_config_access'
          : 'probe_restart';
      const result = await createServerBotActionJob?.({
        tenantId,
        serverId: serverProbeMatch[1],
        runtimeKey: requiredString(body, 'runtimeKey'),
        jobType,
        displayName: probeType,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-bot-probe-job-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminRuntimeControlPostRouteHandler,
};
