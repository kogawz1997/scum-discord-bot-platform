/**
 * Admin entity mutation routes that operate on player, ticket, event,
 * redeem, VIP, moderation, and lightweight stats surfaces.
 */

const {
  requireTenantActionEntitlement,
} = require('./tenantRouteEntitlements');
const {
  requireTenantPermission,
} = require('./tenantRoutePermissions');

function createAdminEntityPostRoutes(deps) {
  const {
    sendJson,
    requiredString,
    asInt,
    resolveScopedTenantId,
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
  } = deps;

  return async function handleAdminEntityPostRoute(context) {
    const {
      client,
      req,
      pathname,
      body,
      res,
      auth,
    } = context;
    const requestedTenantId = requiredString(body, 'tenantId') || String(auth?.tenantId || '').trim() || undefined;
    const scopedTenantId = typeof resolveScopedTenantId === 'function'
      ? resolveScopedTenantId(req, res, auth, requestedTenantId, { required: false })
      : requestedTenantId;
    if (requestedTenantId && scopedTenantId === null) {
      return true;
    }

    async function requirePlayerManagement(message) {
      const permissionCheck = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_players',
        message: 'Your tenant role cannot run player management actions.',
      });
      if (!permissionCheck.allowed) return permissionCheck;
      if (!scopedTenantId) return { allowed: true };
      return requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId: scopedTenantId,
        actionKey: 'can_manage_players',
        message,
      });
    }

    async function requireEventManagement(message) {
      const permissionCheck = requireTenantPermission({
        sendJson,
        res,
        auth,
        permissionKey: 'manage_events',
        message: 'Your tenant role cannot run event management actions.',
      });
      if (!permissionCheck.allowed) return permissionCheck;
      if (!scopedTenantId) return { allowed: true };
      return requireTenantActionEntitlement({
        sendJson,
        res,
        getTenantFeatureAccess,
        buildTenantProductEntitlements,
        tenantId: scopedTenantId,
        actionKey: 'can_manage_events',
        message,
      });
    }

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
      const playerCheck = await requirePlayerManagement(
        'Player operations are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player operations are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const eventCheck = await requireEventManagement(
        'Event creation is locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
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
      const eventCheck = await requireEventManagement(
        'Event activation is locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
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

    if (pathname === '/admin/api/event/update') {
      const eventCheck = await requireEventManagement(
        'Event updates are locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
      const id = asInt(body.id);
      const name = requiredString(body, 'name');
      const time = requiredString(body, 'time');
      const reward = requiredString(body, 'reward');
      if (id == null || !name || !time || !reward) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await updateServerEvent({
        id,
        name,
        time,
        reward,
        tenantId: scopedTenantId,
      });
      if (!result.ok) {
        sendJson(res, result.reason === 'not-found' ? 404 : 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.event });
      return true;
    }

    if (pathname === '/admin/api/event/end') {
      const eventCheck = await requireEventManagement(
        'Event deactivation is locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
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

    if (pathname === '/admin/api/raid/request/review') {
      const eventCheck = await requireEventManagement(
        'Raid request reviews are locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
      const id = asInt(body.id);
      const status = requiredString(body, 'status').toLowerCase();
      if (id == null || !['approved', 'rejected', 'pending'].includes(status)) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = typeof reviewRaidRequest === 'function'
        ? await reviewRaidRequest({
          id,
          status,
          decisionNote: requiredString(body, 'decisionNote') || null,
          reviewedBy: auth?.user || 'admin-web',
          tenantId: scopedTenantId,
          serverId: requiredString(body, 'serverId') || null,
        })
        : { ok: false, reason: 'raid-review-unavailable' };
      if (!result.ok) {
        sendJson(res, result.reason === 'not-found' ? 404 : 400, {
          ok: false,
          error: result.reason || 'Invalid request payload',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.request });
      return true;
    }

    if (pathname === '/admin/api/raid/window/create') {
      const eventCheck = await requireEventManagement(
        'Raid windows are locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
      const title = requiredString(body, 'title');
      const startsAt = requiredString(body, 'startsAt');
      if (!title || !startsAt) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = typeof createRaidWindow === 'function'
        ? await createRaidWindow({
          requestId: asInt(body.requestId),
          title,
          startsAt,
          endsAt: requiredString(body, 'endsAt') || null,
          status: requiredString(body, 'status') || 'scheduled',
          notes: requiredString(body, 'notes') || null,
          actor: auth?.user || 'admin-web',
          tenantId: scopedTenantId,
          serverId: requiredString(body, 'serverId') || null,
        })
        : { ok: false, reason: 'raid-window-unavailable' };
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.window });
      return true;
    }

    if (pathname === '/admin/api/raid/summary/create') {
      const eventCheck = await requireEventManagement(
        'Raid summaries are locked until the current package includes event tools.',
      );
      if (!eventCheck.allowed) return true;
      const outcome = requiredString(body, 'outcome');
      if (!outcome) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = typeof createRaidSummary === 'function'
        ? await createRaidSummary({
          requestId: asInt(body.requestId),
          windowId: asInt(body.windowId),
          outcome,
          notes: requiredString(body, 'notes') || null,
          createdBy: auth?.user || 'admin-web',
          tenantId: scopedTenantId,
          serverId: requiredString(body, 'serverId') || null,
        })
        : { ok: false, reason: 'raid-summary-unavailable' };
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.reason || 'Invalid request payload' });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result.summary });
      return true;
    }

    if (pathname === '/admin/api/link/set') {
      const playerCheck = await requirePlayerManagement(
        'Linked account changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
      const steamId = requiredString(body, 'steamId');
      const userId = requiredString(body, 'userId');
      const inGameName = requiredString(body, 'inGameName');
      if (!steamId || !userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const result = await bindSteamLinkForUser({
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
      const playerCheck = await requirePlayerManagement(
        'Linked account changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player account changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Steam binding is locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Steam binding is locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'VIP changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'VIP changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Redeem code changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Redeem code changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Redeem code changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Moderation actions are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player welcome-pack actions are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player welcome-pack actions are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
      const result = clearWelcomePackClaimsForAdmin({ tenantId: scopedTenantId });
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/stats/add-kill') {
      const playerCheck = await requirePlayerManagement(
        'Player stat changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player stat changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
      const playerCheck = await requirePlayerManagement(
        'Player stat changes are locked until the current package includes player management.',
      );
      if (!playerCheck.allowed) return true;
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
