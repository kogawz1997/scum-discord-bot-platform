'use strict';

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function createPortalPageRoutes(deps) {
  const {
    allowCaptureAuth,
    captureAuthToken,
    createCaptureSession,
    buildSessionCookie,
    tryServePortalStaticAsset,
    tryServeStaticScumIcon,
    buildAdminProductUrl,
    buildLegacyAdminUrl,
    getCanonicalRedirectUrl,
    readJsonBody,
    sendJson,
    sendHtml,
    sendFavicon,
    buildHealthPayload,
    tryServePublicDoc,
    getLandingHtml,
    getDashboardHtml,
    getPricingHtml,
    getSignupHtml,
    getForgotPasswordHtml,
    getVerifyEmailHtml,
    getCheckoutHtml,
    getPaymentResultHtml,
    getPreviewHtml,
    getShowcaseHtml,
    getTrialHtml,
    getPlayerHtml,
    getLegacyPlayerHtml,
    getPlatformPublicOverview,
    isDiscordStartPath,
    isDiscordCallbackPath,
    handleDiscordStart,
    handleDiscordCallback,
    getSession,
    getPreviewSession,
    getAuthLoginHtml,
    renderPlayerLoginPage,
  } = deps;
  const servePortalStaticAsset = typeof tryServePortalStaticAsset === 'function'
    ? tryServePortalStaticAsset
    : async () => false;
  const serveLegacyPlayerHtml = typeof getLegacyPlayerHtml === 'function'
    ? getLegacyPlayerHtml
    : getPlayerHtml;
  const readBody = typeof readJsonBody === 'function'
    ? readJsonBody
    : async () => ({});

  return async function handlePortalPageRoute(context) {
    const {
      req,
      res,
      urlObj,
      pathname,
      method,
    } = context;

    if (await servePortalStaticAsset(req, res, pathname)) {
      return true;
    }

    if (await tryServeStaticScumIcon(req, res, pathname)) {
      return true;
    }

    if (pathname.startsWith('/admin')) {
      const target = buildLegacyAdminUrl(pathname, urlObj.search);
      if (!target) {
        sendJson(res, 503, {
          ok: false,
          error: 'Legacy admin URL is invalid',
        });
        return true;
      }
      sendRedirect(res, target);
      return true;
    }

    const canonicalRedirectUrl = getCanonicalRedirectUrl(req);
    if (canonicalRedirectUrl && (method === 'GET' || method === 'HEAD')) {
      sendRedirect(res, canonicalRedirectUrl);
      return true;
    }

    if (pathname === '/favicon.ico' || pathname === '/favicon.svg') {
      sendFavicon(res);
      return true;
    }

    if (allowCaptureAuth && pathname === '/player/capture-auth' && method === 'POST') {
      const body = await readBody(req);
      const token = String(body?.token || '').trim();
      if (!token || token !== String(captureAuthToken || '').trim()) {
        sendJson(res, 403, {
          ok: false,
          error: 'Capture auth token is invalid',
        });
        return true;
      }
      const sessionId = createCaptureSession();
      res.writeHead(302, {
        Location: '/player',
        'Set-Cookie': buildSessionCookie(sessionId, req),
      });
      res.end();
      return true;
    }

    if (pathname === '/healthz' && method === 'GET') {
      sendJson(res, 200, buildHealthPayload());
      return true;
    }

    if (method === 'GET' && tryServePublicDoc(pathname, res)) {
      return true;
    }

    if (pathname === '/') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/showcase/' && method === 'GET') {
      sendRedirect(res, '/showcase');
      return true;
    }

    if (pathname === '/landing/' && method === 'GET') {
      sendRedirect(res, '/landing');
      return true;
    }

    if (pathname === '/landing' && method === 'GET') {
      sendHtml(res, 200, getLandingHtml());
      return true;
    }

    if (pathname === '/dashboard/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/dashboard' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/pricing' && method === 'GET') {
      sendHtml(res, 200, getPricingHtml());
      return true;
    }

    if (pathname === '/signup/' && method === 'GET') {
      sendRedirect(res, '/signup');
      return true;
    }

    if (pathname === '/signup' && method === 'GET') {
      sendHtml(res, 200, getSignupHtml());
      return true;
    }

    if (pathname === '/forgot-password/' && method === 'GET') {
      sendRedirect(res, '/forgot-password');
      return true;
    }

    if (pathname === '/forgot-password' && method === 'GET') {
      sendHtml(res, 200, getForgotPasswordHtml());
      return true;
    }

    if (pathname === '/verify-email/' && method === 'GET') {
      sendRedirect(res, '/verify-email');
      return true;
    }

    if (pathname === '/verify-email' && method === 'GET') {
      sendHtml(res, 200, getVerifyEmailHtml());
      return true;
    }

    if (pathname === '/checkout/' && method === 'GET') {
      sendRedirect(res, '/checkout');
      return true;
    }

    if (pathname === '/checkout' && method === 'GET') {
      sendHtml(res, 200, getCheckoutHtml());
      return true;
    }

    if (pathname === '/payment-result/' && method === 'GET') {
      sendRedirect(res, '/payment-result');
      return true;
    }

    if (pathname === '/payment-result' && method === 'GET') {
      sendHtml(res, 200, getPaymentResultHtml());
      return true;
    }

    if (pathname === '/preview/' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/preview' && method === 'GET') {
      const target = typeof buildAdminProductUrl === 'function'
        ? buildAdminProductUrl('/tenant/onboarding')
        : '/tenant/onboarding';
      sendRedirect(res, target);
      return true;
    }

    if (pathname === '/showcase' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/trial/' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/trial' && method === 'GET') {
      sendRedirect(res, '/pricing');
      return true;
    }

    if (pathname === '/api/platform/public/overview' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformPublicOverview(),
      });
      return true;
    }

    if (pathname === '/player/') {
      sendRedirect(res, '/player');
      return true;
    }

    if (pathname === '/player/legacy/' && method === 'GET') {
      sendRedirect(res, '/player/legacy');
      return true;
    }

    if (pathname === '/player/login/') {
      sendRedirect(res, '/player/login');
      return true;
    }

    if (isDiscordStartPath(pathname) && method === 'GET') {
      await handleDiscordStart(req, res);
      return true;
    }

    if (isDiscordCallbackPath(pathname) && method === 'GET') {
      await handleDiscordCallback(req, res, urlObj);
      return true;
    }

    if (pathname === '/login' && method === 'GET') {
      sendHtml(res, 200, getAuthLoginHtml());
      return true;
    }

    if (pathname === '/player/login' && method === 'GET') {
      const session = getSession(req);
      if (session) {
        sendRedirect(res, '/player');
        return true;
      }
      sendHtml(
        res,
        200,
        renderPlayerLoginPage(String(urlObj.searchParams.get('error') || '')),
      );
      return true;
    }

    if (
      (pathname === '/player' || pathname.startsWith('/player/'))
      && pathname !== '/player/login'
      && pathname !== '/player/legacy'
      && !pathname.startsWith('/player/api/')
      && method === 'GET'
    ) {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, getPlayerHtml());
      return true;
    }

    if (pathname === '/player/legacy' && method === 'GET') {
      const session = getSession(req);
      if (!session) {
        sendRedirect(res, '/player/login');
        return true;
      }
      sendHtml(res, 200, serveLegacyPlayerHtml());
      return true;
    }

    return false;
  };
}

module.exports = {
  createPortalPageRoutes,
};
