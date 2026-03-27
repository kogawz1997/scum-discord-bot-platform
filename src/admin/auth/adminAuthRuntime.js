'use strict';

const crypto = require('node:crypto');

/**
 * Session, token, and step-up auth helpers for the admin web runtime.
 * Keep them injectable so auth behavior can be reasoned about without the full server file.
 */

function createAdminAuthRuntime(options = {}) {
  const sessions = options.sessions;

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

  function resolveCookieRuntime(req) {
    const requestHost = extractHostname(req?.headers?.host || '');
    if (isLoopbackHostname(requestHost)) {
      return {
        sessionCookieDomain: '',
        sessionSecureCookie: false,
      };
    }
    return {
      sessionCookieDomain: options.sessionCookieDomain,
      sessionSecureCookie: options.sessionSecureCookie,
    };
  }

  function hashText(value) {
    return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
  }

  function getUserAgentHash(req) {
    if (!options.sessionBindUserAgent) return null;
    return hashText(String(req?.headers?.['user-agent'] || '').trim());
  }

  function parseCookies(req) {
    const cookies = {};
    const raw = String(req?.headers?.cookie || '');
    for (const part of raw.split(';')) {
      const [key, ...rest] = part.split('=');
      const name = String(key || '').trim();
      if (!name) continue;
      cookies[name] = decodeURIComponent(rest.join('=').trim());
    }
    return cookies;
  }

  function buildSessionView(sessionId, session = {}, extra = {}) {
    return {
      id: String(sessionId || '').trim(),
      user: String(session.user || '').trim() || null,
      role: options.normalizeRole(session.role || 'mod'),
      tenantId: String(session.tenantId || '').trim() || null,
      authMethod: String(session.authMethod || 'password').trim() || 'password',
      createdAt: Number.isFinite(session.createdAt) ? new Date(session.createdAt).toISOString() : null,
      lastSeenAt: Number.isFinite(session.lastSeenAt) ? new Date(session.lastSeenAt).toISOString() : null,
      expiresAt: Number.isFinite(session.expiresAt) ? new Date(session.expiresAt).toISOString() : null,
      stepUpVerifiedAt:
        Number.isFinite(session.stepUpVerifiedAt)
          ? new Date(session.stepUpVerifiedAt).toISOString()
          : null,
      stepUpActive:
        Number.isFinite(session.stepUpVerifiedAt)
        && session.stepUpVerifiedAt + options.adminWebStepUpTtlMs > Date.now(),
      ip: String(session.ip || '').trim() || null,
      authSource: String(session.authSource || '').trim() || null,
      current: extra.current === true,
    };
  }

  function invalidateSession(sessionId, meta = {}) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) return null;
    const existing = sessions.get(normalizedSessionId);
    if (!existing) return null;
    sessions.delete(normalizedSessionId);
    const reason = String(meta.reason || 'manual-revoke').trim() || 'manual-revoke';
    options.recordAdminSecuritySignal('session-revoked', {
      actor: meta.actor || existing.user || 'system',
      targetUser: existing.user || null,
      role: existing.role || null,
      authMethod: existing.authMethod || null,
      sessionId: normalizedSessionId,
      ip: existing.ip || null,
      reason,
      detail: 'Admin session revoked',
      notify: reason !== 'logout',
    });
    return buildSessionView(normalizedSessionId, existing);
  }

  function cleanupSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
      if (!session) {
        sessions.delete(sessionId);
        continue;
      }
      if (session.expiresAt <= now) {
        invalidateSession(sessionId, {
          actor: session.user || 'system',
          reason: 'session-expired',
        });
        continue;
      }
      if (session.lastSeenAt && session.lastSeenAt + options.sessionIdleTimeoutMs <= now) {
        invalidateSession(sessionId, {
          actor: session.user || 'system',
          reason: 'session-idle-timeout',
        });
      }
    }
  }

  function listAdminSessions(extra = {}) {
    cleanupSessions();
    const currentSessionId = String(extra.currentSessionId || '').trim();
    return Array.from(sessions.entries())
      .map(([sessionId, session]) => buildSessionView(sessionId, session, {
        current: sessionId === currentSessionId,
      }))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }

  function revokeSessionsForUser(username, meta = {}) {
    const targetUser = String(username || '').trim();
    if (!targetUser) return [];
    const revoked = [];
    for (const [sessionId, session] of sessions.entries()) {
      if (String(session?.user || '').trim() !== targetUser) continue;
      const removed = invalidateSession(sessionId, {
        ...meta,
        reason: meta.reason || 'user-revoke',
        actor: meta.actor || targetUser,
      });
      if (removed) revoked.push(removed);
    }
    return revoked;
  }

  function createSession(user, role = 'mod', authMethod = 'password', req = null) {
    cleanupSessions();
    const sessionId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const username = String(user || options.defaultUser || '').trim() || options.defaultUser;
    const userSessions = Array.from(sessions.entries())
      .filter(([, session]) => session?.user === username)
      .sort((left, right) => Number((left[1]?.createdAt || 0) - (right[1]?.createdAt || 0)));
    while (userSessions.length >= options.sessionMaxPerUser) {
      const [oldestSessionId] = userSessions.shift();
      invalidateSession(oldestSessionId, {
        actor: username,
        reason: 'session-max-per-user',
      });
    }
    sessions.set(sessionId, {
      user: username,
      role: options.normalizeRole(role),
      tenantId: String(req?.__pendingAdminTenantId || '').trim() || null,
      authMethod: String(authMethod || 'password'),
      authSource: String(authMethod || 'password'),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + options.sessionTtlMs,
      stepUpVerifiedAt: null,
      userAgentHash: getUserAgentHash(req),
      ip: req ? options.getClientIp(req) : null,
    });
    options.recordAdminSecuritySignal('session-created', {
      actor: username,
      targetUser: username,
      role: options.normalizeRole(role),
      authMethod: String(authMethod || 'password'),
      sessionId,
      ip: req ? options.getClientIp(req) : null,
      reason: 'login',
      detail: 'Admin session created',
    });
    return sessionId;
  }

  function touchStepUpVerification(sessionId) {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) return null;
    const session = sessions.get(normalizedSessionId);
    if (!session) return null;
    session.stepUpVerifiedAt = Date.now();
    return buildSessionView(normalizedSessionId, session);
  }

  function getSessionId(req) {
    const cookies = parseCookies(req);
    return String(cookies[options.sessionCookieName] || '').trim();
  }

  function getSessionFromRequest(req) {
    const sessionId = getSessionId(req);
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt <= now) {
      invalidateSession(sessionId, {
        actor: session.user || 'system',
        reason: 'session-expired',
      });
      return null;
    }
    if (session.lastSeenAt && session.lastSeenAt + options.sessionIdleTimeoutMs <= now) {
      invalidateSession(sessionId, {
        actor: session.user || 'system',
        reason: 'session-idle-timeout',
      });
      return null;
    }
    if (
      options.sessionBindUserAgent
      && session.userAgentHash
      && !options.secureEqual(session.userAgentHash, getUserAgentHash(req))
    ) {
      invalidateSession(sessionId, {
        actor: session.user || 'system',
        reason: 'session-user-agent-mismatch',
      });
      options.recordAdminSecuritySignal('session-user-agent-mismatch', {
        severity: 'warn',
        actor: session.user || 'unknown',
        targetUser: session.user || 'unknown',
        role: session.role || null,
        authMethod: session.authMethod || null,
        sessionId,
        ip: options.getClientIp(req),
        path: String(req?.url || '').trim() || null,
        reason: 'session-user-agent-mismatch',
        detail: 'Admin session was revoked due to user-agent mismatch',
        notify: true,
      });
      return null;
    }
    session.lastSeenAt = now;
    session.expiresAt = now + options.sessionTtlMs;
    return session;
  }

  function hasValidSession(req) {
    return getSessionFromRequest(req) != null;
  }

  function buildSessionCookie(sessionId, req = null) {
    const runtime = resolveCookieRuntime(req);
    const parts = [
      `${options.sessionCookieName}=${encodeURIComponent(sessionId)}`,
      'HttpOnly',
      `Path=${options.sessionCookiePath}`,
      `SameSite=${options.sessionCookieSameSite}`,
      `Max-Age=${Math.floor(options.sessionTtlMs / 1000)}`,
    ];
    if (runtime.sessionCookieDomain) parts.push(`Domain=${runtime.sessionCookieDomain}`);
    if (runtime.sessionSecureCookie) parts.push('Secure');
    return parts.join('; ');
  }

  function buildClearSessionCookie(req = null) {
    const runtime = resolveCookieRuntime(req);
    const parts = [
      `${options.sessionCookieName}=`,
      'HttpOnly',
      `Path=${options.sessionCookiePath}`,
      `SameSite=${options.sessionCookieSameSite}`,
      'Max-Age=0',
    ];
    if (runtime.sessionCookieDomain) parts.push(`Domain=${runtime.sessionCookieDomain}`);
    if (runtime.sessionSecureCookie) parts.push('Secure');
    return parts.join('; ');
  }

  function getRequestToken(req, urlObj) {
    const tokenHeader = String(req?.headers?.['x-admin-token'] || '').trim();
    if (tokenHeader) return tokenHeader;

    const auth = String(req?.headers?.authorization || '').trim();
    if (/^bearer\s+/i.test(auth)) {
      return auth.replace(/^bearer\s+/i, '').trim();
    }

    const tokenQuery = String(urlObj?.searchParams?.get('token') || '').trim();
    if (tokenQuery && options.adminWebAllowTokenQuery) return tokenQuery;
    return '';
  }

  function getAuthContext(req, urlObj) {
    const session = getSessionFromRequest(req);
    if (session) {
      const sessionId = getSessionId(req);
      const auth = {
        mode: 'session',
        sessionId,
        user: session.user || options.defaultUser,
        role: options.normalizeRole(session.role || 'mod'),
        tenantId: String(session.tenantId || '').trim() || null,
        authMethod: session.authMethod || 'password',
        stepUpVerifiedAt: session.stepUpVerifiedAt || null,
      };
      options.setRequestMeta(req, {
        authMode: auth.mode,
        sessionId: auth.sessionId,
        user: auth.user,
        role: auth.role,
        tenantId: auth.tenantId,
      });
      return auth;
    }

    const requestToken = getRequestToken(req, urlObj);
    const expected = options.getAdminToken();
    if (requestToken !== '' && options.secureEqual(requestToken, expected)) {
      const auth = {
        mode: 'token',
        user: 'token',
        role: options.adminWebTokenRole,
        authMethod: 'token',
        sessionId: null,
        stepUpVerifiedAt: null,
      };
      options.setRequestMeta(req, {
        authMode: auth.mode,
        user: auth.user,
        role: auth.role,
        tenantId: null,
      });
      return auth;
    }
    return null;
  }

  function isAuthorized(req, urlObj) {
    return getAuthContext(req, urlObj) != null;
  }

  function hasFreshStepUp(auth = {}) {
    const verifiedAt = Number(auth.stepUpVerifiedAt || 0);
    if (!Number.isFinite(verifiedAt) || verifiedAt <= 0) return false;
    return verifiedAt + options.adminWebStepUpTtlMs > Date.now();
  }

  function requiresStepUpForPermission(permission = null, auth = null) {
    if (!permission || permission.stepUp !== true) return false;
    if (!options.adminWebStepUpEnabled || !options.adminWeb2faActive) return false;
    if (!auth || auth.mode !== 'session') return false;
    return !hasFreshStepUp(auth);
  }

  function ensureStepUpAuth(req, res, auth, body = {}, permission = null) {
    if (!permission || permission.stepUp !== true) return auth;
    if (auth?.mode === 'token') {
      if (options.adminWebAllowTokenSensitiveMutations) return auth;
      options.sendJson(res, 403, {
        ok: false,
        error: 'Sensitive admin mutation requires a session login',
        requiresStepUp: true,
        permission: permission.permission,
        data: {
          mode: auth.mode,
          stepUpMode: 'session-only',
        },
      });
      return null;
    }
    if (!requiresStepUpForPermission(permission, auth)) return auth;
    const otp = options.requiredString(body, 'stepUpOtp')
      || String(req?.headers?.['x-admin-step-up-otp'] || '').trim();
    if (!otp) {
      options.sendJson(res, 403, {
        ok: false,
        error: 'Step-up verification required',
        requiresStepUp: true,
        permission: permission.permission,
        data: {
          path: permission.path,
          ttlMinutes: Math.round(options.adminWebStepUpTtlMs / (60 * 1000)),
          reason: 'step-up-otp-required',
        },
      });
      return null;
    }
    if (!options.verifyTotpCode(options.adminWeb2faSecret, otp, options.adminWeb2faWindowSteps)) {
      options.recordAdminSecuritySignal('step-up-failed', {
        severity: 'warn',
        actor: auth?.user || 'unknown',
        targetUser: auth?.user || 'unknown',
        role: auth?.role || null,
        authMethod: auth?.authMethod || null,
        sessionId: auth?.sessionId || null,
        ip: options.getClientIp(req),
        path: permission.path,
        reason: 'invalid-step-up-otp',
        detail: 'Sensitive admin mutation step-up verification failed',
        notify: true,
      });
      options.sendJson(res, 403, {
        ok: false,
        error: 'Invalid step-up 2FA code',
        requiresStepUp: true,
        permission: permission.permission,
        data: {
          path: permission.path,
          ttlMinutes: Math.round(options.adminWebStepUpTtlMs / (60 * 1000)),
          reason: 'invalid-step-up-otp',
        },
      });
      return null;
    }
    const updatedSession = touchStepUpVerification(auth?.sessionId);
    auth.stepUpVerifiedAt = updatedSession?.stepUpVerifiedAt
      ? new Date(updatedSession.stepUpVerifiedAt).getTime()
      : Date.now();
    options.recordAdminSecuritySignal('step-up-succeeded', {
      actor: auth?.user || 'unknown',
      targetUser: auth?.user || 'unknown',
      role: auth?.role || null,
      authMethod: auth?.authMethod || null,
      sessionId: auth?.sessionId || null,
      ip: options.getClientIp(req),
      path: permission.path,
      reason: permission.permission,
      detail: 'Sensitive admin mutation step-up verification succeeded',
    });
    options.setRequestMeta(req, {
      note: `step-up:${permission.permission}`,
    });
    return auth;
  }

  return {
    buildClearSessionCookie,
    buildSessionCookie,
    cleanupSessions,
    createSession,
    ensureStepUpAuth,
    getAuthContext,
    getRequestToken,
    getSessionFromRequest,
    getSessionId,
    hasFreshStepUp,
    hasValidSession,
    invalidateSession,
    isAuthorized,
    listAdminSessions,
    requiresStepUpForPermission,
    revokeSessionsForUser,
    touchStepUpVerification,
  };
}

module.exports = {
  createAdminAuthRuntime,
};
