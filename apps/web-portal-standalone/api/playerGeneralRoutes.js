/**
 * Remaining standalone portal routes outside the commerce/cart surface.
 */

function createPlayerGeneralRoutes(deps) {
  const {
    sendJson,
    readJsonBody,
    buildClearSessionCookie,
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
  } = deps;

  return async function handlePlayerGeneralRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
      session,
    } = context;
    const tenantOptions = {
      tenantId: session?.tenantId || undefined,
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
          avatarUrl: normalizeText(session.avatarUrl)
            || normalizeText(account?.avatarUrl)
            || null,
          accountStatus: account?.isActive === false ? 'inactive' : 'active',
          steamLinked: Boolean(link?.linked),
        },
      });
      return true;
    }

    if (pathname === '/player/api/logout' && method === 'POST') {
      removeSession(req);
      sendJson(
        res,
        200,
        { ok: true, data: { loggedOut: true } },
        { 'Set-Cookie': buildClearSessionCookie() },
      );
      return true;
    }

    if (pathname === '/player/api/server/info' && method === 'GET') {
      const serverInfo = config.serverInfo || {};
      const raidTimes = Array.isArray(config.raidTimes) ? config.raidTimes : [];
      const status = getStatus();
      const economy = getEconomyConfig();
      const luckyWheel = getLuckyWheelConfig();
      const mapPortal = getMapPortalConfig();
      const rulesShort = Array.isArray(serverInfo.rulesShort)
        ? serverInfo.rulesShort.map((line) => normalizeText(line)).filter(Boolean)
        : [];
      sendJson(res, 200, {
        ok: true,
        data: {
          economy,
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
          tips: luckyWheel.tips,
          luckyWheel: {
            enabled: luckyWheel.enabled,
            cooldownMs: luckyWheel.cooldownMs,
            rewards: luckyWheel.rewards.map((row) => ({
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
          mapPortal,
          status,
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
          accountStatus: account?.isActive === false ? 'inactive' : 'active',
          createdAt: account?.createdAt || null,
          updatedAt: account?.updatedAt || null,
          steamLink: link,
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
      const limit = asInt(urlObj.searchParams.get('limit'), 50, 1, 500);
      const wallet = await getWallet(session.discordId, {
        tenantId: session?.tenantId || undefined,
      });
      const rows = await listWalletLedger(session.discordId, limit, {
        tenantId: session?.tenantId || undefined,
      });
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
      const wheelConfig = getLuckyWheelConfig();
      const limit = asInt(urlObj.searchParams.get('limit'), 20, 1, 80);
      sendJson(res, 200, {
        ok: true,
        data: await buildWheelStatePayload(session.discordId, wheelConfig, limit, tenantOptions),
      });
      return true;
    }

    if (pathname === '/player/api/wheel/spin' && method === 'POST') {
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
        listWalletLedger(session.discordId, limit, {
          tenantId: tenantOptions.tenantId,
        }),
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
      const dashboard = await getPlayerDashboard(session.discordId, {
        tenantId: session?.tenantId || undefined,
      });
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
