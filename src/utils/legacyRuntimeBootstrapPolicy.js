'use strict';

function trimText(value, maxLen = 64) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function parseExplicitBootstrapValue(value) {
  const normalized = trimText(value, 32).toLowerCase();
  if (!normalized) {
    return Object.freeze({
      explicit: false,
      normalized: '',
      value: null,
    });
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return Object.freeze({
      explicit: true,
      normalized,
      value: true,
    });
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return Object.freeze({
      explicit: true,
      normalized,
      value: false,
    });
  }
  return Object.freeze({
    explicit: false,
    normalized,
    value: null,
  });
}

function resolveLegacyRuntimeBootstrapPolicy(options = {}) {
  const {
    env = process.env,
    envName = '',
    runtime = null,
    prismaClientLike = false,
    policy = 'legacy-runtime-bootstrap',
  } = options;

  const explicit = parseExplicitBootstrapValue(envName ? env?.[envName] : '');
  const nodeEnv = trimText(env?.NODE_ENV, 32).toLowerCase();
  const details = {
    policy,
    env: envName || null,
    explicit: explicit.explicit,
    explicitValue: explicit.explicit ? explicit.normalized : null,
    nodeEnv: nodeEnv || null,
    engine: trimText(runtime?.engine, 32).toLowerCase() || null,
    provider: trimText(runtime?.provider, 32).toLowerCase() || null,
    isServerEngine: runtime?.isServerEngine === true,
    prismaClientLike: prismaClientLike === true,
  };

  if (explicit.explicit) {
    return Object.freeze({
      ...details,
      allowed: explicit.value === true,
      reason: explicit.value === true ? 'explicit-opt-in' : 'explicit-opt-out',
      source: 'env',
    });
  }

  if (prismaClientLike) {
    return Object.freeze({
      ...details,
      allowed: false,
      reason: 'prisma-client-runtime',
      source: 'default',
    });
  }

  if (nodeEnv === 'production') {
    return Object.freeze({
      ...details,
      allowed: false,
      reason: 'production-default-deny',
      source: 'default',
    });
  }

  return Object.freeze({
    ...details,
    allowed: true,
    reason: 'non-production-compatibility',
    source: 'default',
  });
}

module.exports = {
  parseExplicitBootstrapValue,
  resolveLegacyRuntimeBootstrapPolicy,
};
