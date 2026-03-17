/**
 * Admin entity mutation routes that operate on player, ticket, event,
 * redeem, VIP, moderation, and lightweight stats surfaces.
 */

function createAdminEntityPostRoutes(deps) {
  const {
    sendJson,
    requiredString,
    asInt,
    claimSupportTicket,
    closeSupportTicket,
    tryNotifyTicket,
    createBountyForUser,
    cancelBountyForUser,
    createServerEvent,
    startServerEvent,
    finishServerEvent,
    joinServerEvent,
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
  } = deps;

  return async function handleAdminEntityPostRoute(context) {
    const {
      client,
      pathname,
      body,
      res,
      auth,
    } = context;
    const scopedTenantId = String(auth?.tenantId || '').trim() || undefined;

    if (pathname === '/admin/api/ticket/claim') {
      const channelId = requiredString(body, 'channelId');
      const staffId = requiredString(body, 'staffId') || auth?.user || 'admin-web';
      if (!channelId || !staffId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = claimSupportTicket({ channelId, staffId, tenantId: scopedTenantId });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      await tryNotifyTicket(client, result.ticket, 'claim', staffId);
      sendJson(res, 200, { ok: true, data: result.ticket });
      return true;
    }

    if (pathname === '/admin/api/ticket/close') {
      const channelId = requiredString(body, 'channelId');
      if (!channelId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = closeSupportTicket({ channelId, tenantId: scopedTenantId });
      if (!result.ok && result.reason === 'not-found') {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      await tryNotifyTicket(client, result.ticket, 'close');
      sendJson(res, 200, { ok: true, data: result.ticket });
      return true;
    }

    if (pathname === '/admin/api/bounty/create') {
      const targetName = requiredString(body, 'targetName');
      const amount = asInt(body.amount);
      const createdBy = requiredString(body, 'createdBy') || auth?.user || 'admin-web';
      if (!targetName || amount == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await createBountyForUser({
        targetName,
        amount,
        createdBy,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: `ไม่สามารถสร้างค่าหัวได้ (${result.reason})` });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.bounty });
      return true;
    }

    if (pathname === '/admin/api/bounty/cancel') {
      const id = asInt(body.id);
      if (id == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = cancelBountyForUser({
        id,
        requesterId: auth?.user || 'admin-web',
        isStaff: true,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: `ไม่สามารถยกเลิกค่าหัวได้ (${result.reason})` });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.bounty });
      return true;
    }

    if (pathname === '/admin/api/event/create') {
      const name = requiredString(body, 'name');
      const time = requiredString(body, 'time');
      const reward = requiredString(body, 'reward');
      if (!name || !time || !reward) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await createServerEvent({
        name,
        time,
        reward,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.event });
      return true;
    }

    if (pathname === '/admin/api/event/start') {
      const id = asInt(body.id);
      if (id == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await startServerEvent({ id, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.event });
      return true;
    }

    if (pathname === '/admin/api/event/end') {
      const id = asInt(body.id);
      if (id == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await finishServerEvent({
        id,
        winnerUserId: requiredString(body, 'winnerUserId') || null,
        coins: asInt(body.coins) || 0,
        actor: 'admin-web',
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          ...result.event,
          participantsCount: result.participants.length,
          rewardGranted: result.rewardGranted,
          rewardError: result.rewardError || null,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/event/join') {
      const id = asInt(body.id);
      const userId = requiredString(body, 'userId');
      if (id == null || !userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await joinServerEvent({ id, userId, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          event: result.event,
          participantsCount: result.participantsCount,
        },
      });
      return true;
    }

    if (pathname === '/admin/api/link/set') {
      const steamId = requiredString(body, 'steamId');
      const userId = requiredString(body, 'userId');
      const inGameName = requiredString(body, 'inGameName');
      if (!steamId || !userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = bindSteamLinkForUser({
        steamId,
        userId,
        inGameName: inGameName || null,
        allowReplace: true,
        allowSteamReuse: true,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: `ไม่สามารถบันทึกลิงก์ได้ (${result.reason})` });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/link/remove') {
      const steamId = requiredString(body, 'steamId');
      const userId = requiredString(body, 'userId');
      if (!steamId && !userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = removeSteamLink({ steamId, userId, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.removed });
      return true;
    }

    if (pathname === '/admin/api/player/account/upsert') {
      const userId = requiredString(body, 'userId');
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await upsertPlayerAccount({
        discordId: userId,
        username: requiredString(body, 'username'),
        displayName: requiredString(body, 'displayName'),
        avatarUrl: requiredString(body, 'avatarUrl'),
        steamId: requiredString(body, 'steamId'),
        isActive: body?.isActive !== false,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.data });
      return true;
    }

    if (pathname === '/admin/api/player/steam/bind') {
      const userId = requiredString(body, 'userId');
      const steamId = requiredString(body, 'steamId');
      if (!userId || !steamId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await bindPlayerSteamId(userId, steamId, { tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.data });
      return true;
    }

    if (pathname === '/admin/api/player/steam/unbind') {
      const userId = requiredString(body, 'userId');
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await unbindPlayerSteamId(userId, { tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.data });
      return true;
    }

    if (pathname === '/admin/api/vip/set') {
      const userId = requiredString(body, 'userId');
      const planId = requiredString(body, 'planId');
      const durationDays = asInt(body.durationDays);
      if (!userId || !planId || durationDays == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await grantVipForUser({
        userId,
        planId,
        durationDays,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: { userId, planId: result.plan.id, expiresAt: result.expiresAt },
      });
      return true;
    }

    if (pathname === '/admin/api/vip/remove') {
      const userId = requiredString(body, 'userId');
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await revokeVipForUser({ userId, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: result.reason || 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { userId } });
      return true;
    }

    if (pathname === '/admin/api/redeem/add') {
      const code = requiredString(body, 'code');
      const type = requiredString(body, 'type');
      if (!code || !type) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const amount = body.amount == null || body.amount === '' ? null : asInt(body.amount, null);
      const itemId = requiredString(body, 'itemId');
      const result = createRedeemCodeForAdmin({ code, type, amount, itemId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: `ไม่สามารถบันทึกโค้ดได้ (${result.reason})` });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/redeem/delete') {
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = deleteRedeemCodeForAdmin({ code });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { code: result.code } });
      return true;
    }

    if (pathname === '/admin/api/redeem/reset-usage') {
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = resetRedeemCodeUsageForAdmin({ code });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.data });
      return true;
    }

    if (pathname === '/admin/api/moderation/add') {
      const userId = requiredString(body, 'userId');
      const type = requiredString(body, 'type');
      const reason = requiredString(body, 'reason');
      const staffId = requiredString(body, 'staffId') || auth?.user || 'admin-web';
      const durationMinutes = body.durationMinutes == null || body.durationMinutes === ''
        ? null
        : asInt(body.durationMinutes);
      if (!userId || !type || !reason) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = createPunishmentEntry({
        userId,
        type,
        reason,
        staffId,
        durationMinutes,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.entry });
      return true;
    }

    if (pathname === '/admin/api/welcome/revoke') {
      const userId = requiredString(body, 'userId');
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = revokeWelcomePackClaimForAdmin({ userId, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: { userId: result.userId } });
      return true;
    }

    if (pathname === '/admin/api/welcome/clear') {
      const result = clearWelcomePackClaimsForAdmin({ tenantId: scopedTenantId });
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/stats/add-kill') {
      const userId = requiredString(body, 'userId');
      const amount = asInt(body.amount);
      if (!userId || amount == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = addKillsForUser({ userId, amount, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-add-kill', { tenantId: scopedTenantId });
      sendJson(res, 200, { ok: true, data: result.stat });
      return true;
    }

    if (pathname === '/admin/api/stats/add-death') {
      const userId = requiredString(body, 'userId');
      const amount = asInt(body.amount);
      if (!userId || amount == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = addDeathsForUser({ userId, amount, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-add-death', { tenantId: scopedTenantId });
      sendJson(res, 200, { ok: true, data: result.stat });
      return true;
    }

    if (pathname === '/admin/api/stats/add-playtime') {
      const userId = requiredString(body, 'userId');
      const minutes = asInt(body.minutes);
      if (!userId || minutes == null) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = addPlaytimeForUser({ userId, minutes, tenantId: scopedTenantId });
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Request failed' });
        return true;
      }
      queueLeaderboardRefreshForAllGuilds(client, 'admin-add-playtime', { tenantId: scopedTenantId });
      sendJson(res, 200, { ok: true, data: result.stat });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminEntityPostRoutes,
};
