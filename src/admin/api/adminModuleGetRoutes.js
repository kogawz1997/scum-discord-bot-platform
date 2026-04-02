'use strict';

function createAdminModuleGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    resolveScopedTenantId,
    getAuthTenantId,
    requiredString,
    asInt,
    buildTenantModuleOverview,
  } = deps;

  return async function handleAdminModuleGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    if (pathname !== '/admin/api/modules/overview') {
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
      const data = await buildTenantModuleOverview({
        tenantId: effectiveTenantId,
        limit: asInt(urlObj.searchParams.get('limit'), 6) || 6,
      });
      sendJson(res, 200, {
        ok: true,
        data,
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: String(error?.message || 'Cannot build module overview'),
      });
    }

    return true;
  };
}

module.exports = {
  createAdminModuleGetRouteHandler,
};
