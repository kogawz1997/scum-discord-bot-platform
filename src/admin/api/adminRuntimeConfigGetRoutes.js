function createAdminRuntimeConfigGetRouteHandler(deps) {
  const {
    ensureRole,
    sendJson,
    requiredString,
    resolveScopedTenantId,
    getAuthTenantId,
    asInt,
    listServerConfigJobs,
    listServerConfigBackups,
    getServerConfigCategory,
    getServerConfigWorkspace,
    listRestartPlans,
    listRestartExecutions,
    getPlatformTenantConfig,
    listPlatformTenantConfigs,
  } = deps;

  return async function handleAdminRuntimeConfigGetRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
    } = context;

    const serverConfigJobsMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/jobs$/);
    if (serverConfigJobsMatch) {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: true,
      });
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listServerConfigJobs({
          tenantId,
          serverId: serverConfigJobsMatch[1],
          jobId: requiredString(urlObj.searchParams.get('jobId')),
          status: requiredString(urlObj.searchParams.get('status')),
          queueStatus: requiredString(urlObj.searchParams.get('queueStatus')),
          jobType: requiredString(urlObj.searchParams.get('jobType')),
          limit: asInt(urlObj.searchParams.get('limit'), 20) || 20,
        }),
      });
      return true;
    }

    const serverConfigBackupsMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/backups$/);
    if (serverConfigBackupsMatch) {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: true,
      });
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listServerConfigBackups({
          tenantId,
          serverId: serverConfigBackupsMatch[1],
          limit: asInt(urlObj.searchParams.get('limit'), 30) || 30,
        }),
      });
      return true;
    }

    const serverConfigCategoryMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config\/([^/]+)$/);
    if (serverConfigCategoryMatch) {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: true,
      });
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getServerConfigCategory({
          tenantId,
          serverId: serverConfigCategoryMatch[1],
          category: serverConfigCategoryMatch[2],
          limit: asInt(urlObj.searchParams.get('limit'), 20) || 20,
        }),
      });
      return true;
    }

    const serverConfigWorkspaceMatch = pathname.match(/^\/admin\/api\/platform\/servers\/([^/]+)\/config$/);
    if (serverConfigWorkspaceMatch) {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: true,
      });
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getServerConfigWorkspace({
          tenantId,
          serverId: serverConfigWorkspaceMatch[1],
          limit: asInt(urlObj.searchParams.get('limit'), 20) || 20,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/restart-plans') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: false },
      );
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listRestartPlans({
          tenantId,
          allowGlobal: !tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          status: requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('limit'), 20) || 20,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/restart-executions') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: false },
      );
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listRestartExecutions({
          tenantId,
          allowGlobal: !tenantId,
          serverId: requiredString(urlObj.searchParams.get('serverId')),
          planId: requiredString(urlObj.searchParams.get('planId')),
          status: requiredString(urlObj.searchParams.get('status')),
          limit: asInt(urlObj.searchParams.get('limit'), 20) || 20,
        }),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-config') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(
        req,
        res,
        auth,
        requestedTenantId || getAuthTenantId(auth),
        { required: true },
      );
      if (!tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformTenantConfig(tenantId),
      });
      return true;
    }

    if (pathname === '/admin/api/platform/tenant-configs') {
      const auth = ensureRole(req, urlObj, 'mod', res);
      if (!auth) return true;
      const requestedTenantId = requiredString(urlObj.searchParams.get('tenantId'));
      const tenantId = resolveScopedTenantId(req, res, auth, requestedTenantId || getAuthTenantId(auth), {
        required: false,
      });
      if (requestedTenantId && !tenantId) return true;
      sendJson(res, 200, {
        ok: true,
        data: await listPlatformTenantConfigs({
          tenantId,
          allowGlobal: !tenantId,
          limit: asInt(urlObj.searchParams.get('limit'), 100) || 100,
        }),
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createAdminRuntimeConfigGetRouteHandler,
};
