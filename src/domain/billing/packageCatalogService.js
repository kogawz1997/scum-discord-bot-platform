'use strict';

const FEATURE_CATALOG = Object.freeze([
  { key: 'server_hosting', title: 'Server Hosting', category: 'server' },
  { key: 'server_settings', title: 'Server Settings', category: 'server' },
  { key: 'server_status', title: 'Server Status', category: 'server' },
  { key: 'bot_log', title: 'Bot Log', category: 'bot' },
  { key: 'bot_delivery', title: 'Bot Delivery', category: 'bot' },
  { key: 'discord_integration', title: 'Discord Integration', category: 'integration' },
  { key: 'log_dashboard', title: 'Log Dashboard', category: 'ui' },
  { key: 'delivery_dashboard', title: 'Delivery Dashboard', category: 'ui' },
  { key: 'shop_module', title: 'Shop Module', category: 'commerce' },
  { key: 'orders_module', title: 'Orders Module', category: 'commerce' },
  { key: 'player_module', title: 'Player Module', category: 'portal' },
  { key: 'donation_module', title: 'Donation Module', category: 'community' },
  { key: 'event_module', title: 'Event Module', category: 'community' },
  { key: 'event_auto_reward', title: 'Event Auto Reward', category: 'community' },
  { key: 'wallet_module', title: 'Wallet Module', category: 'commerce' },
  { key: 'promo_module', title: 'Promo Module', category: 'commerce' },
  { key: 'ranking_module', title: 'Ranking Module', category: 'community' },
  { key: 'restart_announce_module', title: 'Restart Announce Module', category: 'server' },
  { key: 'support_module', title: 'Support Module', category: 'support' },
  { key: 'staff_roles', title: 'Staff Roles', category: 'security' },
  { key: 'analytics_module', title: 'Analytics Module', category: 'analytics' },
  { key: 'sync_agent', title: 'Sync Agent', category: 'agent' },
  { key: 'execute_agent', title: 'Execute Agent', category: 'agent' },
]);

const FEATURE_KEYS = Object.freeze(FEATURE_CATALOG.map((entry) => entry.key));

const PACKAGE_CATALOG = Object.freeze([
  {
    id: 'BOT_LOG',
    title: 'Bot Log',
    description: 'Discord log sync and basic operational visibility.',
    features: [
      'bot_log',
      'discord_integration',
      'log_dashboard',
      'sync_agent',
      'support_module',
      'analytics_module',
    ],
  },
  {
    id: 'BOT_LOG_DELIVERY',
    title: 'Bot Log + Delivery',
    description: 'Managed delivery plus player-facing commerce and sync.',
    features: [
      'bot_log',
      'bot_delivery',
      'discord_integration',
      'log_dashboard',
      'delivery_dashboard',
      'shop_module',
      'orders_module',
      'player_module',
      'wallet_module',
      'donation_module',
      'support_module',
      'ranking_module',
      'analytics_module',
      'restart_announce_module',
      'sync_agent',
      'execute_agent',
    ],
  },
  {
    id: 'FULL_OPTION',
    title: 'Full Option',
    description: 'Full managed server operations with hosting, settings, and delivery.',
    features: [
      'server_hosting',
      'server_settings',
      'server_status',
      'bot_log',
      'bot_delivery',
      'discord_integration',
      'log_dashboard',
      'delivery_dashboard',
      'shop_module',
      'orders_module',
      'player_module',
      'donation_module',
      'event_module',
      'event_auto_reward',
      'wallet_module',
      'promo_module',
      'ranking_module',
      'restart_announce_module',
      'support_module',
      'staff_roles',
      'analytics_module',
      'sync_agent',
      'execute_agent',
    ],
  },
  {
    id: 'SERVER_ONLY',
    title: 'Server Only',
    description: 'Managed server controls without log/delivery add-ons.',
    features: [
      'server_hosting',
      'server_settings',
      'server_status',
      'sync_agent',
      'restart_announce_module',
      'support_module',
      'analytics_module',
    ],
  },
]);

const PLAN_PACKAGE_ALIASES = Object.freeze({
  'trial-14d': 'BOT_LOG_DELIVERY',
  'platform-starter': 'BOT_LOG_DELIVERY',
  'platform-growth': 'FULL_OPTION',
});

function trimText(value, maxLen = 200) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeFeatureKey(value) {
  const text = trimText(value, 120).toLowerCase();
  return FEATURE_KEYS.includes(text) ? text : '';
}

function sanitizeFeatureFlags(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getFeatureCatalog() {
  return FEATURE_CATALOG.map((entry) => ({ ...entry }));
}

function getFeatureKeys() {
  return [...FEATURE_KEYS];
}

function getPackageCatalog() {
  return PACKAGE_CATALOG.map((entry) => ({
    ...entry,
    features: [...entry.features],
  }));
}

function getPackageById(packageId) {
  const requested = trimText(packageId, 120).toUpperCase();
  if (!requested) return null;
  return getPackageCatalog().find((entry) => entry.id === requested) || null;
}

function resolvePackageForPlan(planId, metadata = null) {
  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const explicitPackageId = trimText(meta.packageId || meta.planPackageId, 120).toUpperCase();
  if (explicitPackageId) {
    return getPackageById(explicitPackageId);
  }
  const requestedPlanId = trimText(planId, 120).toLowerCase();
  if (!requestedPlanId) return null;
  return getPackageById(PLAN_PACKAGE_ALIASES[requestedPlanId] || null);
}

function collectEnabledFeatures(featureFlags = {}) {
  const flags = sanitizeFeatureFlags(featureFlags);
  const enabled = new Set();
  const disabled = new Set();

  const applyKeyValue = (source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    for (const [key, rawValue] of Object.entries(source)) {
      const normalized = normalizeFeatureKey(key);
      if (!normalized) continue;
      if (rawValue === true) enabled.add(normalized);
      if (rawValue === false) disabled.add(normalized);
    }
  };

  const applyArray = (values, target) => {
    for (const entry of Array.isArray(values) ? values : []) {
      const normalized = normalizeFeatureKey(entry);
      if (normalized) target.add(normalized);
    }
  };

  applyKeyValue(flags);
  applyKeyValue(flags.features);
  applyKeyValue(flags.featureToggles);
  applyArray(flags.enabledFeatures, enabled);
  applyArray(flags.disabledFeatures, disabled);

  return {
    enabled: [...enabled],
    disabled: [...disabled],
  };
}

function resolveFeatureAccess(options = {}) {
  const {
    planId,
    packageId,
    featureFlags,
    metadata,
  } = options;

  const resolvedPackage = getPackageById(packageId) || resolvePackageForPlan(planId, metadata) || null;
  const enabled = new Set(resolvedPackage?.features || []);
  const overrides = collectEnabledFeatures(featureFlags);
  for (const key of overrides.enabled) enabled.add(key);
  for (const key of overrides.disabled) enabled.delete(key);

  const catalog = getFeatureCatalog().map((entry) => ({
    ...entry,
    enabled: enabled.has(entry.key),
  }));

  return {
    package: resolvedPackage,
    enabledFeatureKeys: catalog.filter((entry) => entry.enabled).map((entry) => entry.key),
    disabledFeatureKeys: catalog.filter((entry) => !entry.enabled).map((entry) => entry.key),
    overrides,
    catalog,
  };
}

function hasFeature(access, featureKey) {
  const requested = normalizeFeatureKey(featureKey);
  if (!requested) return false;
  const enabledKeys = Array.isArray(access?.enabledFeatureKeys)
    ? access.enabledFeatureKeys
    : [];
  return enabledKeys.includes(requested);
}

module.exports = {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  PACKAGE_CATALOG,
  PLAN_PACKAGE_ALIASES,
  getFeatureCatalog,
  getFeatureKeys,
  getPackageById,
  getPackageCatalog,
  hasFeature,
  resolveFeatureAccess,
  resolvePackageForPlan,
};
