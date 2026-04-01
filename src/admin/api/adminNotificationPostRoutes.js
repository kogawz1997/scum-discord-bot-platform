function createAdminNotificationPostRouteHandler(deps) {
  const {
    sendJson,
    parseStringArray,
    getAuthTenantId,
    acknowledgeAdminNotifications,
    clearAdminNotifications,
  } = deps;

  return async function handleAdminNotificationPostRoute(context) {
    const {
      pathname,
      body,
      res,
      auth,
    } = context;

    if (pathname === '/admin/api/notifications/ack') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot acknowledge shared owner notifications' });
        return true;
      }
      const ids = parseStringArray(body?.ids);
      if (ids.length === 0) {
        sendJson(res, 400, { ok: false, error: 'ids is required' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: acknowledgeAdminNotifications(ids, auth?.user || 'unknown'),
      });
      return true;
    }

    if (pathname === '/admin/api/notifications/clear') {
      if (getAuthTenantId(auth)) {
        sendJson(res, 403, { ok: false, error: 'Tenant-scoped admin cannot clear shared owner notifications' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: clearAdminNotifications({
          acknowledgedOnly: body?.acknowledgedOnly === true,
        }),
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminNotificationPostRouteHandler,
};
