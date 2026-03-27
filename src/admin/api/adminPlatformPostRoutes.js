/**
 * Admin mutations for backup/platform/notification surfaces.
 */

function createAdminPlatformPostRoutes(deps) {
  const {
    sendJson,
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
    createServer,
    createServerDiscordLink,
    createSubscription,
    issuePlatformLicense,
    listPlatformLicenses,
    acceptPlatformLicenseLegal,
    createPlatformApiKey,
    createPlatformWebhookEndpoint,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerConfigSaveJob,
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
      const result = await createServerConfigApplyJob?.({
        tenantId,
        serverId: serverConfigApplyMatch[1],
        applyMode: requiredString(body, 'applyMode') || 'save_apply',
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
      const result = await createServerConfigRollbackJob?.({
        tenantId,
        serverId: serverConfigRollbackMatch[1],
        backupId: requiredString(body, 'backupId'),
        applyMode: requiredString(body, 'applyMode') || 'save_restart',
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
      const result = await createServerConfigSaveJob?.({
        tenantId,
        serverId: serverConfigPatchMatch[1],
        changes: Array.isArray(body?.changes) ? body.changes : [],
        applyMode: requiredString(body, 'applyMode') || 'save_only',
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-save-failed' });
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
      const result = await createPlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId,
        serverId: requiredString(body, 'serverId'),
        guildId: requiredString(body, 'guildId'),
        agentId: requiredString(body, 'agentId'),
        runtimeKey: requiredString(body, 'runtimeKey'),
        role: requiredString(body, 'role'),
        scope: requiredString(body, 'scope'),
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
      const result = await createPlatformAgentProvisioningToken?.({
        id: requiredString(body, 'id'),
        tokenId: requiredString(body, 'tokenId'),
        tenantId,
        serverId: requiredString(body, 'serverId'),
        guildId: requiredString(body, 'guildId'),
        agentId: requiredString(body, 'agentId'),
        runtimeKey: requiredString(body, 'runtimeKey'),
        role: requiredString(body, 'role'),
        scope: requiredString(body, 'scope'),
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

    if (pathname === '/admin/api/platform/agent-provision/revoke') {
      const result = await revokePlatformAgentProvisioningToken?.({
        tokenId: requiredString(body, 'tokenId'),
        tenantId: getAuthTenantId(auth) || requiredString(body, 'tenantId'),
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
      const result = await revokePlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId: getAuthTenantId(auth) || requiredString(body, 'tenantId'),
      }, `admin-web:${auth?.user || 'unknown'}`);
      if (!result?.ok) {
        sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-token-revoke-failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-device/revoke') {
      const result = await revokePlatformAgentDevice?.({
        deviceId: requiredString(body, 'deviceId'),
        tenantId: getAuthTenantId(auth) || requiredString(body, 'tenantId'),
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
      const result = await rotatePlatformAgentToken({
        apiKeyId: requiredString(body, 'apiKeyId'),
        tenantId: getAuthTenantId(auth) || requiredString(body, 'tenantId'),
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
