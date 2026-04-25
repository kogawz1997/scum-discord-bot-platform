'use strict';

const {
  assertControlPlaneRegistryPersistenceReady,
} = require('../data/repositories/controlPlaneRegistryRepository');

function trimText(value, maxLen = 320) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function isTruthy(value) {
  const normalized = trimText(value, 32).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function isTestRuntime(env = process.env) {
  if (String(env.NODE_ENV || '').trim().toLowerCase() === 'test') {
    return true;
  }
  return Array.isArray(process.execArgv)
    && process.execArgv.some((entry) => String(entry || '').startsWith('--test'));
}

function assertControlPlaneRuntimeReadiness(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const requireDb = options.requireDb === true
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
    || isTruthy(env.PERSIST_REQUIRE_DB);

  if (!requireDb || isTestRuntime(env)) {
    return {
      ok: true,
      skipped: true,
      requireDb,
    };
  }

  return assertControlPlaneRegistryPersistenceReady({
    requireDb: true,
  });
}

module.exports = {
  assertControlPlaneRuntimeReadiness,
};
