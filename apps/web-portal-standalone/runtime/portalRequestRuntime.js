'use strict';

/**
 * Request/runtime assembly for the standalone player portal.
 * Keep HTTP dispatch and cleanup timers out of the main entry file.
 */

function createPortalRequestRuntime(deps) {
  const {
    sendJson,
    verifyOrigin,
    getSession,
    isDiscordId,
    handlePublicApiRoute,
    handlePortalPageRoute,
    handlePlayerGeneralRoute,
    handlePlayerCommerceRoute,
    cleanupRuntimeState,
    cleanupIntervalMs,
  } = deps;

  function isPublicPlayerAuthPath(pathname) {
    return pathname === '/player/api/auth/email/request'
      || pathname === '/player/api/auth/email/complete';
  }

  async function handlePlayerApi(req, res, urlObj) {
    const pathname = urlObj.pathname;
    const method = String(req.method || 'GET').toUpperCase();

    if (!verifyOrigin(req)) {
      sendJson(res, 403, {
        ok: false,
        error: 'Cross-site request denied',
      });
      return;
    }

    if (isPublicPlayerAuthPath(pathname)) {
      if (
        await handlePlayerGeneralRoute({
          req,
          res,
          urlObj,
          pathname,
          method,
          session: null,
        })
      ) {
        return;
      }

      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    const session = getSession(req);
    if (!session || !isDiscordId(session.discordId)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }

    if (
      await handlePlayerGeneralRoute({
        req,
        res,
        urlObj,
        pathname,
        method,
        session,
      })
    ) {
      return;
    }

    if (
      await handlePlayerCommerceRoute({
        req,
        res,
        urlObj,
        pathname,
        method,
        session,
      })
    ) {
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  async function requestHandler(req, res) {
    const urlObj = new URL(req.url || '/', 'http://player.local');
    const pathname = urlObj.pathname;
    const method = String(req.method || 'GET').toUpperCase();

    if (
      await handlePortalPageRoute({
        req,
        res,
        urlObj,
        pathname,
        method,
      })
    ) {
      return;
    }

    if (pathname.startsWith('/player/api/')) {
      try {
        await handlePlayerApi(req, res, urlObj);
      } catch (error) {
        if (res.headersSent || res.writableEnded) {
          console.error(
            '[web-portal-standalone] player api error after response:',
            error?.message || error,
          );
          return;
        }
        const status = Number(error?.statusCode || 500);
        sendJson(res, status, {
          ok: false,
          error:
            status === 413
              ? 'Payload too large'
              : status >= 500
                ? 'Internal server error'
                : String(error?.message || 'Request failed'),
        });
      }
      return;
    }

    if (pathname.startsWith('/api/public/')) {
      try {
        if (
          method !== 'GET'
          && method !== 'HEAD'
          && method !== 'OPTIONS'
          && !verifyOrigin(req)
        ) {
          sendJson(res, 403, {
            ok: false,
            error: 'Cross-site request denied',
          });
          return;
        }
        if (
          typeof handlePublicApiRoute === 'function'
          && await handlePublicApiRoute({
            req,
            res,
            urlObj,
            pathname,
            method,
          })
        ) {
          return;
        }
      } catch (error) {
        if (res.headersSent || res.writableEnded) {
          console.error(
            '[web-portal-standalone] public api error after response:',
            error?.message || error,
          );
          return;
        }
        const status = Number(error?.statusCode || 500);
        sendJson(res, status, {
          ok: false,
          error:
            status === 413
              ? 'Payload too large'
              : status >= 500
                ? 'Internal server error'
                : String(error?.message || 'Request failed'),
        });
        return;
      }
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  function startCleanupTimer() {
    const timer = setInterval(() => {
      cleanupRuntimeState();
    }, cleanupIntervalMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    return timer;
  }

  return {
    handlePlayerApi,
    requestHandler,
    startCleanupTimer,
  };
}

module.exports = {
  createPortalRequestRuntime,
};
