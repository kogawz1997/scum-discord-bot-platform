function createAdminDeliveryOpsGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    prisma,
    normalizePurchaseStatus,
    listKnownPurchaseStatuses,
    listAllowedPurchaseTransitions,
    listFilteredDeliveryQueue,
    listFilteredDeliveryDeadLetters,
    listDeliveryAudit,
    getDeliveryRuntimeStatus,
    listScumAdminCommandCapabilities,
    listAdminCommandCapabilityPresets,
    getDeliveryCommandOverride,
    getDeliveryDetailsByPurchaseCode,
    buildAdminDashboardCards,
    listPlayerAccounts,
    getPlayerDashboard,
  } = deps;

  return async function handleAdminDeliveryOpsGetRoute(context) {
    const {
      client,
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname === '/admin/api/delivery/queue') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: listFilteredDeliveryQueue({
          limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
          errorCode: String(urlObj.searchParams.get('errorCode') || '').trim(),
          q: String(urlObj.searchParams.get('q') || '').trim(),
          tenantId: tenantId || getAuthTenantId(auth) || undefined,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/dead-letter') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: listFilteredDeliveryDeadLetters({
          limit: asInt(urlObj.searchParams.get('limit'), 500) || 500,
          errorCode: String(urlObj.searchParams.get('errorCode') || '').trim(),
          q: String(urlObj.searchParams.get('q') || '').trim(),
          tenantId: tenantId || getAuthTenantId(auth) || undefined,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/audit') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: listDeliveryAudit(
          asInt(urlObj.searchParams.get('limit'), 200) || 200,
          { tenantId: tenantId || getAuthTenantId(auth) || undefined },
        ),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/runtime') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getDeliveryRuntimeStatus(),
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/capabilities') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      sendJson(res, 200, {
        ok: true,
        data: {
          builtin: listScumAdminCommandCapabilities(),
          presets: listAdminCommandCapabilityPresets(200),
        },
      });
      return true;
    }

    if (pathname === '/admin/api/delivery/command-template') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      try {
        sendJson(res, 200, {
          ok: true,
          data: getDeliveryCommandOverride({
            lookupKey: String(urlObj.searchParams.get('lookupKey') || '').trim() || undefined,
            itemId: String(urlObj.searchParams.get('itemId') || '').trim() || undefined,
            gameItemId: String(urlObj.searchParams.get('gameItemId') || '').trim() || undefined,
          }),
        });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'Cannot load command template'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/delivery/detail') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const purchaseCode = String(urlObj.searchParams.get('code') || '').trim();
      if (!purchaseCode) {
        sendJson(res, 400, { ok: false, error: 'code is required' });
        return true;
      }
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        String(urlObj.searchParams.get('tenantId') || '').trim(),
      );
      if (tenantId === null && getAuthTenantId(auth)) return true;
      try {
        const data = await getDeliveryDetailsByPurchaseCode(
          purchaseCode,
          asInt(urlObj.searchParams.get('limit'), 50) || 50,
          { tenantId },
        );
        const hasData = Boolean(
          data?.purchase
            || data?.queueJob
            || data?.deadLetter
            || (Array.isArray(data?.auditRows) && data.auditRows.length > 0),
        );
        if (!hasData) {
          sendJson(res, 404, { ok: false, error: 'Resource not found' });
          return true;
        }
        sendJson(res, 200, { ok: true, data });
      } catch (error) {
        sendJson(res, 400, {
          ok: false,
          error: String(error?.message || 'Cannot load delivery details'),
        });
      }
      return true;
    }

    if (pathname === '/admin/api/purchase/statuses') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const current = normalizePurchaseStatus(
        String(urlObj.searchParams.get('current') || ''),
      );
      sendJson(res, 200, {
        ok: true,
        data: {
          knownStatuses: listKnownPurchaseStatuses(),
          currentStatus: current || null,
          allowedTransitions: current
            ? listAllowedPurchaseTransitions(current)
            : [],
        },
      });
      return true;
    }

    if (pathname === '/admin/api/dashboard/cards') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const refreshRaw = String(urlObj.searchParams.get('refresh') || '').trim().toLowerCase();
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await buildAdminDashboardCards({
          prisma,
          client,
          tenantId,
          forceRefresh: refreshRaw === '1' || refreshRaw === 'true',
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/player/accounts') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlayerAccounts(
          asInt(urlObj.searchParams.get('limit'), 200) || 200,
          tenantId ? { tenantId } : {},
        ),
      });
      return true;
    }

    if (pathname === '/admin/api/player/dashboard') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const userId = requiredString(urlObj.searchParams.get('userId'));
      if (!userId) {
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      const dashboard = await getPlayerDashboard(userId, tenantId ? { tenantId } : {});
      if (!dashboard.ok) {
        sendJson(res, 400, {
          ok: false,
          error: dashboard.reason || 'Cannot build player dashboard',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, data: dashboard.data });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminDeliveryOpsGetRouteHandler,
};
