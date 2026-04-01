'use strict';

function createAdminDonationGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    buildTenantDonationOverview,
  } = deps;

  return async function handleAdminDonationGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname !== '/admin/api/donations/overview') {
      return false;
    }

    const auth = ensureRole(req, urlObj, 'mod', res);
    if (!auth) return true;

    const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
    const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId, {
      required: false,
    });
    if (requestedTenantId && !tenantId) return true;

    const effectiveTenantId = tenantId || getAuthTenantId(auth);
    if (!effectiveTenantId) {
      sendJson(res, 400, {
        ok: false,
        error: 'tenantId is required',
      });
      return true;
    }

    try {
      const data = await buildTenantDonationOverview({
        tenantId: effectiveTenantId,
        windowDays: asInt(urlObj.searchParams.get('days'), 30) || 30,
        limit: asInt(urlObj.searchParams.get('limit'), 8) || 8,
      });
      sendJson(res, 200, {
        ok: true,
        data,
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: String(error?.message || 'Cannot build donation overview'),
      });
    }
    return true;
  };
}

module.exports = {
  createAdminDonationGetRouteHandler,
};
