'use strict';

const PLAYER_SECTION_RULES = {
  commerce: ['shop_module', 'orders_module', 'wallet_module', 'bot_delivery'],
  shop: ['shop_module'],
  wallet: ['wallet_module'],
  orders: ['orders_module'],
  stats: ['player_module', 'ranking_module', 'event_module', 'support_module', 'analytics_module'],
  ranking: ['ranking_module', 'analytics_module'],
  events: ['event_module', 'event_auto_reward', 'promo_module'],
  support: ['support_module'],
};

function normalizeFeatureAccess(raw) {
  const enabledFeatureKeys = Array.isArray(raw?.enabledFeatureKeys)
    ? raw.enabledFeatureKeys
      .map((value) => String(value || '').trim())
      .filter(Boolean)
    : [];
  return {
    tenantId: raw?.tenantId || null,
    package: raw?.package || null,
    plan: raw?.plan || null,
    enabledFeatureKeys,
    featureSet: new Set(enabledFeatureKeys),
  };
}

async function loadPlayerFeatureAccess(getTenantFeatureAccess, session) {
  if (typeof getTenantFeatureAccess !== 'function' || !session?.tenantId) {
    return normalizeFeatureAccess({
      tenantId: session?.tenantId || null,
      enabledFeatureKeys: [],
    });
  }
  const raw = await getTenantFeatureAccess(session.tenantId, {
    allowFallback: true,
  });
  return normalizeFeatureAccess(raw);
}

function toFeatureList(requiredFeatures) {
  if (Array.isArray(requiredFeatures)) {
    return requiredFeatures
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }
  const single = String(requiredFeatures || '').trim();
  return single ? [single] : [];
}

function hasFeatureAccess(featureAccess, requiredFeatures) {
  const rules = toFeatureList(requiredFeatures);
  if (!rules.length) return true;
  const normalized = normalizeFeatureAccess(featureAccess);
  return rules.some((key) => normalized.featureSet.has(key));
}

function buildPlayerPortalFeatureAccess(featureAccess) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const sections = Object.fromEntries(
    Object.entries(PLAYER_SECTION_RULES).map(([key, requiredFeatures]) => [
      key,
      {
        enabled: hasFeatureAccess(normalized, requiredFeatures),
        requiredFeatures: [...requiredFeatures],
      },
    ]),
  );

  return {
    tenantId: normalized.tenantId,
    package: normalized.package,
    plan: normalized.plan,
    enabledFeatureKeys: [...normalized.enabledFeatureKeys],
    sections,
    pages: {
      home: {
        enabled: true,
        requiredFeatures: [],
      },
      commerce: {
        enabled: sections.commerce.enabled,
        requiredFeatures: [...PLAYER_SECTION_RULES.commerce],
      },
      stats: {
        enabled: sections.stats.enabled,
        requiredFeatures: [...PLAYER_SECTION_RULES.stats],
      },
    },
  };
}

function sendPlayerFeatureDenied(sendJson, res, featureAccess, requiredFeatures, options = {}) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const rules = toFeatureList(requiredFeatures);
  const message = String(options.message || '').trim()
    || 'This feature is not enabled for the current tenant package.';
  sendJson(res, 403, {
    ok: false,
    error: options.error || 'feature-not-enabled',
    data: {
      message,
      requiredFeatures: rules,
      enabledFeatureKeys: [...normalized.enabledFeatureKeys],
      tenantId: normalized.tenantId,
      package: normalized.package,
    },
  });
  return true;
}

module.exports = {
  buildPlayerPortalFeatureAccess,
  hasFeatureAccess,
  loadPlayerFeatureAccess,
  normalizeFeatureAccess,
  PLAYER_SECTION_RULES,
  sendPlayerFeatureDenied,
};
