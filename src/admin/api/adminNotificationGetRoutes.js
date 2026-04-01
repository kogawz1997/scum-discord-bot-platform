function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildAdminNotificationsCsv(rows = []) {
  const headers = [
    'id',
    'type',
    'source',
    'kind',
    'severity',
    'title',
    'message',
    'entityKey',
    'createdAt',
    'acknowledgedAt',
    'acknowledgedBy',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => escapeCsvCell(row?.[key] ?? '')).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

function parseAcknowledgedFlag(urlObj) {
  const acknowledgedRaw = String(urlObj.searchParams.get('acknowledged') || '').trim().toLowerCase();
  return acknowledgedRaw === 'true'
    ? true
    : acknowledgedRaw === 'false'
      ? false
      : null;
}

function createAdminNotificationGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    sendDownload,
    asInt,
    jsonReplacer,
    listAdminNotifications,
  } = deps;

  return async function handleAdminNotificationGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/notifications') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const acknowledged = parseAcknowledgedFlag(urlObj);
      sendJson(res, 200, {
        ok: true,
        data: {
          items: listAdminNotifications({
            limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
            type: String(urlObj.searchParams.get('type') || '').trim(),
            kind: String(urlObj.searchParams.get('kind') || '').trim(),
            severity: String(urlObj.searchParams.get('severity') || '').trim(),
            entityKey: String(urlObj.searchParams.get('entityKey') || '').trim(),
            acknowledged,
          }),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/notifications/export') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const acknowledged = parseAcknowledgedFlag(urlObj);
      const rows = listAdminNotifications({
        limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
        type: String(urlObj.searchParams.get('type') || '').trim(),
        kind: String(urlObj.searchParams.get('kind') || '').trim(),
        severity: String(urlObj.searchParams.get('severity') || '').trim(),
        entityKey: String(urlObj.searchParams.get('entityKey') || '').trim(),
        acknowledged,
      });
      const format = String(urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'csv') {
        sendDownload(
          res,
          200,
          buildAdminNotificationsCsv(rows),
          {
            filename: `admin-notifications-${timestamp}.csv`,
            contentType: 'text/csv; charset=utf-8',
          },
        );
        return true;
      }
      sendDownload(
        res,
        200,
        `${JSON.stringify({ ok: true, data: { items: rows } }, jsonReplacer, 2)}\n`,
        {
          filename: `admin-notifications-${timestamp}.json`,
          contentType: 'application/json; charset=utf-8',
        },
      );
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminNotificationGetRouteHandler,
};
