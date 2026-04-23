'use strict';

/**
 * Compose the player portal helper/auth/route runtime from the standalone
 * entrypoint. Keep server.js focused on env loading and process bootstrap.
 */

const crypto = require('node:crypto');

const {
  safeJsonStringify,
} = require('../../../src/utils/jsonSerialization');
const {
  listShopItems,
  listUserPurchases,
  getWallet,
  listWalletLedger,
  canClaimDaily,
  claimDaily,
  canClaimWeekly,
  claimWeekly,
  listTopWallets,
  listPurchaseStatusHistory,
} = require('../../../src/store/memoryStore');
const {
  getPlayerDashboard,
  listPlayerAccounts,
  getPlayerAccount,
  upsertPlayerAccount,
} = require('../../../src/store/playerAccountStore');
const {
  redeemCodeForUser,
  requestRentBikeForUser,
  createBountyForUser,
  listActiveBountiesForUser,
} = require('../../../src/services/playerOpsService');
const { resolveItemIconUrl } = require('../../../src/services/itemIconService');
const {
  getResolvedCart,
  checkoutCart,
  buildBundleSummary,
  getDeliveryStatusText,
} = require('../../../src/services/cartService');
const {
  normalizeShopKind,
  isGameItemShopKind,
  findShopItemByQuery,
  purchaseShopItemForUser,
} = require('../../../src/services/shopService');
const {
  addCartItem,
  removeCartItem,
  clearCart,
  listCartItems,
} = require('../../../src/store/cartStore');
const { transferCoins } = require('../../../src/services/coinService');
const {
  checkRewardClaimForUser,
  claimRewardForUser,
} = require('../../../src/services/rewardService');
const {
  setLink,
  getLinkBySteamId,
  getLinkByUserId,
} = require('../../../src/store/linkStore');
const {
  canSpinWheel,
  getUserWheelState,
} = require('../../../src/store/luckyWheelStore');
const {
  listPartyMessages,
  addPartyMessage,
  normalizePartyKey,
} = require('../../../src/store/partyChatStore');
const { listCodes } = require('../../../src/store/redeemStore');
const { getStats, listAllStats } = require('../../../src/store/statsStore');
const { getStatus } = require('../../../src/store/scumStore');
const {
  ensureRentBikeTables,
  listRentalVehicles,
  getDailyRent,
} = require('../../../src/store/rentBikeStore');
const { awardWheelRewardForUser } = require('../../../src/services/wheelService');
const {
  getPlatformPublicOverview,
  getPlatformTenantBySlug,
  getTenantFeatureAccess,
} = require('../../../src/services/platformService');
const {
  buildTenantDonationOverview,
} = require('../../../src/services/tenantDonationOverviewService');
const {
  createCheckoutSession,
  finalizeCheckoutSession,
  getCheckoutSessionByToken,
  processBillingWebhookEvent,
} = require('../../../src/services/platformBillingLifecycleService');
const {
  ensurePlatformPlayerIdentity,
  getPlatformUserIdentitySummary,
  issueEmailVerificationToken,
} = require('../../../src/services/platformIdentityService');
const {
  bindSteamLinkForUser,
  removeSteamLink,
} = require('../../../src/services/linkService');
const {
  createPlayerSupportTicket,
  listSupportTicketsForUser,
  closeSupportTicketForUser,
} = require('../../../src/services/ticketService');
const {
  createRaidRequest,
  listRaidRequests,
  listRaidSummaries,
  listRaidWindows,
} = require('../../../src/services/raidService');
const {
  listKillFeedEntries,
} = require('../../../src/services/killFeedService');
const {
  createServerRegistryService,
} = require('../../../src/domain/servers/serverRegistryService');
const {
  createPersistentRuntimeStore,
} = require('../../../src/store/runtimeStateStore');
const { publicPreviewService } = require('../../../src/services/publicPreviewService');
const {
  registerTenantOwnerAccount,
  requestPlayerMagicLink,
  consumePlayerMagicLink,
} = require('../../../src/services/platformWorkspaceAuthService');
const config = require('../../../src/config');
const { resolveDefaultTenantId } = require('../../../src/prisma');

const { createPortalAuthRuntime } = require('../auth/portalAuthRuntime');
const { createPublicPreviewAuthRuntime } = require('../auth/publicPreviewAuthRuntime');
const {
  createPublicPlatformRoutes,
} = require('../api/publicPlatformRoutes');
const {
  createPlayerCommerceRoutes,
} = require('../api/playerCommerceRoutes');
const {
  createPlayerGeneralRoutes,
} = require('../api/playerGeneralRoutes');
const {
  buildPlayerPortalFeatureAccess,
} = require('../api/playerRouteEntitlements');
const {
  buildAdminProductUrl,
  buildLegacyAdminUrl,
  buildPortalHealthPayload,
  buildPortalRuntimeSettings,
  isDiscordCallbackPath,
  isDiscordStartPath,
  isGoogleCallbackPath,
  isGoogleStartPath,
  printPortalStartupHints,
} = require('./portalRuntime');
const {
  asInt,
  buildDiscordAvatarUrl,
  createPortalHelperRuntime,
  escapeHtml,
  isDiscordId,
  normalizeAmount,
  normalizeQuantity,
  normalizeText,
  parseCsvSet,
} = require('./portalHelperRuntime');
const {
  createPortalPageRoutes,
} = require('./portalPageRoutes');
const {
  createPortalRequestRuntime,
} = require('./portalRequestRuntime');
const {
  createPortalPageAssetRuntime,
} = require('./portalPageAssetRuntime');
const {
  createPortalResponseRuntime,
} = require('./portalResponseRuntime');
const {
  createPortalRewardRuntime,
} = require('./portalRewardRuntime');
const {
  createPortalSurfaceRuntime,
} = require('./portalSurfaceRuntime');

const FAVICON_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1">',
  '<stop offset="0%" stop-color="#d3af6a"/><stop offset="100%" stop-color="#b6ce84"/>',
  '</linearGradient></defs>',
  '<rect width="64" height="64" rx="12" fill="#10180f"/>',
  '<path d="M10 14h44v6H10zm0 30h44v6H10z" fill="url(#g)" opacity=".85"/>',
  '<path d="M45 20H24c-2.4 0-4 1.4-4 3.5 0 2.4 1.9 3.4 4.5 4.1l8 2.2c1.4.4 2.1 1 2.1 1.9 0 1-1 1.8-2.4 1.8H18v8h15.2c6.4 0 10.8-3.6 10.8-9.2 0-4.4-2.5-7.2-7.7-8.7l-7.5-2.1c-1.2-.3-1.7-.8-1.7-1.4 0-.8.8-1.3 1.9-1.3H45z" fill="url(#g)"/>',
  '</svg>',
].join('');

function createPortalBootstrapRuntime({
  settings,
  logger = console,
} = {}) {
  const {
    nodeEnv,
    isProduction,
    baseUrl,
    portalMode,
    legacyAdminUrl,
    sessionTtlMs,
    sessionCookieName,
    sessionSecret,
    sessionCookieSameSite,
    sessionCookiePath,
    sessionCookieDomain,
    secureCookie,
    enforceOriginCheck,
    discordClientId,
    discordClientSecret,
    googleClientId,
    googleClientSecret,
    discordGuildId,
    playerOpenAccess,
    requireGuildMember,
    oauthStateTtlMs,
    discordRedirectPath,
    googleRedirectPath,
    cleanupIntervalMs,
    publicAssetsDirPath,
    discordApiBase,
    authLoginHtmlPath,
    playerLoginHtmlPath,
    playerHtmlPath,
    legacyPlayerHtmlPath,
    landingHtmlPath,
    dashboardHtmlPath,
    pricingHtmlPath,
    signupHtmlPath,
    forgotPasswordHtmlPath,
    verifyEmailHtmlPath,
    checkoutHtmlPath,
    paymentResultHtmlPath,
    previewHtmlPath,
    trialHtmlPath,
    showcaseHtmlPath,
    docsDirPath,
    defaultMapPortalUrl,
    scumItemsDirPath,
    partyChatMinIntervalMs,
    partyChatMaxLength,
    allowedDiscordIdsRaw,
  } = settings || {};

  const sessions = createPersistentRuntimeStore({
    filename: 'portal-runtime-sessions.json',
    expiryField: 'expiresAt',
    persistDelayMs: 50,
  });
  const oauthStates = createPersistentRuntimeStore({
    filename: 'portal-runtime-oauth-states.json',
    expiryField: 'expiresAt',
    persistDelayMs: 50,
  });
  const previewSessions = createPersistentRuntimeStore({
    filename: 'portal-runtime-preview-sessions.json',
    expiryField: 'expiresAt',
    persistDelayMs: 50,
  });
  const { listServerRegistry } = createServerRegistryService();
  const partyChatLastSentAt = new Map();
  const allowedDiscordIds = parseCsvSet(allowedDiscordIdsRaw || '');

  const portalHelperRuntime = createPortalHelperRuntime({
    buildBundleSummary,
    buildPortalHealthPayload,
    buildPortalRuntimeSettings,
    config,
    defaultMapPortalUrl,
    getLinkByUserId,
    getRuntimeSettingsInput: () => ({
      nodeEnv,
      mode: portalMode,
      baseUrl,
      legacyAdminUrl,
      sessionCount: sessions.size,
      oauthStateCount: oauthStates.size,
      secureCookie,
      cookieName: sessionCookieName,
      cookiePath: sessionCookiePath,
      cookieSameSite: sessionCookieSameSite,
      cookieDomain: sessionCookieDomain,
      enforceOriginCheck,
      discordOAuthConfigured: Boolean(discordClientId && discordClientSecret),
      googleOAuthConfigured: Boolean(googleClientId && googleClientSecret),
      discordClientId,
      discordClientSecret,
      googleClientId,
      googleClientSecret,
      discordGuildId,
      playerOpenAccess,
      requireGuildMember,
      allowedDiscordIdsCount: allowedDiscordIds.size,
      sessionTtlMs,
      isProduction,
    }),
    isGameItemShopKind,
    listAllStats,
    listPlayerAccounts,
    logger,
    normalizePartyKey,
    normalizeShopKind,
    printPortalStartupHints,
    resolveItemIconUrl,
  });

  const {
    buildHealthPayload,
    buildPlayerNameLookup,
    filterShopItems,
    getEconomyConfig,
    getFrameSrcOrigins,
    getMapPortalConfig,
    normalizeHttpUrl,
    printStartupHints,
    readJsonBody,
    readRawBody,
    resolvePartyContext,
    serializeCartResolved,
    sortLeaderboardRows,
  } = portalHelperRuntime;

  const {
    buildWheelStatePayload,
    getDateKeyInTimezone,
    getLuckyWheelConfig,
    getNextMidnightIsoInTimezone,
    getRentTimezone,
    msToCountdownText,
    msToDaysHours,
    msToHoursMinutes,
    normalizePurchaseStatus,
    pickLuckyWheelReward,
  } = createPortalRewardRuntime({
    crypto,
    config,
    canSpinWheel,
    getUserWheelState,
    normalizeText,
    normalizeAmount,
    normalizeQuantity,
    normalizeHttpUrl,
    resolveItemIconUrl,
  });

  const {
    buildNotificationItems,
    buildSecurityHeaders,
    resolveSessionSteamLink,
    sendHtml,
    sendJson,
    walletReasonLabel,
  } = createPortalResponseRuntime({
    secureCookie,
    safeJsonStringify,
    getFrameSrcOrigins,
    getLinkByUserId,
    getPlayerAccount,
    normalizeText,
  });

  const portalAuthRuntime = createPortalAuthRuntime({
    sessions,
    oauthStates,
    baseUrl,
    enforceOriginCheck,
    playerOpenAccess,
    requireGuildMember,
    allowedDiscordIds,
    oauthStateTtlMs,
    sessionTtlMs,
    sessionCookieName,
    sessionSecret,
    sessionCookiePath,
    sessionCookieSameSite,
    sessionCookieDomain,
    secureCookie,
    discordApiBase,
    discordClientId,
    discordClientSecret,
    googleClientId,
    googleClientSecret,
    discordGuildId,
    discordRedirectPath,
    googleRedirectPath,
    sendJson,
    upsertPlayerAccount,
    ensurePlatformPlayerIdentity,
    getPlatformUserIdentitySummary,
    identityTenantId: resolveDefaultTenantId() || null,
    identityLocale: String(config.platform?.localization?.defaultLocale || 'en').trim().toLowerCase() || 'en',
    buildDiscordAvatarUrl,
    normalizeText,
    isDiscordId,
    logger,
  });

  const {
    buildClearSessionCookie,
    buildSessionCookie,
    cleanupRuntimeState,
    createSession,
    getCanonicalRedirectUrl,
    getSession,
    handleDiscordCallback,
    handleDiscordStart,
    handleGoogleCallback,
    handleGoogleStart,
    removeSession,
    verifyOrigin,
  } = portalAuthRuntime;

  const publicPreviewAuthRuntime = createPublicPreviewAuthRuntime({
    sessions: previewSessions,
    sessionTtlMs,
    sessionCookieName: `${sessionCookieName}_preview`,
    sessionCookiePath,
    sessionCookieSameSite,
    sessionCookieDomain,
    secureCookie,
  });

  const {
    buildClearSessionCookie: buildClearPreviewSessionCookie,
    buildSessionCookie: buildPreviewSessionCookie,
    cleanupRuntimeState: cleanupPreviewRuntimeState,
    createSession: createPreviewSession,
    getSession: getPreviewSession,
    removeSession: removePreviewSession,
  } = publicPreviewAuthRuntime;

  async function readOptionalPublicData(label, readFn, fallback) {
    try {
      return await Promise.resolve().then(() => readFn());
    } catch (error) {
      logger.warn?.(`[public-portal] optional snapshot data unavailable (${label})`, error?.message || error);
      return fallback;
    }
  }

  function buildPublicSupporterRows(overview = {}) {
    const recentActivity = Array.isArray(overview?.recentActivity) ? overview.recentActivity : [];
    const grouped = new Map();
    for (const row of recentActivity) {
      if (!row?.isSupporter) continue;
      const userId = normalizeText(row?.userId) || `supporter-${grouped.size + 1}`;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          label: userId.length > 18 ? `${userId.slice(0, 18)}...` : userId,
          latestPackage: normalizeText(row?.itemName || row?.itemId) || 'Supporter package',
          latestStatus: normalizeText(row?.status || row?.latestTransition) || 'unknown',
          lastPurchaseAt: row?.createdAt || null,
          totalPurchases: 0,
          totalCoins: 0,
        });
      }
      const entry = grouped.get(userId);
      entry.totalPurchases += 1;
      entry.totalCoins += Number(row?.price || 0) || 0;
      if (!entry.lastPurchaseAt || new Date(entry.lastPurchaseAt).getTime() < new Date(row?.createdAt || 0).getTime()) {
        entry.lastPurchaseAt = row?.createdAt || entry.lastPurchaseAt;
        entry.latestPackage = normalizeText(row?.itemName || row?.itemId) || entry.latestPackage;
        entry.latestStatus = normalizeText(row?.status || row?.latestTransition) || entry.latestStatus;
      }
    }
    return Array.from(grouped.values())
      .sort((left, right) => {
        const leftTime = new Date(left.lastPurchaseAt || 0).getTime();
        const rightTime = new Date(right.lastPurchaseAt || 0).getTime();
        if (rightTime !== leftTime) return rightTime - leftTime;
        if (right.totalPurchases !== left.totalPurchases) return right.totalPurchases - left.totalPurchases;
        return right.totalCoins - left.totalCoins;
      })
      .slice(0, 8);
  }

  async function getPublicServerPortalSnapshot(slugValue) {
    let tenant = null;
    try {
      tenant = await getPlatformTenantBySlug(slugValue);
    } catch (error) {
      console.warn('[web-portal-standalone] public server lookup unavailable', error?.message || error);
      tenant = null;
    }
    if (!tenant?.id) {
      return null;
    }

    const tenantId = tenant.id;
    let servers = [];
    try {
      servers = await listServerRegistry({ tenantId });
    } catch (error) {
      console.warn('[web-portal-standalone] public server registry unavailable', error?.message || error);
      servers = [];
    }
    const primaryServerId = servers[0]?.id || null;
    let rawFeatureAccess = {
      tenantId,
      enabledFeatureKeys: [],
    };
    try {
      rawFeatureAccess = await getTenantFeatureAccess(tenantId, {
        allowFallback: true,
      });
    } catch (error) {
      console.warn('[web-portal-standalone] public feature access unavailable', error?.message || error);
    }
    const featureAccess = buildPlayerPortalFeatureAccess(rawFeatureAccess);

    const [
      shopItemsRaw,
      statsRowsRaw,
      killfeedRaw,
      raidWindowsRaw,
      raidSummariesRaw,
      donationOverview,
    ] = await Promise.all([
      readOptionalPublicData('public-shop-items', () => listShopItems({
        tenantId,
        includeDisabled: false,
        includeTestItems: false,
      }), []),
      readOptionalPublicData('public-stats', () => listAllStats({ tenantId, serverId: primaryServerId }), []),
      readOptionalPublicData('public-killfeed', () => listKillFeedEntries({ tenantId, serverId: primaryServerId, limit: 12 }), []),
      readOptionalPublicData('public-raid-windows', () => listRaidWindows({ tenantId, serverId: primaryServerId, limit: 6 }), []),
      readOptionalPublicData('public-raid-summaries', () => listRaidSummaries({ tenantId, serverId: primaryServerId, limit: 6 }), []),
      readOptionalPublicData('public-donations', () => buildTenantDonationOverview({ tenantId, serverId: primaryServerId, limit: 8 }), null),
    ]);

    const shopItems = Array.isArray(shopItemsRaw) ? shopItemsRaw : [];
    const statsRows = Array.isArray(statsRowsRaw) ? statsRowsRaw : [];
    const leaderboard = statsRows
      .map((row) => ({
        userId: normalizeText(row?.userId) || '-',
        kills: Number(row?.kills || 0) || 0,
        deaths: Number(row?.deaths || 0) || 0,
        playtimeMinutes: Number(row?.playtimeMinutes || 0) || 0,
        kd: Number(row?.deaths || 0) > 0 ? (Number(row?.kills || 0) / Number(row?.deaths || 0)) : Number(row?.kills || 0),
      }))
      .sort((left, right) => {
        if (right.kills !== left.kills) return right.kills - left.kills;
        return right.playtimeMinutes - left.playtimeMinutes;
      })
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        slug: normalizeText(tenant.slug) || normalizeText(slugValue),
        name: normalizeText(tenant.name) || normalizeText(tenant.slug) || 'SCUM community',
        status: normalizeText(tenant.status || 'active') || 'active',
      },
      featureAccess,
      servers: Array.isArray(servers) ? servers : [],
      primaryServer: servers[0] || null,
      leaderboard,
      shopItems,
      killfeed: Array.isArray(killfeedRaw) ? killfeedRaw : [],
      raidWindows: Array.isArray(raidWindowsRaw) ? raidWindowsRaw : [],
      raidSummaries: Array.isArray(raidSummariesRaw) ? raidSummariesRaw : [],
      donations: donationOverview || {
        summary: {
          totalPackages: 0,
          activePackages: 0,
          supporterRevenueCoins30d: 0,
          supporterPurchases30d: 0,
          activeSupporters30d: 0,
          lastPurchaseAt: null,
        },
        topPackages: [],
        recentActivity: [],
      },
      supporters: buildPublicSupporterRows(donationOverview || {}),
    };
  }

  const { requestHandler, startCleanupTimer } = createPortalSurfaceRuntime({
    createPublicPlatformRoutes,
    createPlayerCommerceRoutes,
    createPlayerGeneralRoutes,
    createPortalPageAssetRuntime,
    createPortalPageRoutes,
    createPortalRequestRuntime,
    commerceRouteDeps: {
      sendJson,
      readJsonBody,
      normalizeText,
      normalizeAmount,
      normalizeQuantity,
      normalizePurchaseStatus,
      asInt,
      resolveItemIconUrl,
      buildBundleSummary,
      getDeliveryStatusText,
      serializeCartResolved,
      getResolvedCart,
      findShopItemByQuery,
      isGameItemShopKind,
      resolveSessionSteamLink,
      purchaseShopItemForUser,
      checkoutCart,
      listUserPurchases,
      listShopItems,
      listPurchaseStatusHistory,
      listCartItems,
      addCartItem,
      removeCartItem,
      clearCart,
      listActiveBountiesForUser,
      redeemCodeForUser,
      requestRentBikeForUser,
      createBountyForUser,
      normalizeShopKind,
      filterShopItems,
      getTenantFeatureAccess,
    },
    generalRouteDeps: {
      sendJson,
      readJsonBody,
      buildClearSessionCookie,
      buildSessionCookie,
      normalizeText,
      normalizeAmount,
      normalizePurchaseStatus,
      asInt,
      config,
      getStatus,
      getEconomyConfig,
      getLuckyWheelConfig,
      getMapPortalConfig,
      getPlayerAccount,
      getPlayerDashboard,
      resolveSessionSteamLink,
      removeSession,
      createSession,
      updateSession: portalAuthRuntime.updateSession,
      requestPlayerMagicLink,
      consumePlayerMagicLink,
      listTopWallets,
      listAllStats,
      getStats,
      buildPlayerNameLookup,
      sortLeaderboardRows,
      resolvePartyContext,
      listPartyMessages,
      addPartyMessage,
      partyChatLastSentAt,
      partyChatMinIntervalMs,
      partyChatMaxLength,
      listWalletLedger,
      getWallet,
      walletReasonLabel,
      listCodes,
      ensureRentBikeTables,
      getDailyRent,
      listRentalVehicles,
      getRentTimezone,
      getDateKeyInTimezone,
      getNextMidnightIsoInTimezone,
      canClaimDaily,
      canClaimWeekly,
      buildWheelStatePayload,
      canSpinWheel,
      pickLuckyWheelReward,
      awardWheelRewardForUser,
      msToCountdownText,
      buildNotificationItems,
      getLinkBySteamId,
      setLink,
      bindSteamLinkForUser,
      removeSteamLink,
      claimRewardForUser,
      checkRewardClaimForUser,
      msToHoursMinutes,
      msToDaysHours,
      transferCoins,
      isDiscordId,
      listServerRegistry,
      listUserPurchases,
      claimDaily,
      claimWeekly,
      getTenantFeatureAccess,
      getPlatformUserIdentitySummary,
      issueEmailVerificationToken,
      createPlayerSupportTicket,
      listSupportTicketsForUser,
      closeSupportTicketForUser,
      createRaidRequest,
      listRaidRequests,
      listRaidWindows,
      listRaidSummaries,
      listKillFeedEntries,
      listPlayerAccounts,
      buildTenantDonationOverview,
    },
    pageAssetDeps: {
      isProduction,
      authLoginHtmlPath,
      playerLoginHtmlPath,
      playerHtmlPath,
      legacyPlayerHtmlPath,
      landingHtmlPath,
      dashboardHtmlPath,
      pricingHtmlPath,
      signupHtmlPath,
      forgotPasswordHtmlPath,
      verifyEmailHtmlPath,
      checkoutHtmlPath,
      paymentResultHtmlPath,
      previewHtmlPath,
      trialHtmlPath,
      showcaseHtmlPath,
      discordOAuthConfigured: Boolean(discordClientId && discordClientSecret),
      googleOAuthConfigured: Boolean(googleClientId && googleClientSecret),
      publicAssetsDirPath,
      docsDirPath,
      scumItemsDirPath,
      faviconSvg: FAVICON_SVG,
      sendJson,
      sendHtml,
      buildSecurityHeaders,
      escapeHtml,
    },
    pageRouteDeps: {
      allowCaptureAuth: nodeEnv === 'capture',
      captureAuthToken: String(process.env.WEB_PORTAL_CAPTURE_TOKEN || '').trim(),
      createCaptureSession: () => createSession({
        user: 'Capture Player',
        role: 'player',
        discordId: String(process.env.WEB_PORTAL_CAPTURE_DISCORD_ID || '100000000000000000').trim(),
        authMethod: 'capture',
        tenantId: String(process.env.WEB_PORTAL_CAPTURE_TENANT_ID || resolveDefaultTenantId() || '').trim() || null,
        avatarUrl: null,
      }),
      buildSessionCookie,
      buildAdminProductUrl: (pathname, search) => buildAdminProductUrl(legacyAdminUrl, pathname, search),
      buildLegacyAdminUrl: (pathname, search) => buildLegacyAdminUrl(legacyAdminUrl, pathname, search),
      getCanonicalRedirectUrl,
      readJsonBody,
      sendJson,
      sendHtml,
      buildHealthPayload,
      getPlatformPublicOverview,
      getPublicServerPortalSnapshot,
      isDiscordStartPath,
      isDiscordCallbackPath: (pathname) => isDiscordCallbackPath(pathname, discordRedirectPath),
      isGoogleStartPath,
      isGoogleCallbackPath: (pathname) => isGoogleCallbackPath(pathname, googleRedirectPath),
      handleDiscordStart,
      handleDiscordCallback,
      handleGoogleStart,
      handleGoogleCallback,
      getSession,
      getPreviewSession,
    },
    publicRouteDeps: {
      sendJson,
      readJsonBody,
      readRawBody,
      getPlatformPublicOverview,
      getPublicServerPortalSnapshot,
      registerTenantOwnerAccount,
      registerPreviewAccount: publicPreviewService.registerPreviewAccount,
      authenticatePreviewAccount: publicPreviewService.authenticatePreviewAccount,
      getPreviewState: publicPreviewService.getPreviewState,
      requestEmailVerification: publicPreviewService.requestEmailVerification,
      completeEmailVerification: publicPreviewService.completeEmailVerification,
      requestPasswordReset: publicPreviewService.requestPasswordReset,
      completePasswordReset: publicPreviewService.completePasswordReset,
      createCheckoutSession,
      getCheckoutSessionByToken,
      finalizeCheckoutSession,
      processBillingWebhookEvent,
      billingWebhookSecret: String(process.env.PLATFORM_BILLING_WEBHOOK_SECRET || '').trim(),
      buildAdminProductUrl: (pathname, search) => buildAdminProductUrl(legacyAdminUrl, pathname, search),
      createPreviewSession,
      getPreviewSession,
      buildPreviewSessionCookie,
      buildClearPreviewSessionCookie,
      removePreviewSession,
    },
    requestRuntimeDeps: {
      sendJson,
      verifyOrigin,
      getSession,
      requestPlayerMagicLink,
      consumePlayerMagicLink,
      createSession,
      buildSessionCookie,
      isDiscordId,
      cleanupRuntimeState: () => {
        cleanupRuntimeState();
        cleanupPreviewRuntimeState();
      },
      cleanupIntervalMs,
    },
  });

  return {
    startupReady: printStartupHints(),
    requestHandler,
    startCleanupTimer,
  };
}

module.exports = {
  createPortalBootstrapRuntime,
};
