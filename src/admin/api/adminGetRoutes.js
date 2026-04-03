/**
 * Admin read/query routes. This keeps GET-heavy surfaces out of the main
 * admin server entrypoint so auth and runtime wiring stay readable.
 */

const {
  createAdminBillingGetRouteHandler,
} = require('./adminBillingGetRoutes');
const {
  createAdminCommunityGetRouteHandler,
} = require('./adminCommunityGetRoutes');
const {
  createAdminDiagnosticsGetRouteHandler,
} = require('./adminDiagnosticsGetRoutes');
const {
  createAdminDonationGetRouteHandler,
} = require('./adminDonationGetRoutes');
const {
  createAdminModuleGetRouteHandler,
} = require('./adminModuleGetRoutes');
const {
  createAdminDeliveryOpsGetRouteHandler,
} = require('./adminDeliveryOpsGetRoutes');
const {
  createAdminNotificationGetRouteHandler,
} = require('./adminNotificationGetRoutes');
const {
  createAdminObservabilityGetRouteHandler,
} = require('./adminObservabilityGetRoutes');
const {
  createAdminRuntimeConfigGetRouteHandler,
} = require('./adminRuntimeConfigGetRoutes');

function createAdminGetRoutes(deps) {
  const {
    prisma,
    sendJson,
    sendDownload,
    readJsonBody,
    consumeTransientDownload,
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
    listAdminRestoreHistory,
    getPlatformAnalyticsOverview,
    buildTenantDiagnosticsBundle,
    buildTenantDiagnosticsCsv,
    buildTenantSupportCaseBundle,
    buildTenantSupportCaseCsv,
    buildDeliveryLifecycleReport,
    buildDeliveryLifecycleCsv,
    buildTenantDonationOverview,
    buildTenantModuleOverview,
    getPlatformPublicOverview,
    getPlatformPermissionCatalog,
    getPlanCatalog,
    getPackageCatalog,
    listPersistedPackageCatalog,
    getFeatureCatalog,
    getTenantFeatureAccess,
    buildTenantProductEntitlements,
    buildTenantActorAccessSummary,
    buildTenantRoleMatrix,
    getPlatformOpsState,
    getPlatformAutomationState,
    getPlatformAutomationConfig,
    getPlatformTenantConfig,
    getTenantQuotaSnapshot,
    listPlatformTenants,
    listPlatformTenantConfigs,
    listTenantStaffMemberships,
    listServerEvents,
    getParticipants,
    listRaidActivitySnapshot,
    listKillFeedEntries,
    listPlatformSubscriptions,
    listPlatformLicenses,
    listBillingInvoices,
    listBillingPaymentAttempts,
    getBillingProviderConfigSummary,
    listPlatformApiKeys,
    listPlatformWebhookEndpoints,
    listPlatformAgentRuntimes,
    listPlatformServerRegistry,
    listPlatformServerLinks,
    listServerConfigJobs,
    getServerConfigWorkspace,
    getServerConfigCategory,
    listServerConfigBackups,
    listRestartPlans,
    listRestartExecutions,
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

  async function readOptionalAdminData(label, readFn, fallback, options = {}) {
    const timeoutMs = Number(options.timeoutMs);
    let timeoutId = null;
    try {
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        return await Promise.race([
          Promise.resolve().then(() => readFn()),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error(`Timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          }),
        ]);
      }
      return await readFn();
    } catch (error) {
      console.warn(`[admin-web] optional admin data unavailable (${label})`, error?.message || error);
      return fallback;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function buildPlatformOverviewAnalyticsFallback() {
    return {
      overview: {
        activeTenants: 0,
        activeSubscriptions: 0,
        activeLicenses: 0,
        activeApiKeys: 0,
        activeWebhooks: 0,
        onlineAgentRuntimes: 0,
        totalAgentRuntimes: 0,
        totalEvents: 0,
        totalActivity: 0,
        totalTickets: 0,
        totalRevenueCents: 0,
        currency: 'THB',
      },
      trends: {
        windowDays: 7,
        timeline: [],
      },
      posture: {
        expiringSubscriptions: [],
        expiringLicenses: [],
        recentlyRevokedApiKeys: [],
        failedWebhooks: [],
        unresolvedTickets: [],
        offlineAgentRuntimes: [],
      },
    };
  }

  const handleAdminBillingGetRoute = createAdminBillingGetRouteHandler({
    ensureRole,
    sendJson,
    sendDownload,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    readOptionalAdminData,
    listBillingInvoices,
    listBillingPaymentAttempts,
    getBillingProviderConfigSummary,
    asInt,
    jsonReplacer,
  });
  const handleAdminRuntimeConfigGetRoute = createAdminRuntimeConfigGetRouteHandler({
    ensureRole,
    sendJson,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    asInt,
    listServerConfigJobs,
    listServerConfigBackups,
    getServerConfigCategory,
    getServerConfigWorkspace,
    listRestartPlans,
    listRestartExecutions,
    getPlatformTenantConfig,
    listPlatformTenantConfigs,
  });
  const handleAdminCommunityGetRoute = createAdminCommunityGetRouteHandler({
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    listServerEvents,
    getParticipants,
    listRaidActivitySnapshot,
    listKillFeedEntries,
  });
  const handleAdminNotificationGetRoute = createAdminNotificationGetRouteHandler({
    ensureRole,
    sendJson,
    sendDownload,
    asInt,
    jsonReplacer,
    listAdminNotifications,
    getAuthTenantId,
  });
  const handleAdminDiagnosticsGetRoute = createAdminDiagnosticsGetRouteHandler({
    ensureRole,
    sendJson,
    sendDownload,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    jsonReplacer,
    listPlatformSyncEvents,
    buildTenantDiagnosticsBundle,
    buildTenantDiagnosticsCsv,
    buildTenantSupportCaseBundle,
    buildTenantSupportCaseCsv,
    buildDeliveryLifecycleReport,
    buildDeliveryLifecycleCsv,
  });
  const handleAdminDonationGetRoute = createAdminDonationGetRouteHandler({
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    buildTenantDonationOverview,
  });
  const handleAdminModuleGetRoute = createAdminModuleGetRouteHandler({
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    buildTenantModuleOverview,
  });
  const handleAdminDeliveryOpsGetRoute = createAdminDeliveryOpsGetRouteHandler({
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    prisma,
    normalizePurchaseStatus,
    listKnownPurchaseStatuses,
    listAllowedPurchaseTransitions,
    listFilteredDeliveryQueue,
    listFilteredDeliveryDeadLetters,
    getDeliveryRuntimeStatus,
    listScumAdminCommandCapabilities,
    listAdminCommandCapabilityPresets,
    getDeliveryCommandOverride,
    getDeliveryDetailsByPurchaseCode,
    buildAdminDashboardCards,
    listPlayerAccounts,
    getPlayerDashboard,
  });
  const handleAdminObservabilityGetRoute = createAdminObservabilityGetRouteHandler({
    ensureRole,
    sendJson,
    sendDownload,
    requiredString,
    asInt,
    jsonReplacer,
    clampMetricsWindowMs,
    parseMetricsSeriesKeys,
    getCurrentObservabilitySnapshot,
    getAdminRequestLogMetrics,
    listAdminRequestLogs,
    buildObservabilityCsv,
    buildObservabilityExportPayload,
  });

  function buildTenantQuotaFallback(tenantId) {
    return {
      ok: false,
      reason: 'quota-unavailable',
      tenantId,
      tenant: null,
      plan: null,
      subscription: null,
      license: null,
      package: null,
      features: [],
      enabledFeatureKeys: [],
      featureOverrides: {
        enabled: [],
        disabled: [],
      },
      quotas: {},
    };
  }

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
      const rows = await listAdminSecurityEvents({
        limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        type: requiredString(urlObj.searchParams.get('type')),
        severity: requiredString(urlObj.searchParams.get('severity')),
        actor: requiredString(urlObj.searchParams.get('actor')),
        targetUser: requiredString(urlObj.searchParams.get('targetUser')),
        sessionId: requiredString(urlObj.searchParams.get('sessionId')),
      });
      sendJson(res, 200, {
        ok: true,
        data: rows,
      });
      return true;
    }

    if (pathname === '/admin/api/auth/security-events/export') {
      const auth = ensureRole(req, urlObj, 'admin', res);
      if (!auth) return true;
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const rows = await buildAdminSecurityEventExportRows(urlObj);
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
      const tenantAccess = typeof buildTenantActorAccessSummary === 'function'
        ? buildTenantActorAccessSummary({
          role: auth.role,
          status: auth.tenantId ? 'active' : 'active',
        })
        : null;
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
          tenantAccess,
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
          automationState: await getPlatformAutomationState(),
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

    if (pathname === '/admin/api/backup/restore/history') {
      const auth = ensureRole(req, urlObj, 'owner', res);
      if (!auth) return true;
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, {
          ok: false,
          error: 'Tenant-scoped admin cannot review shared restore history',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: listAdminRestoreHistory(asInt(urlObj.searchParams.get('limit'), 20) || 20),
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
      const [
        analytics,
        publicOverview,
        tenantFeatureAccess,
        opsState,
        automationState,
        tenantConfig,
      ] = await Promise.all([
        readOptionalAdminData(
          'platform-overview-analytics',
          () => getPlatformAnalyticsOverview(tenantId ? { tenantId } : { allowGlobal: true }),
          buildPlatformOverviewAnalyticsFallback(),
          { timeoutMs: 2000 },
        ),
        readOptionalAdminData(
          'platform-overview-public',
          () => getPlatformPublicOverview(),
          null,
          { timeoutMs: 2000 },
        ),
        tenantId
          ? readOptionalAdminData(
            'platform-overview-tenant-feature-access',
            () => getTenantFeatureAccess(tenantId),
            null,
            { timeoutMs: 1500 },
          )
          : Promise.resolve(null),
        readOptionalAdminData(
          'platform-overview-ops-state',
          () => getPlatformOpsState(),
          null,
          { timeoutMs: 1500 },
        ),
        readOptionalAdminData(
          'platform-overview-automation-state',
          () => getPlatformAutomationState(),
          null,
          { timeoutMs: 1500 },
        ),
        tenantId
          ? readOptionalAdminData(
            'platform-overview-tenant-config',
            () => getPlatformTenantConfig(tenantId),
            null,
            { timeoutMs: 1500 },
          )
          : Promise.resolve(null),
      ]);
      const packages = typeof listPersistedPackageCatalog === 'function'
        ? await listPersistedPackageCatalog({ includeInactive: true }).catch(() => (
          typeof getPackageCatalog === 'function' ? getPackageCatalog() : []
        ))
        : await Promise.resolve(typeof getPackageCatalog === 'function' ? getPackageCatalog() : []);
      sendJson(res, 200, {
        ok: true,
        data: {
          analytics,
          publicOverview,
          permissionCatalog: getPlatformPermissionCatalog(),
          plans: getPlanCatalog(),
          packages,
          features: typeof getFeatureCatalog === 'function' ? getFeatureCatalog() : [],
          tenantFeatureAccess,
          opsState,
          automationState,
          automationConfig: getPlatformAutomationConfig(),
          tenantConfig,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/platform/packages') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const packages = typeof listPersistedPackageCatalog === 'function'
        ? await listPersistedPackageCatalog({ includeInactive: true }).catch(() => (
          typeof getPackageCatalog === 'function' ? getPackageCatalog() : []
        ))
        : await Promise.resolve(typeof getPackageCatalog === 'function' ? getPackageCatalog() : []);
      sendJson(res, 200, {
        ok: true,
        data: packages,
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
        data: await readOptionalAdminData(
          'tenant-quota',
          () => getTenantQuotaSnapshot(tenantId, { cache: false }),
          buildTenantQuotaFallback(tenantId),
        ),
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
          ? await getTenantFeatureAccess(tenantId, { cache: false })
          : await getTenantQuotaSnapshot(tenantId, { cache: false }),
      });
      return true;
    }

    if (pathname === '/admin/api/feature-access') {
      const auth = ensureRole(req, urlObj, 'viewer', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')) || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const rawAccess = typeof getTenantFeatureAccess === 'function'
        ? await getTenantFeatureAccess(tenantId, { cache: false })
        : { tenantId, enabledFeatureKeys: [] };
      sendJson(res, 200, {
        ok: true,
        data: typeof buildTenantProductEntitlements === 'function'
          ? buildTenantProductEntitlements(rawAccess)
          : rawAccess,
      });
      return true;
    }

    if (pathname === '/admin/api/platform/ops-state') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          ...(await getPlatformOpsState()),
          automation: await getPlatformAutomationState(),
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

    if (await handleAdminRuntimeConfigGetRoute(context)) {
      return true;
    }

    if (await handleAdminCommunityGetRoute(context)) {
      return true;
    }

    if (await handleAdminDiagnosticsGetRoute(context)) {
      return true;
    }

    if (await handleAdminDonationGetRoute(context)) {
      return true;
    }

    if (await handleAdminModuleGetRoute(context)) {
      return true;
    }

    if (await handleAdminDeliveryOpsGetRoute(context)) {
      return true;
    }

    if (await handleAdminNotificationGetRoute(context)) {
      return true;
    }

    if (await handleAdminObservabilityGetRoute(context)) {
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
        data: await readOptionalAdminData('agent-registry', () => listPlatformAgentRegistry({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
        }), []),
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
        data: await readOptionalAdminData('agent-provisioning', () => listPlatformAgentProvisioningTokens({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
          status: requiredString(urlObj.searchParams.get('status')),
        }), []),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/runtime-download') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method-not-allowed' });
        return true;
      }
      const body = await readJsonBody(req);
      const token = requiredString(body?.token);
      if (!token) {
        sendJson(res, 400, { ok: false, error: 'token is required' });
        return true;
      }
      const entry = consumeTransientDownload?.(token, {
        user: auth?.user,
        tenantId: getAuthTenantId(auth),
      });
      if (!entry?.body) {
        sendJson(res, 404, { ok: false, error: 'runtime-download-not-found' });
        return true;
      }
      sendDownload(res, 200, entry.body, {
        filename: entry.filename,
        contentType: entry.contentType,
        cacheControl: 'no-store, private, max-age=0',
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
        data: await readOptionalAdminData('agent-devices', () => listPlatformAgentDevices({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
          status: requiredString(urlObj.searchParams.get('status')),
        }), []),
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
        data: await readOptionalAdminData('agent-credentials', () => listPlatformAgentCredentials({
          tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          agentId: requiredString(urlObj.searchParams.get('agentId')),
        }), []),
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

    if (pathname === '/admin/api/platform/tenant-staff') {
      const auth = ensureRole(req, urlObj, 'viewer', res);
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
        data: await listTenantStaffMemberships(tenantId, {
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
          actor: {
            role: auth.role,
            email: auth.user,
            user: auth.user,
          },
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-role-matrix') {
      const auth = ensureRole(req, urlObj, 'viewer', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')) || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const currentAccess = typeof buildTenantActorAccessSummary === 'function'
        ? buildTenantActorAccessSummary({ role: auth.role, status: 'active' })
        : null;
      sendJson(res, 200, {
        ok: true,
        data: {
          tenantId,
          currentAccess,
          roles: typeof buildTenantRoleMatrix === 'function' ? buildTenantRoleMatrix() : [],
        },
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

    if (await handleAdminBillingGetRoute(context)) {
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
      const rows = await listShopItems({
        tenantId,
        includeDisabled: true,
        includeTestItems: true,
      });
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
      const rows = await listShopItems({
        tenantId,
        includeDisabled: true,
        includeTestItems: true,
      });
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
