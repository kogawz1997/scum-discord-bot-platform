/**
 * Remaining standalone portal routes outside the commerce/cart surface.
 */

const {
  buildPlayerPortalFeatureAccess,
  hasFeatureAccess,
  loadPlayerFeatureAccess,
  sendPlayerFeatureDenied,
} = require('./playerRouteEntitlements');

function createPlayerGeneralRoutes(deps) {
  const {
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
    updateSession,
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
    claimRewardForUser,
    checkRewardClaimForUser,
    msToHoursMinutes,
    msToDaysHours,
    transferCoins,
    isDiscordId,
    listServerRegistry,
    getPlatformUserIdentitySummary,
    createRaidRequest,
    listRaidRequests,
    listRaidWindows,
    listRaidSummaries,
    listKillFeedEntries,
    listPlayerAccounts,
    buildTenantDonationOverview,
  } = deps;
  const safeNormalizeText = typeof normalizeText === 'function'
    ? normalizeText
    : (value) => String(value || '').trim();
  const safeNormalizeAmount = typeof normalizeAmount === 'function'
    ? normalizeAmount
    : (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
    };
  const safeAsInt = typeof asInt === 'function'
    ? asInt
    : (value, fallback = null) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
    };

  async function getFeatureAccess(session) {
    return loadPlayerFeatureAccess(deps.getTenantFeatureAccess, session);
  }

  async function readOptionalPlayerData(label, readFn, fallback) {
    try {
      return await Promise.resolve().then(() => readFn());
    } catch (error) {
      console.warn(`[player-portal] optional player data unavailable (${label})`, error?.message || error);
      return fallback;
    }
  }

  function normalizeEconomySnapshot(raw) {
    return {
      currencySymbol: normalizeText(raw?.currencySymbol) || 'Coins',
      dailyReward: normalizeAmount(raw?.dailyReward, 0),
      weeklyReward: normalizeAmount(raw?.weeklyReward, 0),
    };
  }

  function normalizeServerStatusSnapshot(raw) {
    return {
      onlinePlayers: normalizeAmount(raw?.onlinePlayers, 0),
      maxPlayers: normalizeAmount(raw?.maxPlayers, 0),
      pingMs: raw?.pingMs == null ? null : normalizeAmount(raw?.pingMs, 0),
      uptimeMinutes: normalizeAmount(raw?.uptimeMinutes, 0),
      lastUpdated: raw?.lastUpdated || null,
    };
  }

  function normalizeLuckyWheelConfigSnapshot(raw) {
    const rewards = Array.isArray(raw?.rewards)
      ? raw.rewards.map((row) => ({
        id: normalizeText(row?.id) || 'reward',
        label: normalizeText(row?.label || row?.id) || 'Reward',
        type: normalizeText(row?.type || 'coins') || 'coins',
        amount: normalizeAmount(row?.amount, 0),
        weight: Math.max(1, normalizeAmount(row?.weight, 1)),
        itemId: normalizeText(row?.itemId) || null,
        gameItemId: normalizeText(row?.gameItemId) || null,
        quantity: normalizeAmount(row?.quantity, 0),
        iconUrl: normalizeText(row?.iconUrl) || null,
      }))
      : [];
    return {
      enabled: raw?.enabled === true,
      cooldownMs: normalizeAmount(raw?.cooldownMs, 0),
      rewards,
      tips: Array.isArray(raw?.tips)
        ? raw.tips.map((line) => normalizeText(line)).filter(Boolean)
        : [],
    };
  }

  function normalizeMapPortalSnapshot(raw) {
    return {
      enabled: raw?.enabled === true,
      embedEnabled: raw?.embedEnabled === true,
      embedUrl: normalizeText(raw?.embedUrl) || null,
      externalUrl: normalizeText(raw?.externalUrl) || null,
    };
  }

  function buildSupporterDisplayLabel(account, userId, index) {
    const displayName = safeNormalizeText(account?.displayName || account?.username);
    if (displayName) return displayName;
    const normalizedUserId = safeNormalizeText(userId);
    if (normalizedUserId && /^\d{6,25}$/.test(normalizedUserId)) {
      return `Supporter ${normalizedUserId.slice(-4)}`;
    }
    if (normalizedUserId) {
      return normalizedUserId.length > 18 ? `${normalizedUserId.slice(0, 18)}...` : normalizedUserId;
    }
    return `Supporter #${index}`;
  }

  function buildSupporterCommunityPayload(overview, playerAccounts, limit) {
    const recentActivity = Array.isArray(overview?.recentActivity) ? overview.recentActivity : [];
    const accountRows = Array.isArray(playerAccounts) ? playerAccounts : [];
    const accountMap = new Map(
      accountRows
        .map((row) => [safeNormalizeText(row?.discordId), row])
        .filter(([discordId]) => Boolean(discordId)),
    );
    const grouped = new Map();
    for (const row of recentActivity) {
      if (!row?.isSupporter) continue;
      const userId = safeNormalizeText(row?.userId) || `supporter-${grouped.size + 1}`;
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          label: buildSupporterDisplayLabel(accountMap.get(userId), userId, grouped.size + 1),
          latestPackage: safeNormalizeText(row?.itemName || row?.itemId) || 'Supporter package',
          latestStatus: safeNormalizeText(row?.status || row?.latestTransition) || 'unknown',
          lastPurchaseAt: row?.createdAt || null,
          totalPurchases: 0,
          totalCoins: 0,
        });
      }
      const entry = grouped.get(userId);
      entry.totalPurchases += 1;
      entry.totalCoins += safeNormalizeAmount(row?.price, 0);
      if (!entry.lastPurchaseAt || new Date(entry.lastPurchaseAt).getTime() < new Date(row?.createdAt || 0).getTime()) {
        entry.lastPurchaseAt = row?.createdAt || entry.lastPurchaseAt;
        entry.latestPackage = safeNormalizeText(row?.itemName || row?.itemId) || entry.latestPackage;
        entry.latestStatus = safeNormalizeText(row?.status || row?.latestTransition) || entry.latestStatus;
      }
    }
    const max = Math.max(1, Math.min(24, safeAsInt(limit, 8) || 8));
    return Array.from(grouped.values())
      .sort((left, right) => {
        const leftTime = new Date(left.lastPurchaseAt || 0).getTime();
        const rightTime = new Date(right.lastPurchaseAt || 0).getTime();
        if (rightTime !== leftTime) return rightTime - leftTime;
        if (right.totalPurchases !== left.totalPurchases) return right.totalPurchases - left.totalPurchases;
        return right.totalCoins - left.totalCoins;
      })
      .slice(0, max)
      .map((row) => ({
        label: row.label,
        latestPackage: row.latestPackage,
        latestStatus: row.latestStatus,
        lastPurchaseAt: row.lastPurchaseAt,
        totalPurchases: row.totalPurchases,
        totalCoins: row.totalCoins,
      }));
  }

  function buildFallbackWheelState(wheelConfig) {
    const normalizedConfig = normalizeLuckyWheelConfigSnapshot(wheelConfig);
    return {
      enabled: normalizedConfig.enabled,
      cooldownMs: normalizedConfig.cooldownMs,
      canSpin: false,
      remainingMs: 0,
      remainingText: normalizedConfig.enabled ? 'Temporarily unavailable' : 'Disabled',
      nextSpinAt: null,
      lastSpinAt: null,
      totalSpins: 0,
      history: [],
      rewards: normalizedConfig.rewards,
    };
  }

  function normalizeServerRegistryEntry(row) {
    const id = safeNormalizeText(row?.id);
    if (!id) return null;
    const guildLinks = Array.isArray(row?.guildLinks)
      ? row.guildLinks
        .map((entry) => ({
          id: safeNormalizeText(entry?.id) || null,
          guildId: safeNormalizeText(entry?.guildId) || null,
          status: safeNormalizeText(entry?.status || 'active').toLowerCase() || 'active',
        }))
        .filter((entry) => entry.guildId)
      : [];
    const status = safeNormalizeText(row?.status || 'active').toLowerCase() || 'active';
    const name = safeNormalizeText(row?.name) || id;
    return {
      id,
      name,
      status,
      locale: safeNormalizeText(row?.locale) || null,
      guildCount: guildLinks.length,
      guildLinks,
      label: guildLinks.length > 0 ? `${name} (${guildLinks.length} guild)` : name,
    };
  }

  async function resolvePlayerServerState(session) {
    const tenantId = safeNormalizeText(session?.tenantId);
    const preferredServerId = safeNormalizeText(session?.activeServerId) || null;
    const preferredServerName = safeNormalizeText(session?.activeServerName) || null;
    if (!tenantId || typeof listServerRegistry !== 'function') {
      return {
        tenantId: tenantId || null,
        count: 0,
        items: [],
        activeServerId: preferredServerId,
        activeServerName: preferredServerName,
        effectiveServerId: preferredServerId,
        effectiveServerName: preferredServerName,
        selectionRequired: false,
      };
    }

    const rows = await Promise.resolve(listServerRegistry({ tenantId }));
    const items = (Array.isArray(rows) ? rows : [])
      .map(normalizeServerRegistryEntry)
      .filter(Boolean)
      .sort((left, right) => {
        const leftActive = left.status === 'active' ? 0 : 1;
        const rightActive = right.status === 'active' ? 0 : 1;
        if (leftActive !== rightActive) return leftActive - rightActive;
        return left.name.localeCompare(right.name, 'en');
      });

    const persistedServer = preferredServerId
      ? items.find((entry) => entry.id === preferredServerId) || null
      : null;
    const singleServerSelection = !persistedServer && items.length === 1 ? items[0] : null;
    const effectiveServer = persistedServer
      || singleServerSelection
      || items.find((entry) => entry.status === 'active')
      || items[0]
      || null;
    const activeServer = persistedServer || singleServerSelection || null;

    return {
      tenantId,
      count: items.length,
      items,
      activeServerId: activeServer?.id || null,
      activeServerName: activeServer?.name || null,
      effectiveServerId: effectiveServer?.id || preferredServerId || null,
      effectiveServerName: effectiveServer?.name || preferredServerName || null,
      selectionRequired: items.length > 1 && !persistedServer,
    };
  }

  return async function handlePlayerGeneralRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
      session,
    } = context;
    const playerServerState = session ? await resolvePlayerServerState(session) : null;
    const tenantOptions = {
      tenantId: session?.tenantId || undefined,
      serverId: playerServerState?.effectiveServerId || session?.activeServerId || undefined,
    };

    if (pathname === '/player/api/me' && method === 'GET') {
      const [account, link] = await Promise.all([
        getPlayerAccount(session.discordId, tenantOptions),
        resolveSessionSteamLink(session.discordId, tenantOptions),
      ]);
      sendJson(res, 200, {
        ok: true,
        data: {
          user: session.user,
          role: session.role,
          discordId: session.discordId,
          authMethod: session.authMethod,
          primaryEmail: normalizeText(session.primaryEmail) || null,
          avatarUrl: normalizeText(session.avatarUrl)
            || normalizeText(account?.avatarUrl)
            || null,
          accountStatus: account?.isActive === false ? 'inactive' : 'active',
          steamLinked: Boolean(link?.linked),
          tenantId: tenantOptions.tenantId || null,
          activeServerId: playerServerState?.activeServerId || null,
          activeServerName: playerServerState?.activeServerName || null,
          effectiveServerId: playerServerState?.effectiveServerId || null,
          effectiveServerName: playerServerState?.effectiveServerName || null,
          serverSelectionRequired: playerServerState?.selectionRequired === true,
        },
      });
      return true;
    }

    if (pathname === '/player/api/servers' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: {
          tenantId: tenantOptions.tenantId || null,
          count: safeNormalizeAmount(playerServerState?.count, 0),
          activeServerId: playerServerState?.activeServerId || null,
          activeServerName: playerServerState?.activeServerName || null,
          effectiveServerId: playerServerState?.effectiveServerId || null,
          effectiveServerName: playerServerState?.effectiveServerName || null,
          selectionRequired: playerServerState?.selectionRequired === true,
          items: Array.isArray(playerServerState?.items) ? playerServerState.items : [],
        },
      });
      return true;
    }

    if (pathname === '/player/api/session/server' && method === 'POST') {
      if (!tenantOptions.tenantId) {
        sendJson(res, 400, {
          ok: false,
          error: 'tenant-required',
        });
        return true;
      }
      const body = await readJsonBody(req);
      const serverId = normalizeText(body?.serverId || body?.id);
      if (!serverId) {
        sendJson(res, 400, {
          ok: false,
          error: 'missing-server',
          data: {
            message: 'Choose a server before continuing',
          },
        });
        return true;
      }
      const items = Array.isArray(playerServerState?.items) ? playerServerState.items : [];
      const targetServer = items.find((entry) => entry.id === serverId) || null;
      if (!targetServer) {
        sendJson(res, 404, {
          ok: false,
          error: 'server-not-found',
        });
        return true;
      }
      if (typeof updateSession !== 'function') {
        sendJson(res, 500, {
          ok: false,
          error: 'session-update-unavailable',
        });
        return true;
      }
      const sessionToken = updateSession(req, {
        activeServerId: targetServer.id,
        activeServerName: targetServer.name,
      });
      if (!sessionToken) {
        sendJson(res, 401, {
          ok: false,
          error: 'session-update-failed',
        });
        return true;
      }
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            tenantId: tenantOptions.tenantId,
            count: safeNormalizeAmount(playerServerState?.count, 0),
            activeServerId: targetServer.id,
            activeServerName: targetServer.name,
            effectiveServerId: targetServer.id,
            effectiveServerName: targetServer.name,
            selectionRequired: false,
            items,
            message: `Now viewing ${targetServer.name}`,
          },
        },
        {
          'Set-Cookie': buildSessionCookie(sessionToken, req),
        },
      );
      return true;
    }

    if (pathname === '/player/api/feature-access' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      sendJson(res, 200, {
        ok: true,
        data: buildPlayerPortalFeatureAccess(featureAccess),
      });
      return true;
    }

    if (pathname === '/player/api/supporters' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['donation_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['donation_module']);
      }
      const limit = safeAsInt(urlObj.searchParams.get('limit'), 8) || 8;
      const overview = typeof buildTenantDonationOverview === 'function' && tenantOptions.tenantId
        ? await buildTenantDonationOverview({
          tenantId: tenantOptions.tenantId,
          serverId: tenantOptions.serverId || null,
          limit: Math.max(limit * 2, 12),
        }).catch(() => null)
        : null;
      const playerAccounts = typeof listPlayerAccounts === 'function' && tenantOptions.tenantId
        ? await readOptionalPlayerData(
          'supporter-player-accounts',
          () => listPlayerAccounts(Math.max(limit * 4, 32), tenantOptions),
          [],
        )
        : [];
      sendJson(res, 200, {
        ok: true,
        data: {
          generatedAt: overview?.generatedAt || null,
          summary: overview?.summary || {
            supporterPackages: 0,
            supporterPurchases30d: 0,
            supporterRevenueCoins30d: 0,
            activeSupporters30d: 0,
            lastPurchaseAt: null,
          },
          items: buildSupporterCommunityPayload(overview, playerAccounts, limit),
        },
      });
      return true;
    }

    if (pathname === '/player/api/auth/email/request' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = typeof requestPlayerMagicLink === 'function'
        ? await requestPlayerMagicLink({
          email: body?.email,
        })
        : { ok: false, reason: 'email-magic-link-not-configured' };
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'email-magic-link-request-failed',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          requested: true,
        },
      });
      return true;
    }

    if (pathname === '/player/api/auth/email/complete' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = typeof consumePlayerMagicLink === 'function'
        ? await consumePlayerMagicLink({
          token: body?.token,
          email: body?.email,
        })
        : { ok: false, reason: 'email-magic-link-not-configured' };
      if (!result?.ok || !result?.discordUserId) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'email-magic-link-complete-failed',
        });
        return true;
      }
      const nextServerState = await resolvePlayerServerState({
        tenantId: result?.profile?.tenantId || null,
      });
      const sessionId = createSession({
        user: normalizeText(result?.user?.displayName) || normalizeText(result?.user?.primaryEmail) || result.discordUserId,
        role: 'player',
        discordId: result.discordUserId,
        authMethod: 'email-magic-link',
        primaryEmail: normalizeText(result?.user?.primaryEmail) || normalizeText(body?.email) || null,
        avatarUrl: null,
        platformUserId: result?.user?.id || null,
        platformProfileId: result?.profile?.id || null,
        tenantId: result?.profile?.tenantId || null,
        activeServerId: nextServerState?.activeServerId || null,
        activeServerName: nextServerState?.activeServerName || null,
      });
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            nextUrl: '/player/home',
          },
        },
        {
          'Set-Cookie': buildSessionCookie(sessionId, req),
        },
      );
      return true;
    }

    if (pathname === '/player/api/logout' && method === 'POST') {
      removeSession(req);
      sendJson(
        res,
        200,
        { ok: true, data: { loggedOut: true } },
        { 'Set-Cookie': buildClearSessionCookie(req) },
      );
      return true;
    }

    if (pathname === '/player/api/server/info' && method === 'GET') {
      const serverInfo = config.serverInfo || {};
      const raidTimes = Array.isArray(config.raidTimes) ? config.raidTimes : [];
      const [status, economy, luckyWheel, mapPortal] = await Promise.all([
        readOptionalPlayerData(
          'server-status',
          () => (typeof getStatus === 'function' ? getStatus(tenantOptions) : null),
          null,
        ),
        readOptionalPlayerData(
          'economy-config',
          () => (typeof getEconomyConfig === 'function' ? getEconomyConfig() : null),
          null,
        ),
        readOptionalPlayerData(
          'lucky-wheel-config',
          () => (typeof getLuckyWheelConfig === 'function' ? getLuckyWheelConfig() : null),
          null,
        ),
        readOptionalPlayerData(
          'map-portal-config',
          () => (typeof getMapPortalConfig === 'function' ? getMapPortalConfig() : null),
          null,
        ),
      ]);
      const rulesShort = Array.isArray(serverInfo.rulesShort)
        ? serverInfo.rulesShort.map((line) => normalizeText(line)).filter(Boolean)
        : [];
      const safeEconomy = normalizeEconomySnapshot(economy);
      const safeWheel = normalizeLuckyWheelConfigSnapshot(luckyWheel);
      const safeMapPortal = normalizeMapPortalSnapshot(mapPortal);
      sendJson(res, 200, {
        ok: true,
        data: {
          economy: safeEconomy,
          serverInfo: {
            name: normalizeText(serverInfo.name) || 'SCUM Server',
            description: normalizeText(serverInfo.description),
            ip: normalizeText(serverInfo.ip),
            port: normalizeText(serverInfo.port),
            maxPlayers: normalizeAmount(serverInfo.maxPlayers, 0),
            rulesShort,
            website: normalizeText(serverInfo.website),
          },
          raidTimes: raidTimes.map((line) => normalizeText(line)).filter(Boolean),
          tips: safeWheel.tips,
          luckyWheel: {
            enabled: safeWheel.enabled,
            cooldownMs: safeWheel.cooldownMs,
            rewards: safeWheel.rewards.map((row) => ({
              id: row.id,
              label: row.label,
              type: row.type,
              amount: row.amount,
              weight: row.weight,
              itemId: row.itemId || null,
              gameItemId: row.gameItemId || null,
              quantity: row.quantity || 0,
              iconUrl: row.iconUrl || null,
            })),
          },
          mapPortal: safeMapPortal,
          scope: {
            tenantId: tenantOptions.tenantId || null,
            activeServerId: playerServerState?.activeServerId || null,
            activeServerName: playerServerState?.activeServerName || null,
            effectiveServerId: playerServerState?.effectiveServerId || null,
            effectiveServerName: playerServerState?.effectiveServerName || null,
            selectionRequired: playerServerState?.selectionRequired === true,
          },
          status: normalizeServerStatusSnapshot(status),
        },
      });
      return true;
    }

    if (pathname === '/player/api/raids' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module']);
      }
      const [myRequests, windows, summaries] = await Promise.all([
        typeof listRaidRequests === 'function'
          ? listRaidRequests({
            tenantId: tenantOptions.tenantId || null,
            serverId: tenantOptions.serverId || null,
            requesterUserId: session.discordId,
            limit: safeAsInt(urlObj.searchParams.get('limit'), 12, 1, 50) || 12,
          })
          : [],
        typeof listRaidWindows === 'function'
          ? listRaidWindows({
            tenantId: tenantOptions.tenantId || null,
            serverId: tenantOptions.serverId || null,
            limit: 12,
          })
          : [],
        typeof listRaidSummaries === 'function'
          ? listRaidSummaries({
            tenantId: tenantOptions.tenantId || null,
            serverId: tenantOptions.serverId || null,
            limit: 12,
          })
          : [],
      ]);
      sendJson(res, 200, {
        ok: true,
        data: {
          myRequests: Array.isArray(myRequests) ? myRequests : [],
          windows: Array.isArray(windows) ? windows : [],
          summaries: Array.isArray(summaries) ? summaries : [],
        },
      });
      return true;
    }

    if (pathname === '/player/api/raids/request' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module']);
      }
      const body = await readJsonBody(req);
      const requestText = safeNormalizeText(body?.requestText || body?.summary);
      const preferredWindow = safeNormalizeText(body?.preferredWindow);
      if (!requestText) {
        sendJson(res, 400, {
          ok: false,
          error: 'invalid-raid-request',
          data: { message: 'Provide a raid request summary before submitting.' },
        });
        return true;
      }
      const result = typeof createRaidRequest === 'function'
        ? await createRaidRequest({
          tenantId: tenantOptions.tenantId || null,
          serverId: tenantOptions.serverId || null,
          requesterUserId: session.discordId,
          requesterName: session.user || session.discordId || 'Player',
          requestText,
          preferredWindow: preferredWindow || null,
        })
        : { ok: false, reason: 'raid-service-unavailable' };
      if (!result?.ok) {
        sendJson(res, 503, {
          ok: false,
          error: result?.reason || 'raid-service-unavailable',
          data: { message: 'Raid requests are temporarily unavailable right now.' },
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          request: result.request,
          message: 'Raid request submitted. Staff can now review the preferred window.',
        },
      });
      return true;
    }

    if (pathname === '/player/api/killfeed' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module']);
      }
      const rows = typeof listKillFeedEntries === 'function'
        ? await listKillFeedEntries({
          tenantId: tenantOptions.tenantId || null,
          serverId: tenantOptions.serverId || null,
          limit: safeAsInt(urlObj.searchParams.get('limit'), 20) || 20,
        })
        : [];
      const items = (Array.isArray(rows) ? rows : []).map((row) => ({
        ...row,
        involvesPlayer:
          row?.killerUserId === session.discordId || row?.victimUserId === session.discordId,
        playerRole:
          row?.killerUserId === session.discordId
            ? 'killer'
            : row?.victimUserId === session.discordId
              ? 'victim'
              : null,
      }));
      sendJson(res, 200, {
        ok: true,
        data: {
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/online' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: getStatus(),
      });
      return true;
    }

    if (pathname === '/player/api/prices' && method === 'GET') {
      const economy = getEconomyConfig();
      sendJson(res, 200, {
        ok: true,
        data: {
          currencySymbol: economy.currencySymbol,
          dailyReward: economy.dailyReward,
          weeklyReward: economy.weeklyReward,
          message:
            `สกุลเงินหลัก: ${economy.currencySymbol} | ` +
            `รายวัน: ${economy.dailyReward.toLocaleString()} | ` +
            `รายสัปดาห์: ${economy.weeklyReward.toLocaleString()}`,
        },
      });
      return true;
    }

    if (pathname === '/player/api/leaderboard' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['ranking_module', 'analytics_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['ranking_module', 'analytics_module']);
      }
      const typeRaw = normalizeText(urlObj.searchParams.get('type')).toLowerCase();
      const type = ['economy', 'kills', 'kd', 'playtime'].includes(typeRaw)
        ? typeRaw
        : 'kills';
      const limit = asInt(urlObj.searchParams.get('limit'), 10, 3, 50);
      const nameMap = await buildPlayerNameLookup(tenantOptions);

      if (type === 'economy') {
        const rows = await listTopWallets(limit, tenantOptions);
        const items = rows.map((row, index) => {
          const userId = normalizeText(row?.userId);
          return {
            rank: index + 1,
            userId,
            name: nameMap.get(userId) || userId,
            balance: normalizeAmount(row?.balance, 0),
          };
        });
        sendJson(res, 200, { ok: true, data: { type, total: items.length, items } });
        return true;
      }

      const allStats = listAllStats(tenantOptions).map((row) => {
        const kills = normalizeAmount(row?.kills, 0);
        const deaths = normalizeAmount(row?.deaths, 0);
        const playtimeMinutes = normalizeAmount(row?.playtimeMinutes, 0);
        const kd = deaths === 0 ? kills : kills / deaths;
        return {
          userId: normalizeText(row?.userId),
          kills,
          deaths,
          playtimeMinutes,
          kd,
        };
      });

      sortLeaderboardRows(allStats, type);
      const items = allStats.slice(0, limit).map((row, index) => ({
        rank: index + 1,
        userId: row.userId,
        name: nameMap.get(row.userId) || row.userId,
        kills: row.kills,
        deaths: row.deaths,
        kd: Number(row.kd.toFixed(2)),
        playtimeMinutes: row.playtimeMinutes,
        playtimeHours: Math.floor(row.playtimeMinutes / 60),
      }));

      sendJson(res, 200, { ok: true, data: { type, total: items.length, items } });
      return true;
    }

    if (pathname === '/player/api/stats/me' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['player_module', 'ranking_module', 'analytics_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['player_module', 'ranking_module', 'analytics_module']);
      }
      const stats = getStats(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          userId: session.discordId,
          kills: normalizeAmount(stats?.kills, 0),
          deaths: normalizeAmount(stats?.deaths, 0),
          kd: Number(
            (
              (normalizeAmount(stats?.deaths, 0) === 0
                ? normalizeAmount(stats?.kills, 0)
                : normalizeAmount(stats?.kills, 0) / normalizeAmount(stats?.deaths, 0))
            ).toFixed(2),
          ),
          playtimeMinutes: normalizeAmount(stats?.playtimeMinutes, 0),
        },
      });
      return true;
    }

    if (pathname === '/player/api/profile' && method === 'GET') {
      const [account, link] = await Promise.all([
        getPlayerAccount(session.discordId, tenantOptions),
        resolveSessionSteamLink(session.discordId, tenantOptions),
      ]);
      const identity = await readOptionalPlayerData(
        'player-identity-summary',
        () => (
          typeof getPlatformUserIdentitySummary === 'function'
            ? getPlatformUserIdentitySummary({
              userId: session.platformUserId || null,
              email: session.primaryEmail || null,
              discordUserId: session.discordId,
              steamId: link?.steamId || null,
              tenantId: tenantOptions.tenantId || null,
              legacySteamLink: link || null,
              fallbackEmail: session.primaryEmail || null,
              fallbackDiscordUserId: session.discordId || null,
            })
            : null
        ),
        null,
      );
      const identities = Array.isArray(identity?.identities) ? identity.identities : [];
      const memberships = Array.isArray(identity?.memberships) ? identity.memberships : [];
      const emailIdentity = identities.find((entry) => String(entry?.provider || '').trim().toLowerCase() === 'email_preview') || null;
      const discordIdentity = identities.find((entry) => String(entry?.provider || '').trim().toLowerCase() === 'discord') || null;
      const steamIdentity = identities.find((entry) => String(entry?.provider || '').trim().toLowerCase() === 'steam') || null;
      const activeMembership = memberships.find((entry) => normalizeText(entry?.tenantId) === normalizeText(tenantOptions.tenantId))
        || memberships.find((entry) => normalizeText(entry?.status || '').toLowerCase() === 'active')
        || memberships[0]
        || null;
      const normalizedIdentitySummary = identity?.identitySummary || {
        linkedProviders: identities
          .map((entry) => normalizeText(entry?.provider).toLowerCase())
          .filter(Boolean),
        verificationState: normalizeText(identity?.profile?.verificationState).toLowerCase() || null,
        memberships: memberships.map((entry) => ({
          tenantId: entry?.tenantId || null,
          membershipType: entry?.membershipType || null,
          role: entry?.role || null,
          status: entry?.status || null,
        })),
        linkedAccounts: {
          email: {
            linked: Boolean(emailIdentity || session.primaryEmail),
            verified: Boolean(emailIdentity?.verifiedAt),
            value: normalizeText(identity?.user?.primaryEmail)
              || normalizeText(emailIdentity?.providerEmail)
              || normalizeText(session.primaryEmail)
              || null,
          },
          discord: {
            linked: Boolean(discordIdentity || session.discordId),
            verified: Boolean(discordIdentity?.verifiedAt) || Boolean(session.discordId),
            value: normalizeText(discordIdentity?.providerUserId) || normalizeText(session.discordId) || null,
          },
          steam: {
            linked: Boolean(steamIdentity || link?.linked),
            verified: Boolean(steamIdentity?.verifiedAt)
              || ['steam_linked', 'verified', 'fully_verified'].includes(normalizeText(identity?.profile?.verificationState).toLowerCase()),
            value: normalizeText(identity?.profile?.steamId)
              || normalizeText(steamIdentity?.providerUserId)
              || normalizeText(link?.steamId)
              || null,
          },
          inGame: {
            linked: Boolean(identity?.profile?.inGameName),
            verified: ['verified', 'fully_verified', 'in_game_verified'].includes(normalizeText(identity?.profile?.verificationState).toLowerCase()),
            value: normalizeText(identity?.profile?.inGameName) || normalizeText(link?.inGameName) || null,
          },
        },
        activeMembership: activeMembership
          ? {
              tenantId: activeMembership.tenantId || null,
              membershipType: activeMembership.membershipType || null,
              role: activeMembership.role || null,
              status: activeMembership.status || null,
            }
          : null,
      };
      sendJson(res, 200, {
        ok: true,
        data: {
          discordId: session.discordId,
          user: session.user,
          role: session.role || 'player',
          avatarUrl: normalizeText(session.avatarUrl)
            || normalizeText(account?.avatarUrl)
            || null,
          username: normalizeText(account?.username)
            || normalizeText(session.user)
            || null,
          displayName: normalizeText(account?.displayName)
            || normalizeText(session.user)
            || null,
          primaryEmail: normalizeText(session.primaryEmail) || null,
          accountStatus: account?.isActive === false ? 'inactive' : 'active',
          createdAt: account?.createdAt || null,
          updatedAt: account?.updatedAt || null,
          steamLink: link,
          platformUserId: identity?.user?.id || session.platformUserId || null,
          platformProfileId: identity?.profile?.id || session.platformProfileId || null,
          identitySummary: normalizedIdentitySummary,
        },
      });
      return true;
    }

    if (pathname === '/player/api/party' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: await resolvePartyContext(session.discordId, tenantOptions),
      });
      return true;
    }

    if (pathname === '/player/api/party/chat' && method === 'GET') {
      const limit = asInt(urlObj.searchParams.get('limit'), 80, 1, 200);
      const party = await resolvePartyContext(session.discordId, tenantOptions);
      const items =
        party.chatEnabled && party.partyKey
          ? await listPartyMessages(party.partyKey, limit, tenantOptions)
          : [];
      sendJson(res, 200, {
        ok: true,
        data: {
          party,
          total: items.length,
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/party/chat/send' && method === 'POST') {
      const body = await readJsonBody(req);
      const message = normalizeText(body.message || body.text);
      if (!message) {
        sendJson(res, 400, {
          ok: false,
          error: 'missing-message',
          data: { message: 'กรุณาพิมพ์ข้อความก่อนส่ง' },
        });
        return true;
      }
      if (message.length > partyChatMaxLength) {
        sendJson(res, 400, {
          ok: false,
          error: 'message-too-long',
          data: {
            maxLength: partyChatMaxLength,
            message: `ข้อความยาวเกินไป (สูงสุด ${partyChatMaxLength} ตัวอักษร)`,
          },
        });
        return true;
      }

      const party = await resolvePartyContext(session.discordId, tenantOptions);
      if (!party.chatEnabled || !party.partyKey) {
        sendJson(res, 400, {
          ok: false,
          error: 'party-chat-unavailable',
          data: { message: 'ยังไม่พบปาร์ตี้ของคุณในระบบ (ต้องมี squad ก่อน)' },
        });
        return true;
      }

      const nowMs = Date.now();
      const previousMs = partyChatLastSentAt.get(session.discordId) || 0;
      if (nowMs - previousMs < partyChatMinIntervalMs) {
        sendJson(res, 429, {
          ok: false,
          error: 'party-chat-rate-limit',
          data: {
            retryAfterMs: partyChatMinIntervalMs - (nowMs - previousMs),
            message: 'ส่งข้อความเร็วเกินไป กรุณารอสักครู่',
          },
        });
        return true;
      }

      const me = party.members.find((row) => row.discordId === session.discordId);
      const displayName =
        normalizeText(me?.displayName) || normalizeText(session.user) || session.discordId;
      const addResult = await addPartyMessage(party.partyKey, {
        userId: session.discordId,
        displayName,
        message,
      }, tenantOptions);
      if (!addResult?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: addResult?.reason || 'party-chat-send-failed',
        });
        return true;
      }
      partyChatLastSentAt.set(session.discordId, nowMs);
      sendJson(res, 200, {
        ok: true,
        data: {
          party,
          item: addResult.data,
        },
      });
      return true;
    }

    if (pathname === '/player/api/wallet/ledger' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['wallet_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['wallet_module']);
      }
      const limit = asInt(urlObj.searchParams.get('limit'), 50, 1, 500);
      const wallet = await getWallet(session.discordId, tenantOptions);
      const rows = await listWalletLedger(session.discordId, limit, tenantOptions);
      const items = rows.map((row) => ({
        id: row.id,
        delta: normalizeAmount(row.delta, 0) * (Number(row.delta || 0) < 0 ? -1 : 1),
        balanceBefore: normalizeAmount(row.balanceBefore, 0),
        balanceAfter: normalizeAmount(row.balanceAfter, 0),
        reason: normalizeText(row.reason),
        reasonLabel: walletReasonLabel(row.reason),
        reference: normalizeText(row.reference) || null,
        actor: normalizeText(row.actor) || null,
        meta: row.meta || null,
        createdAt: row.createdAt || null,
      }));
      sendJson(res, 200, {
        ok: true,
        data: {
          wallet: {
            userId: session.discordId,
            balance: normalizeAmount(wallet.balance, 0),
          },
          total: items.length,
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/redeem/history' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['orders_module', 'wallet_module', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['orders_module', 'wallet_module', 'promo_module']);
      }
      const limit = asInt(urlObj.searchParams.get('limit'), 50, 1, 500);
      const rows = listCodes(tenantOptions)
        .filter((row) => normalizeText(row.usedBy) === session.discordId)
        .sort((a, b) => {
          const at = a?.usedAt ? new Date(a.usedAt).getTime() : 0;
          const bt = b?.usedAt ? new Date(b.usedAt).getTime() : 0;
          return bt - at;
        })
        .slice(0, limit)
        .map((row) => ({
          code: row.code,
          type: row.type,
          amount: row.amount == null ? null : normalizeAmount(row.amount, 0),
          itemId: normalizeText(row.itemId) || null,
          usedBy: normalizeText(row.usedBy) || null,
          usedAt: row.usedAt || null,
        }));
      sendJson(res, 200, {
        ok: true,
        data: {
          total: rows.length,
          items: rows,
        },
      });
      return true;
    }

    if (pathname === '/player/api/rentbike/status' && method === 'GET') {
      const link = await resolveSessionSteamLink(session.discordId, tenantOptions);
      if (!link.linked || !link.steamId) {
        sendJson(res, 200, {
          ok: true,
          data: {
            linked: false,
            steamId: null,
            current: null,
            history: [],
            todayQuotaUsed: false,
            nextResetAt: getNextMidnightIsoInTimezone(getRentTimezone()),
          },
        });
        return true;
      }

      await ensureRentBikeTables();
      const timezone = getRentTimezone();
      const dateKey = getDateKeyInTimezone(timezone);
      const [dailyRent, rentals] = await Promise.all([
        getDailyRent(link.steamId, dateKey, tenantOptions),
        listRentalVehicles(400, tenantOptions),
      ]);
      const history = rentals
        .filter((row) => normalizeText(row.userKey) === link.steamId)
        .sort((a, b) => {
          const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
      const current = history.find((row) =>
        ['pending', 'delivering', 'delivered'].includes(
          normalizeText(row.status).toLowerCase(),
        ),
      ) || null;
      sendJson(res, 200, {
        ok: true,
        data: {
          linked: true,
          steamId: link.steamId,
          todayQuotaUsed: Boolean(dailyRent?.used),
          nextResetAt: getNextMidnightIsoInTimezone(timezone),
          current,
          history: history.slice(0, 50),
        },
      });
      return true;
    }

    if (pathname === '/player/api/missions' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'event_auto_reward', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'event_auto_reward', 'promo_module']);
      }
      const [dailyCheck, weeklyCheck, rentLink] = await Promise.all([
        canClaimDaily(session.discordId, tenantOptions),
        canClaimWeekly(session.discordId, tenantOptions),
        resolveSessionSteamLink(session.discordId, tenantOptions),
      ]);
      const timezone = getRentTimezone();
      const dateKey = getDateKeyInTimezone(timezone);
      let rentDaily = null;
      if (rentLink?.steamId) {
        await ensureRentBikeTables();
        rentDaily = await getDailyRent(rentLink.steamId, dateKey, tenantOptions);
      }

      sendJson(res, 200, {
        ok: true,
        data: {
          missions: [
            {
              id: 'daily-claim',
              title: 'ภารกิจรายวัน: รับเหรียญ',
              category: 'daily',
              completed: !dailyCheck?.ok,
              claimable: Boolean(dailyCheck?.ok),
              remainingMs: dailyCheck?.ok ? 0 : normalizeAmount(dailyCheck?.remainingMs, 0),
              remainingText: dailyCheck?.ok ? 'พร้อมรับ' : msToHoursMinutes(dailyCheck?.remainingMs),
            },
            {
              id: 'weekly-claim',
              title: 'ภารกิจรายสัปดาห์: รับเหรียญ',
              category: 'weekly',
              completed: !weeklyCheck?.ok,
              claimable: Boolean(weeklyCheck?.ok),
              remainingMs: weeklyCheck?.ok ? 0 : normalizeAmount(weeklyCheck?.remainingMs, 0),
              remainingText: weeklyCheck?.ok ? 'พร้อมรับ' : msToDaysHours(weeklyCheck?.remainingMs),
            },
            {
              id: 'rentbike-daily',
              title: 'สิทธิ์เช่ามอไซรายวัน',
              category: 'vehicle',
              completed: Boolean(rentDaily?.used),
              claimable: rentLink?.steamId ? !Boolean(rentDaily?.used) : false,
              remainingMs: Boolean(rentDaily?.used) ? 1 : 0,
              remainingText: Boolean(rentDaily?.used)
                ? `รีเซ็ต ${getDateKeyInTimezone(timezone)} 00:00 (${timezone})`
                : rentLink?.steamId
                  ? 'พร้อมเช่า'
                  : 'ต้องลิงก์ SteamID ก่อน',
            },
          ],
        },
      });
      return true;
    }

    if (pathname === '/player/api/wheel/state' && method === 'GET') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'promo_module']);
      }
      const limit = asInt(urlObj.searchParams.get('limit'), 20, 1, 80);
      const wheelConfig = normalizeLuckyWheelConfigSnapshot(
        await readOptionalPlayerData(
          'lucky-wheel-config',
          () => (typeof getLuckyWheelConfig === 'function' ? getLuckyWheelConfig() : null),
          null,
        ),
      );
      const wheelState = await readOptionalPlayerData(
        'wheel-state',
        () => (
          typeof buildWheelStatePayload === 'function'
            ? buildWheelStatePayload(session.discordId, wheelConfig, limit, tenantOptions)
            : null
        ),
        null,
      );
      sendJson(res, 200, {
        ok: true,
        data: wheelState || buildFallbackWheelState(wheelConfig),
      });
      return true;
    }

    if (pathname === '/player/api/wheel/spin' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['event_module', 'promo_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['event_module', 'promo_module']);
      }
      const wheelConfig = getLuckyWheelConfig();
      if (!wheelConfig.enabled) {
        sendJson(res, 403, {
          ok: false,
          error: 'wheel-disabled',
          data: { message: 'วงล้อสุ่มรางวัลถูกปิดอยู่ชั่วคราว' },
        });
        return true;
      }

      const check = await canSpinWheel(
        session.discordId,
        wheelConfig.cooldownMs,
        Date.now(),
        tenantOptions,
      );
      if (!check.ok) {
        sendJson(res, 429, {
          ok: false,
          error: 'wheel-cooldown',
          data: {
            remainingMs: normalizeAmount(check.remainingMs, 0),
            remainingText: msToCountdownText(check.remainingMs),
            nextSpinAt: check.nextSpinAt || null,
            message: 'ยังหมุนไม่ได้ในตอนนี้',
          },
        });
        return true;
      }

      const reward = pickLuckyWheelReward(wheelConfig.rewards);
      if (!reward) {
        sendJson(res, 500, { ok: false, error: 'wheel-reward-not-found' });
        return true;
      }
      const wheelResult = await awardWheelRewardForUser({
        userId: session.discordId,
        reward,
        source: 'player-portal',
        actor: 'system',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!wheelResult.ok) {
        const error = wheelResult.reason || 'wheel-award-failed';
        const statusCode = error === 'steam-link-required-for-item-wheel' ? 400 : 500;
        sendJson(res, statusCode, {
          ok: false,
          error,
          data: {
            message: error === 'steam-link-required-for-item-wheel'
              ? 'วงล้อมีรางวัลไอเทมในเกม กรุณาผูก SteamID ก่อนหมุน'
              : 'ไม่สามารถมอบรางวัลวงล้อได้',
          },
        });
        return true;
      }

      const wheelState = await buildWheelStatePayload(
        session.discordId,
        wheelConfig,
        20,
        tenantOptions,
      );
      const rewardData = wheelResult.reward || {};
      const rewardLabel = normalizeText(rewardData.label || reward.label || reward.id) || 'รางวัลพิเศษ';
      sendJson(res, 200, {
        ok: true,
        data: {
          reward: {
            id: rewardData.id,
            label: rewardLabel,
            type: rewardData.type,
            amount: rewardData.amount,
            quantity: rewardData.type === 'item' ? rewardData.quantity : 0,
            itemId: rewardData.type === 'item' ? rewardData.itemId : null,
            gameItemId: rewardData.type === 'item' ? rewardData.gameItemId : null,
            iconUrl: rewardData.iconUrl,
            purchaseCode: rewardData.purchaseCode,
            deliveryQueued: rewardData.deliveryQueued,
            deliveryQueueReason: rewardData.deliveryQueueReason,
            at: rewardData.at,
            awardedCoins: rewardData.awardedCoins,
          },
          walletBalance: normalizeAmount(wheelResult.walletBalance, 0),
          message: wheelResult.message,
          state: wheelState,
        },
      });
      return true;
    }

    if (pathname === '/player/api/notifications' && method === 'GET') {
      const limit = asInt(urlObj.searchParams.get('limit'), 30, 1, 100);
      const [purchasesRaw, ledgerRaw, rentLink] = await Promise.all([
        deps.listUserPurchases(session.discordId, tenantOptions),
        listWalletLedger(session.discordId, limit, tenantOptions),
        resolveSessionSteamLink(session.discordId, tenantOptions),
      ]);
      let rentalRaw = [];
      if (rentLink?.steamId) {
        await ensureRentBikeTables();
        const rentals = await listRentalVehicles(300, tenantOptions);
        rentalRaw = rentals.filter((row) => normalizeText(row.userKey) === rentLink.steamId);
      }
      const items = buildNotificationItems({
        purchases: purchasesRaw.slice(0, limit),
        ledgers: ledgerRaw.slice(0, limit),
        rentals: rentalRaw.slice(0, limit),
      }).slice(0, limit);
      sendJson(res, 200, { ok: true, data: { total: items.length, items } });
      return true;
    }

    if (pathname === '/player/api/linksteam/me' && method === 'GET') {
      const link = await resolveSessionSteamLink(session.discordId, tenantOptions);
      sendJson(res, 200, {
        ok: true,
        data: {
          linked: link.linked,
          steamId: link.steamId,
          inGameName: link.inGameName,
          linkedAt: link.linkedAt,
        },
      });
      return true;
    }

    if (pathname === '/player/api/linksteam/history' && method === 'GET') {
      const link = await resolveSessionSteamLink(session.discordId, tenantOptions);
      const items = [];
      if (link?.steamId) {
        items.push({
          action: 'bind',
          steamId: link.steamId,
          inGameName: link.inGameName || null,
          at: link.linkedAt || null,
        });
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          total: items.length,
          items,
        },
      });
      return true;
    }

    if (pathname === '/player/api/linksteam/set' && method === 'POST') {
      const body = await readJsonBody(req);
      const steamId = normalizeText(body.steamId);
      const isSteamId = /^\d{15,25}$/.test(steamId);
      if (!isSteamId) {
        sendJson(res, 400, {
          ok: false,
          error: 'invalid-steamid',
          data: { message: 'SteamID ต้องเป็นตัวเลข 15-25 หลัก' },
        });
        return true;
      }

      const userCurrentLink = await resolveSessionSteamLink(session.discordId, tenantOptions);
      if (userCurrentLink?.linked && normalizeText(userCurrentLink.steamId) !== steamId) {
        sendJson(res, 403, {
          ok: false,
          error: 'steam-link-locked',
          data: {
            message:
              'บัญชีนี้ผูก SteamID ไปแล้ว เปลี่ยนไม่ได้เอง ต้องติดต่อแอดมินเท่านั้น',
            steamId: userCurrentLink.steamId,
          },
        });
        return true;
      }

      if (userCurrentLink?.linked && normalizeText(userCurrentLink.steamId) === steamId) {
        sendJson(res, 200, {
          ok: true,
          data: {
            linked: true,
            steamId: userCurrentLink.steamId,
            inGameName: userCurrentLink.inGameName || null,
            locked: true,
          },
        });
        return true;
      }

      const existing = getLinkBySteamId(steamId, tenantOptions);
      if (existing && normalizeText(existing.userId) !== session.discordId) {
        sendJson(res, 409, {
          ok: false,
          error: 'steamid-already-bound',
          data: { message: 'SteamID นี้ถูกผูกกับบัญชีอื่นอยู่แล้ว' },
        });
        return true;
      }
      const result = setLink({
        steamId,
        userId: session.discordId,
        inGameName: null,
      }, tenantOptions);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'invalid-steamid',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          linked: true,
          steamId: result.steamId,
          inGameName: null,
          locked: true,
        },
      });
      return true;
    }

    if (pathname === '/player/api/linksteam/unset' && method === 'POST') {
      sendJson(res, 403, {
        ok: false,
        error: 'steam-link-locked',
        data: {
          message: 'ไม่สามารถยกเลิกการผูก SteamID ด้วยตัวเองได้ กรุณาติดต่อแอดมิน',
        },
      });
      return true;
    }

    if (pathname === '/player/api/daily/claim' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['wallet_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['wallet_module']);
      }
      const economy = getEconomyConfig();
      const check = await checkRewardClaimForUser({
        userId: session.discordId,
        type: 'daily',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!check?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: 'daily-cooldown',
          data: {
            remainingMs: normalizeAmount(check?.remainingMs, 0),
            remainingText: msToHoursMinutes(check?.remainingMs),
          },
        });
        return true;
      }
      const result = await claimRewardForUser({
        userId: session.discordId,
        type: 'daily',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        sendJson(res, 500, { ok: false, error: result.reason || 'daily-claim-failed' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          reward: economy.dailyReward,
          balance: normalizeAmount(result.balance, 0),
          currencySymbol: economy.currencySymbol,
          message: result.message,
        },
      });
      return true;
    }

    if (pathname === '/player/api/weekly/claim' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['wallet_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['wallet_module']);
      }
      const economy = getEconomyConfig();
      const check = await checkRewardClaimForUser({
        userId: session.discordId,
        type: 'weekly',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!check?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: 'weekly-cooldown',
          data: {
            remainingMs: normalizeAmount(check?.remainingMs, 0),
            remainingText: msToDaysHours(check?.remainingMs),
          },
        });
        return true;
      }
      const result = await claimRewardForUser({
        userId: session.discordId,
        type: 'weekly',
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        sendJson(res, 500, { ok: false, error: result.reason || 'weekly-claim-failed' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          reward: economy.weeklyReward,
          balance: normalizeAmount(result.balance, 0),
          currencySymbol: economy.currencySymbol,
          message: result.message,
        },
      });
      return true;
    }

    if (pathname === '/player/api/gift' && method === 'POST') {
      const featureAccess = await getFeatureAccess(session);
      if (!hasFeatureAccess(featureAccess, ['wallet_module'])) {
        return sendPlayerFeatureDenied(sendJson, res, featureAccess, ['wallet_module']);
      }
      const body = await readJsonBody(req);
      const targetDiscordId = normalizeText(body.targetDiscordId || body.userId);
      const amount = normalizeAmount(body.amount, 0);
      if (!isDiscordId(targetDiscordId) || amount <= 0) {
        sendJson(res, 400, { ok: false, error: 'invalid-input' });
        return true;
      }
      if (targetDiscordId === session.discordId) {
        sendJson(res, 400, { ok: false, error: 'cannot-gift-self' });
        return true;
      }

      const result = await transferCoins({
        fromUserId: session.discordId,
        toUserId: targetDiscordId,
        amount,
        actor: `portal:${session.user}`,
        source: 'player-portal-gift',
        outReason: 'gift_transfer_out',
        inReason: 'gift_transfer_in',
        meta: { via: 'web-portal-standalone' },
        tenantId: tenantOptions.tenantId || null,
      });
      if (!result.ok) {
        const status = result.reason === 'insufficient-balance' ? 400 : 500;
        sendJson(res, status, {
          ok: false,
          error: result.reason || 'gift-failed',
          data: result,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/player/api/dashboard' && method === 'GET') {
      const dashboard = await getPlayerDashboard(session.discordId, tenantOptions);
      if (!dashboard?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: dashboard?.reason || 'Cannot build player dashboard',
        });
        return true;
      }
      const [dailyCheck, weeklyCheck, link] = await Promise.all([
        canClaimDaily(session.discordId, tenantOptions),
        canClaimWeekly(session.discordId, tenantOptions),
        resolveSessionSteamLink(session.discordId, tenantOptions),
      ]);

      let rent = {
        linked: false,
        todayQuotaUsed: false,
        nextResetAt: getNextMidnightIsoInTimezone(getRentTimezone()),
        current: null,
      };
      if (link?.steamId) {
        await ensureRentBikeTables();
        const timezone = getRentTimezone();
        const dateKey = getDateKeyInTimezone(timezone);
        const [dailyRent, rentals] = await Promise.all([
          getDailyRent(link.steamId, dateKey, tenantOptions),
          listRentalVehicles(250, tenantOptions),
        ]);
        const history = rentals
          .filter((row) => normalizeText(row.userKey) === link.steamId)
          .sort((a, b) => {
            const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bt - at;
          });
        rent = {
          linked: true,
          todayQuotaUsed: Boolean(dailyRent?.used),
          nextResetAt: getNextMidnightIsoInTimezone(timezone),
          current: history.find((row) =>
            ['pending', 'delivering', 'delivered'].includes(
              normalizeText(row.status).toLowerCase(),
            ),
          ) || null,
        };
      }

      const serverInfo = config.serverInfo || {};
      const announcements = [
        normalizeText(serverInfo.description),
        ...(Array.isArray(config.raidTimes)
          ? config.raidTimes.map((row) => normalizeText(row)).filter(Boolean)
          : []),
      ].filter(Boolean);

      const latestPurchase = Array.isArray(dashboard.data?.recentPurchases)
        ? dashboard.data.recentPurchases[0] || null
        : null;

      sendJson(res, 200, {
        ok: true,
        data: {
          ...dashboard.data,
          steamLink: link,
          serverScope: {
            tenantId: tenantOptions.tenantId || null,
            activeServerId: playerServerState?.activeServerId || null,
            activeServerName: playerServerState?.activeServerName || null,
            effectiveServerId: playerServerState?.effectiveServerId || null,
            effectiveServerName: playerServerState?.effectiveServerName || null,
            selectionRequired: playerServerState?.selectionRequired === true,
          },
          latestOrder: latestPurchase,
          missionsSummary: {
            dailyClaimable: Boolean(dailyCheck?.ok),
            weeklyClaimable: Boolean(weeklyCheck?.ok),
            dailyRemainingMs: dailyCheck?.ok ? 0 : normalizeAmount(dailyCheck?.remainingMs, 0),
            weeklyRemainingMs: weeklyCheck?.ok
              ? 0
              : normalizeAmount(weeklyCheck?.remainingMs, 0),
          },
          rent,
          announcements,
        },
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createPlayerGeneralRoutes,
};
