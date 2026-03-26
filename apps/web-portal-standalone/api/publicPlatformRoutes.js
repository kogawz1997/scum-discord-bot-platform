'use strict';

/**
 * Public product-site routes for preview signup/login. These live outside the
 * player/admin auth flows so users can inspect the SaaS before purchase.
 */

function createPublicPlatformRoutes(deps = {}) {
  const {
    sendJson,
    readJsonBody,
    getPlatformPublicOverview,
    registerPreviewAccount,
    authenticatePreviewAccount,
    getPreviewState,
    requestPasswordReset,
    createPreviewSession,
    getPreviewSession,
    buildPreviewSessionCookie,
    buildClearPreviewSessionCookie,
    removePreviewSession,
  } = deps;

  return async function handlePublicApiRoute(context) {
    const {
      req,
      res,
      pathname,
      method,
    } = context;

    if (pathname === '/api/public/packages' && method === 'GET') {
      const overview = await getPlatformPublicOverview();
      sendJson(res, 200, {
        ok: true,
        data: {
          packages: overview?.billing?.packages || [],
          features: overview?.billing?.features || [],
          plans: overview?.billing?.plans || [],
        },
      });
      return true;
    }

    if (pathname === '/api/public/session' && method === 'GET') {
      const session = getPreviewSession(req);
      if (!session?.accountId) {
        sendJson(res, 200, {
          ok: true,
          data: { session: null },
        });
        return true;
      }
      const state = await getPreviewState(session.accountId);
      if (!state?.ok) {
        sendJson(res, 200, {
          ok: true,
          data: { session: null },
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          session: {
            accountId: session.accountId,
            tenantId: session.tenantId || null,
          },
          preview: state.state,
          packageCatalog: state.packageCatalog || [],
        },
      });
      return true;
    }

    if (pathname === '/api/public/signup' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await registerPreviewAccount(body);
      if (!result?.ok) {
        const status = result?.reason === 'email-exists'
          ? 409
          : ['invalid-email', 'weak-password', 'community-required'].includes(result?.reason)
            ? 400
            : 500;
        sendJson(res, status, {
          ok: false,
          error: result?.reason || 'signup-failed',
        });
        return true;
      }
      const sessionId = createPreviewSession({
        accountId: result.account.id,
        tenantId: result.account.tenantId || result.tenant?.id || null,
        email: result.account.email,
      });
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            account: result.account,
            tenant: result.tenant,
            subscription: result.subscription,
            nextUrl: '/preview',
          },
        },
        { 'Set-Cookie': buildPreviewSessionCookie(sessionId, req) },
      );
      return true;
    }

    if (pathname === '/api/public/login' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await authenticatePreviewAccount(body);
      if (!result?.ok) {
        sendJson(res, 401, {
          ok: false,
          error: result?.reason || 'invalid-credentials',
        });
        return true;
      }
      const sessionId = createPreviewSession({
        accountId: result.account.id,
        tenantId: result.account.tenantId || null,
        email: result.account.email,
      });
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            account: result.account,
            nextUrl: '/preview',
          },
        },
        { 'Set-Cookie': buildPreviewSessionCookie(sessionId, req) },
      );
      return true;
    }

    if (pathname === '/api/public/logout' && method === 'POST') {
      removePreviewSession(req);
      sendJson(
        res,
        200,
        { ok: true, data: { loggedOut: true } },
        { 'Set-Cookie': buildClearPreviewSessionCookie(req) },
      );
      return true;
    }

    if (pathname === '/api/public/password-reset-request' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await requestPasswordReset(body);
      if (!result?.ok) {
        sendJson(res, 400, {
          ok: false,
          error: result?.reason || 'invalid-request',
        });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        data: {
          queued: true,
        },
      });
      return true;
    }

    return false;
  };
}

module.exports = {
  createPublicPlatformRoutes,
};
