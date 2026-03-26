'use strict';

const crypto = require('node:crypto');

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
    createSession,
    buildSessionCookie,
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

  function buildPlayerPortalUrl(req, urlObj, pathname) {
    const requestHost = String(req?.headers?.host || '').trim();
    const requestHostname = extractHostname(requestHost);
    const search = String(urlObj?.search || '');
    if (isLoopbackHostname(requestHostname)) {
      const localHost = requestHostname || '127.0.0.1';
      const localPort = String(process.env.WEB_PORTAL_PORT || '3300').trim() || '3300';
      return `http://${localHost}:${localPort}${pathname}${search}`;
    }

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
      auth: '/owner#security',
      platform: '/owner#fleet',
      metrics: '/owner#observability',
      control: '/owner#control',
      config: '/owner#control',
      danger: '/owner#recovery',
      delivery: '/owner#observability',
      economy: '/owner#audit',
      players: '/owner#fleet',
      community: '/owner#fleet',
      moderation: '/owner#fleet',
    };
    const tenantTabTargets = {
      auth: '/tenant#audit',
      platform: '/tenant#plan-integrations',
      metrics: '/tenant#insights',
      control: '/tenant#config',
      config: '/tenant#config',
      danger: '/tenant#actions',
      delivery: '/tenant#commerce',
      economy: '/tenant#commerce',
      players: '/tenant#players',
      community: '/tenant#support-tools',
      moderation: '/tenant#players',
    };
    const tabTargets = isTenantScoped ? tenantTabTargets : ownerTabTargets;
    const target = tabTargets[tab];
    if (target) return target;
    return isTenantScoped ? '/tenant' : '/owner';
  }

  function buildAdminLoginRoute(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    if (raw === '/owner' || raw === '/owner/' || raw === '/owner/login' || raw === '/owner/login/') {
      return '/owner/login';
    }
    if (raw === '/tenant' || raw === '/tenant/' || raw === '/tenant/login' || raw === '/tenant/login/') {
      return '/tenant/login';
    }
    return '/admin/login';
  }

  function getRequestedSurface(pathname) {
    const raw = String(pathname || '').trim().toLowerCase();
    if (raw.startsWith('/owner')) return 'owner';
    if (raw.startsWith('/tenant')) return 'tenant';
    return 'admin';
  }

  function isOwnerAuth(auth) {
    return String(auth?.role || '').trim().toLowerCase() === 'owner';
  }

  function canAccessTenantSurface(auth) {
    return isOwnerAuth(auth) || Boolean(auth?.tenantId);
  }

  function getDefaultSurfaceTarget(auth) {
    if (isOwnerAuth(auth)) return '/owner';
    if (auth?.tenantId) return '/tenant';
    return '/admin/login';
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
      if (isAuthorized(req, urlObj)) {
        const auth = getAuthContext(req, urlObj);
        const requestedSurface = getRequestedSurface(pathname);
        const canAccessRequestedSurface = (
          requestedSurface === 'admin'
          || (requestedSurface === 'owner' && isOwnerAuth(auth))
          || (requestedSurface === 'tenant' && canAccessTenantSurface(auth))
        );
        if (canAccessRequestedSurface) {
          const target = requestedSurface === 'owner'
            ? '/owner'
            : requestedSurface === 'tenant'
              ? '/tenant'
              : getDefaultSurfaceTarget(auth);
          res.writeHead(302, { Location: target });
          res.end();
          return true;
        }
        if (requestedSurface === 'owner') {
          res.writeHead(302, { Location: '/tenant' });
          res.end();
          return true;
        }
      }
      sendHtml(res, 200, getLoginHtml());
      return true;
    }

    if (req.method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
      if (!isAuthorized(req, urlObj)) {
        res.writeHead(302, { Location: '/admin/login' });
        res.end();
        return true;
      }
      const auth = getAuthContext(req, urlObj);
      const target = getDefaultSurfaceTarget(auth);
      res.writeHead(302, { Location: target });
      res.end();
      return true;
    }

    if (req.method === 'GET' && (pathname === '/admin/legacy' || pathname === '/admin/legacy/')) {
      if (!isAuthorized(req, urlObj)) {
        res.writeHead(302, { Location: '/admin/login' });
        res.end();
        return true;
      }
      const auth = getAuthContext(req, urlObj);
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

    if (req.method === 'GET' && (pathname === '/owner' || pathname === '/owner/')) {
      if (!isAuthorized(req, urlObj)) {
        res.writeHead(302, { Location: buildAdminLoginRoute(pathname) });
        res.end();
        return true;
      }
      const auth = getAuthContext(req, urlObj);
      if (!isOwnerAuth(auth)) {
        res.writeHead(302, { Location: '/owner/login?switch=1' });
        res.end();
        return true;
      }
      sendHtml(res, 200, getOwnerConsoleHtml());
      return true;
    }

    if (req.method === 'GET' && (pathname === '/tenant' || pathname === '/tenant/')) {
      if (!isAuthorized(req, urlObj)) {
        res.writeHead(302, { Location: buildAdminLoginRoute(pathname) });
        res.end();
        return true;
      }
      const auth = getAuthContext(req, urlObj);
      if (!canAccessTenantSurface(auth)) {
        res.writeHead(302, { Location: '/tenant/login?switch=1' });
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
      sendJson(res, 200, {
        ok: true,
        data: {
          packages: typeof getPackageCatalog === 'function' ? getPackageCatalog() : [],
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
          const result = await activatePlatformAgent?.({
            setupToken: requiredString(body, 'setupToken'),
            setup_token: requiredString(body, 'setup_token'),
            machineFingerprint: requiredString(body, 'machineFingerprint'),
            machine_fingerprint: requiredString(body, 'machine_fingerprint'),
            runtimeKey: requiredString(body, 'runtimeKey'),
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
          'Set-Cookie': buildSessionCookie(sessionId),
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
