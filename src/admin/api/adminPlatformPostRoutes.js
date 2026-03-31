/**
 * Admin mutations for backup/platform/notification surfaces.
 */

const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');
const {
  resolveStrictAgentRoleScope,
} = require('../../contracts/agent/agentContracts');

function isTenantScopedAuth(auth, getAuthTenantId) {
  if (typeof getAuthTenantId !== 'function') return false;
  return Boolean(trimText(getAuthTenantId(auth), 160));
}

function trimText(value, maxLen = 160) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function parseSubscriptionMetadata(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const text = trimText(value, 4000);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractSubscriptionPackageId(row) {
  const metadata = parseSubscriptionMetadata(
    row?.metadata
      || row?.metadataJson
      || row?.meta
      || row?.metaJson,
  );
  return trimText(
    metadata.packageId
      || row?.packageId
      || row?.packageName
      || row?.planPackageId,
    120,
  ).toUpperCase();
}

function resolveRuntimeActionEntitlement(body = {}) {
  const strictProfile = resolveStrictAgentRoleScope(body);
  if (strictProfile.ok && strictProfile.runtimeKind === 'server-bots') return 'can_create_server_bot';
  if (strictProfile.ok && strictProfile.runtimeKind === 'delivery-agents') return 'can_create_delivery_agent';

  const role = trimText(body?.role, 80).toLowerCase();
  const scope = trimText(body?.scope, 80).toLowerCase();
  if (role === 'sync' || ['sync_only', 'sync-only'].includes(scope)) {
    return 'can_create_server_bot';
  }
  if (role === 'execute' || ['execute_only', 'execute-only'].includes(scope)) {
    return 'can_create_delivery_agent';
  }
  return null;
}

function createAdminPlatformPostRoutes(deps) {
  const {
    sendJson,
    prepareTransientDownload,
    requiredString,
    parseStringArray,
    getAuthTenantId,
    resolveScopedTenantId,
    createAdminBackup,
    previewAdminBackupRestore,
    restoreAdminBackup,
    getCurrentObservabilitySnapshot,
    publishAdminLiveUpdate,
    createTenant,
    createPackageCatalogEntry,
    inviteTenantStaff,
    updateTenantStaffRole,
    revokeTenantStaffMembership,
    createServer,
    createServerDiscordLink,
    createSubscription,
    deletePackageCatalogEntry,
    createCheckoutSession,
    updateInvoiceStatus,
    updatePaymentAttempt,
    updateSubscriptionBillingState,
    issuePlatformLicense,
    listPlatformSubscriptions,
    listPlatformLicenses,
    acceptPlatformLicenseLegal,
    createPlatformApiKey,
    createPlatformWebhookEndpoint,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerConfigSaveJob,
    createServerBotActionJob,
    scheduleRestartPlan,
    createPlatformAgentToken,
    createPlatformAgentProvisioningToken,
    revokePlatformAgentDevice,
    revokePlatformAgentProvisioningToken,
    revokePlatformAgentToken,
    rotatePlatformAgentToken,
    dispatchPlatformWebhookEvent,
    createMarketplaceOffer,
    reconcileDeliveryState,
    runPlatformMonitoringCycle,
    runPlatformAutomationCycle,
    acknowledgeAdminNotifications,
    clearAdminNotifications,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
    updatePackageCatalogEntry,
  } = deps;

  return async function handleAdminPlatformPostRoute(context) {
    const {
      client,
      req,
      pathname,
      body,
      res,
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

    const serverConfigPatchMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config$/);
    if (req?.method === 'PATCH' && serverConfigPatchMatch) {
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

    if (pathname === '/admin/api/backup/create') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot manage shared backups',
        });
        return true;
      }
      const note = requiredString(body, 'note') || null;
      const saved = await createAdminBackup({
        client,
        actor: auth?.user || 'unknown',
        role: auth?.role || 'unknown',
        note,
        includeSnapshot: body?.includeSnapshot !== false,
        observabilitySnapshot: await getCurrentObservabilitySnapshot(),
      });
      publishAdminLiveUpdate('backup-create', {
        backup: saved?.id || saved?.file || null,
        actor: auth?.user || 'unknown',
        role: auth?.role || 'unknown',
        note,
      });
      sendJson(res, 200, { ok: true, data: saved });
      return true;
    }

    if (pathname === '/admin/api/backup/restore') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot manage shared backups',
        });
        return true;
      }
      const backupName = requiredString(body, 'backup');
      const dryRun = body?.dryRun === true;
      if (!backupName) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      if (dryRun) {
        try {
          sendJson(res, 200, {
            ok: true,
            data: await previewAdminBackupRestore(backupName, {
              client,
              observabilitySnapshot: await getCurrentObservabilitySnapshot(),
              issuePreviewToken: true,
            }),
          });
        } catch (error) {
          sendJson(res, Number(error?.statusCode || 400), {
            ok: false,
            error: String(error?.message || 'Backup restore preview failed'),
            data: error?.data || null,
          });
        }
        return true;
      }
      try {
        sendJson(res, 200, {
          ok: true,
          data: await restoreAdminBackup(backupName, {
            client,
            actor: auth?.user || 'unknown',
            role: auth?.role || 'unknown',
            confirmBackup: requiredString(body, 'confirmBackup') || '',
            previewToken: requiredString(body, 'previewToken') || '',
            observabilitySnapshot: await getCurrentObservabilitySnapshot(),
          }),
        });
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 500), {
          ok: false,
          error:
            Number(error?.statusCode || 500) >= 500
              ? 'Backup restore failed'
              : String(error?.message || 'Backup restore failed'),
          data: error?.data || null,
        });
      }
      return true;
    }

    if (pathname === '/admin/api/platform/tenant') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot create or modify tenant records' });
        return true;
      }
      const result = await createTenant({
        id: requiredString(body, 'id'),
        slug: requiredString(body, 'slug'),
        name: requiredString(body, 'name'),
        type: requiredString(body, 'type'),
        status: requiredString(body, 'status'),
        locale: requiredString(body, 'locale'),
        ownerName: requiredString(body, 'ownerName'),
        ownerEmail: requiredString(body, 'ownerEmail'),
        parentTenantId: requiredString(body, 'parentTenantId'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-tenant-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.tenant });
      return true;
    }

    if (pathname === '/admin/api/platform/package') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot create platform packages' });
        return true;
      }
      const result = await createPackageCatalogEntry?.({
        id: requiredString(body, 'id'),
        title: requiredString(body, 'title'),
        description: requiredString(body, 'description'),
        status: requiredString(body, 'status'),
        position: body?.position,
        featureText: requiredString(body, 'featureText'),
        metadata: body?.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-package-create-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.package });
      return true;
    }

    if (pathname === '/admin/api/platform/package/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change platform packages' });
        return true;
      }
      const result = await updatePackageCatalogEntry?.({
        id: requiredString(body, 'id'),
        title: requiredString(body, 'title'),
        description: requiredString(body, 'description'),
        status: requiredString(body, 'status'),
        position: body?.position,
        featureText: requiredString(body, 'featureText'),
        metadata: body?.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-package-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.package });
      return true;
    }

    if (pathname === '/admin/api/platform/package/delete') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot delete platform packages' });
        return true;
      }
      const packageId = trimText(requiredString(body, 'packageId') || requiredString(body, 'id'), 120).toUpperCase();
      if (!packageId) {
        sendJson(res, 400, { ok: false, error: 'package-id-required' });
        return true;
      }
      const activeSubscriptions = typeof listPlatformSubscriptions === 'function'
        ? await listPlatformSubscriptions({ allowGlobal: true, limit: 5000 }).catch(() => [])
        : [];
      const usageCount = activeSubscriptions.filter((row) => extractSubscriptionPackageId(row) === packageId).length;
      if (usageCount > 0) {
        sendJson(res, 409, {
          ok: false,
          error: 'package-in-use',
          data: {
            packageId,
            usageCount,
          },
        });
        return true;
      }
      const result = await deletePackageCatalogEntry?.({
        id: packageId,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-package-delete-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-staff') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const staffPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_staff',
        message: 'Your tenant role cannot invite tenant users.',
      });
      if (!staffPermission.allowed) return true;
      const staffCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_manage_staff',
        message: 'Staff access changes are locked until the current package includes staff management.',
      });
      if (!staffCheck.allowed) return true;
      const result = await inviteTenantStaff?.({
        tenantId,
        email: requiredString(body, 'email'),
        displayName: requiredString(body, 'displayName'),
        role: requiredString(body, 'role'),
        locale: requiredString(body, 'locale'),
      }, {
        actor: `admin-web:${auth?.user || 'unknown'}`,
        role: auth?.role || 'viewer',
        email: auth?.user || '',
        user: auth?.user || '',
      });
      if (!result?.ok) {
        sendJson(res, Number(result?.statusCode || 400), {
          ok: false,
          error: result?.reason || 'tenant-staff-invite-failed',
          data: result?.message ? { message: result.message } : null,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.staff });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-staff/role') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const staffPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_staff',
        message: 'Your tenant role cannot change tenant roles.',
      });
      if (!staffPermission.allowed) return true;
      const staffCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_manage_staff',
        message: 'Role assignment is locked until the current package includes staff management.',
      });
      if (!staffCheck.allowed) return true;
      const result = await updateTenantStaffRole?.({
        tenantId,
        membershipId: requiredString(body, 'membershipId'),
        userId: requiredString(body, 'userId'),
        role: requiredString(body, 'role'),
        status: requiredString(body, 'status'),
      }, {
        actor: `admin-web:${auth?.user || 'unknown'}`,
        role: auth?.role || 'viewer',
        email: auth?.user || '',
        user: auth?.user || '',
      });
      if (!result?.ok) {
        sendJson(res, Number(result?.statusCode || 400), {
          ok: false,
          error: result?.reason || 'tenant-staff-role-failed',
          data: result?.message ? { message: result.message } : null,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.staff });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-staff/revoke') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId') || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const staffPermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_staff',
        message: 'Your tenant role cannot remove tenant users.',
      });
      if (!staffPermission.allowed) return true;
      const staffCheck = await requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId,
        actionKey: 'can_manage_staff',
        message: 'Staff revocation is locked until the current package includes staff management.',
      });
      if (!staffCheck.allowed) return true;
      const result = await revokeTenantStaffMembership?.({
        tenantId,
        membershipId: requiredString(body, 'membershipId'),
        userId: requiredString(body, 'userId'),
        revokeReason: requiredString(body, 'revokeReason'),
      }, {
        actor: `admin-web:${auth?.user || 'unknown'}`,
        role: auth?.role || 'viewer',
        email: auth?.user || '',
        user: auth?.user || '',
      });
      if (!result?.ok) {
        sendJson(res, Number(result?.statusCode || 400), {
          ok: false,
          error: result?.reason || 'tenant-staff-revoke-failed',
          data: result?.message ? { message: result.message } : null,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.staff });
      return true;
    }

    if (pathname === '/admin/api/platform/server') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createServer({
        id: requiredString(body, 'id'),
        tenantId,
        slug: requiredString(body, 'slug'),
        name: requiredString(body, 'name'),
        status: requiredString(body, 'status'),
        locale: requiredString(body, 'locale'),
        guildId: requiredString(body, 'guildId'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-server-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.server });
      return true;
    }

    if (pathname === '/admin/api/platform/server-discord-link') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createServerDiscordLink({
        id: requiredString(body, 'id'),
        tenantId,
        serverId: requiredString(body, 'serverId'),
        guildId: requiredString(body, 'guildId'),
        status: requiredString(body, 'status'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-server-discord-link-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.link });
      return true;
    }

    if (pathname === '/admin/api/platform/subscription') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createSubscription({
        id: requiredString(body, 'id'),
        tenantId,
        planId: requiredString(body, 'planId'),
        billingCycle: requiredString(body, 'billingCycle'),
        status: requiredString(body, 'status'),
        currency: requiredString(body, 'currency'),
        amountCents: body.amountCents,
        intervalDays: body.intervalDays,
        startedAt: body.startedAt,
        renewsAt: body.renewsAt,
        canceledAt: body.canceledAt,
        externalRef: requiredString(body, 'externalRef'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-subscription-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.subscription });
      return true;
    }

    if (pathname === '/admin/api/platform/subscription/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change platform subscriptions directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};
      const packageId = requiredString(body, 'packageId');
      if (packageId) {
        metadata.packageId = packageId;
      }
      const result = await updateSubscriptionBillingState?.({
        tenantId,
        subscriptionId: requiredString(body, 'subscriptionId'),
        planId: requiredString(body, 'planId'),
        billingCycle: requiredString(body, 'billingCycle'),
        status: requiredString(body, 'status'),
        currency: requiredString(body, 'currency'),
        amountCents: body.amountCents,
        renewsAt: Object.prototype.hasOwnProperty.call(body || {}, 'renewsAt') ? body.renewsAt : undefined,
        canceledAt: Object.prototype.hasOwnProperty.call(body || {}, 'canceledAt') ? body.canceledAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        metadata,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-subscription-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.subscription });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/invoice/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change platform invoices directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await updateInvoiceStatus?.({
        tenantId,
        invoiceId: requiredString(body, 'invoiceId'),
        status: requiredString(body, 'status'),
        paidAt: Object.prototype.hasOwnProperty.call(body || {}, 'paidAt') ? body.paidAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        metadata: body?.metadata,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-invoice-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.invoice });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/payment-attempt/update') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot change payment attempts directly' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await updatePaymentAttempt?.({
        tenantId,
        attemptId: requiredString(body, 'attemptId'),
        status: requiredString(body, 'status'),
        completedAt: Object.prototype.hasOwnProperty.call(body || {}, 'completedAt') ? body.completedAt : undefined,
        externalRef: requiredString(body, 'externalRef'),
        errorCode: requiredString(body, 'errorCode'),
        errorDetail: requiredString(body, 'errorDetail'),
        metadata: body?.metadata,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-payment-attempt-update-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.attempt });
      return true;
    }

    if (pathname === '/admin/api/platform/billing/checkout-session') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot create owner billing checkout sessions' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createCheckoutSession?.({
        tenantId,
        invoiceId: requiredString(body, 'invoiceId'),
        subscriptionId: requiredString(body, 'subscriptionId'),
        customerId: requiredString(body, 'customerId'),
        planId: requiredString(body, 'planId'),
        packageId: requiredString(body, 'packageId'),
        billingCycle: requiredString(body, 'billingCycle'),
        currency: requiredString(body, 'currency'),
        amountCents: body?.amountCents,
        successUrl: requiredString(body, 'successUrl'),
        cancelUrl: requiredString(body, 'cancelUrl'),
        checkoutUrl: requiredString(body, 'checkoutUrl'),
        metadata: body?.metadata,
        actor: `owner-web:${auth?.user || 'unknown'}`,
      });
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-checkout-session-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { session: result.session, invoice: result.invoice } });
      return true;
    }

    if (pathname === '/admin/api/platform/license') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await issuePlatformLicense({
        id: requiredString(body, 'id'),
        tenantId,
        licenseKey: requiredString(body, 'licenseKey'),
        status: requiredString(body, 'status'),
        seats: body.seats,
        issuedAt: body.issuedAt,
        expiresAt: body.expiresAt,
        legalDocVersion: requiredString(body, 'legalDocVersion'),
        legalAcceptedAt: body.legalAcceptedAt,
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-license-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.license });
      return true;
    }

    if (pathname === '/admin/api/platform/license/accept-legal') {
      if (getAuthTenantId(auth)) {
        const tenantLicenses = await listPlatformLicenses({
          limit: 500,
          tenantId: getAuthTenantId(auth),
        });
        const requestedLicenseId = requiredString(body, 'licenseId');
        if (!tenantLicenses.some((row) => String(row?.id || '').trim() === requestedLicenseId)) {
          sendJson(res, 403, { ok: false, error: 'Forbidden: tenant scope mismatch' });
          return true;
        }
      }
      const result = await acceptPlatformLicenseLegal({
        licenseId: requiredString(body, 'licenseId'),
        legalDocVersion: requiredString(body, 'legalDocVersion'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-license-legal-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.license });
      return true;
    }

    if (pathname === '/admin/api/platform/apikey') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createPlatformApiKey({
        id: requiredString(body, 'id'),
        tenantId,
        name: requiredString(body, 'name'),
        status: requiredString(body, 'status'),
        scopes: parseStringArray(body.scopes),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-apikey-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-token') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const strictProfile = resolveStrictAgentRoleScope(body);
      if (!strictProfile.ok) {
        sendJson(res, 400, { ok: false, error: strictProfile.reason || 'strict-agent-role-scope-required' });
        return true;
      }
      const result = await createPlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId,
        serverId: requiredString(body, 'serverId'),
        guildId: requiredString(body, 'guildId'),
        agentId: requiredString(body, 'agentId'),
        runtimeKey: requiredString(body, 'runtimeKey'),
        role: strictProfile.role,
        scope: strictProfile.scope,
        runtimeKind: strictProfile.runtimeKind,
        name: requiredString(body, 'name'),
        displayName: requiredString(body, 'displayName'),
        minimumVersion: requiredString(body, 'minimumVersion'),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-token-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-provision') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const strictProfile = resolveStrictAgentRoleScope(body);
      if (!strictProfile.ok) {
        sendJson(res, 400, { ok: false, error: strictProfile.reason || 'strict-agent-role-scope-required' });
        return true;
      }
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot create tenant runtimes.',
      });
      if (!runtimePermission.allowed) return true;
      const runtimeActionKey = resolveRuntimeActionEntitlement(body);
      if (runtimeActionKey && isTenantScopedAuth(auth, getAuthTenantId)) {
        const runtimeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: runtimeActionKey,
          message: runtimeActionKey === 'can_create_server_bot'
            ? 'Server Bot setup is locked until the current package includes Server Bot support.'
            : 'Delivery Agent setup is locked until the current package includes delivery runtime support.',
        });
        if (!runtimeCheck.allowed) return true;
      }
      const result = await createPlatformAgentProvisioningToken?.({
        id: requiredString(body, 'id'),
        tokenId: requiredString(body, 'tokenId'),
        tenantId,
        serverId: requiredString(body, 'serverId'),
        guildId: requiredString(body, 'guildId'),
        agentId: requiredString(body, 'agentId'),
        runtimeKey: requiredString(body, 'runtimeKey'),
        role: strictProfile.role,
        scope: strictProfile.scope,
        runtimeKind: strictProfile.runtimeKind,
        name: requiredString(body, 'name'),
        displayName: requiredString(body, 'displayName'),
        minimumVersion: requiredString(body, 'minimumVersion'),
        expiresAt: requiredString(body, 'expiresAt'),
        metadata: body.metadata,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-provision-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/runtime-download/prepare') {
      const prepared = prepareTransientDownload?.({
        filename: requiredString(body, 'filename'),
        content: typeof body?.content === 'string' ? body.content : '',
        mimeType: requiredString(body, 'mimeType'),
      }, {
        user: auth?.user,
        tenantId: getAuthTenantId(auth) || requiredString(body, 'tenantId'),
      });
      if (!prepared?.ok) {
        const statusCode = prepared?.reason === 'content-too-large' ? 413 : 400;
        sendJson(res, statusCode, {
          ok: false,
          error: prepared?.reason || 'runtime-download-prepare-failed',
          data: prepared?.maxContentBytes
            ? { maxContentBytes: prepared.maxContentBytes }
            : undefined,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          filename: prepared.filename,
          expiresAt: prepared.expiresAt,
          downloadUrl: `/admin/api/platform/runtime-download?token=${encodeURIComponent(prepared.token)}`,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-provision/revoke') {
      const tenantId = getAuthTenantId(auth) || requiredString(body, 'tenantId');
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot revoke tenant runtime setup.',
      });
      if (!runtimePermission.allowed) return true;
      const runtimeActionKey = resolveRuntimeActionEntitlement(body);
      if (tenantId && runtimeActionKey && isTenantScopedAuth(auth, getAuthTenantId)) {
        const runtimeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: runtimeActionKey,
          message: 'Runtime setup token management is locked in the current package.',
        });
        if (!runtimeCheck.allowed) return true;
      }
      const result = await revokePlatformAgentProvisioningToken?.({
        tokenId: requiredString(body, 'tokenId'),
        tenantId,
        revokeReason: requiredString(body, 'revokeReason'),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-provision-revoke-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-token/revoke') {
      const tenantId = getAuthTenantId(auth) || requiredString(body, 'tenantId');
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot revoke tenant runtime tokens.',
      });
      if (!runtimePermission.allowed) return true;
      const runtimeActionKey = resolveRuntimeActionEntitlement(body);
      if (tenantId && runtimeActionKey && isTenantScopedAuth(auth, getAuthTenantId)) {
        const runtimeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: runtimeActionKey,
          message: 'Runtime credential management is locked in the current package.',
        });
        if (!runtimeCheck.allowed) return true;
      }
      const result = await revokePlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-token-revoke-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-device/revoke') {
      const tenantId = getAuthTenantId(auth) || requiredString(body, 'tenantId');
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot reset tenant runtime bindings.',
      });
      if (!runtimePermission.allowed) return true;
      const runtimeActionKey = resolveRuntimeActionEntitlement(body);
      if (tenantId && runtimeActionKey && isTenantScopedAuth(auth, getAuthTenantId)) {
        const runtimeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: runtimeActionKey,
          message: 'Runtime device reset is locked in the current package.',
        });
        if (!runtimeCheck.allowed) return true;
      }
      const result = await revokePlatformAgentDevice?.({
        deviceId: requiredString(body, 'deviceId'),
        tenantId,
        revokeReason: requiredString(body, 'revokeReason'),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-device-revoke-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-token/rotate') {
      const tenantId = getAuthTenantId(auth) || requiredString(body, 'tenantId');
      const runtimePermission = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_runtimes',
        message: 'Your tenant role cannot reissue tenant runtime setup tokens.',
      });
      if (!runtimePermission.allowed) return true;
      const runtimeActionKey = resolveRuntimeActionEntitlement(body);
      if (tenantId && runtimeActionKey && isTenantScopedAuth(auth, getAuthTenantId)) {
        const runtimeCheck = await requireTenantActionEntitlement({
          sendJson,
          res,
          getTenantFeatureAccess,
          buildTenantProductEntitlements,
          tenantId,
          actionKey: runtimeActionKey,
          message: 'Runtime credential rotation is locked in the current package.',
        });
        if (!runtimeCheck.allowed) return true;
      }
      const result = await rotatePlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId,
        name: requiredString(body, 'name'),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-token-rotate-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/webhook') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createPlatformWebhookEndpoint({
        id: requiredString(body, 'id'),
        tenantId,
        name: requiredString(body, 'name'),
        eventType: requiredString(body, 'eventType'),
        targetUrl: requiredString(body, 'targetUrl'),
        secretValue: requiredString(body, 'secretValue'),
        enabled: body.enabled !== false,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-webhook-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.webhook });
      return true;
    }

    if (pathname === '/admin/api/platform/webhook/test') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          tenantId,
          eventType: requiredString(body, 'eventType') || 'platform.admin.test',
          results: await dispatchPlatformWebhookEvent(
            requiredString(body, 'eventType') || 'platform.admin.test',
            body.payload && typeof body.payload === 'object'
              ? body.payload
              : {
                source: 'admin-web',
                actor: auth?.user || 'unknown',
                triggeredAt: new Date().toISOString(),
              },
            { tenantId },
          ),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/marketplace') {
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(body, 'tenantId'),
        { required: true },
      );
      if (!tenantId) return true;
      const result = await createMarketplaceOffer({
        id: requiredString(body, 'id'),
        tenantId,
        title: requiredString(body, 'title'),
        kind: requiredString(body, 'kind'),
        priceCents: body.priceCents,
        currency: requiredString(body, 'currency'),
        status: requiredString(body, 'status'),
        locale: requiredString(body, 'locale'),
        meta: body.meta,
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'platform-marketplace-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.offer });
      return true;
    }

    if (pathname === '/admin/api/platform/reconcile') {
      const requestedTenantId = requiredString(body, 'tenantId');
      const scopedTenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId,
        { required: false },
      );
      if (requestedTenantId && !scopedTenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await reconcileDeliveryState({
          tenantId: scopedTenantId,
          windowMs: body.windowMs,
          pendingOverdueMs: body.pendingOverdueMs,
          allowGlobal: !scopedTenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/monitoring/run') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot run shared platform monitoring directly' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: await runPlatformMonitoringCycle({
          client,
          force: true,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/automation/run') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot run shared platform automation directly' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: await runPlatformAutomationCycle({
          client,
          force: body?.force !== false,
          dryRun: body?.dryRun === true,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/notifications/ack') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot acknowledge shared owner notifications' });
        return true;
      }
      const ids = parseStringArray(body?.ids);
      if (ids.length === 0) {
        sendJson(res, 400, { ok: false, error: 'ids is required' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: acknowledgeAdminNotifications(ids, auth?.user || 'unknown'),
      });
      return true;
    }

    if (pathname === '/admin/api/notifications/clear') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot clear shared owner notifications' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: clearAdminNotifications({
          acknowledgedOnly: body?.acknowledgedOnly === true,
        }),
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminPlatformPostRoutes,
};
