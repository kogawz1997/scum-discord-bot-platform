/**
 * Admin auth/session mutation routes.
 */

function createAdminAuthPostRoutes(deps) {
  const {
    sendJson,
    requiredString,
    getLoginRateLimitState,
    recordAdminSecuritySignal,
    recordLoginAttempt,
    getUserByCredentials,
    adminWeb2faActive,
    adminWeb2faSecret,
    adminWeb2faWindowSteps,
    verifyTotpCode,
    createSession,
    sessionTtlMs,
    buildSessionCookie,
    getSessionId,
    invalidateSession,
    revokeSessionsForUser,
    buildClearSessionCookie,
  } = deps;

  return async function handleAdminAuthPostRoute(context) {
    const {
      req,
      pathname,
      body,
      res,
      auth,
    } = context;

    if (pathname === '/admin/api/login') {
      const rateLimit = getLoginRateLimitState(req);
      if (rateLimit.limited) {
        recordAdminSecuritySignal('login-rate-limited', {
          severity: 'warn',
          actor: String(req?.__pendingAdminUser || '').trim() || 'unknown',
          targetUser: String(req?.__pendingAdminUser || '').trim() || 'unknown',
          authMethod: 'password',
          ip: rateLimit.ip,
          path: pathname,
          reason: 'too-many-attempts',
          detail: 'Admin login was rate limited',
          notify: true,
        });
        const retryAfterSec = Math.max(
          1,
          Math.ceil(rateLimit.retryAfterMs / 1000),
        );
        sendJson(
          res,
          429,
          {
            ok: false,
            error: `Too many login attempts. Please wait ${retryAfterSec}s and try again.`,
          },
          {
            'Retry-After': String(retryAfterSec),
          },
        );
        return true;
      }

      const username = requiredString(body, 'username');
      const password = requiredString(body, 'password');
      req.__pendingAdminUser = username || 'unknown';
      req.__pendingAdminAuthMethod = 'password';
      req.__pendingAdminTenantId = null;
      if (!username || !password) {
        req.__pendingAdminFailureReason = 'invalid-payload';
        sendJson(res, 400, { ok: false, error: 'Invalid request payload' });
        return true;
      }

      const user = await getUserByCredentials(username, password);
      if (!user) {
        req.__pendingAdminFailureReason = 'invalid-credentials';
        recordLoginAttempt(req, false);
        sendJson(res, 401, { ok: false, error: 'Invalid username or password' });
        return true;
      }

      if (adminWeb2faActive) {
        const otp = requiredString(body, 'otp');
        if (!otp) {
          req.__pendingAdminFailureReason = 'otp-required';
          recordLoginAttempt(req, false);
          sendJson(res, 401, {
            ok: false,
            error: 'OTP required',
            requiresOtp: true,
          });
          return true;
        }
        if (!verifyTotpCode(adminWeb2faSecret, otp, adminWeb2faWindowSteps)) {
          req.__pendingAdminFailureReason = 'invalid-2fa-code';
          recordLoginAttempt(req, false);
          sendJson(res, 401, { ok: false, error: 'Invalid 2FA code' });
          return true;
        }
      }

      req.__pendingAdminUser = user.username;
      req.__pendingAdminAuthMethod = user.authMethod;
      req.__pendingAdminTenantId = user.tenantId || null;
      recordLoginAttempt(req, true);
      const sessionId = createSession(user.username, user.role, user.authMethod, req);
      sendJson(
        res,
        200,
        {
          ok: true,
          data: {
            user: user.username,
            role: user.role,
            tenantId: user.tenantId || null,
            sessionTtlHours: Math.round(sessionTtlMs / (60 * 60 * 1000)),
          },
        },
        {
          'Set-Cookie': buildSessionCookie(sessionId, req),
        },
      );
      return true;
    }

    if (pathname === '/admin/api/logout') {
      const sessionId = getSessionId(req);
      invalidateSession(sessionId, {
        actor: auth?.user || 'unknown',
        reason: 'logout',
      });
      sendJson(
        res,
        200,
        { ok: true, data: { loggedOut: true } },
        { 'Set-Cookie': buildClearSessionCookie(req) },
      );
      return true;
    }

    if (pathname !== '/admin/api/auth/session/revoke') {
      return false;
    }

    const reason = requiredString(body, 'reason') || 'manual-revoke';
    const sessionId = requiredString(body, 'sessionId');
    const targetUser = requiredString(body, 'targetUser');
    const revokeCurrent = body?.current === true || (!sessionId && !targetUser);

    if (sessionId) {
      const revoked = invalidateSession(sessionId, {
        actor: auth?.user || 'unknown',
        reason,
      });
      if (!revoked) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      sendJson(
        res,
        200,
        { ok: true, data: { revokedCount: 1, sessions: [revoked] } },
        sessionId === auth?.sessionId ? { 'Set-Cookie': buildClearSessionCookie(req) } : {},
      );
      return true;
    }

    if (targetUser) {
      const revoked = revokeSessionsForUser(targetUser, {
        actor: auth?.user || 'unknown',
        reason,
      });
      if (revoked.length === 0) {
        sendJson(res, 404, { ok: false, error: 'Resource not found' });
        return true;
      }
      const currentRevoked = revoked.some((entry) => entry.id === auth?.sessionId);
      sendJson(
        res,
        200,
        { ok: true, data: { revokedCount: revoked.length, sessions: revoked } },
        currentRevoked ? { 'Set-Cookie': buildClearSessionCookie(req) } : {},
      );
      return true;
    }

    if (revokeCurrent) {
      const revoked = invalidateSession(auth?.sessionId, {
        actor: auth?.user || 'unknown',
        reason,
      });
      sendJson(
        res,
        200,
        { ok: true, data: { revokedCount: revoked ? 1 : 0, sessions: revoked ? [revoked] : [] } },
        { 'Set-Cookie': buildClearSessionCookie(req) },
      );
      return true;
    }

    return true;
  };
}

module.exports = {
  createAdminAuthPostRoutes,
};
