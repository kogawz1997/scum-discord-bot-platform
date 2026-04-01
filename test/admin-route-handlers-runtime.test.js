const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminRouteHandlersRuntime,
} = require('../src/admin/runtime/adminRouteHandlersRuntime');

test('admin route handlers runtime wires service outputs into route factories', () => {
  const entityMarker = () => {};
  const configMarker = () => {};
  const publicMarker = () => {};
  const getMarker = () => {};
  const authMarker = () => {};
  const commerceMarker = () => {};
  const portalMarker = () => {};
  const platformMarker = () => {};
  const auditMarker = () => {};
  const deriveMarker = () => 'derive';
  const mutateMarker = () => 'mutate';

  let agentFactoryDeps = null;
  let syncFactoryDeps = null;
  let configServiceDeps = null;
  let publicRouteDeps = null;
  let getRouteDeps = null;
  let platformPostDeps = null;
  let routeRuntimeDeps = null;

  const runtime = createAdminRouteHandlersRuntime({
    createServerRegistryService: () => ({
      createServer: 'create-server-marker',
      createServerDiscordLink: 'create-server-discord-link-marker',
      listServerLinks: 'list-server-links-marker',
      listServerRegistry: 'list-server-registry-marker',
    }),
    createAgentRegistryService: (deps) => {
      agentFactoryDeps = deps;
      return {
        activateAgent: 'activate-agent-marker',
        createAgentProvisioningToken: 'create-provisioning-token-marker',
        createAgentToken: 'create-agent-token-marker',
        listAgentRegistry: 'list-agent-registry-marker',
        listManagedAgentCredentials: 'list-agent-credentials-marker',
        listManagedAgentDevices: 'list-agent-devices-marker',
        listProvisioningTokens: 'list-provisioning-tokens-marker',
        recordSession: 'record-agent-session-marker',
        registerAgent: 'register-agent-marker',
        revokeManagedAgentDevice: 'revoke-agent-device-marker',
        revokeProvisioningToken: 'revoke-provisioning-token-marker',
        revokeAgentToken: 'revoke-agent-token-marker',
        rotateAgentToken: 'rotate-agent-token-marker',
      };
    },
    createSyncIngestionService: (deps) => {
      syncFactoryDeps = deps;
      return {
        ingestPayload: 'ingest-platform-agent-sync-marker',
      };
    },
    createPlatformServerConfigService: (deps) => {
      configServiceDeps = deps;
      return {
        getServerConfigCategory: 'get-server-config-category-marker',
        getServerConfigWorkspace: 'get-server-config-workspace-marker',
        listServerConfigBackups: 'list-server-config-backups-marker',
        createServerConfigSaveJob: 'create-server-config-save-job-marker',
        createServerConfigApplyJob: 'create-server-config-apply-job-marker',
        createServerConfigRollbackJob: 'create-server-config-rollback-job-marker',
        createServerBotActionJob: 'create-server-bot-action-job-marker',
        claimNextServerConfigJob: 'claim-next-server-config-job-marker',
        completeServerConfigJob: 'complete-server-config-job-marker',
        upsertServerConfigSnapshot: 'upsert-server-config-snapshot-marker',
      };
    },
    createAdminEntityPostRoutes: () => entityMarker,
    createAdminConfigPostRoutes: () => configMarker,
    createAdminPublicRoutes: (deps) => {
      publicRouteDeps = deps;
      return publicMarker;
    },
    createAdminGetRoutes: (deps) => {
      getRouteDeps = deps;
      return getMarker;
    },
    createAdminAuthPostRoutes: () => authMarker,
    createAdminCommerceDeliveryPostRoutes: () => commerceMarker,
    createAdminPortalPostRoutes: () => portalMarker,
    createAdminPlatformPostRoutes: (deps) => {
      platformPostDeps = deps;
      return platformMarker;
    },
    createAdminAuditRoutes: () => auditMarker,
    createAdminRouteRuntime: (deps) => {
      routeRuntimeDeps = deps;
      return {
        deriveRouteGroup: deriveMarker,
        handleMutationAction: mutateMarker,
      };
    },
    createPlatformApiKey: 'create-platform-api-key-marker',
    listPlatformApiKeys: 'list-platform-api-keys-marker',
    listPlatformAgentRuntimes: 'list-platform-agent-runtimes-marker',
    recordPlatformAgentHeartbeat: 'record-platform-agent-heartbeat-marker',
    revokePlatformApiKey: 'revoke-platform-api-key-marker',
    rotatePlatformApiKey: 'rotate-platform-api-key-marker',
    getPlatformTenantById: 'get-platform-tenant-by-id-marker',
    emitPlatformEvent: 'emit-platform-event-marker',
    sendJson: () => {},
    requiredString: (value) => String(value || '').trim(),
    asInt: (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    claimSupportTicket: 'claim-support-ticket-marker',
    closeSupportTicket: 'close-support-ticket-marker',
    tryNotifyTicket: 'try-notify-ticket-marker',
    createBountyForUser: 'create-bounty-for-user-marker',
    cancelBountyForUser: 'cancel-bounty-for-user-marker',
    createServerEvent: 'create-server-event-marker',
    updateServerEvent: 'update-server-event-marker',
    startServerEvent: 'start-server-event-marker',
    finishServerEvent: 'finish-server-event-marker',
    joinServerEvent: 'join-server-event-marker',
    reviewRaidRequest: 'review-raid-request-marker',
    createRaidWindow: 'create-raid-window-marker',
    createRaidSummary: 'create-raid-summary-marker',
    bindSteamLinkForUser: 'bind-steam-link-marker',
    removeSteamLink: 'remove-steam-link-marker',
    upsertPlayerAccount: 'upsert-player-account-marker',
    bindPlayerSteamId: 'bind-player-steam-id-marker',
    unbindPlayerSteamId: 'unbind-player-steam-id-marker',
    grantVipForUser: 'grant-vip-marker',
    revokeVipForUser: 'revoke-vip-marker',
    createRedeemCodeForAdmin: 'create-redeem-code-marker',
    deleteRedeemCodeForAdmin: 'delete-redeem-code-marker',
    resetRedeemCodeUsageForAdmin: 'reset-redeem-code-usage-marker',
    createPunishmentEntry: 'create-punishment-entry-marker',
    revokeWelcomePackClaimForAdmin: 'revoke-welcome-pack-claim-marker',
    clearWelcomePackClaimsForAdmin: 'clear-welcome-pack-claims-marker',
    addKillsForUser: 'add-kills-marker',
    addDeathsForUser: 'add-deaths-marker',
    addPlaytimeForUser: 'add-playtime-marker',
    queueLeaderboardRefreshForAllGuilds: 'queue-leaderboard-refresh-marker',
    getTenantFeatureAccess: 'get-tenant-feature-access-marker',
    buildTenantProductEntitlements: 'build-tenant-product-entitlements-marker',
    parseStringArray: () => [],
    getAuthTenantId: 'get-auth-tenant-id-marker',
    buildAdminEditableEnvPatch: 'build-admin-env-patch-marker',
    buildAdminEditableEnvApplySummary: 'build-admin-env-apply-summary-marker',
    updateEnvFile: 'update-env-file-marker',
    resolveAdminEditableRootEnvFilePath: 'resolve-root-env-path-marker',
    resolveAdminEditablePortalEnvFilePath: 'resolve-portal-env-path-marker',
    recordAdminSecuritySignal: 'record-admin-security-signal-marker',
    getClientIp: 'get-client-ip-marker',
    upsertAdminUserInDb: 'upsert-admin-user-marker',
    revokeSessionsForUser: 'revoke-sessions-for-user-marker',
    buildClearSessionCookie: 'build-clear-session-cookie-marker',
    restartManagedRuntimeServices: 'restart-managed-runtime-services-marker',
    config: { platform: {} },
    resolveScopedTenantId: 'resolve-scoped-tenant-id-marker',
    upsertPlatformTenantConfig: 'upsert-platform-tenant-config-marker',
    tryServeAdminStaticAsset: 'serve-admin-static-asset-marker',
    tryServeStaticScumIcon: 'serve-static-scum-icon-marker',
    sendText: 'send-text-marker',
    sendHtml: 'send-html-marker',
    isAuthorized: 'is-authorized-marker',
    getAuthContext: 'get-auth-context-marker',
    getLoginHtml: 'get-login-html-marker',
    getTenantLoginHtml: 'get-tenant-login-html-marker',
    getOwnerConsoleHtml: 'get-owner-console-html-marker',
    getTenantConsoleHtml: 'get-tenant-console-html-marker',
    getDashboardHtml: 'get-dashboard-html-marker',
    getPersistenceStatus: 'get-persistence-status-marker',
    getPublicPersistenceStatus: 'get-public-persistence-status-marker',
    getDeliveryMetricsSnapshot: 'get-delivery-metrics-snapshot-marker',
    ensurePlatformApiKey: 'ensure-platform-api-key-marker',
    readJsonBody: 'read-json-body-marker',
    getTenantQuotaSnapshot: 'get-tenant-quota-snapshot-marker',
    getPlatformPublicOverview: 'get-platform-public-overview-marker',
    getPlatformAnalyticsOverview: 'get-platform-analytics-overview-marker',
    getPackageCatalogSummary: 'get-package-catalog-summary-marker',
    getFeatureCatalogSummary: 'get-feature-catalog-summary-marker',
    verifyPlatformApiKey: 'verify-platform-api-key-marker',
    SSO_DISCORD_ACTIVE: true,
    cleanupDiscordOauthStates: 'cleanup-discord-oauth-states-marker',
    buildDiscordAuthorizeUrl: 'build-discord-authorize-url-marker',
    getDiscordRedirectUri: 'get-discord-redirect-uri-marker',
    exchangeDiscordOauthCode: 'exchange-discord-oauth-code-marker',
    fetchDiscordProfile: 'fetch-discord-profile-marker',
    fetchDiscordGuildMember: 'fetch-discord-guild-member-marker',
    listDiscordGuildRolesFromClient: 'list-discord-guild-roles-marker',
    resolveMappedMemberRole: 'resolve-mapped-member-role-marker',
    getAdminSsoRoleMappingSummary: 'get-admin-sso-role-mapping-summary-marker',
    SSO_DISCORD_GUILD_ID: 'guild-1',
    SSO_DISCORD_DEFAULT_ROLE: 'member',
    discordOauthStates: new Map(),
    createSession: 'create-session-marker',
    buildSessionCookie: 'build-session-cookie-marker',
    invalidateSession: 'invalidate-session-marker',
    authenticateTenantUser: 'authenticate-tenant-user-marker',
    consumeTenantBootstrapToken: 'consume-tenant-bootstrap-token-marker',
    resolveTenantSessionAccessContext: 'resolve-tenant-session-access-context-marker',
    resolveAdminSessionAccessContext: 'resolve-admin-session-access-context-marker',
    prisma: 'prisma-marker',
    sendDownload: 'send-download-marker',
    consumeTransientDownload: 'consume-transient-download-marker',
    ensureRole: 'ensure-role-marker',
    ensurePortalTokenAuth: 'ensure-portal-token-auth-marker',
    getSessionId: 'get-session-id-marker',
    hasFreshStepUp: 'has-fresh-step-up-marker',
    hasValidSession: 'has-valid-session-marker',
    filterRowsByTenantScope: 'filter-rows-by-tenant-scope-marker',
    jsonReplacer: 'json-replacer-marker',
    getAdminPermissionMatrixSummary: 'get-admin-permission-matrix-summary-marker',
    buildRoleMatrix: 'build-role-matrix-marker',
    listAdminPermissionMatrix: 'list-admin-permission-matrix-marker',
    listAdminSecurityEvents: 'list-admin-security-events-marker',
    buildAdminSecurityEventExportRows: 'build-admin-security-event-export-rows-marker',
    buildAdminSecurityEventCsv: 'build-admin-security-event-csv-marker',
    buildSecretRotationReport: 'build-secret-rotation-report-marker',
    buildSecretRotationCsv: 'build-secret-rotation-csv-marker',
    listAdminSessions: 'list-admin-sessions-marker',
    listAdminUsersFromDb: 'list-admin-users-from-db-marker',
    buildControlPanelSettings: 'build-control-panel-settings-marker',
    buildCommandRegistry: 'build-command-registry-marker',
    getRuntimeSupervisorSnapshot: 'get-runtime-supervisor-snapshot-marker',
    getAdminRestoreState: 'get-admin-restore-state-marker',
    listAdminRestoreHistory: 'list-admin-restore-history-marker',
    buildTenantDiagnosticsBundle: 'build-tenant-diagnostics-bundle-marker',
    buildTenantDiagnosticsCsv: 'build-tenant-diagnostics-csv-marker',
    buildTenantSupportCaseBundle: 'build-tenant-support-case-bundle-marker',
    buildTenantSupportCaseCsv: 'build-tenant-support-case-csv-marker',
    buildDeliveryLifecycleReport: 'build-delivery-lifecycle-report-marker',
    buildDeliveryLifecycleCsv: 'build-delivery-lifecycle-csv-marker',
    buildTenantDonationOverview: 'build-tenant-donation-overview-marker',
    getPlatformPermissionCatalog: 'get-platform-permission-catalog-marker',
    getPlanCatalog: 'get-plan-catalog-marker',
    listPersistedPackageCatalog: 'list-persisted-package-catalog-marker',
    buildTenantActorAccessSummary: 'build-tenant-actor-access-summary-marker',
    buildTenantRoleMatrix: 'build-tenant-role-matrix-marker',
    getPlatformOpsState: 'get-platform-ops-state-marker',
    getPlatformAutomationState: 'get-platform-automation-state-marker',
    getAutomationConfig: 'get-automation-config-marker',
    getPlatformTenantConfig: 'get-platform-tenant-config-marker',
    listPlatformTenants: 'list-platform-tenants-marker',
    listPlatformTenantConfigs: 'list-platform-tenant-configs-marker',
    listTenantStaffMemberships: 'list-tenant-staff-memberships-marker',
    listServerEvents: 'list-server-events-marker',
    getParticipants: 'get-participants-marker',
    listRaidActivitySnapshot: 'list-raid-activity-snapshot-marker',
    listKillFeedEntries: 'list-kill-feed-entries-marker',
    listPlatformSubscriptions: 'list-platform-subscriptions-marker',
    listPlatformLicenses: 'list-platform-licenses-marker',
    listBillingInvoices: 'list-billing-invoices-marker',
    listBillingPaymentAttempts: 'list-billing-payment-attempts-marker',
    getBillingProviderConfigSummary: 'get-billing-provider-config-summary-marker',
    listPlatformWebhookEndpoints: 'list-platform-webhook-endpoints-marker',
    listMarketplaceOffers: 'list-marketplace-offers-marker',
    reconcileDeliveryState: 'reconcile-delivery-state-marker',
    listRestartPlans: 'list-restart-plans-marker',
    listRestartExecutions: 'list-restart-executions-marker',
    clampMetricsWindowMs: 'clamp-metrics-window-ms-marker',
    parseMetricsSeriesKeys: 'parse-metrics-series-keys-marker',
    getCurrentObservabilitySnapshot: 'get-current-observability-snapshot-marker',
    getAdminRequestLogMetrics: 'get-admin-request-log-metrics-marker',
    listAdminRequestLogs: 'list-admin-request-logs-marker',
    buildObservabilityCsv: 'build-observability-csv-marker',
    buildObservabilityExportPayload: 'build-observability-export-payload-marker',
    openLiveStream: 'open-live-stream-marker',
    listItemIconCatalog: 'list-item-icon-catalog-marker',
    listWikiWeaponCatalog: 'list-wiki-weapon-catalog-marker',
    getWikiWeaponCatalogMeta: 'get-wiki-weapon-catalog-meta-marker',
    listManifestItemCatalog: 'list-manifest-item-catalog-marker',
    getManifestItemCatalogMeta: 'get-manifest-item-catalog-meta-marker',
    listShopItems: 'list-shop-items-marker',
    filterShopItems: 'filter-shop-items-marker',
    listUserPurchases: 'list-user-purchases-marker',
    normalizePurchaseStatus: 'normalize-purchase-status-marker',
    getPlayerDashboard: 'get-player-dashboard-marker',
    listActiveBountiesForUser: 'list-active-bounties-for-user-marker',
    listFilteredDeliveryQueue: 'list-filtered-delivery-queue-marker',
    listFilteredDeliveryDeadLetters: 'list-filtered-delivery-dead-letters-marker',
    getDeliveryRuntimeStatus: 'get-delivery-runtime-status-marker',
    listScumAdminCommandCapabilities: 'list-scum-admin-command-capabilities-marker',
    listAdminCommandCapabilityPresets: 'list-admin-command-capability-presets-marker',
    getDeliveryCommandOverride: 'get-delivery-command-override-marker',
    getDeliveryDetailsByPurchaseCode: 'get-delivery-details-by-purchase-code-marker',
    listAdminNotifications: 'list-admin-notifications-marker',
    listKnownPurchaseStatuses: 'list-known-purchase-statuses-marker',
    listAllowedPurchaseTransitions: 'list-allowed-purchase-transitions-marker',
    buildAdminDashboardCards: 'build-admin-dashboard-cards-marker',
    listPlayerAccounts: 'list-player-accounts-marker',
    buildAdminSnapshot: 'build-admin-snapshot-marker',
    listAdminBackupFiles: 'list-admin-backup-files-marker',
    ADMIN_WEB_2FA_ACTIVE: true,
    SESSION_COOKIE_NAME: 'session',
    SESSION_COOKIE_PATH: '/',
    SESSION_COOKIE_SAMESITE: 'Lax',
    SESSION_SECURE_COOKIE: true,
    SESSION_COOKIE_DOMAIN: null,
    SESSION_TTL_MS: 3600000,
    SESSION_IDLE_TIMEOUT_MS: 1800000,
    SESSION_MAX_PER_USER: 5,
    SESSION_BIND_USER_AGENT: true,
    ADMIN_WEB_STEP_UP_ENABLED: true,
    ADMIN_WEB_STEP_UP_TTL_MS: 600000,
    ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS: false,
    getLoginRateLimitState: 'get-login-rate-limit-state-marker',
    recordLoginAttempt: 'record-login-attempt-marker',
    getUserByCredentials: 'get-user-by-credentials-marker',
    ADMIN_WEB_2FA_SECRET: 'secret',
    ADMIN_WEB_2FA_WINDOW_STEPS: 1,
    verifyTotpCode: 'verify-totp-code-marker',
    setCoinsExact: 'set-coins-exact-marker',
    creditCoins: 'credit-coins-marker',
    debitCoins: 'debit-coins-marker',
    addShopItemForAdmin: 'add-shop-item-for-admin-marker',
    updateShopItemForAdmin: 'update-shop-item-for-admin-marker',
    setShopItemPriceForAdmin: 'set-shop-item-price-for-admin-marker',
    setShopItemStatusForAdmin: 'set-shop-item-status-for-admin-marker',
    deleteShopItemForAdmin: 'delete-shop-item-for-admin-marker',
    updatePurchaseStatusForActor: 'update-purchase-status-for-actor-marker',
    parseDeliveryItemsBody: 'parse-delivery-items-body-marker',
    enqueuePurchaseDeliveryByCode: 'enqueue-purchase-delivery-by-code-marker',
    retryDeliveryNow: 'retry-delivery-now-marker',
    retryDeliveryNowMany: 'retry-delivery-now-many-marker',
    retryDeliveryDeadLetter: 'retry-delivery-dead-letter-marker',
    retryDeliveryDeadLetterMany: 'retry-delivery-dead-letter-many-marker',
    removeDeliveryDeadLetter: 'remove-delivery-dead-letter-marker',
    cancelDeliveryJob: 'cancel-delivery-job-marker',
    previewDeliveryCommands: 'preview-delivery-commands-marker',
    getDeliveryPreflightReport: 'get-delivery-preflight-report-marker',
    simulateDeliveryPlan: 'simulate-delivery-plan-marker',
    setDeliveryCommandOverride: 'set-delivery-command-override-marker',
    sendTestDeliveryCommand: 'send-test-delivery-command-marker',
    saveAdminCommandCapabilityPreset: 'save-admin-command-capability-preset-marker',
    getAdminCommandCapabilityPresetById: 'get-admin-command-capability-preset-by-id-marker',
    deleteAdminCommandCapabilityPreset: 'delete-admin-command-capability-preset-marker',
    testScumAdminCommandCapability: 'test-scum-admin-command-capability-marker',
    runRentBikeMidnightReset: 'run-rent-bike-midnight-reset-marker',
    getRentBikeRuntime: 'get-rent-bike-runtime-marker',
    updateScumStatusForAdmin: 'update-scum-status-for-admin-marker',
    getStatus: 'get-status-marker',
    redeemCodeForUser: 'redeem-code-for-user-marker',
    requestRentBikeForUser: 'request-rent-bike-for-user-marker',
    prepareTransientDownload: 'prepare-transient-download-marker',
    createAdminBackup: 'create-admin-backup-marker',
    previewAdminBackupRestore: 'preview-admin-backup-restore-marker',
    restoreAdminBackup: 'restore-admin-backup-marker',
    publishAdminLiveUpdate: 'publish-admin-live-update-marker',
    createTenant: 'create-tenant-marker',
    createPackageCatalogEntry: 'create-package-catalog-entry-marker',
    inviteTenantStaff: 'invite-tenant-staff-marker',
    updateTenantStaffRole: 'update-tenant-staff-role-marker',
    revokeTenantStaffMembership: 'revoke-tenant-staff-membership-marker',
    createSubscription: 'create-subscription-marker',
    deletePackageCatalogEntry: 'delete-package-catalog-entry-marker',
    createCheckoutSession: 'create-checkout-session-marker',
    updateInvoiceStatus: 'update-invoice-status-marker',
    updatePaymentAttempt: 'update-payment-attempt-marker',
    updateSubscriptionBillingState: 'update-subscription-billing-state-marker',
    issuePlatformLicense: 'issue-platform-license-marker',
    acceptPlatformLicenseLegal: 'accept-platform-license-legal-marker',
    createPlatformWebhookEndpoint: 'create-platform-webhook-endpoint-marker',
    dispatchPlatformWebhookEvent: 'dispatch-platform-webhook-event-marker',
    scheduleRestartPlan: 'schedule-restart-plan-marker',
    createMarketplaceOffer: 'create-marketplace-offer-marker',
    runPlatformMonitoringCycle: 'run-platform-monitoring-cycle-marker',
    runPlatformAutomationCycle: 'run-platform-automation-cycle-marker',
    acknowledgeAdminNotifications: 'acknowledge-admin-notifications-marker',
    clearAdminNotifications: 'clear-admin-notifications-marker',
    updatePackageCatalogEntry: 'update-package-catalog-entry-marker',
    buildAuditDatasetService: 'build-audit-dataset-service-marker',
    buildAuditExportPayloadService: 'build-audit-export-payload-service-marker',
    buildAuditCsvService: 'build-audit-csv-service-marker',
    listAuditPresetsService: 'list-audit-presets-service-marker',
    saveAuditPresetService: 'save-audit-preset-service-marker',
    deleteAuditPresetService: 'delete-audit-preset-service-marker',
    listControlPlaneAgentSessions: 'list-control-plane-agent-sessions-marker',
    listControlPlaneSyncRuns: 'list-control-plane-sync-runs-marker',
    listControlPlaneSyncEvents: 'list-control-plane-sync-events-marker',
    listEvents: 'list-events-marker',
  });

  assert.equal(agentFactoryDeps.createPlatformApiKey, 'create-platform-api-key-marker');
  assert.equal(syncFactoryDeps.emitPlatformEvent, 'emit-platform-event-marker');
  assert.equal(configServiceDeps.listServerRegistry, 'list-server-registry-marker');
  assert.equal(publicRouteDeps.activatePlatformAgent, 'activate-agent-marker');
  assert.equal(publicRouteDeps.registerPlatformAgent, 'register-agent-marker');
  assert.equal(publicRouteDeps.ingestPlatformAgentSync, 'ingest-platform-agent-sync-marker');
  assert.equal(publicRouteDeps.getPackageCatalog, 'get-package-catalog-summary-marker');
  assert.equal(getRouteDeps.listPlatformServerRegistry, 'list-server-registry-marker');
  assert.equal(getRouteDeps.listPlatformSyncRuns, 'list-control-plane-sync-runs-marker');
  assert.equal(getRouteDeps.buildTenantDonationOverview, 'build-tenant-donation-overview-marker');
  assert.equal(platformPostDeps.createServer, 'create-server-marker');
  assert.equal(platformPostDeps.createServerConfigApplyJob, 'create-server-config-apply-job-marker');
  assert.equal(routeRuntimeDeps.handleAdminPlatformPostRoute, platformMarker);
  assert.equal(routeRuntimeDeps.handleAdminCommerceDeliveryPostRoute, commerceMarker);

  assert.equal(runtime.deriveRouteGroup, deriveMarker);
  assert.equal(runtime.handleMutationAction, mutateMarker);
  assert.equal(runtime.handleAdminPublicRoute, publicMarker);
  assert.equal(runtime.handleAdminGetRoute, getMarker);
  assert.equal(runtime.handleAdminAuthPostRoute, authMarker);
  assert.equal(runtime.handleAdminEntityPostRoute, entityMarker);
  assert.equal(runtime.handleAdminConfigPostRoute, configMarker);
  assert.equal(runtime.handleAdminCommerceDeliveryPostRoute, commerceMarker);
  assert.equal(runtime.handleAdminPortalPostRoute, portalMarker);
  assert.equal(runtime.handleAdminPlatformPostRoute, platformMarker);
  assert.equal(runtime.handleAdminAuditRoute, auditMarker);
});
