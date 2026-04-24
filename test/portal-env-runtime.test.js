'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createPortalEnvRuntime,
} = require('../apps/web-portal-standalone/runtime/portalEnvRuntime');

function buildHelpers(processEnv) {
  return {
    path,
    processEnv,
    asInt(value, fallback, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      const i = Math.trunc(n);
      if (Number.isFinite(min) && i < min) return min;
      if (Number.isFinite(max) && i > max) return max;
      return i;
    },
    envBool(value, fallback = false) {
      const text = String(value || '').trim().toLowerCase();
      if (text === '1' || text === 'true' || text === 'yes' || text === 'on') return true;
      if (text === '0' || text === 'false' || text === 'no' || text === 'off') return false;
      return fallback;
    },
    normalizeCookieDomain(value) {
      return String(value || '').trim() || null;
    },
    normalizeCookiePath(value, fallback = '/') {
      return String(value || fallback).trim() || fallback;
    },
    normalizeMode(value) {
      const text = String(value || 'player').trim().toLowerCase();
      return text === 'admin' ? 'admin' : 'player';
    },
    normalizeSameSite(value) {
      const text = String(value || 'lax').trim().toLowerCase();
      if (text === 'strict' || text === 'none') return text;
      return 'lax';
    },
  };
}

test('portal env runtime requires explicit session secret in production', () => {
  assert.throws(
    () => createPortalEnvRuntime(buildHelpers({
      NODE_ENV: 'production',
      WEB_PORTAL_BASE_URL: 'https://portal.example.com',
    })),
    /WEB_PORTAL_SESSION_SECRET must be set/,
  );
});

test('portal env runtime rejects short session secret in production', () => {
  assert.throws(
    () => createPortalEnvRuntime(buildHelpers({
      NODE_ENV: 'production',
      WEB_PORTAL_BASE_URL: 'https://portal.example.com',
      WEB_PORTAL_SESSION_SECRET: 'short',
    })),
    /at least 32 characters/,
  );
});

test('portal env runtime accepts adequate session secret in production', () => {
  const secret = 'a'.repeat(32);
  const settings = createPortalEnvRuntime(buildHelpers({
    NODE_ENV: 'production',
    WEB_PORTAL_BASE_URL: 'https://portal.example.com',
    WEB_PORTAL_SESSION_SECRET: secret,
  }));
  assert.equal(settings.sessionSecret, secret);
});

test('portal env runtime allows fallback session secret in development', () => {
  const settings = createPortalEnvRuntime(buildHelpers({
    NODE_ENV: 'development',
    WEB_PORTAL_BASE_URL: 'http://127.0.0.1:3300',
  }));
  assert.ok(settings.sessionSecret, 'session secret should be derived in dev');
});
