'use strict';

const crypto = require('node:crypto');
const { URL, URLSearchParams } = require('node:url');

/**
 * Auth and session runtime for the standalone player portal.
 * Keep HTTP and OAuth side-effects here so the main server can focus on routes.
 */

function createPortalAuthRuntime(options = {}) {
  const sessions = options.sessions;
  const oauthStates = options.oauthStates;

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

  function getSession(req) {
    const cookies = parseCookies(req);
    const sessionId = String(cookies[options.sessionCookieName] || '').trim();
    if (!sessionId) return null;

    const row = sessions.get(sessionId);
    if (!row) return null;

    const now = Date.now();
    if (row.expiresAt <= now) {
      sessions.delete(sessionId);
      return null;
    }

    row.expiresAt = now + options.sessionTtlMs;
    return row;
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

    for (const [state, row] of oauthStates.entries()) {
      if (!row || row.expiresAt <= now) {
        oauthStates.delete(state);
      }
    }
  }

  function getBaseOrigin() {
    try {
      return new URL(options.baseUrl).origin;
    } catch {
      return null;
    }
  }

  function getForwardedProto(req) {
    const raw = String(req?.headers?.['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (!raw) return null;
    return raw;
  }

  function getCanonicalRedirectUrl(req) {
    let expected;
    try {
      expected = new URL(options.baseUrl);
    } catch {
      return null;
    }

    const reqHost = String(req?.headers?.host || '').trim().toLowerCase();
    const reqHostname = extractHostname(reqHost);
    if (isLoopbackHostname(reqHostname)) {
      return null;
    }
    const expectedHost = String(expected.host || '').trim().toLowerCase();
    const forwardedProto = getForwardedProto(req);
    const reqProto = forwardedProto || (req?.socket?.encrypted ? 'https' : 'http');
    const expectedProto = String(expected.protocol || 'http:').replace(':', '').toLowerCase();

    const hostMismatch = Boolean(reqHost) && reqHost !== expectedHost;
    const protoMismatch = Boolean(reqProto) && reqProto !== expectedProto;
    if (!hostMismatch && !protoMismatch) return null;

    try {
      return new URL(req?.url || '/', options.baseUrl).toString();
    } catch {
      return null;
    }
  }

  function getRequestOrigin(req) {
    const reqHost = String(req?.headers?.host || '').trim().toLowerCase();
    if (!reqHost) return null;
    const forwardedProto = getForwardedProto(req);
    const reqProto = forwardedProto || (req?.socket?.encrypted ? 'https' : 'http');
    try {
      return new URL(`${reqProto}://${reqHost}`).origin;
    } catch {
      return null;
    }
  }

  function verifyOrigin(req) {
    if (!options.enforceOriginCheck) return true;

    const method = String(req?.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    const expectedOrigin = getBaseOrigin();
    if (!expectedOrigin) return false;
    const requestOrigin = getRequestOrigin(req);
    const requestHost = extractHostname(req?.headers?.host || '');
    const allowedOrigins = new Set([expectedOrigin]);
    if (requestOrigin && isLoopbackHostname(requestHost)) {
      allowedOrigins.add(requestOrigin);
    }

    const originHeader = String(req?.headers?.origin || '').trim();
    if (originHeader && !allowedOrigins.has(originHeader)) return false;

    const referer = String(req?.headers?.referer || '').trim();
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (!allowedOrigins.has(refererOrigin)) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  function startOauthState() {
    cleanupRuntimeState();
    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, {
      createdAt: Date.now(),
      expiresAt: Date.now() + options.oauthStateTtlMs,
    });
    return state;
  }

  function getDiscordRedirectUri() {
    return new URL(options.discordRedirectPath, options.baseUrl).toString();
  }

  function buildDiscordAuthorizeUrl(state) {
    const url = new URL(`${options.discordApiBase}/oauth2/authorize`);
    url.searchParams.set('client_id', options.discordClientId);
    url.searchParams.set('redirect_uri', getDiscordRedirectUri());
    url.searchParams.set('response_type', 'code');

    const scopes = ['identify'];
    if (!options.playerOpenAccess && options.requireGuildMember && options.discordGuildId) {
      scopes.push('guilds.members.read');
    }
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', state);
    return url.toString();
  }

  async function exchangeDiscordCode(code) {
    const body = new URLSearchParams({
      client_id: options.discordClientId,
      client_secret: options.discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getDiscordRedirectUri(),
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${options.discordApiBase}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.access_token) {
        throw new Error(`Discord token exchange failed (${res.status})`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchDiscordProfile(accessToken) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${options.discordApiBase}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) {
        throw new Error('Discord profile fetch failed');
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchDiscordGuildMember(accessToken, guildId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(
        `${options.discordApiBase}/users/@me/guilds/${encodeURIComponent(guildId)}/member`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        throw new Error(`Discord guild membership check failed (${res.status})`);
      }
      return res.json().catch(() => null);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function handleDiscordStart(_req, res) {
    if (!options.discordClientId || !options.discordClientSecret) {
      return options.sendJson(res, 500, {
        ok: false,
        error: 'Discord OAuth env is not configured',
      });
    }

    const state = startOauthState();
    res.writeHead(302, { Location: buildDiscordAuthorizeUrl(state) });
    res.end();
  }

  async function handleDiscordCallback(_req, res, urlObj) {
    try {
      cleanupRuntimeState();

      const state = options.normalizeText(urlObj.searchParams.get('state'));
      const code = options.normalizeText(urlObj.searchParams.get('code'));
      const errorText = options.normalizeText(urlObj.searchParams.get('error'));

      if (errorText) {
        res.writeHead(302, {
          Location: '/player/login?error=Discord%20authorization%20denied',
        });
        return res.end();
      }

      if (!state || !oauthStates.has(state)) {
        res.writeHead(302, {
          Location: '/player/login?error=Invalid%20OAuth%20state',
        });
        return res.end();
      }
      oauthStates.delete(state);

      if (!code) {
        res.writeHead(302, {
          Location: '/player/login?error=Missing%20OAuth%20code',
        });
        return res.end();
      }

      const token = await exchangeDiscordCode(code);
      const profile = await fetchDiscordProfile(token.access_token);

      const discordId = options.normalizeText(profile.id);
      if (!options.isDiscordId(discordId)) {
        throw new Error('Discord profile missing id');
      }

      if (!options.playerOpenAccess) {
        if (
          options.allowedDiscordIds.size > 0
          && !options.allowedDiscordIds.has(discordId)
        ) {
          res.writeHead(302, {
            Location: '/player/login?error=Discord%20account%20not%20allowed',
          });
          return res.end();
        }

        if (options.requireGuildMember && options.discordGuildId) {
          try {
            await fetchDiscordGuildMember(token.access_token, options.discordGuildId);
          } catch (error) {
            options.logger.warn(
              '[web-portal-standalone] guild membership check failed:',
              error.message,
            );
            res.writeHead(302, {
              Location: '/player/login?error=Discord%20guild%20membership%20required',
            });
            return res.end();
          }
        }
      }

      const user = [profile.global_name, profile.username]
        .map((value) => options.normalizeText(value))
        .find(Boolean)
        || discordId;

      const avatarUrl = options.buildDiscordAvatarUrl(profile);
      await options.upsertPlayerAccount({
        discordId,
        username: options.normalizeText(profile.username),
        displayName: options.normalizeText(profile.global_name) || user,
        avatarUrl,
        isActive: true,
      });

      const sessionId = createSession({
        user,
        role: 'player',
        discordId,
        authMethod: 'discord-oauth',
        avatarUrl,
      });

      res.writeHead(302, {
        Location: '/player',
        'Set-Cookie': buildSessionCookie(sessionId, _req),
      });
      res.end();
    } catch (error) {
      options.logger.error('[web-portal-standalone] discord callback failed:', error);
      res.writeHead(302, {
        Location: '/player/login?error=Discord%20login%20failed',
      });
      res.end();
    }
  }

  return {
    buildClearSessionCookie,
    buildSessionCookie,
    cleanupRuntimeState,
    createSession,
    getCanonicalRedirectUrl,
    getSession,
    handleDiscordCallback,
    handleDiscordStart,
    removeSession,
    verifyOrigin,
  };
}

module.exports = {
  createPortalAuthRuntime,
};
