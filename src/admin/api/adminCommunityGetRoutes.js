function createAdminCommunityGetRouteHandler(deps) {
  const {
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
  } = deps;

  return async function handleAdminCommunityGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/event/list') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')) || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const limit = asInt(urlObj.searchParams.get('limit'), 50) || 50;
      const listedEvents = typeof listServerEvents === 'function'
        ? listServerEvents({ tenantId })
        : [];
      const rows = Array.isArray(listedEvents)
        ? listedEvents.slice(0, limit)
        : [];
      sendJson(res, 200, {
        ok: true,
        data: rows.map((event) => ({
          ...event,
          participants: typeof getParticipants === 'function'
            ? getParticipants(event?.id, { tenantId })
            : [],
        })),
      });
      return true;
    }

    if (pathname === '/admin/api/raid/list') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')) || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const limit = asInt(urlObj.searchParams.get('limit'), 20) || 20;
      const serverId = requiredString(urlObj.searchParams.get('serverId')) || null;
      const data = typeof listRaidActivitySnapshot === 'function'
        ? await listRaidActivitySnapshot({ tenantId, serverId, limit })
        : { requests: [], windows: [], summaries: [] };
      sendJson(res, 200, {
        ok: true,
        data,
      });
      return true;
    }

    if (pathname === '/admin/api/killfeed/list') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requiredString(urlObj.searchParams.get('tenantId')) || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      const limit = asInt(urlObj.searchParams.get('limit'), 20) || 20;
      const serverId = requiredString(urlObj.searchParams.get('serverId')) || null;
      const items = typeof listKillFeedEntries === 'function'
        ? await listKillFeedEntries({ tenantId, serverId, limit })
        : [];
      sendJson(res, 200, {
        ok: true,
        data: {
          tenantId,
          serverId,
          items: Array.isArray(items) ? items : [],
        },
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminCommunityGetRouteHandler,
};
