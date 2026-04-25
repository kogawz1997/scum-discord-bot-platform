const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');
const {
  RESTART_MODES,
} = require('../../contracts/jobs/jobContracts');

const ALLOWED_APPLY_MODES = new Set(['save_only', 'save_apply', 'save_restart']);
const MAX_CONFIG_CHANGES = 500;
const MAX_RESTART_DELAY_SECONDS = 24 * 60 * 60;

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

function emitGovernanceAudit(recordAdminSecuritySignal, options = {}) {
  if (typeof recordAdminSecuritySignal !== 'function') return;
  const requestId = getRequestId(options.req);
  const auth = options.auth || {};
  const actionType = trimText(options.actionType, 120);
  if (!actionType) return;
  recordAdminSecuritySignal(actionType, {
    actor: auth?.user || null,
    role: auth?.role || null,
    authMethod: auth?.authMethod || null,
    sessionId: auth?.sessionId || null,
    ip: options.ip || null,
    path: options.pathname || options.req?.url || null,
    detail: trimText(options.detail, 500) || actionType,
    severity: options.severity || 'info',
    data: {
      governance: true,
      actionType,
      tenantId: trimText(options.tenantId, 160) || null,
      serverId: trimText(options.serverId, 160) || null,
      targetType: trimText(options.targetType, 120) || 'server',
      targetId: trimText(options.targetId, 160) || null,
      runtimeKey: trimText(options.runtimeKey, 200) || null,
      actorId: getAdminActorId(auth),
      actorRole: auth?.role || null,
      requestId,
      correlationId: requestId,
      jobId: trimText(options.jobId, 160) || null,
      reason: trimText(options.reason, 400) || null,
      resultStatus: trimText(options.resultStatus, 80) || 'queued',
      beforeState: options.beforeState || null,
      afterState: options.afterState || null,
    },
  });
}

function sendRateLimitResponse(sendJson, res, rateLimit, message) {
  const retryAfterSec = Math.max(1, Math.ceil(Number(rateLimit?.retryAfterMs || 0) / 1000));
  sendJson(res, 429, {
    ok: false,
    error: message || `Too many requests. Please wait ${retryAfterSec}s and try again.`,
    retryAfterSec,
  }, {
    'Retry-After': String(retryAfterSec),
  });
}

function enforceActionRateLimit(options = {}) {
  const {
    sendJson,
    res,
    req,
    auth,
    tenantId,
    actionKey,
    message,
    consumeAdminActionRateLimit,
    getClientIp,
    identityKey,
    path,
  } = options;
  if (typeof consumeAdminActionRateLimit !== 'function') return false;
  let ip = '';
  try {
    ip = req?.headers && typeof getClientIp === 'function' ? getClientIp(req) : '';
  } catch {
    ip = '';
  }
  const rateLimit = consumeAdminActionRateLimit(actionKey, {
    tenantId,
    actor: String(auth?.user || 'unknown').trim() || 'unknown',
    ip,
    identityKey: identityKey || '',
    path: path || req?.url || '',
  });
  if (!rateLimit?.limited) return false;
  sendRateLimitResponse(sendJson, res, rateLimit, message);
  return true;
}

function normalizeApplyMode(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ALLOWED_APPLY_MODES.has(normalized) ? normalized : null;
}

function validateConfigChanges(changes) {
  if (changes == null) {
    return { ok: true, changes: [] };
  }
  if (!Array.isArray(changes)) {
    return { ok: false, error: 'changes must be an array' };
  }
  if (changes.length > MAX_CONFIG_CHANGES) {
    return { ok: false, error: `changes cannot contain more than ${MAX_CONFIG_CHANGES} entries` };
  }
  return { ok: true, changes };
}

function needsRestartCapabilityForConfigJob(job = {}) {
  const jobType = String(job?.jobType || '').trim().toLowerCase();
  const applyMode = String(job?.applyMode || '').trim().toLowerCase();
  return applyMode === 'save_restart' || ['server_start', 'server_stop', 'probe_restart'].includes(jobType);
}

function createAdminRuntimeControlPostRouteHandler(deps) {
  const {
    sendJson,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
    getServerConfigJob,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerConfigSaveJob,
    retryServerConfigJob,
    scheduleRestartPlan,
    createServerBotActionJob,
    consumeAdminActionRateLimit,
    getClientIp,
    recordAdminSecuritySignal,
  } = deps;

  return async function handleAdminRuntimeControlPostRoute(context) {
    const {
      req,
      res,
      pathname,
      body,
      auth,
    } = context;

    const serverConfigRetryMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/jobs\/([^/]+)\/retry$/);
    if (req?.method === 'POST' && serverConfigRetryMatch) {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const serverId = serverConfigRetryMatch[1];
      const jobId = serverConfigRetryMatch[2];
      const sourceJob = await getServerConfigJob?.({
        tenantId,
        serverId,
        jobId,
      });
      if (!sourceJob) {
        sendJson(res, 404, { ok: false, error: 'server-config-job-not-found' });
        return true;
      }

      const jobType = String(sourceJob.jobType || '').trim().toLowerCase();
      if (['probe_sync', 'probe_config_access', 'probe_restart'].includes(jobType)) {
        const runtimePermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: 'manage_runtimes',
          message: 'Your tenant role cannot retry Server Bot probe jobs.',
        });
        if (!runtimePermission.allowed) return true;
        const actionKey = jobType === 'probe_sync'
          ? 'can_view_sync_status'
          : jobType === 'probe_config_access'
            ? 'can_edit_config'
            : 'can_restart_server';
        const probeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey,
          message: jobType === 'probe_sync'
            ? 'Sync probe retry is locked until the current package includes sync visibility.'
            : jobType === 'probe_config_access'
              ? 'Config access retry is locked until the current package includes config editing.'
              : 'Restart probe retry is locked until the current package includes restart control.',
        });
        if (!probeCheck.allowed) return true;
      } else {
        const editPermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: jobType === 'server_start' || jobType === 'server_stop' ? 'restart_server' : 'edit_config',
          message: jobType === 'server_start' || jobType === 'server_stop'
            ? 'Your tenant role cannot retry server control jobs.'
            : 'Your tenant role cannot retry server config jobs.',
        });
        if (!editPermission.allowed) return true;
        const editCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: jobType === 'server_start' || jobType === 'server_stop' ? 'can_restart_server' : 'can_edit_config',
          message: jobType === 'server_start' || jobType === 'server_stop'
            ? 'Server control retry is locked until the current package includes restart control.'
            : 'Server config retry is locked until the current package includes config editing.',
        });
        if (!editCheck.allowed) return true;
      }

      if (needsRestartCapabilityForConfigJob(sourceJob) && !['probe_restart', 'server_start', 'server_stop'].includes(jobType)) {
        const restartPermission = requireTenantPermission({
          sendJson,
          res,
          auth,
          permissionKey: 'restart_server',
          message: 'Your tenant role cannot retry restart-required config jobs.',
        });
        if (!restartPermission.allowed) return true;
        const restartCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: 'can_restart_server',
          message: 'Retry with restart is locked until the current package includes restart control.',
        });
        if (!restartCheck.allowed) return true;
      }

      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-config-retry',
        message: 'Too many config retry requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: `${serverId}:${jobId}`,
        path: pathname,
      })) return true;

      const result = await retryServerConfigJob?.({
        tenantId,
        serverId,
        jobId,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-retry-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

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
      const rawApplyMode = requiredString(body, 'applyMode');
      const applyMode = normalizeApplyMode(rawApplyMode, 'save_apply');
      if (!applyMode) {
        sendJson(res, 400, { ok: false, error: 'Invalid applyMode' });
        return true;
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
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-config-apply',
        message: 'Too many config apply requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: serverConfigApplyMatch[1],
        path: pathname,
      })) return true;
      const result = await createServerConfigApplyJob?.({
        tenantId,
        serverId: serverConfigApplyMatch[1],
        applyMode,
        requestId: getRequestId(req),
        actorRole: auth?.role || null,
        reason: requiredString(body, 'reason') || 'config-apply',
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-apply-failed' });
        return true;
      }
      emitGovernanceAudit(recordAdminSecuritySignal, {
        req,
        auth,
        pathname,
        tenantId,
        serverId: serverConfigApplyMatch[1],
        actionType: 'server.config.apply',
        targetType: 'server_config_job',
        targetId: result.job?.id,
        jobId: result.job?.id,
        reason: requiredString(body, 'reason') || 'config-apply',
        resultStatus: result.reused ? 'reused' : 'queued',
        afterState: {
          applyMode,
          reused: result.reused === true,
        },
      });
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
      const rawApplyMode = requiredString(body, 'applyMode');
      const applyMode = normalizeApplyMode(rawApplyMode, 'save_restart');
      if (!applyMode) {
        sendJson(res, 400, { ok: false, error: 'Invalid applyMode' });
        return true;
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
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-config-rollback',
        message: 'Too many config rollback requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: `${serverConfigRollbackMatch[1]}:${requiredString(body, 'backupId')}`,
        path: pathname,
      })) return true;
      const result = await createServerConfigRollbackJob?.({
        tenantId,
        serverId: serverConfigRollbackMatch[1],
        backupId: requiredString(body, 'backupId'),
        applyMode,
        requestId: getRequestId(req),
        actorRole: auth?.role || null,
        reason: requiredString(body, 'reason') || 'config-rollback',
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-rollback-failed' });
        return true;
      }
      emitGovernanceAudit(recordAdminSecuritySignal, {
        req,
        auth,
        pathname,
        tenantId,
        serverId: serverConfigRollbackMatch[1],
        actionType: 'server.config.rollback',
        targetType: 'server_config_job',
        targetId: result.job?.id,
        jobId: result.job?.id,
        reason: requiredString(body, 'reason') || 'config-rollback',
        resultStatus: result.reused ? 'reused' : 'queued',
        beforeState: {
          backupId: requiredString(body, 'backupId'),
        },
        afterState: {
          applyMode,
          reused: result.reused === true,
        },
      });
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
      const rawApplyMode = requiredString(body, 'applyMode');
      const applyMode = normalizeApplyMode(rawApplyMode, 'save_only');
      if (!applyMode) {
        sendJson(res, 400, { ok: false, error: 'Invalid applyMode' });
        return true;
      }
      const changesValidation = validateConfigChanges(body?.changes);
      if (!changesValidation.ok) {
        sendJson(res, 400, { ok: false, error: changesValidation.error });
        return true;
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
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-config-save',
        message: 'Too many config save requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: serverConfigPatchMatch[1],
        path: pathname,
      })) return true;
      const result = await createServerConfigSaveJob?.({
        tenantId,
        serverId: serverConfigPatchMatch[1],
        changes: changesValidation.changes,
        applyMode,
        requestId: getRequestId(req),
        actorRole: auth?.role || null,
        reason: requiredString(body, 'reason') || 'config-save',
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-save-failed' });
        return true;
      }
      emitGovernanceAudit(recordAdminSecuritySignal, {
        req,
        auth,
        pathname,
        tenantId,
        serverId: serverConfigPatchMatch[1],
        actionType: 'server.config.save',
        targetType: 'server_config_job',
        targetId: result.job?.id,
        jobId: result.job?.id,
        reason: requiredString(body, 'reason') || 'config-save',
        resultStatus: result.reused ? 'reused' : 'queued',
        afterState: {
          applyMode,
          changeCount: changesValidation.changes.length,
          reused: result.reused === true,
        },
      });
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
      const restartMode = String(requiredString(body, 'restartMode') || 'safe_restart').trim().toLowerCase();
      if (!RESTART_MODES.includes(restartMode)) {
        sendJson(res, 400, { ok: false, error: 'Invalid restartMode' });
        return true;
      }
      const delaySeconds = Number(body?.delaySeconds);
      const normalizedDelaySeconds = Number.isFinite(delaySeconds) ? Math.max(0, Math.trunc(delaySeconds)) : 0;
      if (normalizedDelaySeconds > MAX_RESTART_DELAY_SECONDS) {
        sendJson(res, 400, { ok: false, error: `delaySeconds cannot exceed ${MAX_RESTART_DELAY_SECONDS}` });
        return true;
      }
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-restart',
        message: 'Too many restart requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: serverRestartMatch[1],
        path: pathname,
      })) return true;
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
        requestId: getRequestId(req),
        actorRole: auth?.role || null,
        announcementPlan: Array.isArray(body?.announcementPlan) ? body.announcementPlan : [],
        metadata: body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? body.metadata
          : {},
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'restart-plan-failed' });
        return true;
      }
      emitGovernanceAudit(recordAdminSecuritySignal, {
        req,
        auth,
        pathname,
        tenantId,
        serverId: serverRestartMatch[1],
        actionType: 'server.restart.schedule',
        targetType: 'restart_plan',
        targetId: result.plan?.id,
        runtimeKey: requiredString(body, 'runtimeKey'),
        jobId: result.plan?.id,
        reason: requiredString(body, 'reason') || 'tenant-ui-restart',
        resultStatus: result.reused ? 'reused' : 'scheduled',
        afterState: {
          restartMode,
          controlMode: requiredString(body, 'controlMode') || 'service',
          delaySeconds: normalizedDelaySeconds,
          scheduledFor: result.plan?.scheduledFor || null,
        },
      });
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
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-control',
        message: 'Too many server control requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: `${serverControlMatch[1]}:${controlAction}`,
        path: pathname,
      })) return true;
      const result = await createServerBotActionJob?.({
        tenantId,
        serverId: serverControlMatch[1],
        runtimeKey: requiredString(body, 'runtimeKey'),
        jobType: controlAction === 'start' ? 'server_start' : 'server_stop',
        displayName: controlAction === 'start' ? 'Start server' : 'Stop server',
        requestId: getRequestId(req),
        actorRole: auth?.role || null,
        reason: requiredString(body, 'reason') || `server-${controlAction}`,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-control-job-failed' });
        return true;
      }
      emitGovernanceAudit(recordAdminSecuritySignal, {
        req,
        auth,
        pathname,
        tenantId,
        serverId: serverControlMatch[1],
        actionType: controlAction === 'start' ? 'server.start' : 'server.stop',
        targetType: 'server_config_job',
        targetId: result.job?.id,
        runtimeKey: requiredString(body, 'runtimeKey'),
        jobId: result.job?.id,
        reason: requiredString(body, 'reason') || `server-${controlAction}`,
        resultStatus: result.reused ? 'reused' : 'queued',
        afterState: {
          controlAction,
          reused: result.reused === true,
        },
      });
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
      if (enforceActionRateLimit({
        sendJson,
        res,
        req,
        auth,
        tenantId,
        actionKey: 'server-bot-probe',
        message: 'Too many Server Bot probe requests. Please wait and try again.',
        consumeAdminActionRateLimit,
        getClientIp,
        identityKey: `${serverProbeMatch[1]}:${probeType}`,
        path: pathname,
      })) return true;
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
