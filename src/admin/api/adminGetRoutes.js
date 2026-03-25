/**
 * Admin read/query routes. This keeps GET-heavy surfaces out of the main
 * admin server entrypoint so auth and runtime wiring stay readable.
 */

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildAdminNotificationsCsv(rows = []) {
  const headers = [
    'id',
    'type',
    'source',
    'kind',
    'severity',
    'title',
    'message',
    'entityKey',
    'createdAt',
    'acknowledgedAt',
    'acknowledgedBy',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escapeCsvCell(row?.[key] ?? '')).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

function createAdminGetRoutes(deps) {
  const {
    prisma,
    sendJson,
    sendDownload,
    ensureRole,
    ensurePortalTokenAuth,
    getAuthContext,
    getAuthTenantId,
    getSessionId,
    hasFreshStepUp,
    hasValidSession,
    resolveScopedTenantId,
    filterRowsByTenantScope,
    requiredString,
    asInt,
    jsonReplacer,
    getAdminSsoRoleMappingSummary,
    getAdminPermissionMatrixSummary,
    buildRoleMatrix,
    listAdminPermissionMatrix,
    listAdminSecurityEvents,
    buildAdminSecurityEventExportRows,
    buildAdminSecurityEventCsv,
    buildSecretRotationReport,
    buildSecretRotationCsv,
    listAdminSessions,
    listAdminUsersFromDb,
    buildControlPanelSettings,
    buildCommandRegistry,
    getRuntimeSupervisorSnapshot,
    getAdminRestoreState,
    getPlatformAnalyticsOverview,
    buildTenantDiagnosticsBundle,
    buildTenantDiagnosticsCsv,
    buildTenantSupportCaseBundle,
    buildTenantSupportCaseCsv,
    buildDeliveryLifecycleReport,
    buildDeliveryLifecycleCsv,
    getPlatformPublicOverview,
    getPlatformPermissionCatalog,
    getPlanCatalog,
    getPackageCatalog,
    getFeatureCatalog,
    getTenantFeatureAccess,
    getPlatformOpsState,
    getPlatformAutomationState,
    getPlatformAutomationConfig,
    getPlatformTenantConfig,
    getTenantQuotaSnapshot,
    listPlatformTenants,
    listPlatformTenantConfigs,
    listPlatformSubscriptions,
    listPlatformLicenses,
    listPlatformApiKeys,
    listPlatformWebhookEndpoints,
    listPlatformAgentRuntimes,
    listPlatformServerRegistry,
    listPlatformServerLinks,
    listPlatformAgentRegistry,
    listPlatformAgentProvisioningTokens,
    listPlatformAgentDevices,
    listPlatformAgentCredentials,
    listPlatformAgentSessions,
    listPlatformSyncRuns,
    listPlatformSyncEvents,
    listMarketplaceOffers,
    reconcileDeliveryState,
    clampMetricsWindowMs,
    parseMetricsSeriesKeys,
    getCurrentObservabilitySnapshot,
    getAdminRequestLogMetrics,
    listAdminRequestLogs,
    buildObservabilityCsv,
    buildObservabilityExportPayload,
    openLiveStream,
    listItemIconCatalog,
    listWikiWeaponCatalog,
    getWikiWeaponCatalogMeta,
    listManifestItemCatalog,
    getManifestItemCatalogMeta,
    listShopItems,
    filterShopItems,
    listUserPurchases,
    normalizePurchaseStatus,
    getPlayerDashboard,
    listActiveBountiesForUser,
    listFilteredDeliveryQueue,
    listFilteredDeliveryDeadLetters,
    getDeliveryRuntimeStatus,
    listScumAdminCommandCapabilities,
    listAdminCommandCapabilityPresets,
    getDeliveryCommandOverride,
    getDeliveryDetailsByPurchaseCode,
    listAdminNotifications,
    listKnownPurchaseStatuses,
    listAllowedPurchaseTransitions,
    buildAdminDashboardCards,
    listPlayerAccounts,
    buildAdminSnapshot,
    listAdminBackupFiles,
    SSO_DISCORD_ACTIVE,
    ADMIN_WEB_2FA_ACTIVE,
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_PATH,
    SESSION_COOKIE_SAMESITE,
    SESSION_SECURE_COOKIE,
    SESSION_COOKIE_DOMAIN,
    SESSION_TTL_MS,
    SESSION_IDLE_TIMEOUT_MS,
    SESSION_MAX_PER_USER,
    SESSION_BIND_USER_AGENT,
    ADMIN_WEB_STEP_UP_ENABLED,
    ADMIN_WEB_STEP_UP_TTL_MS,
    ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS,
  } = deps;

  return async function handleAdminGetRoute(context) {
    const {
      client,
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/auth/providers') {
      const ssoRoleMapping = getAdminSsoRoleMappingSummary(process.env);
      sendJson(res, 200, {
        ok: true,
        data: {
          loginSource: 'database',
          password: true,
          discordSso: SSO_DISCORD_ACTIVE,
          discordSsoRoleMapping: {
            enabled: ssoRoleMapping.enabled,
            defaultRole: ssoRoleMapping.defaultRole,
            hasExplicitMappings: ssoRoleMapping.hasExplicitMappings,
            hasElevatedMappings: ssoRoleMapping.hasElevatedMappings,
            ownerRoleCount: ssoRoleMapping.ownerRoleIds.length,
            adminRoleCount: ssoRoleMapping.adminRoleIds.length,
            modRoleCount: ssoRoleMapping.modRoleIds.length,
            ownerRoleNameCount: ssoRoleMapping.ownerRoleNames.length,
            adminRoleNameCount: ssoRoleMapping.adminRoleNames.length,
            modRoleNameCount: ssoRoleMapping.modRoleNames.length,
          },
          twoFactor: ADMIN_WEB_2FA_ACTIVE,
          sessionCookie: {
            name: SESSION_COOKIE_NAME,
            path: SESSION_COOKIE_PATH,
            sameSite: SESSION_COOKIE_SAMESITE,
            secure: SESSION_SECURE_COOKIE,
            domain: SESSION_COOKIE_DOMAIN || null,
          },
          sessionPolicy: {
            ttlHours: Math.round(SESSION_TTL_MS / (60 * 60 * 1000)),
            idleMinutes: Math.round(SESSION_IDLE_TIMEOUT_MS / (60 * 1000)),
            maxSessionsPerUser: SESSION_MAX_PER_USER,
            bindUserAgent: SESSION_BIND_USER_AGENT,
          },
          stepUp: {
            enabled: ADMIN_WEB_STEP_UP_ENABLED && ADMIN_WEB_2FA_ACTIVE,
            ttlMinutes: Math.round(ADMIN_WEB_STEP_UP_TTL_MS / (60 * 1000)),
            tokenSensitiveMutationsAllowed: ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS,
          },
          roleMatrix: getAdminPermissionMatrixSummary(),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/auth/role-matrix') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          summary: getAdminPermissionMatrixSummary(),
          roles: buildRoleMatrix(),
          permissions: listAdminPermissionMatrix(),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/auth/security-events') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: listAdminSecurityEvents({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          type: requiredString(urlObj.searchParams.get('type')),
          severity: requiredString(urlObj.searchParams.get('severity')),
          actor: requiredString(urlObj.searchParams.get('actor')),
          targetUser: requiredString(urlObj.searchParams.get('targetUser')),
          sessionId: requiredString(urlObj.searchParams.get('sessionId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/auth/security-events/export') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const rows = buildAdminSecurityEventExportRows(urlObj);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildAdminSecurityEventCsv(rows),
          {
            filename: `admin-security-events-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify({ ok: true, data: rows }, jsonReplacer, 2)}\n`,
        {
          filename: `admin-security-events-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/security/rotation-check') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: buildSecretRotationReport(),
      });
      return true;
    }

    if (pathname === '/admin/api/security/rotation-check/export') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      const report = buildSecretRotationReport();
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildSecretRotationCsv(report),
          {
            filename: `secret-rotation-check-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(report, jsonReplacer, 2)}\n`,
        {
          filename: `secret-rotation-check-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/auth/sessions') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      const authTenantId = getAuthTenantId(auth);
      sendJson(res, 200, {
        ok: true,
        data: listAdminSessions({
          currentSessionId: getSessionId(req),
        }).filter((row) => !authTenantId || row.tenantId === authTenantId),
      });
      return true;
    }

    if (pathname === '/admin/api/auth/users') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      const authTenantId = getAuthTenantId(auth);
      const users = await listAdminUsersFromDb(250, { activeOnly: false });
      sendJson(res, 200, {
        ok: true,
        data: authTenantId
          ? users.filter((row) => row.tenantId === authTenantId)
          : users,
      });
      return true;
    }

    if (pathname === '/admin/api/control-panel/settings') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildControlPanelSettings(client, auth, { tenantId }),
      });
      return true;
    }

    if (pathname === '/admin/api/control-panel/commands') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: buildCommandRegistry(client),
      });
      return true;
    }

    if (pathname === '/admin/api/me') {
      const auth = getAuthContext(req, urlObj);
      if (!auth) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          user: auth.user,
          role: auth.role,
          tenantId: auth.tenantId || null,
          authMethod: auth.authMethod,
          session: hasValidSession(req),
          stepUpRequired: ADMIN_WEB_STEP_UP_ENABLED && ADMIN_WEB_2FA_ACTIVE,
          stepUpActive: hasFreshStepUp(auth),
          tenantConfig: auth.tenantId ? await getPlatformTenantConfig(auth.tenantId) : null,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/health') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const runtimeSupervisor = await getRuntimeSupervisorSnapshot().catch(() => null);
      sendJson(res, 200, {
        ok: true,
        data: {
          now: new Date().toISOString(),
          guilds: client.guilds.cache.size,
          role: auth.role,
          runtimeSupervisor,
          automationState: getPlatformAutomationState(),
          automationConfig: getPlatformAutomationConfig(),
          backupRestore: getAdminRestoreState(),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/backup/restore/status') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot manage shared backups',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: getAdminRestoreState(),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/overview') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          analytics: await getPlatformAnalyticsOverview(tenantId ? { tenantId } : { allowGlobal: true }),
          publicOverview: await getPlatformPublicOverview(),
          permissionCatalog: getPlatformPermissionCatalog(),
          plans: getPlanCatalog(),
          packages: typeof getPackageCatalog === 'function' ? getPackageCatalog() : [],
          features: typeof getFeatureCatalog === 'function' ? getFeatureCatalog() : [],
          tenantFeatureAccess: tenantId && typeof getTenantFeatureAccess === 'function'
            ? await getTenantFeatureAccess(tenantId)
            : null,
          opsState: getPlatformOpsState(),
          automationState: getPlatformAutomationState(),
          automationConfig: getPlatformAutomationConfig(),
          tenantConfig: tenantId ? await getPlatformTenantConfig(tenantId) : null,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/packages') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: typeof getPackageCatalog === 'function' ? getPackageCatalog() : [],
      });
      return true;
    }

    if (pathname === '/admin/api/platform/features') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: typeof getFeatureCatalog === 'function' ? getFeatureCatalog() : [],
      });
      return true;
    }

    if (pathname === '/admin/api/platform/quota') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getTenantQuotaSnapshot(tenantId),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-feature-access') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: typeof getTenantFeatureAccess === 'function'
          ? await getTenantFeatureAccess(tenantId)
          : await getTenantQuotaSnapshot(tenantId),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/ops-state') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          ...getPlatformOpsState(),
          automation: getPlatformAutomationState(),
          automationConfig: getPlatformAutomationConfig(),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenants') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      let data = await listPlatformTenants({
        limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        status: requiredString(urlObj.searchParams.get('status')),
        type: requiredString(urlObj.searchParams.get('type')),
      });
      data = filterRowsByTenantScope(data, auth);
      sendJson(res, 200, { ok: true, data });
      return true;
    }

    if (pathname === '/admin/api/platform/servers') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformServerRegistry({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/server-discord-links') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformServerLinks({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          guildId: requiredString(urlObj.searchParams.get('guildId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-registry') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentRegistry({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-provisioning') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentProvisioningTokens({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
          status: requiredString(urlObj.searchParams.get('status')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-devices') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentDevices({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
          status: requiredString(urlObj.searchParams.get('status')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-credentials') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentCredentials({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-runtimes') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentRuntimes({
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')) || undefined,
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agent-sessions') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentSessions({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/sync-runs') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformSyncRuns({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/sync-events') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: false },
      );
      if (requiredString(urlObj.searchParams.get('tenantId')) && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformSyncEvents({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-diagnostics') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
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
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
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
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildTenantSupportCaseBundle(tenantId, {
          limit: asInt(urlObj.searchParams.get('limit'), 25) || 25,
          windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
          pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-support-case/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: true },
      );
      if (!tenantId) return true;
      const data = await buildTenantSupportCaseBundle(tenantId, {
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

    if (pathname === '/admin/api/platform/tenant-config') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformTenantConfig(tenantId),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-configs') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformTenantConfigs({
          tenantId,
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/subscriptions') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformSubscriptions({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/licenses') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformLicenses({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/apikeys') {
      // Tenant-scoped operators already create scoped API keys via the matching
      // POST route. Keep the read path aligned and rely on tenant scope
      // enforcement below instead of forcing owner role here.
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformApiKeys({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/webhooks') {
      // Same reasoning as platform/apikeys above: scoped tenant operators need
      // to inspect their own webhook endpoints without crossing tenant bounds.
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformWebhookEndpoints({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          eventType: requiredString(urlObj.searchParams.get('eventType')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/agents') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformAgentRuntimes({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/marketplace') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listMarketplaceOffers({
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          tenantId,
          status: requiredString(urlObj.searchParams.get('status')),
          locale: requiredString(urlObj.searchParams.get('locale')),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/reconcile') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await reconcileDeliveryState({
          tenantId,
          windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
          pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
          allowGlobal: !tenantId,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/runtime/supervisor') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const refreshRaw = String(urlObj.searchParams.get('refresh') || '').trim().toLowerCase();
      sendJson(res, 200, {
        ok: true,
        data: await getRuntimeSupervisorSnapshot({
          forceRefresh: refreshRaw === '1' || refreshRaw === 'true',
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/observability') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getCurrentObservabilitySnapshot({
          windowMs: clampMetricsWindowMs(urlObj.searchParams.get('windowMs')),
          seriesKeys: parseMetricsSeriesKeys(urlObj.searchParams.get('series')),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/observability/requests') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          metrics: getAdminRequestLogMetrics({
            windowMs: asInt(urlObj.searchParams.get('windowMs'), null),
          }),
          items: listAdminRequestLogs({
            limit: asInt(urlObj.searchParams.get('limit'), 200) || 200,
            statusClass: requiredString(urlObj.searchParams.get('statusClass')),
            routeGroup: requiredString(urlObj.searchParams.get('routeGroup')),
            authMode: requiredString(urlObj.searchParams.get('authMode')),
            requestId: requiredString(urlObj.searchParams.get('requestId')),
            tenantId: requiredString(urlObj.searchParams.get('tenantId')),
            pathContains: requiredString(urlObj.searchParams.get('path')),
            onlyErrors:
              String(urlObj.searchParams.get('onlyErrors') || '').trim().toLowerCase() === 'true',
          }),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/observability/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const data = await getCurrentObservabilitySnapshot({
        windowMs: clampMetricsWindowMs(urlObj.searchParams.get('windowMs')),
        seriesKeys: parseMetricsSeriesKeys(urlObj.searchParams.get('series')),
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildObservabilityCsv(data),
          {
            filename: `observability-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify(buildObservabilityExportPayload(data), jsonReplacer, 2)}\n`,
        {
          filename: `observability-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/live') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      openLiveStream(req, res);
      return true;
    }

    if (pathname === '/admin/api/items/catalog') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const query = String(urlObj.searchParams.get('q') || '').trim();
      const limit = asInt(urlObj.searchParams.get('limit'), 120);
      const items = listItemIconCatalog(query, limit || 120);
      sendJson(res, 200, {
        ok: true,
        data: { total: items.length, query, items },
      });
      return true;
    }

    if (pathname === '/admin/api/items/weapons-catalog') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const query = String(urlObj.searchParams.get('q') || '').trim();
      const limit = asInt(urlObj.searchParams.get('limit'), 200);
      const items = listWikiWeaponCatalog(query, limit || 200);
      sendJson(res, 200, {
        ok: true,
        data: {
          query,
          total: items.length,
          meta: getWikiWeaponCatalogMeta(),
          items,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/items/manifest-catalog') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const query = String(urlObj.searchParams.get('q') || '').trim();
      const category = String(urlObj.searchParams.get('category') || '').trim();
      const limit = asInt(urlObj.searchParams.get('limit'), 300);
      const items = listManifestItemCatalog({
        query,
        category,
        limit: limit || 300,
      });
      sendJson(res, 200, {
        ok: true,
        data: {
          query,
          category,
          total: items.length,
          meta: getManifestItemCatalogMeta(),
          items,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/shop/list') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const q = String(urlObj.searchParams.get('q') || '').trim();
      const kind = String(urlObj.searchParams.get('kind') || 'all').trim();
      const limit = asInt(urlObj.searchParams.get('limit'), 200) || 200;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        String(urlObj.searchParams.get('tenantId') || '').trim(),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const rows = await listShopItems({ tenantId });
      const items = filterShopItems(rows, { q, kind, limit });
      sendJson(res, 200, {
        ok: true,
        data: { query: q, kind, tenantId, total: items.length, items },
      });
      return true;
    }

    if (pathname === '/admin/api/purchase/list') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const userId = requiredString(urlObj.searchParams.get('userId'));
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const limit = Math.max(
        1,
        Math.min(1000, asInt(urlObj.searchParams.get('limit'), 100) || 100),
      );
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        String(urlObj.searchParams.get('tenantId') || '').trim(),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      const statusFilter = normalizePurchaseStatus(
        String(urlObj.searchParams.get('status') || ''),
      );
      const rows = await listUserPurchases(userId, { tenantId });
      const items = rows
        .filter((row) => !statusFilter || normalizePurchaseStatus(row.status) === statusFilter)
        .slice(0, limit);
      sendJson(res, 200, {
        ok: true,
        data: { userId, tenantId, total: items.length, items },
      });
      return true;
    }

    if (pathname === '/admin/api/portal/player/dashboard') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const dashboard = await getPlayerDashboard(portal.discordId, {
        tenantId: getAuthTenantId(portal.auth) || undefined,
      });
      if (!dashboard.ok) {
        sendJson(res, 400, {
          ok: false,
          error: dashboard.reason || 'Cannot build player dashboard',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: dashboard.data });
      return true;
    }

    if (pathname === '/admin/api/portal/shop/list') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const q = String(urlObj.searchParams.get('q') || '').trim();
      const kind = String(urlObj.searchParams.get('kind') || 'all').trim();
      const limit = asInt(urlObj.searchParams.get('limit'), 120) || 120;
      const tenantId = getAuthTenantId(portal.auth);
      const rows = await listShopItems({ tenantId });
      const items = filterShopItems(rows, { q, kind, limit });
      sendJson(res, 200, {
        ok: true,
        data: { query: q, kind, tenantId, total: items.length, items },
      });
      return true;
    }

    if (pathname === '/admin/api/portal/purchase/list') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const limit = Math.max(
        1,
        Math.min(200, asInt(urlObj.searchParams.get('limit'), 40) || 40),
      );
      const tenantId = getAuthTenantId(portal.auth);
      const statusFilter = normalizePurchaseStatus(
        String(urlObj.searchParams.get('status') || ''),
      );
      const rows = await listUserPurchases(portal.discordId, { tenantId });
      const items = rows
        .filter((row) => !statusFilter || normalizePurchaseStatus(row.status) === statusFilter)
        .slice(0, limit);
      sendJson(res, 200, {
          ok: true,
          data: {
            userId: portal.discordId,
            tenantId,
            total: items.length,
            items,
          },
      });
      return true;
    }

    if (pathname === '/admin/api/portal/bounty/list') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const items = listActiveBountiesForUser();
      sendJson(res, 200, {
        ok: true,
        data: { total: items.length, items },
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/queue') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: listFilteredDeliveryQueue({
          limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
          errorCode: String(urlObj.searchParams.get('errorCode') || '').trim(),
          q: String(urlObj.searchParams.get('q') || '').trim(),
          tenantId: tenantId || getAuthTenantId(auth) || undefined,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/dead-letter') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: listFilteredDeliveryDeadLetters({
          limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
          errorCode: String(urlObj.searchParams.get('errorCode') || '').trim(),
          q: String(urlObj.searchParams.get('q') || '').trim(),
          tenantId: tenantId || getAuthTenantId(auth) || undefined,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/lifecycle') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildDeliveryLifecycleReport({
          tenantId: tenantId || getAuthTenantId(auth) || undefined,
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
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const data = await buildDeliveryLifecycleReport({
        tenantId: tenantId || getAuthTenantId(auth) || undefined,
        limit: asInt(urlObj.searchParams.get('limit'), 120) || 120,
        pendingOverdueMs: asInt(urlObj.searchParams.get('pendingOverdueMs'), null),
        retryHeavyAttempts: asInt(urlObj.searchParams.get('retryHeavyAttempts'), null),
        poisonAttempts: asInt(urlObj.searchParams.get('poisonAttempts'), null),
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const scopeLabel = tenantId || getAuthTenantId(auth) || 'global';
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

    if (pathname === '/admin/api/delivery/runtime') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getDeliveryRuntimeStatus(),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/capabilities') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          builtin: listScumAdminCommandCapabilities(),
          presets: listAdminCommandCapabilityPresets(200),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/command-template') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      try {
        sendJson(res, 200, {
          ok: true,
          data: getDeliveryCommandOverride({
            lookupKey: String(urlObj.searchParams.get('lookupKey') || '').trim() || undefined,
            itemId: String(urlObj.searchParams.get('itemId') || '').trim() || undefined,
            gameItemId: String(urlObj.searchParams.get('gameItemId') || '').trim() || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถโหลด command template ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/detail') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const purchaseCode = String(urlObj.searchParams.get('code') || '').trim();
      if (!purchaseCode) {
        sendJson(res, 400, { ok: false, error: 'code is required' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        String(urlObj.searchParams.get('tenantId') || '').trim(),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      try {
        const data = await getDeliveryDetailsByPurchaseCode(
          purchaseCode,
          asInt(urlObj.searchParams.get('limit'), 50) || 50,
          { tenantId },
        );
        const hasData = Boolean(
          data?.purchase
            || data?.queueJob
            || data?.deadLetter
            || (Array.isArray(data?.auditRows) && data.auditRows.length > 0),
        );
        if (!hasData) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'ไม่สามารถโหลดรายละเอียด delivery ได้'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/notifications') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const acknowledgedRaw = String(urlObj.searchParams.get('acknowledged') || '').trim().toLowerCase();
      const acknowledged =
        acknowledgedRaw === 'true'
          ? true
          : acknowledgedRaw === 'false'
            ? false
            : null;
      sendJson(res, 200, {
        ok: true,
        data: {
          items: listAdminNotifications({
            limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
            type: String(urlObj.searchParams.get('type') || '').trim(),
            kind: String(urlObj.searchParams.get('kind') || '').trim(),
            severity: String(urlObj.searchParams.get('severity') || '').trim(),
            entityKey: String(urlObj.searchParams.get('entityKey') || '').trim(),
            acknowledged,
          }),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/notifications/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const acknowledgedRaw = String(urlObj.searchParams.get('acknowledged') || '').trim().toLowerCase();
      const acknowledged =
        acknowledgedRaw === 'true'
          ? true
          : acknowledgedRaw === 'false'
            ? false
            : null;
      const rows = listAdminNotifications({
        limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
        type: String(urlObj.searchParams.get('type') || '').trim(),
        kind: String(urlObj.searchParams.get('kind') || '').trim(),
        severity: String(urlObj.searchParams.get('severity') || '').trim(),
        entityKey: String(urlObj.searchParams.get('entityKey') || '').trim(),
        acknowledged,
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildAdminNotificationsCsv(rows),
          {
            filename: `admin-notifications-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify({ ok: true, data: { items: rows } }, jsonReplacer, 2)}\n`,
        {
          filename: `admin-notifications-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/purchase/statuses') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const current = normalizePurchaseStatus(
        String(urlObj.searchParams.get('current') || ''),
      );
      sendJson(res, 200, {
        ok: true,
        data: {
          knownStatuses: listKnownPurchaseStatuses(),
          currentStatus: current || null,
          allowedTransitions: current
            ? listAllowedPurchaseTransitions(current)
            : [],
        },
      });
      return true;
    }

    if (pathname === '/admin/api/dashboard/cards') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const refreshRaw = String(urlObj.searchParams.get('refresh') || '').trim().toLowerCase();
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildAdminDashboardCards({
          prisma,
          client,
          tenantId,
          forceRefresh: refreshRaw === '1' || refreshRaw === 'true',
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/player/accounts') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlayerAccounts(
          asInt(urlObj.searchParams.get('limit'), 200) || 200,
          tenantId ? { tenantId } : {},
        ),
      });
      return true;
    }

    if (pathname === '/admin/api/player/dashboard') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const userId = requiredString(urlObj.searchParams.get('userId'));
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const dashboard = await getPlayerDashboard(userId, tenantId ? { tenantId } : {});
      if (!dashboard.ok) {
        sendJson(res, 400, {
          ok: false,
          error: dashboard.reason || 'Cannot build player dashboard',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: dashboard.data });
      return true;
    }

    if (pathname === '/admin/api/snapshot') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot export shared runtime snapshots',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: await buildAdminSnapshot({
          client,
          observabilitySnapshot: await getCurrentObservabilitySnapshot(),
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/snapshot/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot export shared runtime snapshots',
        });
        return true;
      }
      const data = await buildAdminSnapshot({
        client,
        observabilitySnapshot: await getCurrentObservabilitySnapshot(),
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      sendDownload(
        res,
        200,
        `${JSON.stringify({ ok: true, data }, jsonReplacer, 2)}\n`,
        {
          filename: `snapshot-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    if (pathname === '/admin/api/backup/list') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot manage shared backups',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: listAdminBackupFiles(),
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminGetRoutes,
};
