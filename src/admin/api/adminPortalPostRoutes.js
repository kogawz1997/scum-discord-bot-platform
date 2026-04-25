/**
 * Admin portal-token mutation routes used by the player portal bridge.
 */

function createAdminPortalPostRoutes(deps) {
  const {
    sendJson,
    ensurePortalTokenAuth,
    readJsonBody,
    requiredString,
    getAuthTenantId,
    redeemCodeForUser,
    requestRentBikeForUser,
    createBountyForUser,
  } = deps;

  return async function handleAdminPortalPostRoute(context) {
    const { req, res, urlObj, pathname, body: providedBody } = context;

    if (pathname === '/admin/api/portal/redeem') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const body = providedBody ?? (await readJsonBody(req));
      const code = requiredString(body, 'code');
      if (!code) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }

      const tenantId =
        getAuthTenantId?.(portal.auth) || requiredString(body, 'tenantId') || undefined;
      const result = await redeemCodeForUser({
        userId: portal.discordId,
        code,
        actor: `portal:${portal.forwardedUser}`,
        source: 'player-portal',
        tenantId,
      });
      if (!result.ok) {
        const status =
          result.reason === 'code-not-found' || result.reason === 'code-already-used' ? 400 : 500;
        sendJson(res, status, {
          ok: false,
          error: result.reason,
          data: result,
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          ...result,
          message:
            result.type === 'coins'
              ? `ใช้โค้ดสำเร็จ ได้รับ ${result.amount} เหรียญ`
              : 'ใช้โค้ดสำเร็จ',
        },
      });
      return true;
    }

    if (pathname === '/admin/api/portal/rentbike/request') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const body = providedBody ?? (await readJsonBody(req).catch(() => ({})));
      const tenantId =
        getAuthTenantId?.(portal.auth) || requiredString(body, 'tenantId') || undefined;
      const result = await requestRentBikeForUser({
        discordUserId: portal.discordId,
        guildId: requiredString(body, 'guildId') || null,
        tenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result.reason || 'rentbike-failed',
          data: result,
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    if (pathname === '/admin/api/portal/bounty/add') {
      const portal = ensurePortalTokenAuth(req, urlObj, res);
      if (!portal) return true;
      const body = providedBody ?? (await readJsonBody(req));
      const targetName = requiredString(body, 'targetName');
      const amount = Number(body?.amount);
      const tenantId =
        getAuthTenantId?.(portal.auth) || requiredString(body, 'tenantId') || undefined;
      const result = await createBountyForUser({
        createdBy: portal.discordId,
        targetName,
        amount,
        tenantId,
      });
      if (!result.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result.reason || 'bounty-create-failed',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: result });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminPortalPostRoutes,
};
