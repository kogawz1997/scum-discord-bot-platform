const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');

const CONFIG_APPLY_MODES = new Set(['save_only', 'save_apply', 'save_restart']);
const RESTART_MODES = new Set(['immediate', 'delayed', 'safe_restart']);
const SERVER_CONTROL_MODES = new Set(['script', 'service', 'process']);

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function createAdminRuntimeControlPostRouteHandler(deps) {
  const {
    sendJson,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    consumeActionRateLimit,
    recordAdminSecuritySignal,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerConfigSaveJob,
    scheduleRestartPlan,
    createServerBotActionJob,
  } = deps;

  function parseConfigApplyMode(value, fallback) {
    const normalized = trimText(value, 40).toLowerCase();
    if (!normalized) return fallback;
    return CONFIG_APPLY_MODES.has(normalized) ? normalized : null;
  }

  function normalizeConfigChanges(value) {
    if (value == null) return { ok: true, changes: [] };
    if (!Array.isArray(value)) {
      return { ok: false, error: 'Config changes must be an array.' };
    }
    if (value.length > 250) {
      return { ok: false, error: 'Config changes exceed the maximum allowed entries.' };
    }
    const changes = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return { ok: false, error: 'Each config change must be an object.' };
      }
      const file = trimText(entry.file, 200);
      const section = trimText(entry.section, 160);
      const key = trimText(entry.key, 160);
      if (!file || !key) {
        return { ok: false, error: 'Each config change must include file and key.' };
      }
      changes.push({
        file,
        section,
        key,
        value: Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : null,
      });
    }
    return { ok: true, changes };
  }

  function parseRestartMode(value, fallback = 'safe_restart') {
    const normalized = trimText(value, 40).toLowerCase();
    if (!normalized) return fallback;
    return RESTART_MODES.has(normalized) ? normalized : null;
  }

  function parseControlMode(value, fallback = 'service') {
    const normalized = trimText(value, 40).toLowerCase();
    if (!normalized) return fallback;
    return SERVER_CONTROL_MODES.has(normalized) ? normalized : null;
  }

  function normalizeAnnouncementPlan(value) {
    if (value == null) return { ok: true, announcementPlan: [] };
    if (!Array.isArray(value)) {
      return { ok: false, error: 'Announcement plan must be an array.' };
    }
    if (value.length > 12) {
      return { ok: false, error: 'Announcement plan exceeds the maximum allowed checkpoints.' };
    }
    const announcementPlan = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return { ok: false, error: 'Each announcement entry must be an object.' };
      }
      const delaySeconds = Number(entry.delaySeconds);
      const message = trimText(entry.message, 320);
      if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
        return { ok: false, error: 'Announcement delaySeconds must be a non-negative integer.' };
      }
      if (!message) {
        return { ok: false, error: 'Announcement message is required.' };
      }
      announcementPlan.push({
        delaySeconds: Math.trunc(delaySeconds),
        message,
      });
    }
    return { ok: true, announcementPlan };
  }

  function normalizeMetadata(value) {
    if (value == null) return { ok: true, metadata: {} };
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'Metadata must be an object.' };
    }
    return { ok: true, metadata: value };
  }

  function enforceActionRateLimit({ actionType, req, res, auth, pathname, tenantId }) {
    if (typeof consumeActionRateLimit !== 'function') return false;
    const rateLimit = consumeActionRateLimit(actionType, req, {
      actor: auth?.user || 'unknown',
      tenantId: tenantId || getAuthTenantId(auth) || 'global',
    });
    if (!rateLimit?.limited) return false;
    if (typeof recordAdminSecuritySignal === 'function') {
      recordAdminSecuritySignal(`${actionType}-rate-limited`, {
        severity: 'warn',
        actor: auth?.user || 'unknown',
        targetUser: auth?.user || 'unknown',
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: rateLimit.ip || null,
        path: pathname,
        reason: 'too-many-attempts',
        detail: `Admin action ${actionType} was rate limited`,
        data: {
          actionType,
          tenantId: tenantId || getAuthTenantId(auth) || null,
          retryAfterMs: rateLimit.retryAfterMs || 0,
        },
        notify: true,
      });
    }
    const retryAfterSec = Math.max(1, Math.ceil(Number(rateLimit.retryAfterMs || 0) / 1000));
    sendJson(res, 429, {
      ok: false,
      error: `Too many ${actionType} actions. Please wait ${retryAfterSec}s and try again.`,
    }, {
      'Retry-After': String(retryAfterSec),
    });
    return true;
  }

  function rejectInvalidPayload({ res, auth, pathname, tenantId, actionType, error, data = null }) {
    if (typeof recordAdminSecuritySignal === 'function') {
      recordAdminSecuritySignal(`${actionType}-invalid-payload`, {
        severity: 'info',
        actor: auth?.user || 'unknown',
        targetUser: auth?.user || 'unknown',
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        path: pathname,
        reason: 'invalid-request-payload',
        detail: error,
        data: {
          actionType,
          tenantId: tenantId || getAuthTenantId(auth) || null,
          ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
        },
      });
    }
    sendJson(res, 400, { ok: false, error });
    return true;
  }

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
      if (enforceActionRateLimit({
        actionType: 'config-apply',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
      const applyMode = parseConfigApplyMode(requiredString(body, 'applyMode'), 'save_apply');
      if (!applyMode) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'config-apply',
          error: 'Invalid applyMode.',
        });
      }
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
      if (enforceActionRateLimit({
        actionType: 'config-apply',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
      const applyMode = parseConfigApplyMode(requiredString(body, 'applyMode'), 'save_restart');
      if (!applyMode) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'config-apply',
          error: 'Invalid applyMode.',
        });
      }
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
      if (enforceActionRateLimit({
        actionType: 'config-apply',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
      const applyMode = parseConfigApplyMode(requiredString(body, 'applyMode'), 'save_only');
      if (!applyMode) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'config-apply',
          error: 'Invalid applyMode.',
        });
      }
      const changesResult = normalizeConfigChanges(body?.changes);
      if (!changesResult.ok) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'config-apply',
          error: changesResult.error,
        });
      }
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
        changes: changesResult.changes,
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
      if (enforceActionRateLimit({
        actionType: 'restart',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
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
      const restartMode = parseRestartMode(requiredString(body, 'restartMode'), 'safe_restart');
      if (!restartMode) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'restart',
          error: 'Invalid restartMode.',
        });
      }
      const controlMode = parseControlMode(requiredString(body, 'controlMode'), 'service');
      if (!controlMode) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'restart',
          error: 'Invalid controlMode.',
        });
      }
      const delaySeconds = Number(body?.delaySeconds);
      const normalizedDelaySeconds = Number.isFinite(delaySeconds) ? Math.max(0, Math.trunc(delaySeconds)) : 0;
      const announcementPlanResult = normalizeAnnouncementPlan(body?.announcementPlan);
      if (!announcementPlanResult.ok) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'restart',
          error: announcementPlanResult.error,
        });
      }
      const metadataResult = normalizeMetadata(body?.metadata);
      if (!metadataResult.ok) {
        return rejectInvalidPayload({
          res,
          auth,
          pathname,
          tenantId,
          actionType: 'restart',
          error: metadataResult.error,
        });
      }
      const result = await scheduleRestartPlan?.({
        tenantId,
        serverId: serverRestartMatch[1],
        guildId: requiredString(body, 'guildId') || requiredString(body, 'serverId') || serverRestartMatch[1],
        runtimeKey: requiredString(body, 'runtimeKey'),
        requestedBy: requiredString(body, 'requestedBy') || `admin-web:${auth?.user || 'unknown'}`,
        restartMode,
        controlMode,
        delaySeconds: normalizedDelaySeconds,
        reason: requiredString(body, 'reason') || 'tenant-ui-restart',
        announcementPlan: announcementPlanResult.announcementPlan,
        metadata: metadataResult.metadata,
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
      if (enforceActionRateLimit({
        actionType: 'restart',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
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
      if (serverProbeMatch[2] === 'restart' && enforceActionRateLimit({
        actionType: 'restart',
        req,
        res,
        auth,
        pathname,
        tenantId,
      })) return true;
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
