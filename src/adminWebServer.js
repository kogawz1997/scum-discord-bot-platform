const crypto = require('node:crypto');
const path = require('node:path');

const config = require('./config');
const { prisma } = require('./prisma');
const {
  getAdminSsoRoleMappingSummary,
  resolveMappedMemberRole,
} = require('./utils/adminSsoRoleMapping');
const {
  buildDiscordAuthorizeUrl,
  exchangeDiscordOauthCode,
  fetchDiscordGuildMember,
  fetchDiscordProfile,
  listDiscordGuildRolesFromClient,
} = require('./admin/auth/adminDiscordOauthClient');
const {
  getRequiredCommandAccessRole,
} = require('./utils/discordCommandAccess');
const {
  buildRoleMatrix,
  getAdminPermissionForPath,
  getAdminPermissionMatrixSummary,
  hasRoleAtLeast,
  listAdminPermissionMatrix,
  normalizeRole,
} = require('./utils/adminPermissionMatrix');
const {
  buildTenantProductEntitlements,
} = require('./domain/billing/productEntitlementService');
const {
  listShopItems,
  listUserPurchases,
  listKnownPurchaseStatuses,
} = require('./store/memoryStore');
const {
  normalizePurchaseStatus,
  listAllowedPurchaseTransitions,
} = require('./services/purchaseStateMachine');
const { listEvents, getParticipants } = require('./store/eventStore');
const {
  createServerEvent,
  listServerEvents,
  joinServerEvent,
  updateServerEvent,
  startServerEvent,
  finishServerEvent,
} = require('./services/eventService');
const {
  createRaidRequest,
  createRaidSummary,
  createRaidWindow,
  listRaidActivitySnapshot,
  reviewRaidRequest,
} = require('./services/raidService');
const {
  listKillFeedEntries,
} = require('./services/killFeedService');
const { getStatus } = require('./store/scumStore');
const {
  upsertPlayerAccount,
  bindPlayerSteamId,
  unbindPlayerSteamId,
  getPlayerDashboard,
  listPlayerAccounts,
} = require('./store/playerAccountStore');
const {
  getRentBikeRuntime,
  runRentBikeMidnightReset,
} = require('./services/rentBikeService');
const {
  listManagedRuntimeServices,
  restartManagedRuntimeServices,
} = require('./services/adminServiceControl');
const {
  enqueuePurchaseDeliveryByCode,
  listDeliveryQueue,
  listFilteredDeliveryQueue,
  listFilteredDeliveryDeadLetters,
  retryDeliveryNow,
  retryDeliveryNowMany,
  retryDeliveryDeadLetter,
  retryDeliveryDeadLetterMany,
  removeDeliveryDeadLetter,
  cancelDeliveryJob,
  getDeliveryMetricsSnapshot,
  getDeliveryRuntimeSnapshotSync,
  getDeliveryRuntimeStatus,
  getDeliveryPreflightReport,
  previewDeliveryCommands,
  simulateDeliveryPlan,
  sendTestDeliveryCommand,
  listScumAdminCommandCapabilities,
  testScumAdminCommandCapability,
  getDeliveryCommandOverride,
  setDeliveryCommandOverride,
  getDeliveryDetailsByPurchaseCode,
} = require('./services/rconDelivery');
const {
  queueLeaderboardRefreshForAllGuilds,
} = require('./services/leaderboardPanels');
const {
  adminLiveBus,
  publishAdminLiveUpdate,
} = require('./services/adminLiveBus');
const {
  listAdminNotifications,
  acknowledgeAdminNotifications,
  clearAdminNotifications,
  addAdminNotification,
} = require('./store/adminNotificationStore');
const {
  listAdminSecurityEvents,
  recordAdminSecurityEvent,
} = require('./store/adminSecurityEventStore');
const {
  getAdminRequestLogMetrics,
  listAdminRequestLogs,
  recordAdminRequestLog,
} = require('./store/adminRequestLogStore');
const {
  listAdminCommandCapabilityPresets,
  getAdminCommandCapabilityPresetById,
  saveAdminCommandCapabilityPreset,
  deleteAdminCommandCapabilityPreset,
} = require('./store/adminCommandCapabilityPresetStore');
const {
  listItemIconCatalog,
  resolveItemIconUrl,
} = require('./services/itemIconService');
const {
  listWikiWeaponCatalog,
  getWikiWeaponCatalogMeta,
} = require('./services/wikiWeaponCatalog');
const {
  listManifestItemCatalog,
  getManifestItemCatalogMeta,
} = require('./services/wikiItemManifestCatalog');
const {
  redeemCodeForUser,
  requestRentBikeForUser,
  createBountyForUser,
  listActiveBountiesForUser,
  cancelBountyForUser,
  createRedeemCodeForAdmin,
  deleteRedeemCodeForAdmin,
  resetRedeemCodeUsageForAdmin,
} = require('./services/playerOpsService');
const {
  updatePurchaseStatusForActor,
} = require('./services/purchaseService');
const {
  addShopItemForAdmin,
  updateShopItemForAdmin,
  setShopItemPriceForAdmin,
  setShopItemStatusForAdmin,
  deleteShopItemForAdmin,
} = require('./services/shopService');
const {
  creditCoins,
  debitCoins,
  setCoinsExact,
} = require('./services/coinService');
const {
  grantVipForUser,
  revokeVipForUser,
} = require('./services/vipService');
const {
  buildAdminSnapshot,
  createAdminBackup,
  listAdminBackupFiles,
  previewAdminBackupRestore,
  restoreAdminBackup,
  getAdminRestoreState,
  listAdminRestoreHistory,
} = require('./services/adminSnapshotService');
const {
  buildAuditDataset: buildAuditDatasetService,
  buildAuditExportPayload: buildAuditExportPayloadService,
  buildAuditCsv: buildAuditCsvService,
  listAuditPresets: listAuditPresetsService,
  saveAuditPreset: saveAuditPresetService,
  deleteAuditPreset: deleteAuditPresetService,
} = require('./services/adminAuditService');
const {
  createObservabilitySeriesState,
  clampObservabilityWindowMs,
  parseObservabilitySeriesKeys,
  captureObservabilitySeries,
  listObservabilitySeries,
  buildAdminObservabilitySnapshot,
  buildObservabilityExportPayload,
  buildObservabilityCsv,
} = require('./services/adminObservabilityService');
const {
  buildAdminDashboardCards,
} = require('./services/adminDashboardService');
const {
  getCachedRuntimeSupervisorSnapshot,
  getRuntimeSupervisorSnapshot,
  startRuntimeSupervisorMonitor,
  stopRuntimeSupervisorMonitor,
} = require('./services/runtimeSupervisorService');
const {
  acceptPlatformLicenseLegal,
  createMarketplaceOffer,
  createPackageCatalogEntry,
  createPlatformApiKey,
  createPlatformWebhookEndpoint,
  createSubscription,
  createTenant,
  deletePackageCatalogEntry,
  dispatchPlatformWebhookEvent,
  emitPlatformEvent,
  getFeatureCatalog: getFeatureCatalogSummary,
  getPlanCatalog,
  getPackageCatalog: getPackageCatalogSummary,
  getPlatformAnalyticsOverview,
  getPlatformPermissionCatalog,
  getPlatformPublicOverview,
  getPlatformTenantById,
  getTenantFeatureAccess,
  getTenantQuotaSnapshot,
  listPersistedPackageCatalog,
  issuePlatformLicense,
  listMarketplaceOffers,
  listPlatformAgentRuntimes,
  listPlatformApiKeys,
  listPlatformLicenses,
  listPlatformSubscriptions,
  listPlatformTenants,
  listPlatformWebhookEndpoints,
  recordPlatformAgentHeartbeat,
  reconcileDeliveryState,
  revokePlatformApiKey,
  rotatePlatformApiKey,
  updatePackageCatalogEntry,
  verifyPlatformApiKey,
} = require('./services/platformService');
const {
  runPlatformMonitoringCycle,
  startPlatformMonitoring,
  stopPlatformMonitoring,
} = require('./services/platformMonitoringService');
const {
  buildTenantDiagnosticsBundle,
  buildTenantDiagnosticsCsv,
  buildTenantSupportCaseBundle,
  buildTenantSupportCaseCsv,
} = require('./services/tenantDiagnosticsService');
const {
  buildDeliveryLifecycleReport,
  buildDeliveryLifecycleCsv,
} = require('./services/deliveryLifecycleService');
const {
  buildTenantDonationOverview,
} = require('./services/tenantDonationOverviewService');
const {
  buildTenantModuleOverview,
} = require('./services/tenantModuleOverviewService');
const {
  buildSecretRotationReport,
  buildSecretRotationCsv,
} = require('./utils/secretRotationCheck');
const {
  runPlatformAutomationCycle,
  getAutomationConfig,
  startPlatformAutomation,
  stopPlatformAutomation,
} = require('./services/platformAutomationService');
const { getPlatformOpsState } = require('./store/platformOpsStateStore');
const {
  getPlatformAutomationState,
} = require('./store/platformAutomationStateStore');
const {
  authenticateTenantUser,
  consumeTenantBootstrapToken,
  resolveTenantSessionAccessContext,
} = require('./services/platformWorkspaceAuthService');
const {
  revokeWelcomePackClaimForAdmin,
  clearWelcomePackClaimsForAdmin,
} = require('./services/welcomePackService');
const {
  claimSupportTicket,
  closeSupportTicket,
} = require('./services/ticketService');
const {
  bindSteamLinkForUser,
  removeSteamLink,
} = require('./services/linkService');
const { createPunishmentEntry } = require('./services/moderationService');
const {
  addKillsForUser,
  addDeathsForUser,
  addPlaytimeForUser,
} = require('./services/statsService');
const { updateScumStatusForAdmin } = require('./services/scumStatusService');
const {
  getPersistenceStatus,
  getPublicPersistenceStatus,
} = require('./store/_persist');
const {
  createPersistentRuntimeStore,
} = require('./store/runtimeStateStore');
const {
  isAdminRestoreMaintenanceActive,
} = require('./store/adminRestoreStateStore');
const { getWebhookMetricsSnapshot } = require('./scumWebhookServer');
const { updateEnvFile } = require('./utils/envFileEditor');
const { resolveDatabaseRuntime } = require('./utils/dbEngine');
const {
  buildControlPanelEnvCatalog: buildAdminEditableEnvCatalog,
  buildControlPanelEnvCatalogGroups: buildAdminEditableEnvCatalogGroups,
  buildControlPanelEnvApplySummary: buildAdminEditableEnvApplySummary,
  buildControlPanelEnvPatch: buildAdminEditableEnvPatch,
  buildControlPanelEnvPolicySummary: buildAdminEditableEnvPolicySummary,
  buildControlPanelEnvSection: buildAdminEditableEnvSection,
  buildControlPanelEnvSectionGroups: buildAdminEditableEnvSectionGroups,
  getControlPanelEnvFileValues: getAdminEditableEnvFileValues,
  getPortalEnvFilePath: resolveAdminEditablePortalEnvFilePath,
  getRootEnvFilePath: resolveAdminEditableRootEnvFilePath,
} = require('./config/adminEditableConfig');
const {
  getPlatformTenantConfig,
  listPlatformTenantConfigs,
  upsertPlatformTenantConfig,
} = require('./services/platformTenantConfigService');
const {
  createPlatformServerConfigService,
} = require('./services/platformServerConfigService');
const {
  scheduleRestartPlan,
  listRestartExecutions,
  listRestartPlans,
} = require('./services/platformRestartOrchestrationService');
const {
  createCheckoutSession,
  getBillingProviderConfigSummary,
  listBillingInvoices,
  listBillingPaymentAttempts,
  updateInvoiceStatus,
  updatePaymentAttempt,
  updateSubscriptionBillingState,
} = require('./services/platformBillingLifecycleService');
const {
  inviteTenantStaff,
  listTenantStaffMemberships,
  revokeTenantStaffMembership,
  updateTenantStaffRole,
} = require('./services/platformTenantStaffService');
const {
  buildTenantActorAccessSummary,
  buildTenantRoleMatrix,
} = require('./services/platformTenantAccessService');
const {
  createServerRegistryService,
} = require('./domain/servers/serverRegistryService');
const {
  createAgentRegistryService,
} = require('./domain/agents/agentRegistryService');
const {
  createSyncIngestionService,
} = require('./domain/sync/syncIngestionService');
const {
  listAgentSessions: listControlPlaneAgentSessions,
  listSyncEvents: listControlPlaneSyncEvents,
  listSyncRuns: listControlPlaneSyncRuns,
} = require('./data/repositories/controlPlaneRegistryRepository');
const { createAdminAuthRuntime } = require('./admin/auth/adminAuthRuntime');
const {
  createAdminUserStoreRuntime,
} = require('./admin/auth/adminUserStoreRuntime');
const {
  createAdminConfigPostRoutes,
} = require('./admin/api/adminConfigPostRoutes');
const {
  createAdminPublicRoutes,
} = require('./admin/api/adminPublicRoutes');
const {
  createAdminGetRoutes,
} = require('./admin/api/adminGetRoutes');
const {
  createAdminAuthPostRoutes,
} = require('./admin/api/adminAuthPostRoutes');
const {
  createAdminEntityPostRoutes,
} = require('./admin/api/adminEntityPostRoutes');
const {
  createAdminCommerceDeliveryPostRoutes,
} = require('./admin/api/adminCommerceDeliveryPostRoutes');
const {
  createAdminPortalPostRoutes,
} = require('./admin/api/adminPortalPostRoutes');
const {
  createAdminPlatformPostRoutes,
} = require('./admin/api/adminPlatformPostRoutes');
const {
  createAdminAuditRoutes,
} = require('./admin/audit/adminAuditRoutes');
const {
  filterRowsByTenantScope,
  getAuthTenantId,
  resolveTenantScope,
} = require('./admin/adminTenantScope');
const {
  createAdminPageRuntime,
} = require('./admin/runtime/adminPageRuntime');
const {
  createAdminLiveRuntime,
} = require('./admin/runtime/adminLiveRuntime');
const {
  createAdminEnvRuntime,
} = require('./admin/runtime/adminEnvRuntime');
const {
  createAdminHttpRuntime,
  envBool,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeSameSite,
} = require('./admin/runtime/adminHttpRuntime');
const {
  createAdminRequestRuntime,
} = require('./admin/runtime/adminRequestRuntime');
const {
  createAdminTransientDownloadRuntime,
} = require('./admin/runtime/adminTransientDownloadRuntime');
const {
  createAdminAccessRuntime,
} = require('./admin/runtime/adminAccessRuntime');
const {
  createAdminControlPanelRuntime,
} = require('./admin/runtime/adminControlPanelRuntime');
const {
  createAdminSecurityRuntime,
} = require('./admin/runtime/adminSecurityRuntime');
const {
  createAdminSecurityExportRuntime,
} = require('./admin/runtime/adminSecurityExportRuntime');
const {
  createAdminObservabilityRuntime,
} = require('./admin/runtime/adminObservabilityRuntime');
const {
  createAdminTicketRuntime,
} = require('./admin/runtime/adminTicketRuntime');
const {
  createAdminRouteRuntime,
} = require('./admin/runtime/adminRouteRuntime');
const {
  createAdminRouteHandlersRuntime,
} = require('./admin/runtime/adminRouteHandlersRuntime');
const {
  createAdminRequestHandler,
} = require('./admin/runtime/adminServerRuntime');
const {
  createSecureEqual,
} = require('./admin/runtime/adminCryptoRuntime');
const {
  createAdminServerLifecycle,
} = require('./admin/runtime/adminServerLifecycleRuntime');

const {
  dashboardHtmlPath,
  loginHtmlPath,
  adminAssetsDirPath,
  scumItemsDirPath,
  sessionCookieName: SESSION_COOKIE_NAME,
  sessionTtlMs: SESSION_TTL_MS,
  sessionIdleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
  sessionMaxPerUser: SESSION_MAX_PER_USER,
  sessionBindUserAgent: SESSION_BIND_USER_AGENT,
  sessionCookiePath: SESSION_COOKIE_PATH,
  sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
  sessionCookieDomain: SESSION_COOKIE_DOMAIN,
  adminWebMaxBodyBytes: ADMIN_WEB_MAX_BODY_BYTES,
  liveHeartbeatMs: LIVE_HEARTBEAT_MS,
  sessionSecureCookie: SESSION_SECURE_COOKIE,
  adminWebHstsEnabled: ADMIN_WEB_HSTS_ENABLED,
  adminWebHstsMaxAgeSec: ADMIN_WEB_HSTS_MAX_AGE_SEC,
  adminWebTrustProxy: ADMIN_WEB_TRUST_PROXY,
  adminWebAllowTokenQuery: ADMIN_WEB_ALLOW_TOKEN_QUERY,
  adminWebEnforceOriginCheck: ADMIN_WEB_ENFORCE_ORIGIN_CHECK,
  adminWebAllowedOrigins: ADMIN_WEB_ALLOWED_ORIGINS,
  adminWebCsp: ADMIN_WEB_CSP,
  adminWebUser: ADMIN_WEB_USER,
  loginRateLimitWindowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  loginRateLimitMaxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  loginSpikeWindowMs: LOGIN_SPIKE_WINDOW_MS,
  loginSpikeThreshold: LOGIN_SPIKE_THRESHOLD,
  loginSpikeIpThreshold: LOGIN_SPIKE_IP_THRESHOLD,
  loginSpikeAlertCooldownMs: LOGIN_SPIKE_ALERT_COOLDOWN_MS,
  adminWebUserRole: ADMIN_WEB_USER_ROLE,
  adminWebTokenRole: ADMIN_WEB_TOKEN_ROLE,
  adminWebUsersJson: ADMIN_WEB_USERS_JSON,
  adminWeb2faEnabled: ADMIN_WEB_2FA_ENABLED,
  adminWeb2faSecret: ADMIN_WEB_2FA_SECRET,
  adminWeb2faActive: ADMIN_WEB_2FA_ACTIVE,
  adminWeb2faWindowSteps: ADMIN_WEB_2FA_WINDOW_STEPS,
  adminWebStepUpEnabled: ADMIN_WEB_STEP_UP_ENABLED,
  adminWebStepUpTtlMs: ADMIN_WEB_STEP_UP_TTL_MS,
  adminWebAllowTokenSensitiveMutations: ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS,
  ssoDiscordEnabled: SSO_DISCORD_ENABLED,
  ssoDiscordClientId: SSO_DISCORD_CLIENT_ID,
  ssoDiscordClientSecret: SSO_DISCORD_CLIENT_SECRET,
  ssoDiscordActive: SSO_DISCORD_ACTIVE,
  ssoDiscordRedirectUri: SSO_DISCORD_REDIRECT_URI,
  ssoDiscordGuildId: SSO_DISCORD_GUILD_ID,
  ssoDiscordDefaultRole: SSO_DISCORD_DEFAULT_ROLE,
  ssoStateTtlMs: SSO_STATE_TTL_MS,
  metricsSeriesIntervalMs: METRICS_SERIES_INTERVAL_MS,
  metricsSeriesRetentionMs: METRICS_SERIES_RETENTION_MS,
  discordApiBase: DISCORD_API_BASE,
} = createAdminEnvRuntime({
  path,
  processEnv: process.env,
  envBool,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeRole,
  normalizeSameSite,
});
const ownerConsoleHtmlPath = path.join(__dirname, 'admin', 'owner-console.html');
const tenantConsoleHtmlPath = path.join(__dirname, 'admin', 'tenant-console.html');
const tenantLoginHtmlPath = path.join(__dirname, 'admin', 'tenant-login.html');
const sessions = createPersistentRuntimeStore({
  filename: 'admin-runtime-sessions.json',
  expiryField: 'expiresAt',
  persistDelayMs: 50,
});
const discordOauthStates = createPersistentRuntimeStore({
  filename: 'admin-runtime-discord-oauth-states.json',
  expiryField: 'expiresAt',
  persistDelayMs: 50,
});
const secureEqual = createSecureEqual(crypto);
const {
  buildSecurityHeaders,
  jsonReplacer,
  sendDownload,
  sendHtml,
  sendJson,
  sendText,
  verifyTotpCode,
} = createAdminHttpRuntime({
  adminWebHstsEnabled: ADMIN_WEB_HSTS_ENABLED,
  adminWebHstsMaxAgeSec: ADMIN_WEB_HSTS_MAX_AGE_SEC,
  adminWebCsp: ADMIN_WEB_CSP,
  secureEqual,
});
const {
  buildAllowedOrigins,
  getClientIp,
  getRequestOrigin,
  isSafeHttpMethod,
  readJsonBody,
  sendRestoreMaintenanceUnavailable,
  setRequestMeta,
  shouldBypassRestoreMaintenance,
  violatesBrowserOriginPolicy,
} = createAdminRequestRuntime({
  adminWebMaxBodyBytes: ADMIN_WEB_MAX_BODY_BYTES,
  adminWebTrustProxy: ADMIN_WEB_TRUST_PROXY,
  adminWebEnforceOriginCheck: ADMIN_WEB_ENFORCE_ORIGIN_CHECK,
  adminWebAllowedOrigins: ADMIN_WEB_ALLOWED_ORIGINS,
  getAdminRestoreState,
  sendJson,
});

const {
  prepareTransientDownload,
  consumeTransientDownload,
} = createAdminTransientDownloadRuntime();
const {
  ensureAdminUsersReady,
  getAdminToken,
  getUserByCredentials,
  resolveAdminSessionAccessContext,
  listAdminUsersFromDb,
  upsertAdminUserInDb,
} = createAdminUserStoreRuntime({
  prisma,
  crypto,
  secureEqual,
  normalizeRole,
  resolveDatabaseRuntime,
  adminWebUser: ADMIN_WEB_USER,
  adminWebUserRole: ADMIN_WEB_USER_ROLE,
  adminWebUsersJson: ADMIN_WEB_USERS_JSON,
});

const {
  buildCommandRegistry,
  buildControlPanelSettings,
  getDiscordRedirectUri,
} = createAdminControlPanelRuntime({
  config,
  getRequiredCommandAccessRole,
  getAdminEditableEnvFileValues,
  buildAdminEditableEnvSection,
  buildAdminEditableEnvSectionGroups,
  buildAdminEditableEnvCatalog,
  buildAdminEditableEnvCatalogGroups,
  buildAdminEditableEnvPolicySummary,
  getRootEnvFilePath: resolveAdminEditableRootEnvFilePath,
  getPortalEnvFilePath: resolveAdminEditablePortalEnvFilePath,
  listManagedRuntimeServices,
  listAdminUsersFromDb,
  getPlatformTenantConfig,
  hasRoleAtLeast,
  ssoDiscordRedirectUri: SSO_DISCORD_REDIRECT_URI,
});

const {
  cleanupDiscordOauthStates,
  getLoginFailureMetrics,
  getLoginRateLimitState,
  recordAdminSecuritySignal,
  recordLoginAttempt,
} = createAdminSecurityRuntime({
  loginRateLimitWindowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  loginRateLimitMaxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  loginSpikeWindowMs: LOGIN_SPIKE_WINDOW_MS,
  loginSpikeThreshold: LOGIN_SPIKE_THRESHOLD,
  loginSpikeIpThreshold: LOGIN_SPIKE_IP_THRESHOLD,
  loginSpikeAlertCooldownMs: LOGIN_SPIKE_ALERT_COOLDOWN_MS,
  discordOauthStates,
  ssoStateTtlMs: SSO_STATE_TTL_MS,
  getClientIp,
  publishAdminLiveUpdate,
  addAdminNotification,
  recordAdminSecurityEvent,
  logger: console,
});

const {
  asInt,
  ensurePlatformApiKey,
  ensurePortalTokenAuth,
  ensureRole,
  filterShopItems,
  parseDeliveryItemsBody,
  parseStringArray,
  requiredRoleForPostPath,
  requiredString,
  resolveScopedTenantId,
} = createAdminAccessRuntime({
  sendJson,
  getAuthContext: (...args) => getAuthContext(...args),
  hasRoleAtLeast,
  resolveTenantScope,
  verifyPlatformApiKey,
  setRequestMeta: (...args) => setRequestMeta(...args),
  getAdminPermissionForPath,
  resolveItemIconUrl,
});

const adminAuthRuntime = createAdminAuthRuntime({
  sessions,
  defaultUser: ADMIN_WEB_USER,
  sessionCookieName: SESSION_COOKIE_NAME,
  sessionTtlMs: SESSION_TTL_MS,
  sessionIdleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
  sessionMaxPerUser: SESSION_MAX_PER_USER,
  sessionBindUserAgent: SESSION_BIND_USER_AGENT,
  sessionCookiePath: SESSION_COOKIE_PATH,
  sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
  sessionCookieDomain: SESSION_COOKIE_DOMAIN,
  sessionSecureCookie: SESSION_SECURE_COOKIE,
  adminWebAllowTokenQuery: ADMIN_WEB_ALLOW_TOKEN_QUERY,
  adminWebTokenRole: ADMIN_WEB_TOKEN_ROLE,
  adminWebStepUpEnabled: ADMIN_WEB_STEP_UP_ENABLED,
  adminWeb2faActive: ADMIN_WEB_2FA_ACTIVE,
  adminWeb2faSecret: ADMIN_WEB_2FA_SECRET,
  adminWeb2faWindowSteps: ADMIN_WEB_2FA_WINDOW_STEPS,
  adminWebStepUpTtlMs: ADMIN_WEB_STEP_UP_TTL_MS,
  adminWebAllowTokenSensitiveMutations: ADMIN_WEB_ALLOW_TOKEN_SENSITIVE_MUTATIONS,
  secureEqual,
  normalizeRole,
  getClientIp,
  getAdminToken,
  sendJson,
  requiredString,
  verifyTotpCode,
  recordAdminSecuritySignal,
  setRequestMeta,
});

const {
  buildClearSessionCookie,
  buildSessionCookie,
  createSession,
  ensureStepUpAuth,
  getAuthContext,
  getSessionId,
  hasFreshStepUp,
  hasValidSession,
  invalidateSession,
  isAuthorized,
  listAdminSessions,
  revokeSessionsForUser,
} = adminAuthRuntime;

const {
  tryServeAdminStaticAsset,
  tryServeStaticScumIcon,
  getDashboardHtml,
  getOwnerConsoleHtml,
  getTenantConsoleHtml,
  getLoginHtml,
  getTenantLoginHtml,
} = createAdminPageRuntime({
  dashboardHtmlPath,
  ownerConsoleHtmlPath,
  tenantConsoleHtmlPath,
  loginHtmlPath,
  tenantLoginHtmlPath,
  assetsDirPath: adminAssetsDirPath,
  scumItemsDirPath,
  buildSecurityHeaders,
  sendText,
});
const {
  broadcastLiveUpdate,
  captureMetricsSeries,
  clampMetricsWindowMs,
  closeAllLiveStreams,
  ensureMetricsSeriesTimer,
  listMetricsSeries,
  openLiveStream,
  parseMetricsSeriesKeys,
  stopMetricsSeriesTimer,
} = createAdminLiveRuntime({
  liveHeartbeatMs: LIVE_HEARTBEAT_MS,
  metricsSeriesIntervalMs: METRICS_SERIES_INTERVAL_MS,
  metricsSeriesRetentionMs: METRICS_SERIES_RETENTION_MS,
  createObservabilitySeriesState,
  clampObservabilityWindowMs,
  parseObservabilitySeriesKeys,
  captureObservabilitySeries,
  listObservabilitySeries,
  buildSecurityHeaders,
  jsonReplacer,
  getDeliveryMetricsSnapshot,
  getDeliveryRuntimeSnapshotSync,
  getLoginFailureMetrics,
  getWebhookMetricsSnapshot,
  getAdminRequestLogMetrics,
  getRuntimeSupervisorSnapshot: getCachedRuntimeSupervisorSnapshot,
});

const {
  buildAdminSecurityEventCsv,
  buildAdminSecurityEventExportRows,
} = createAdminSecurityExportRuntime({
  asInt,
  listAdminSecurityEvents,
  requiredString,
});

const {
  getCurrentObservabilitySnapshot,
} = createAdminObservabilityRuntime({
  buildAdminObservabilitySnapshot,
  captureMetricsSeries,
  getAdminRequestLogMetrics,
  getCachedRuntimeSupervisorSnapshot,
  getDeliveryMetricsSnapshot,
  getDeliveryRuntimeStatus,
  getLoginFailureMetrics,
  getPlatformOpsState,
  getWebhookMetricsSnapshot,
  listAdminRequestLogs,
  listDeliveryQueue,
  listMetricsSeries,
  metricsSeriesRetentionMs: METRICS_SERIES_RETENTION_MS,
});

const {
  tryNotifyTicket,
} = createAdminTicketRuntime();

const {
  deriveRouteGroup,
  handleMutationAction,
  handleAdminPublicRoute,
  handleAdminGetRoute,
  handleAdminAuthPostRoute,
  handleAdminEntityPostRoute,
  handleAdminConfigPostRoute,
  handleAdminCommerceDeliveryPostRoute,
  handleAdminPortalPostRoute,
  handleAdminPlatformPostRoute,
  handleAdminAuditRoute,
} = createAdminRouteHandlersRuntime({
  createServerRegistryService,
  createAgentRegistryService,
  createSyncIngestionService,
  createPlatformServerConfigService,
  createAdminEntityPostRoutes,
  createAdminConfigPostRoutes,
  createAdminPublicRoutes,
  createAdminGetRoutes,
  createAdminAuthPostRoutes,
  createAdminCommerceDeliveryPostRoutes,
  createAdminPortalPostRoutes,
  createAdminPlatformPostRoutes,
  createAdminAuditRoutes,
  createAdminRouteRuntime,
  createPlatformApiKey,
  listPlatformApiKeys,
  listPlatformAgentRuntimes,
  recordPlatformAgentHeartbeat,
  revokePlatformApiKey,
  rotatePlatformApiKey,
  getPlatformTenantById,
  emitPlatformEvent,
  sendJson,
  requiredString,
  asInt,
  claimSupportTicket,
  closeSupportTicket,
  tryNotifyTicket,
  createBountyForUser,
  cancelBountyForUser,
  createServerEvent,
  updateServerEvent,
  startServerEvent,
  finishServerEvent,
  joinServerEvent,
  reviewRaidRequest,
  createRaidWindow,
  createRaidSummary,
  bindSteamLinkForUser,
  removeSteamLink,
  upsertPlayerAccount,
  bindPlayerSteamId,
  unbindPlayerSteamId,
  grantVipForUser,
  revokeVipForUser,
  createRedeemCodeForAdmin,
  deleteRedeemCodeForAdmin,
  resetRedeemCodeUsageForAdmin,
  createPunishmentEntry,
  revokeWelcomePackClaimForAdmin,
  clearWelcomePackClaimsForAdmin,
  addKillsForUser,
  addDeathsForUser,
  addPlaytimeForUser,
  queueLeaderboardRefreshForAllGuilds,
  getTenantFeatureAccess,
  buildTenantProductEntitlements,
  parseStringArray,
  getAuthTenantId,
  buildAdminEditableEnvPatch,
  buildAdminEditableEnvApplySummary,
  updateEnvFile,
  resolveAdminEditableRootEnvFilePath,
  resolveAdminEditablePortalEnvFilePath,
  recordAdminSecuritySignal,
  getClientIp,
  upsertAdminUserInDb,
  revokeSessionsForUser,
  buildClearSessionCookie,
  restartManagedRuntimeServices,
  config,
  resolveScopedTenantId,
  upsertPlatformTenantConfig,
  tryServeAdminStaticAsset,
  tryServeStaticScumIcon,
  sendText,
  sendHtml,
  isAuthorized,
  getAuthContext,
  getLoginHtml,
  getTenantLoginHtml,
  getOwnerConsoleHtml,
  getTenantConsoleHtml,
  getDashboardHtml,
  getPersistenceStatus,
  getPublicPersistenceStatus,
  getDeliveryMetricsSnapshot,
  ensurePlatformApiKey,
  readJsonBody,
  getTenantQuotaSnapshot,
  getPlatformPublicOverview,
  getPlatformAnalyticsOverview,
  getPackageCatalogSummary,
  getFeatureCatalogSummary,
  verifyPlatformApiKey,
  SSO_DISCORD_ACTIVE,
  cleanupDiscordOauthStates,
  buildDiscordAuthorizeUrl: ({ host, port, state }) => buildDiscordAuthorizeUrl({
    apiBase: DISCORD_API_BASE,
    clientId: SSO_DISCORD_CLIENT_ID,
    guildId: SSO_DISCORD_GUILD_ID,
    redirectUri: getDiscordRedirectUri(host, port),
    state,
  }),
  getDiscordRedirectUri,
  exchangeDiscordOauthCode: (code, redirectUri) => exchangeDiscordOauthCode({
    apiBase: DISCORD_API_BASE,
    clientId: SSO_DISCORD_CLIENT_ID,
    clientSecret: SSO_DISCORD_CLIENT_SECRET,
    code,
    redirectUri,
  }),
  fetchDiscordProfile: (accessToken) => fetchDiscordProfile(DISCORD_API_BASE, accessToken),
  fetchDiscordGuildMember: (accessToken, guildId) => fetchDiscordGuildMember(
    DISCORD_API_BASE,
    accessToken,
    guildId,
  ),
  listDiscordGuildRolesFromClient,
  resolveMappedMemberRole,
  getAdminSsoRoleMappingSummary,
  SSO_DISCORD_GUILD_ID,
  SSO_DISCORD_DEFAULT_ROLE,
  discordOauthStates,
  createSession,
  buildSessionCookie,
  invalidateSession,
  authenticateTenantUser,
  consumeTenantBootstrapToken,
  resolveTenantSessionAccessContext,
  resolveAdminSessionAccessContext,
  prisma,
  sendDownload,
  consumeTransientDownload,
  ensureRole,
  ensurePortalTokenAuth,
  getSessionId,
  hasFreshStepUp,
  hasValidSession,
  filterRowsByTenantScope,
  jsonReplacer,
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
  buildTenantDiagnosticsBundle,
  buildTenantDiagnosticsCsv,
  buildTenantSupportCaseBundle,
    buildTenantSupportCaseCsv,
    buildDeliveryLifecycleReport,
    buildDeliveryLifecycleCsv,
    buildTenantDonationOverview,
    buildTenantModuleOverview,
    getPlatformPermissionCatalog,
  getPlanCatalog,
  listPersistedPackageCatalog,
  buildTenantActorAccessSummary,
  buildTenantRoleMatrix,
  getPlatformOpsState,
  getPlatformAutomationState,
  getAutomationConfig,
  getPlatformTenantConfig,
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
  listPlatformWebhookEndpoints,
  listMarketplaceOffers,
  reconcileDeliveryState,
  listRestartPlans,
  listRestartExecutions,
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
  getLoginRateLimitState,
  recordLoginAttempt,
  getUserByCredentials,
  ADMIN_WEB_2FA_SECRET,
  ADMIN_WEB_2FA_WINDOW_STEPS,
  verifyTotpCode,
  setCoinsExact,
  creditCoins,
  debitCoins,
  addShopItemForAdmin,
  updateShopItemForAdmin,
  setShopItemPriceForAdmin,
  setShopItemStatusForAdmin,
  deleteShopItemForAdmin,
  updatePurchaseStatusForActor,
  parseDeliveryItemsBody,
  enqueuePurchaseDeliveryByCode,
  retryDeliveryNow,
  retryDeliveryNowMany,
  retryDeliveryDeadLetter,
  retryDeliveryDeadLetterMany,
  removeDeliveryDeadLetter,
  cancelDeliveryJob,
  previewDeliveryCommands,
  getDeliveryPreflightReport,
  simulateDeliveryPlan,
  setDeliveryCommandOverride,
  sendTestDeliveryCommand,
  saveAdminCommandCapabilityPreset,
  getAdminCommandCapabilityPresetById,
  deleteAdminCommandCapabilityPreset,
  testScumAdminCommandCapability,
  runRentBikeMidnightReset,
  getRentBikeRuntime,
  updateScumStatusForAdmin,
  getStatus,
  redeemCodeForUser,
  requestRentBikeForUser,
  prepareTransientDownload,
  createAdminBackup,
  previewAdminBackupRestore,
  restoreAdminBackup,
  publishAdminLiveUpdate,
  createTenant,
  createPackageCatalogEntry,
  inviteTenantStaff,
  updateTenantStaffRole,
  revokeTenantStaffMembership,
  createSubscription,
  deletePackageCatalogEntry,
  createCheckoutSession,
  updateInvoiceStatus,
  updatePaymentAttempt,
  updateSubscriptionBillingState,
  issuePlatformLicense,
  acceptPlatformLicenseLegal,
  createPlatformWebhookEndpoint,
  dispatchPlatformWebhookEvent,
  scheduleRestartPlan,
  createMarketplaceOffer,
  runPlatformMonitoringCycle,
  runPlatformAutomationCycle,
  acknowledgeAdminNotifications,
  clearAdminNotifications,
  updatePackageCatalogEntry,
  buildAuditDatasetService,
  buildAuditExportPayloadService,
  buildAuditCsvService,
  listAuditPresetsService,
  saveAuditPresetService,
  deleteAuditPresetService,
  listControlPlaneAgentSessions,
  listControlPlaneSyncRuns,
  listControlPlaneSyncEvents,
  listEvents,
});

const {
  startAdminWebServer,
} = createAdminServerLifecycle({
  processEnv: process.env,
  asInt,
  getAdminToken,
  buildAllowedOrigins,
  ensureMetricsSeriesTimer,
  startPlatformMonitoring,
  stopPlatformMonitoring,
  startPlatformAutomation,
  stopPlatformAutomation,
  adminLiveBus,
  broadcastLiveUpdate,
  createAdminRequestHandler,
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
  closeAllLiveStreams,
  stopMetricsSeriesTimer,
  startRuntimeSupervisorMonitor,
  stopRuntimeSupervisorMonitor,
  ensureAdminUsersReady,
  listAdminUsersFromDb,
  sessionSecureCookie: SESSION_SECURE_COOKIE,
  sessionCookieName: SESSION_COOKIE_NAME,
  sessionCookiePath: SESSION_COOKIE_PATH,
  sessionCookieSameSite: SESSION_COOKIE_SAMESITE,
  sessionCookieDomain: SESSION_COOKIE_DOMAIN,
  adminWeb2faActive: ADMIN_WEB_2FA_ACTIVE,
  adminWeb2faEnabled: ADMIN_WEB_2FA_ENABLED,
  ssoDiscordActive: SSO_DISCORD_ACTIVE,
  ssoDiscordEnabled: SSO_DISCORD_ENABLED,
});

module.exports = {
  startAdminWebServer,
};
