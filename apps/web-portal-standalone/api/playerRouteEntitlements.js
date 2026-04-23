'use strict';

const {
  buildPlayerProductEntitlements,
  normalizeFeatureAccess,
} = require('../../../src/domain/billing/productEntitlementService');

const PLAYER_SECTION_RULES = {
  home: [],
  stats: ['player_module', 'ranking_module', 'analytics_module'],
  leaderboard: ['ranking_module', 'analytics_module'],
  shop: ['shop_module'],
  orders: ['orders_module'],
  delivery: ['bot_delivery', 'orders_module'],
  events: ['event_module'],
  donations: ['donation_module'],
  profile: [],
  support: ['support_module'],
};

async function loadPlayerFeatureAccess(getTenantFeatureAccess, session) {
  if (typeof getTenantFeatureAccess !== 'function' || !session?.tenantId) {
    return normalizeFeatureAccess({
      tenantId: session?.tenantId || null,
      enabledFeatureKeys: [],
    });
  }
  try {
    const raw = await getTenantFeatureAccess(session.tenantId, {
      allowFallback: true,
    });
    return normalizeFeatureAccess(raw);
  } catch {
    return normalizeFeatureAccess({
      tenantId: session?.tenantId || null,
      enabledFeatureKeys: [],
    });
  }
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
  const canonical = buildPlayerProductEntitlements(featureAccess);
  const pageSections = {
    home: canonical.sections.home,
    stats: canonical.sections.stats,
    leaderboard: canonical.sections.leaderboard,
    shop: canonical.sections.shop,
    orders: canonical.sections.orders,
    delivery: canonical.sections.delivery,
    events: canonical.sections.events,
    donations: canonical.sections.donations,
    profile: canonical.sections.profile,
    support: canonical.sections.support,
  };
  return {
    ...canonical,
    pages: {
      ...pageSections,
      home: canonical.sections.home,
      commerce: {
        enabled: [
          canonical.sections.shop,
          canonical.sections.orders,
          canonical.sections.delivery,
          canonical.sections.donations,
        ].some((entry) => entry?.enabled),
        requiredFeatures: ['shop_module', 'orders_module', 'bot_delivery', 'donation_module'],
      },
      stats: {
        enabled: [
          canonical.sections.stats,
          canonical.sections.leaderboard,
          canonical.sections.events,
          canonical.sections.support,
        ].some((entry) => entry?.enabled),
        requiredFeatures: ['player_module', 'ranking_module', 'event_module', 'support_module'],
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
      entitlements: buildPlayerProductEntitlements(normalized),
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
