'use strict';

const crypto = require('node:crypto');
const { Buffer } = require('node:buffer');

/**
 * Admin public/platform routes that do not belong to the authenticated admin API
 * surface. This keeps page routing, platform API, and Discord SSO out of the
 * main admin server entrypoint.
 */

function createAdminPublicRoutes(deps) {
  const {
    tryServeAdminStaticAsset,
    tryServeStaticScumIcon,
    sendJson,
    sendText,
    sendHtml,
    isAuthorized,
    getAuthContext,
    getLoginHtml,
    getTenantLoginHtml,
    getOwnerConsoleHtml,
    getTenantConsoleHtml,
    getDashboardHtml,
    getPersistenceStatus,
    getPublicPersistenceStatus,
    getDeliveryMetricsSnapshot,
    ensurePlatformApiKey,
    requiredString,
    readJsonBody,
    getTenantQuotaSnapshot,
    getTenantFeatureAccess,
    getPlatformPublicOverview,
    getPlatformAnalyticsOverview,
    getPackageCatalog,
    getFeatureCatalog,
    recordPlatformAgentHeartbeat,
    verifyPlatformApiKey,
    activatePlatformAgent,
    registerPlatformAgent,
    recordPlatformAgentSession,
    ingestPlatformAgentSync,
    upsertServerConfigSnapshot,
    claimNextServerConfigJob,
    completeServerConfigJob,
    reconcileDeliveryState,
    dispatchPlatformWebhookEvent,
    ssoDiscordActive,
    cleanupDiscordOauthStates,
    buildDiscordAuthorizeUrl,
    getDiscordRedirectUri,
    exchangeDiscordOauthCode,
    fetchDiscordProfile,
    fetchDiscordGuildMember,
    listDiscordGuildRolesFromClient,
    resolveMappedMemberRole,
    getAdminSsoRoleMappingSummary,
    ssoDiscordGuildId,
    ssoDiscordDefaultRole,
    setDiscordOauthState,
    hasDiscordOauthState,
    deleteDiscordOauthState,
    getClientIp,
    recordAdminSecuritySignal,
    consumeAdminActionRateLimit,
    createSession,
    buildSessionCookie,
    buildClearSessionCookie,
    invalidateSession,
    authenticateTenantUser,
    consumeTenantBootstrapToken,
    resolveTenantSessionAccessContext,
    resolveAdminSessionAccessContext,
  } = deps;

  function extractHostname(rawHost) {
    const input = String(rawHost || '').trim().toLowerCase();
    if (!input) return '';
    if (input.startsWith('[')) {
      const endIndex = input.indexOf(']');
      return endIndex > 0 ? input.slice(1, endIndex) : input;
    }
    const colonIndex = input.indexOf(':');
    return colonIndex >= 0 ? input.slice(0, colonIndex) : input;
  }

  function isLoopbackHostname(hostname) {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
  }

  function trimTrailingSlash(value) {
    return String(value || '').trim().replace(/\/+$/, '');
  }

  function sendRateLimitResponse(res, rateLimit, message) {
    const retryAfterSec = Math.max(1, Math.ceil(Number(rateLimit?.retryAfterMs || 0) / 1000));
    sendJson(res, 429, {
      ok: false,
      error: message || `Too many requests. Please wait ${retryAfterSec}s and try again.`,
      retryAfterSec,
    }, {
      'Retry-After': String(retryAfterSec),
    });
  }

  async function readTenantBootstrapBody(req) {
    const contentType = String(req?.headers?.['content-type'] || '')
      .trim()
      .toLowerCase();
    if (contentType.includes('application/json')) {
      return readJsonBody(req);
    }
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || '')));
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return {};
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(raw).entries());
    }
    return {};
  }

  function buildSurfaceBaseUrl(surface, req) {
    const normalizedSurface = String(surface || '').trim().toLowerCase();
    const configuredBase = normalizedSurface === 'owner'
      ? trimTrailingSlash(process.env.OWNER_WEB_BASE_URL)
      : normalizedSurface === 'tenant'
        ? trimTrailingSlash(process.env.TENANT_WEB_BASE_URL)
        : normalizedSurface === 'player'
          ? trimTrailingSlash(process.env.WEB_PORTAL_BASE_URL)
          : '';
    if (configuredBase) return configuredBase;

    const requestHost = String(req?.headers?.host || '').trim();
    const requestHostname = extractHostname(requestHost) || '127.0.0.1';
    if (!isLoopbackHostname(requestHostname)) {
      return '';
    }

    if (normalizedSurface === 'owner') {
      return `http://${requestHostname}:${String(process.env.OWNER_WEB_PORT || '3201').trim() || '3201'}`;
    }
    if (normalizedSurface === 'tenant') {
      return `http://${requestHostname}:${String(process.env.TENANT_WEB_PORT || '3202').trim() || '3202'}`;
    }
    if (normalizedSurface === 'player') {
      return `http://${requestHostname}:${String(process.env.WEB_PORTAL_PORT || '3300').trim() || '3300'}`;
    }
    return '';
  }

  function buildSurfaceRedirectUrl(surface, req, pathname, search = '') {
    const baseUrl = buildSurfaceBaseUrl(surface, req);
    if (!baseUrl) return null;
    try {
      const target = new URL(pathname, baseUrl);
      target.search = String(search || '');
      return target.toString();
    } catch {
      return null;
    }
  }

  function buildPlayerPortalUrl(req, urlObj, pathname) {
    const requestHost = String(req?.headers?.host || '').trim();
    const requestHostname = extractHostname(requestHost);
    const search = String(urlObj?.search || '');
    if (isLoopbackHostname(requestHostname)) {
      const localHost = requestHostname || '127.0.0.1';
      const localPort = String(process.env.WEB_PORTAL_PORT || '3300').trim() || '3300';
      return `http://${localHost}:${localPort}${pathname}${search}`;
    }

    const splitSurfaceTarget = buildSurfaceRedirectUrl('player', req, pathname, urlObj?.search || '');
    if (splitSurfaceTarget) return splitSurfaceTarget;

    const configuredBase = String(process.env.WEB_PORTAL_BASE_URL || '').trim();
    if (!configuredBase) return null;

    try {
      const target = new URL(pathname, configuredBase);
      target.search = search;
      return target.toString();
    } catch {
      return null;
    }
  }

  function buildLegacyFallbackTarget(auth, urlObj) {
    const query = urlObj?.searchParams;
    const tab = String(query?.get('tab') || '').trim().toLowerCase();
    const isTenantScoped = Boolean(auth?.tenantId);
    const ownerTabTargets = {
      auth: '/owner/audit',
      platform: '/owner/runtime',
      metrics: '/owner/analytics',
      control: '/owner/settings',
      config: '/owner/settings',
      danger: '/owner/audit',
      delivery: '/owner/runtime',
      economy: '/owner/subscriptions',
      players: '/owner/tenants',
      community: '/owner/tenants',
      moderation: '/owner/audit',
    };
    const tenantTabTargets = {
      auth: '/tenant/roles',
      platform: '/tenant/settings',
      metrics: '/tenant/logs-sync',
      control: '/tenant/server/config',
      config: '/tenant/server/config',
      danger: '/tenant/server/restarts',
      delivery: '/tenant/orders',
      economy: '/tenant/orders',
      players: '/tenant/players',
      community: '/tenant/events',
      moderation: '/tenant/players',
    };
    const tabTargets = isTenantScoped ? tenantTabTargets : ownerTabTargets;
    const target = tabTargets[tab];
    if (target) return target;
    return isTenantScoped ? '/tenant' : '/owner';
  }

  function buildAdminLoginRoute(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    if (raw === '/owner' || raw === '/owner/' || raw === '/owner/login' || raw === '/owner/login/' || raw.startsWith('/owner/')) {
      return '/owner/login';
    }
    if (raw === '/tenant' || raw === '/tenant/' || raw === '/tenant/login' || raw === '/tenant/login/' || raw.startsWith('/tenant/')) {
      return '/tenant/login';
    }
    return '/admin/login';
  }

  function normalizeTenantNextUrl(value, fallback = '') {
    const text = String(value || '').trim();
    if (!text) return fallback;
    if (!text.startsWith('/tenant')) return fallback;
    if (text.startsWith('//') || /[\r\n]/.test(text)) return fallback;
    try {
      const normalized = new URL(text, 'https://tenant.local');
      normalized.searchParams.delete('bootstrap');
      normalized.searchParams.delete('bootstrapToken');
      normalized.searchParams.delete('token');
      return `${normalized.pathname}${normalized.search}${normalized.hash}`;
    } catch {
      return text;
    }
  }

  function buildTenantLoginSearch(pathname, search = '', options = {}) {
    const params = new URLSearchParams();
    if (options.switch === true) {
      params.set('switch', '1');
    }
    const nextUrl = normalizeTenantNextUrl(
      `${String(pathname || '').trim()}${String(search || '').trim()}`,
      '',
    );
    if (nextUrl && nextUrl !== '/tenant' && nextUrl !== '/tenant/') {
      params.set('next', nextUrl);
    }
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function getRequestedSurface(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    if (raw.startsWith('/owner')) return 'owner';
    if (raw.startsWith('/tenant')) return 'tenant';
    return 'admin';
  }

  function isOwnerConsolePath(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    return raw === '/owner' || raw === '/owner/' || (raw.startsWith('/owner/') && !raw.startsWith('/owner/login') && !raw.startsWith('/owner/api/'));
  }

  function isTenantConsolePath(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    return raw === '/tenant' || raw === '/tenant/' || (raw.startsWith('/tenant/') && !raw.startsWith('/tenant/login') && !raw.startsWith('/tenant/api/'));
  }

  function isOwnerAuth(auth) {
    return String(auth?.role || '').trim().toLowerCase() === 'owner';
  }

  function isPlatformOwnerAuth(auth) {
    return isOwnerAuth(auth) && !auth?.tenantId;
  }

  function canAccessTenantSurface(auth) {
    return Boolean(auth?.tenantId);
  }

  function getDefaultSurfaceTarget(auth) {
    if (auth?.tenantId) return '/tenant';
    if (isPlatformOwnerAuth(auth)) return '/owner';
    return '/admin/login';
  }

  async function getEffectiveAuth(req, urlObj, res = null) {
    const auth = getAuthContext(req, urlObj);
    if (!auth || auth.mode !== 'session') {
      return auth;
    }
    let resolved = null;
    let invalidReason = 'admin-session-invalid';
    let defaultAuthMethod = 'password-db';
    if (auth.tenantId) {
      if (typeof resolveTenantSessionAccessContext !== 'function') {
        return auth;
      }
      resolved = await resolveTenantSessionAccessContext({
        tenantId: auth.tenantId,
        userId: auth.userId,
        email: auth.primaryEmail || auth.user,
        authMethod: auth.authMethod,
      });
      invalidReason = 'tenant-session-invalid';
      defaultAuthMethod = 'platform-user-password';
    } else {
      if (typeof resolveAdminSessionAccessContext !== 'function') {
        return auth;
      }
      resolved = await resolveAdminSessionAccessContext({
        username: auth.user,
        authMethod: auth.authMethod,
      });
    }
    if (!resolved?.ok || !resolved?.authContext) {
      if (typeof invalidateSession === 'function' && auth.sessionId) {
        invalidateSession(auth.sessionId, {
          actor: auth.user || 'system',
          reason: resolved?.reason || invalidReason,
        });
      }
      req.__resolvedAdminAuthContext = null;
      if (res && typeof buildClearSessionCookie === 'function') {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Set-Cookie', buildClearSessionCookie(req));
        } else {
          res.headers = { ...(res.headers || {}), 'Set-Cookie': buildClearSessionCookie(req) };
        }
      }
      return null;
    }
    const effectiveAuth = {
      ...auth,
      ...resolved.authContext,
      mode: auth.mode,
      sessionId: auth.sessionId,
      authMethod: auth.authMethod || resolved.authContext.authMethod || defaultAuthMethod,
    };
    req.__resolvedAdminAuthContext = effectiveAuth;
    return effectiveAuth;
  }

  function extractPlatformApiKey(req) {
    const rawHeader = req?.headers?.['x-platform-api-key'];
    const directKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const normalizedDirectKey = String(directKey || '').trim();
    if (normalizedDirectKey) return normalizedDirectKey;

    const authorization = String(req?.headers?.authorization || '').trim();
    if (authorization.toLowerCase().startsWith('bearer ')) {
      return authorization.slice(7).trim();
    }
    return '';
  }

  async function ensurePlatformApiKeyAny(req, res, scopeSets = []) {
    const normalizedScopeSets = Array.isArray(scopeSets)
      ? scopeSets.filter((entry) => Array.isArray(entry) && entry.length > 0)
      : [];
    if (normalizedScopeSets.length === 0 || typeof verifyPlatformApiKey !== 'function') {
      return ensurePlatformApiKey(req, res, normalizedScopeSets[0] || []);
    }

    const rawKey = extractPlatformApiKey(req);
    if (!rawKey) {
      sendJson(res, 401, { ok: false, error: 'Missing platform API key' });
      return null;
    }

    const failures = [];
    for (const requiredScopes of normalizedScopeSets) {
      const result = await verifyPlatformApiKey(rawKey, requiredScopes);
      if (result?.ok) return result;
      failures.push(result || { ok: false, reason: 'invalid-api-key' });
      if (result?.reason && !['insufficient-scope', 'invalid-api-key', 'missing-api-key'].includes(result.reason)) {
        const statusCode = result.reason === 'tenant-access-suspended' ? 403 : 401;
        sendJson(res, statusCode, { ok: false, error: result.reason });
        return null;
      }
    }

    const insufficient = failures.find((entry) => entry?.reason === 'insufficient-scope') || null;
    if (insufficient) {
      const missingScopes = Array.from(new Set(
        failures.flatMap((entry) => Array.isArray(entry?.missingScopes) ? entry.missingScopes : []),
      ));
      sendJson(res, 403, {
        ok: false,
        error: 'insufficient-scope',
        data: {
          missingScopes,
        },
      });
      return null;
    }

    sendJson(res, 401, { ok: false, error: 'invalid-api-key' });
    return null;
  }

  return async function handleAdminPublicRoute(context) {
    const {
      client,
      req,
      res,
      urlObj,
      pathname,
      host,
      port,
    } = context;

    if (await tryServeAdminStaticAsset(req, res, pathname)) {
      return true;
    }

    if (await tryServeStaticScumIcon(req, res, pathname)) {
      return true;
    }

    if (req.method === 'GET' && pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(302, { Location: '/admin' });
      res.end();
      return true;
    }

    if (req.method === 'GET' && pathname === '/healthz') {
      sendJson(res, 200, {
        ok: true,
        data: {
          now: new Date().toISOString(),
          service: 'admin-web',
          uptimeSec: Math.round(process.uptime()),
          persistence:
            typeof getPublicPersistenceStatus === 'function'
              ? getPublicPersistenceStatus()
              : getPersistenceStatus(),
          delivery: typeof getDeliveryMetricsSnapshot === 'function'
            ? getDeliveryMetricsSnapshot()
            : null,
        },
      });
      return true;
    }

    if (
      req.method === 'GET'
      && (pathname === '/player' || pathname === '/player/' || pathname.startsWith('/player/'))
    ) {
      const target = buildPlayerPortalUrl(req, urlObj, pathname);
      if (!target) {
        sendJson(res, 503, {
          ok: false,
          error: 'Player portal URL is invalid',
        });
        return true;
      }
      res.writeHead(302, { Location: target });
      res.end();
      return true;
    }

    if (
      req.method === 'GET'
      && (
        pathname === '/admin/login'
        || pathname === '/admin/login/'
        || pathname === '/owner/login'
        || pathname === '/owner/login/'
        || pathname === '/tenant/login'
        || pathname === '/tenant/login/'
      )
    ) {
      const auth = await getEffectiveAuth(req, urlObj, res);
      if (auth) {
        const requestedSurface = getRequestedSurface(pathname);
        const canAccessRequestedSurface = (
          requestedSurface === 'admin'
          || (requestedSurface === 'owner' && isPlatformOwnerAuth(auth))
          || (requestedSurface === 'tenant' && canAccessTenantSurface(auth))
        );
        if (canAccessRequestedSurface) {
          const target = requestedSurface === 'owner'
            ? (buildSurfaceRedirectUrl('owner', req, '/owner') || '/owner')
            : requestedSurface === 'tenant'
              ? (buildSurfaceRedirectUrl('tenant', req, '/tenant') || '/tenant')
              : (() => {
                const defaultTarget = getDefaultSurfaceTarget(auth);
                return defaultTarget === '/owner'
                  ? (buildSurfaceRedirectUrl('owner', req, '/owner') || defaultTarget)
                  : defaultTarget === '/tenant'
                    ? (buildSurfaceRedirectUrl('tenant', req, '/tenant') || defaultTarget)
                    : defaultTarget;
              })();
          res.writeHead(302, { Location: target });
          res.end();
          return true;
        }
      } else if (pathname.startsWith('/owner/login')) {
        const target = buildSurfaceRedirectUrl('owner', req, '/owner/login', urlObj?.search || '');
        if (target) {
          res.writeHead(302, { Location: target });
          res.end();
          return true;
        }
      } else if (pathname.startsWith('/tenant/login')) {
        const target = buildSurfaceRedirectUrl('tenant', req, '/tenant/login', urlObj?.search || '');
        if (target) {
          res.writeHead(302, { Location: target });
          res.end();
          return true;
        }
      }
      const loginHtml = pathname.startsWith('/tenant/login')
        ? (typeof getTenantLoginHtml === 'function' ? getTenantLoginHtml() : getLoginHtml())
        : getLoginHtml();
      sendHtml(res, 200, loginHtml);
      return true;
    }

    if (req.method === 'POST' && pathname === '/tenant/api/auth/login') {
      const body = await readJsonBody(req);
      const nextUrl = normalizeTenantNextUrl(
        body?.nextUrl || body?.next || urlObj?.searchParams?.get('next'),
        '/tenant/onboarding',
      ) || '/tenant/onboarding';
      const result = await authenticateTenantUser?.({
        email: requiredString(body, 'email'),
        password: requiredString(body, 'password'),
      });
      if (!result?.ok || !result?.membership?.tenantId) {
        sendJson(res, 401, {
          ok: false,
          error: result?.reason || 'tenant-login-failed',
        });
        return true;
      }
      req.__pendingAdminTenantId = result.membership.tenantId;
      req.__pendingAdminSessionContext = {
        userId: result.user?.id || null,
        primaryEmail: result.user?.primaryEmail || null,
        tenantMembershipId: result.membership?.id || null,
        tenantMembershipType: result.membership?.membershipType || 'tenant',
        tenantMembershipStatus: result.membership?.status || 'active',
      };
      const sessionId = createSession(
        result.user?.primaryEmail || result.user?.displayName || result.membership.tenantId,
        result.membership.role || 'viewer',
        'platform-user-password',
        req,
      );
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            tenantId: result.membership.tenantId,
            role: result.membership.role || 'viewer',
            nextUrl,
          },
        },
        {
          'Set-Cookie': buildSessionCookie(sessionId, req),
        },
      );
      return true;
    }

    if (req.method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
      const auth = await getEffectiveAuth(req, urlObj, res);
      if (!auth) {
        res.writeHead(302, { Location: '/admin/login' });
        res.end();
        return true;
      }
      const target = getDefaultSurfaceTarget(auth);
      const redirectedTarget = target === '/owner'
        ? (buildSurfaceRedirectUrl('owner', req, '/owner') || target)
        : target === '/tenant'
          ? (buildSurfaceRedirectUrl('tenant', req, '/tenant') || target)
          : target;
      res.writeHead(302, { Location: redirectedTarget });
      res.end();
      return true;
    }

    if (req.method === 'GET' && (pathname === '/admin/legacy' || pathname === '/admin/legacy/')) {
      const auth = await getEffectiveAuth(req, urlObj, res);
      if (!auth) {
        res.writeHead(302, { Location: '/admin/login' });
        res.end();
        return true;
      }
      const fallbackEnabled = String(urlObj?.searchParams?.get('fallback') || '').trim() === '1';
      if (!fallbackEnabled) {
        const target = buildLegacyFallbackTarget(auth, urlObj);
        res.writeHead(302, { Location: target });
        res.end();
        return true;
      }
      sendHtml(res, 200, getDashboardHtml());
      return true;
    }

    if (req.method === 'GET' && isOwnerConsolePath(pathname)) {
      const splitOwnerTarget = buildSurfaceRedirectUrl('owner', req, pathname, urlObj?.search || '');
      const auth = await getEffectiveAuth(req, urlObj, res);
      if (!auth) {
        if (splitOwnerTarget) {
          res.writeHead(302, {
            Location: buildSurfaceRedirectUrl('owner', req, '/owner/login', '') || splitOwnerTarget,
          });
          res.end();
          return true;
        }
        res.writeHead(302, { Location: buildAdminLoginRoute(pathname) });
        res.end();
        return true;
      }
      if (!isPlatformOwnerAuth(auth)) {
        const fallbackTarget = buildSurfaceRedirectUrl('owner', req, '/owner/login', '?switch=1') || '/owner/login?switch=1';
        res.writeHead(302, { Location: fallbackTarget });
        res.end();
        return true;
      }
      if (splitOwnerTarget) {
        res.writeHead(302, { Location: splitOwnerTarget });
        res.end();
        return true;
      }
      sendHtml(res, 200, getOwnerConsoleHtml());
      return true;
    }

    if (req.method === 'POST' && isTenantConsolePath(pathname)) {
      const existingAuth = await getEffectiveAuth(req, urlObj, res);
      const body = await readTenantBootstrapBody(req);
      const bootstrapToken = requiredString(body?.bootstrapToken || body?.bootstrap);
      if (bootstrapToken && typeof consumeTenantBootstrapToken === 'function') {
        const bootstrap = await consumeTenantBootstrapToken({ token: bootstrapToken });
        if (bootstrap?.ok && bootstrap?.membership?.tenantId) {
          req.__pendingAdminTenantId = bootstrap.membership.tenantId;
          req.__pendingAdminSessionContext = {
            userId: bootstrap.user?.id || null,
            primaryEmail: bootstrap.user?.primaryEmail || bootstrap.token?.email || null,
            tenantMembershipId: bootstrap.membership?.id || null,
            tenantMembershipType: bootstrap.membership?.membershipType || 'tenant',
            tenantMembershipStatus: bootstrap.membership?.status || 'active',
          };
          const sessionId = createSession(
            bootstrap.user?.primaryEmail || bootstrap.token?.email || bootstrap.membership.tenantId,
            bootstrap.membership.role || 'owner',
            'tenant-bootstrap',
            req,
          );
          res.writeHead(303, {
            Location: pathname,
            'Set-Cookie': buildSessionCookie(sessionId, req),
          });
          res.end();
          return true;
        }
      }
      if (existingAuth) {
        res.writeHead(303, { Location: pathname });
        res.end();
        return true;
      }
      const tenantLoginSearch = buildTenantLoginSearch(pathname, '', { switch: false });
      res.writeHead(303, {
        Location: `/tenant/login${tenantLoginSearch}`,
      });
      res.end();
      return true;
    }

    if (req.method === 'GET' && isTenantConsolePath(pathname)) {
      const existingAuth = await getEffectiveAuth(req, urlObj, res);
      const tenantSearchParams = new URLSearchParams(urlObj?.search || '');
      tenantSearchParams.delete('bootstrap');
      tenantSearchParams.delete('bootstrapToken');
      tenantSearchParams.delete('token');
      const sanitizedTenantSearch = tenantSearchParams.toString()
        ? `?${tenantSearchParams.toString()}`
        : '';
      const splitTenantTarget = buildSurfaceRedirectUrl('tenant', req, pathname, sanitizedTenantSearch);
      const auth = existingAuth;
      if (!auth) {
        const tenantLoginSearch = buildTenantLoginSearch(pathname, sanitizedTenantSearch);
        if (splitTenantTarget) {
          res.writeHead(302, {
            Location: buildSurfaceRedirectUrl('tenant', req, '/tenant/login', tenantLoginSearch) || splitTenantTarget,
          });
          res.end();
          return true;
        }
        const fallbackRoute = buildAdminLoginRoute(pathname);
        res.writeHead(302, {
          Location: fallbackRoute === '/tenant/login'
            ? `/tenant/login${tenantLoginSearch}`
            : fallbackRoute,
        });
        res.end();
        return true;
      }
      if (!canAccessTenantSurface(auth)) {
        const tenantLoginSearch = buildTenantLoginSearch(pathname, sanitizedTenantSearch, { switch: true });
        const redirectTarget = buildSurfaceRedirectUrl('tenant', req, '/tenant/login', tenantLoginSearch) || `/tenant/login${tenantLoginSearch}`;
        res.writeHead(302, { Location: redirectTarget });
        res.end();
        return true;
      }
      if (splitTenantTarget) {
        res.writeHead(302, { Location: splitTenantTarget });
        res.end();
        return true;
      }
      sendHtml(res, 200, getTenantConsoleHtml());
      return true;
    }

    if (req.method === 'GET' && pathname === '/platform/api/v1/public/overview') {
      sendJson(res, 200, {
        ok: true,
        data: await getPlatformPublicOverview(),
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/platform/api/v1/public/packages') {
      const packages = typeof getPackageCatalog === 'function'
        ? await Promise.resolve(getPackageCatalog({ status: 'active' }))
        : [];
      sendJson(res, 200, {
        ok: true,
        data: {
          packages,
          features: typeof getFeatureCatalog === 'function' ? getFeatureCatalog() : [],
        },
      });
      return true;
    }

    if (pathname.startsWith('/platform/api/v1/')) {
      try {
        if (req.method === 'GET' && pathname === '/platform/api/v1/tenant/self') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['tenant:read']);
          if (!platformAuth) return true;
          sendJson(res, 200, {
            ok: true,
            data: {
              tenant: platformAuth.tenant,
              apiKey: platformAuth.apiKey,
              scopes: platformAuth.scopes,
              quota: await getTenantQuotaSnapshot(platformAuth.tenant?.id, { cache: false }),
            },
          });
          return true;
        }

        if (req.method === 'GET' && pathname === '/platform/api/v1/quota/self') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['tenant:read']);
          if (!platformAuth) return true;
          sendJson(res, 200, {
            ok: true,
            data: await getTenantQuotaSnapshot(platformAuth.tenant?.id, { cache: false }),
          });
          return true;
        }

        if (req.method === 'GET' && pathname === '/platform/api/v1/features/self') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['tenant:read']);
          if (!platformAuth) return true;
          sendJson(res, 200, {
            ok: true,
            data: typeof getTenantFeatureAccess === 'function'
              ? await getTenantFeatureAccess(platformAuth.tenant?.id, { cache: false })
              : await getTenantQuotaSnapshot(platformAuth.tenant?.id, { cache: false }),
          });
          return true;
        }

        if (req.method === 'GET' && pathname === '/platform/api/v1/analytics/overview') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['analytics:read']);
          if (!platformAuth) return true;
          sendJson(res, 200, {
            ok: true,
            data: await getPlatformAnalyticsOverview({
              tenantId: platformAuth.tenant?.id,
            }),
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/agent/heartbeat') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['agent:write']);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await recordPlatformAgentHeartbeat({
            tenantId: platformAuth.tenant?.id,
            runtimeKey: requiredString(body, 'runtimeKey'),
            version: requiredString(body, 'version'),
            channel: requiredString(body, 'channel'),
            status: requiredString(body, 'status'),
            minRequiredVersion: requiredString(body, 'minRequiredVersion'),
            meta: body.meta,
          }, 'platform-api');
          if (!result.ok) {
            sendJson(res, 400, { ok: false, error: result.reason || 'platform-agent-heartbeat-failed' });
            return true;
          }
          sendJson(res, 200, { ok: true, data: result.runtime });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/agent/activate') {
          const body = await readJsonBody(req);
          const setupToken = requiredString(body, 'setupToken') || requiredString(body, 'setup_token');
          const machineFingerprint = requiredString(body, 'machineFingerprint') || requiredString(body, 'machine_fingerprint');
          const runtimeKey = requiredString(body, 'runtimeKey');
          if (typeof consumeAdminActionRateLimit === 'function') {
            let ip = '';
            try {
              ip = req?.headers && typeof getClientIp === 'function' ? getClientIp(req) : '';
            } catch {
              ip = '';
            }
            const rateLimit = consumeAdminActionRateLimit('platform-agent-activate', {
              actor: 'platform-agent-activate',
              ip,
              identityKey: machineFingerprint || String(setupToken || '').slice(0, 12),
              path: pathname,
            });
            if (rateLimit?.limited) {
              sendRateLimitResponse(
                res,
                rateLimit,
                'Too many activation attempts. Please wait and try again.',
              );
              return true;
            }
          }
          const result = await activatePlatformAgent?.({
            setupToken,
            setup_token: requiredString(body, 'setup_token'),
            machineFingerprint,
            machine_fingerprint: requiredString(body, 'machine_fingerprint'),
            runtimeKey,
            displayName: requiredString(body, 'displayName') || requiredString(body, 'name'),
            hostname: requiredString(body, 'hostname'),
            version: requiredString(body, 'version'),
            channel: requiredString(body, 'channel'),
            baseUrl: requiredString(body, 'baseUrl'),
            metadata: body.metadata,
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-activate-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: result,
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/agent/register') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['agent:register'],
            ['agent:write'],
          ]);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await registerPlatformAgent?.({
            id: requiredString(body, 'id'),
            tenantId: requiredString(body, 'tenantId') || platformAuth.tenant?.id || null,
            serverId: requiredString(body, 'serverId'),
            guildId: requiredString(body, 'guildId'),
            agentId: requiredString(body, 'agentId'),
            runtimeKey: requiredString(body, 'runtimeKey'),
            displayName: requiredString(body, 'displayName') || requiredString(body, 'name'),
            role: requiredString(body, 'role'),
            scope: requiredString(body, 'scope'),
            channel: requiredString(body, 'channel'),
            version: requiredString(body, 'version'),
            minimumVersion: requiredString(body, 'minimumVersion') || requiredString(body, 'minRequiredVersion'),
            baseUrl: requiredString(body, 'baseUrl'),
            hostname: requiredString(body, 'hostname'),
            meta: body.meta,
          }, {
            tenantId: platformAuth.tenant?.id || null,
            apiKeyId: platformAuth.apiKey?.id || null,
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-register-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              agent: result.agent,
              binding: result.binding,
            },
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/agent/session') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['agent:session'],
            ['agent:write'],
          ]);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await recordPlatformAgentSession?.({
            sessionId: requiredString(body, 'sessionId'),
            tenantId: requiredString(body, 'tenantId') || platformAuth.tenant?.id || null,
            serverId: requiredString(body, 'serverId'),
            guildId: requiredString(body, 'guildId'),
            agentId: requiredString(body, 'agentId'),
            runtimeKey: requiredString(body, 'runtimeKey'),
            role: requiredString(body, 'role'),
            scope: requiredString(body, 'scope'),
            channel: requiredString(body, 'channel'),
            version: requiredString(body, 'version'),
            heartbeatAt: requiredString(body, 'heartbeatAt'),
            baseUrl: requiredString(body, 'baseUrl'),
            hostname: requiredString(body, 'hostname'),
            diagnostics: body.diagnostics,
            meta: body.meta,
          }, {
            tenantId: platformAuth.tenant?.id || null,
            apiKeyId: platformAuth.apiKey?.id || null,
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-session-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              session: result.session,
              agent: result.agent,
            },
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/agent/sync') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['agent:sync'],
            ['agent:write'],
          ]);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await ingestPlatformAgentSync?.({
            syncRunId: requiredString(body, 'syncRunId'),
            tenantId: requiredString(body, 'tenantId') || platformAuth.tenant?.id || null,
            serverId: requiredString(body, 'serverId'),
            guildId: requiredString(body, 'guildId'),
            agentId: requiredString(body, 'agentId'),
            runtimeKey: requiredString(body, 'runtimeKey'),
            role: requiredString(body, 'role'),
            scope: requiredString(body, 'scope'),
            channel: requiredString(body, 'channel'),
            version: requiredString(body, 'version'),
            heartbeatAt: requiredString(body, 'heartbeatAt'),
            sourceType: requiredString(body, 'sourceType'),
            sourcePath: requiredString(body, 'sourcePath'),
            freshnessAt: requiredString(body, 'freshnessAt'),
            eventCount: body.eventCount,
            snapshot: body.snapshot,
            events: body.events,
            errors: body.errors,
            payload: body.payload,
            meta: body.meta,
          }, {
            tenantId: platformAuth.tenant?.id || null,
            apiKeyId: platformAuth.apiKey?.id || null,
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'platform-agent-sync-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: {
              syncRun: result.syncRun,
              syncEvents: result.syncEvents,
              server: result.server,
              agent: result.agent,
            },
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/server-config/snapshot') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['config:write'],
            ['agent:sync'],
          ]);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await upsertServerConfigSnapshot?.({
            tenantId: requiredString(body, 'tenantId') || platformAuth.tenant?.id || null,
            serverId: requiredString(body, 'serverId'),
            runtimeKey: requiredString(body, 'runtimeKey'),
            snapshot: body.snapshot,
            lastJobId: requiredString(body, 'lastJobId'),
            lastError: requiredString(body, 'lastError'),
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-snapshot-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: result,
          });
          return true;
        }

        if (req.method === 'GET' && pathname === '/platform/api/v1/server-config/jobs/next') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['agent:sync'],
            ['config:write'],
            ['server:control'],
          ]);
          if (!platformAuth) return true;
          const result = await claimNextServerConfigJob?.({
            tenantId: requiredString(urlObj.searchParams.get('tenantId')) || platformAuth.tenant?.id || null,
            serverId: requiredString(urlObj.searchParams.get('serverId')),
            runtimeKey: requiredString(urlObj.searchParams.get('runtimeKey')),
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-job-claim-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: result,
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/server-config/jobs/result') {
          const platformAuth = await ensurePlatformApiKeyAny(req, res, [
            ['agent:sync'],
            ['config:write'],
            ['server:control'],
          ]);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          const result = await completeServerConfigJob?.({
            tenantId: requiredString(body, 'tenantId') || platformAuth.tenant?.id || null,
            serverId: requiredString(body, 'serverId'),
            runtimeKey: requiredString(body, 'runtimeKey'),
            jobId: requiredString(body, 'jobId'),
            status: requiredString(body, 'status'),
            result: body.result,
            error: requiredString(body, 'error'),
            backups: body.backups,
            snapshot: body.snapshot,
          }, 'platform-api');
          if (!result?.ok) {
            sendJson(res, 400, { ok: false, error: result?.reason || 'server-config-job-result-failed' });
            return true;
          }
          sendJson(res, 200, {
            ok: true,
            data: result,
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/delivery/reconcile') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['delivery:reconcile']);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          sendJson(res, 200, {
            ok: true,
            data: await reconcileDeliveryState({
              tenantId: platformAuth.tenant?.id,
              windowMs: body.windowMs,
              pendingOverdueMs: body.pendingOverdueMs,
            }),
          });
          return true;
        }

        if (req.method === 'POST' && pathname === '/platform/api/v1/webhooks/test') {
          const platformAuth = await ensurePlatformApiKey(req, res, ['webhook:write']);
          if (!platformAuth) return true;
          const body = await readJsonBody(req);
          sendJson(res, 200, {
            ok: true,
            data: {
              tenantId: platformAuth.tenant?.id || null,
              eventType: requiredString(body.eventType) || 'platform.admin.test',
              results: await dispatchPlatformWebhookEvent(
                requiredString(body.eventType) || 'platform.admin.test',
                body.payload && typeof body.payload === 'object'
                  ? body.payload
                  : {
                    source: 'platform-api',
                    triggeredAt: new Date().toISOString(),
                  },
                { tenantId: platformAuth.tenant?.id || null },
              ),
            },
          });
          return true;
        }

        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      } catch (error) {
        sendJson(res, Number(error?.statusCode || 500), {
          ok: false,
          error:
            Number(error?.statusCode || 500) >= 500
              ? 'Internal platform API error'
              : String(error?.message || 'Bad request'),
        });
        return true;
      }
    }

    if (req.method === 'GET' && pathname === '/admin/auth/discord/start') {
      if (!ssoDiscordActive) {
        sendText(res, 404, 'SSO is disabled');
        return true;
      }
      cleanupDiscordOauthStates();
      const state = crypto.randomBytes(18).toString('hex');
      setDiscordOauthState(state, {
        createdAt: Date.now(),
      });
      const authorizeUrl = buildDiscordAuthorizeUrl({
        host,
        port,
        state,
      });
      res.writeHead(302, { Location: authorizeUrl });
      res.end();
      return true;
    }

    if (req.method === 'GET' && pathname === '/admin/auth/discord/callback') {
      if (!ssoDiscordActive) {
        sendText(res, 404, 'SSO is disabled');
        return true;
      }
      try {
        cleanupDiscordOauthStates();
        const code = String(urlObj.searchParams.get('code') || '').trim();
        const state = String(urlObj.searchParams.get('state') || '').trim();
        const errorText = String(urlObj.searchParams.get('error') || '').trim();
        if (errorText) {
          recordAdminSecuritySignal('sso-failed', {
            severity: 'warn',
            actor: 'discord-sso',
            authMethod: 'discord-sso',
            ip: getClientIp(req),
            path: pathname,
            reason: 'discord-authorization-denied',
            detail: 'Discord SSO authorization was denied',
            notify: true,
          });
          res.writeHead(302, {
            Location: `/admin/login?error=${encodeURIComponent('Discord authorization denied')}`,
          });
          res.end();
          return true;
        }
        const hasValidState = state && hasDiscordOauthState(state);
        if (!code || !state || !hasValidState) {
          recordAdminSecuritySignal('sso-failed', {
            severity: 'warn',
            actor: 'discord-sso',
            authMethod: 'discord-sso',
            ip: getClientIp(req),
            path: pathname,
            reason: 'invalid-sso-state',
            detail: 'Discord SSO callback failed validation',
            notify: true,
          });
          res.writeHead(302, {
            Location: `/admin/login?error=${encodeURIComponent('Invalid SSO state')}`,
          });
          res.end();
          return true;
        }
        deleteDiscordOauthState(state);

        const redirectUri = getDiscordRedirectUri(host, port);
        const tokenResult = await exchangeDiscordOauthCode(code, redirectUri);
        const profile = await fetchDiscordProfile(tokenResult.access_token);
        let resolvedRole = ssoDiscordDefaultRole;
        if (ssoDiscordGuildId) {
          const member = await fetchDiscordGuildMember(
            tokenResult.access_token,
            ssoDiscordGuildId,
          );
          const guildRoles = await listDiscordGuildRolesFromClient(client, ssoDiscordGuildId);
          resolvedRole = resolveMappedMemberRole(
            member?.roles || [],
            guildRoles,
            getAdminSsoRoleMappingSummary(process.env),
          );
        }

        const username = profile.username && profile.discriminator
          ? `${profile.username}#${profile.discriminator}`
          : String(profile.username || profile.id);
        req.__pendingAdminTenantId = null;
        const sessionId = createSession(username, resolvedRole, 'discord-sso', req);
        recordAdminSecuritySignal('sso-succeeded', {
          actor: username,
          targetUser: username,
          role: resolvedRole,
          authMethod: 'discord-sso',
          sessionId,
          ip: getClientIp(req),
          path: pathname,
          detail: 'Discord SSO login succeeded',
        });
        res.writeHead(302, {
          Location: '/admin',
          'Set-Cookie': buildSessionCookie(sessionId, req),
        });
        res.end();
        return true;
      } catch (error) {
        recordAdminSecuritySignal('sso-failed', {
          severity: 'warn',
          actor: 'discord-sso',
          authMethod: 'discord-sso',
          ip: getClientIp(req),
          path: pathname,
          reason: String(error?.message || 'discord-sso-failed'),
          detail: 'Discord SSO callback failed unexpectedly',
          notify: true,
        });
        res.writeHead(302, {
          Location: `/admin/login?error=${encodeURIComponent('Discord SSO failed')}`,
        });
        res.end();
        return true;
      }
    }

    return false;
  };
}

module.exports = {
  createAdminPublicRoutes,
};
