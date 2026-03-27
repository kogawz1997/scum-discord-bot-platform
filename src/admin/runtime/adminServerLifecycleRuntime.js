/**
 * Admin web server lifecycle wiring.
 */

const http = require('node:http');

function createAdminServerLifecycle({
  processEnv,
  asInt,
  getAdminToken,
  buildAllowedOrigins,
  ensureMetricsSeriesTimer,
  startPlatformMonitoring,
  stopPlatformMonitoring,
  startPlatformAutomation,
  stopPlatformAutomation,
  adminLiveBus,
  broadcastLiveUpdate,
  createAdminRequestHandler,
  setRequestMeta,
  deriveRouteGroup,
  getClientIp,
  getRequestOrigin,
  recordAdminRequestLog,
  handleAdminPublicRoute,
  hasValidSession,
  isSafeHttpMethod,
  violatesBrowserOriginPolicy,
  sendJson,
  getAuthContext,
  readJsonBody,
  handleAdminAuthPostRoute,
  shouldBypassRestoreMaintenance,
  isAdminRestoreMaintenanceActive,
  sendRestoreMaintenanceUnavailable,
  handleAdminAuditRoute,
  handleAdminGetRoute,
  getAdminPermissionForPath,
  requiredRoleForPostPath,
  ensureRole,
  ensureStepUpAuth,
  handlePostAction,
  handleMutationAction,
  publishAdminLiveUpdate,
  sendText,
  closeAllLiveStreams,
  stopMetricsSeriesTimer,
  startRuntimeSupervisorMonitor,
  stopRuntimeSupervisorMonitor,
  ensureAdminUsersReady,
  listAdminUsersFromDb,
  hostEnvKey = 'ADMIN_WEB_HOST',
  portEnvKey = 'ADMIN_WEB_PORT',
  sessionSecureCookie,
  sessionCookieName,
  sessionCookiePath,
  sessionCookieSameSite,
  sessionCookieDomain,
  adminWeb2faActive,
  adminWeb2faEnabled,
  ssoDiscordActive,
  ssoDiscordEnabled,
}) {
  let adminServer = null;
  let liveBusBound = false;

  function startAdminWebServer(client) {
    if (adminServer) return adminServer;

    const host = String(processEnv?.[hostEnvKey] || '127.0.0.1').trim() || '127.0.0.1';
    const port = asInt(processEnv?.[portEnvKey], 3200) || 3200;
    const allowedOrigins = buildAllowedOrigins(host, port);
    const token = getAdminToken();

    ensureMetricsSeriesTimer();
    startPlatformMonitoring({ client });
    startPlatformAutomation({ client });

    if (!liveBusBound) {
      adminLiveBus.on('update', (evt) => {
        broadcastLiveUpdate(evt?.type || 'update', evt?.payload || {});
      });
      liveBusBound = true;
    }

    adminServer = http.createServer(createAdminRequestHandler({
      crypto: require('node:crypto'),
      client,
      host,
      port,
      allowedOrigins,
      setRequestMeta,
      deriveRouteGroup,
      getClientIp,
      getRequestOrigin,
      recordAdminRequestLog,
      handleAdminPublicRoute,
      hasValidSession,
      isSafeHttpMethod,
      violatesBrowserOriginPolicy,
      sendJson,
      getAuthContext,
      readJsonBody,
      handleAdminAuthPostRoute,
      shouldBypassRestoreMaintenance,
      isAdminRestoreMaintenanceActive,
      sendRestoreMaintenanceUnavailable,
      handleAdminAuditRoute,
      handleAdminGetRoute,
      getAdminPermissionForPath,
      requiredRoleForPostPath,
      ensureRole,
      ensureStepUpAuth,
      handleMutationAction: handleMutationAction || handlePostAction,
      publishAdminLiveUpdate,
      sendText,
    }));

    adminServer.on('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`[admin-web] port ${port} is already in use`);
        return;
      }
      console.error('[admin-web] เซิร์ฟเวอร์ผิดพลาด', err);
    });

    adminServer.on('close', () => {
      closeAllLiveStreams();
      stopMetricsSeriesTimer();
      stopPlatformMonitoring();
      stopPlatformAutomation();
      stopRuntimeSupervisorMonitor();
      adminServer = null;
    });

    adminServer.listen(port, host, () => {
      console.log(`[admin-web] เปิดใช้งานที่ http://${host}:${port}/admin`);
      startRuntimeSupervisorMonitor();
      ensureAdminUsersReady()
        .then(async () => {
          const users = await listAdminUsersFromDb(50);
          if (String(processEnv?.NODE_ENV || '').trim().toLowerCase() !== 'test') {
            const preview = users
              .slice(0, 5)
              .map((user) => `${user.username}(${user.role})`)
              .join(', ');
            console.log(
              `[admin-web] login users ready: count=${users.length}${preview ? ` sample=${preview}` : ''}${users.length > 5 ? ', ...' : ''}`,
            );
          }
        })
        .catch((error) => {
          console.error('[admin-web] failed to initialize admin users from db', error);
        });
      if ((host !== '127.0.0.1' && host !== 'localhost') && !sessionSecureCookie) {
        console.warn(
          '[admin-web] SESSION cookie is not secure. Set ADMIN_WEB_SECURE_COOKIE=true for HTTPS production.',
        );
      }
      console.log(
        `[admin-web] session cookie: name=${sessionCookieName} path=${sessionCookiePath} sameSite=${sessionCookieSameSite} secure=${sessionSecureCookie}${sessionCookieDomain ? ` domain=${sessionCookieDomain}` : ''}`,
      );
      if (!processEnv?.ADMIN_WEB_PASSWORD) {
        console.log(
          '[admin-web] ยังไม่ได้ตั้งค่า ADMIN_WEB_PASSWORD จึงใช้ ADMIN_WEB_TOKEN (หรือโทเค็นชั่วคราว) เป็นรหัสผ่านล็อกอิน',
        );
      }
      if (!processEnv?.ADMIN_WEB_TOKEN) {
        console.log(`[admin-web] โทเค็น/รหัสผ่านชั่วคราว: ${token}`);
      }
      if (adminWeb2faActive) {
        console.log('[admin-web] 2FA (TOTP) is enabled');
      } else if (adminWeb2faEnabled) {
        console.warn('[admin-web] ADMIN_WEB_2FA_ENABLED=true but ADMIN_WEB_2FA_SECRET is empty');
      }
      if (ssoDiscordActive) {
        console.log(
          `[admin-web] Discord SSO enabled: http://${host}:${port}/admin/auth/discord/start`,
        );
      } else if (ssoDiscordEnabled) {
        console.warn('[admin-web] ADMIN_WEB_SSO_DISCORD_ENABLED=true but client id/secret missing');
      }
    });

    return adminServer;
  }

  return {
    startAdminWebServer,
  };
}

module.exports = {
  createAdminServerLifecycle,
};
