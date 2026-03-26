'use strict';

const crypto = require('node:crypto');

function parseCookies(req) {
  const out = {};
  const raw = String(req?.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function createPublicPreviewAuthRuntime(options = {}) {
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
        secureCookie: false,
        sessionCookieDomain: '',
      };
    }
    return {
      secureCookie: options.secureCookie,
      sessionCookieDomain: options.sessionCookieDomain,
    };
  }

  function buildSessionCookie(sessionId, req) {
    const runtime = resolveCookieRuntime(req);
    const parts = [
      `${options.sessionCookieName}=${encodeURIComponent(sessionId)}`,
      'HttpOnly',
      `Path=${options.sessionCookiePath}`,
      `SameSite=${options.sessionCookieSameSite}`,
      `Max-Age=${Math.floor(options.sessionTtlMs / 1000)}`,
    ];
    if (runtime.sessionCookieDomain) parts.push(`Domain=${runtime.sessionCookieDomain}`);
    if (runtime.secureCookie) parts.push('Secure');
    return parts.join('; ');
  }

  function buildClearSessionCookie(req) {
    const runtime = resolveCookieRuntime(req);
    const parts = [
      `${options.sessionCookieName}=`,
      'HttpOnly',
      `Path=${options.sessionCookiePath}`,
      `SameSite=${options.sessionCookieSameSite}`,
      'Max-Age=0',
    ];
    if (runtime.sessionCookieDomain) parts.push(`Domain=${runtime.sessionCookieDomain}`);
    if (runtime.secureCookie) parts.push('Secure');
    return parts.join('; ');
  }

  function createSession(payload) {
    const sessionId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    sessions.set(sessionId, {
      ...payload,
      createdAt: now,
      expiresAt: now + options.sessionTtlMs,
    });
    return sessionId;
  }

  function getSession(req) {
    const cookies = parseCookies(req);
    const sessionId = String(cookies[options.sessionCookieName] || '').trim();
    if (!sessionId) return null;
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
      return null;
    }
    session.expiresAt = Date.now() + options.sessionTtlMs;
    return session;
  }

  function removeSession(req) {
    const cookies = parseCookies(req);
    const sessionId = String(cookies[options.sessionCookieName] || '').trim();
    if (!sessionId) return;
    sessions.delete(sessionId);
  }

  function cleanupRuntimeState() {
    const now = Date.now();
    for (const [sessionId, row] of sessions.entries()) {
      if (!row || row.expiresAt <= now) {
        sessions.delete(sessionId);
      }
    }
  }

  return {
    buildClearSessionCookie,
    buildSessionCookie,
    cleanupRuntimeState,
    createSession,
    getSession,
    removeSession,
  };
}

module.exports = {
  createPublicPreviewAuthRuntime,
};
