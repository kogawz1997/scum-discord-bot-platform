'use strict';

function trimText(value, maxLen = 160) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeSubscriptionStatus(value) {
  const normalized = trimText(value, 40).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'preview') return 'preview';
  if (['trial', 'trialing'].includes(normalized)) return 'trialing';
  if (normalized === 'active') return 'active';
  if (['canceled', 'cancelled'].includes(normalized)) return 'cancelled';
  if (normalized === 'expired') return 'expired';
  if (['suspended', 'past_due', 'failed', 'pending', 'paused', 'void', 'disputed', 'inactive'].includes(normalized)) return 'past_due';
  return normalized;
}

function isOperationalSubscriptionStatus(value) {
  const normalized = normalizeSubscriptionStatus(value);
  return normalized === 'active' || normalized === 'trialing';
}

function normalizeFeatureAccess(raw) {
  const enabledFeatureKeys = Array.isArray(raw?.enabledFeatureKeys)
    ? raw.enabledFeatureKeys.map((value) => trimText(value, 120)).filter(Boolean)
    : [];
  return {
    tenantId: trimText(raw?.tenantId, 160) || null,
    package: raw?.package || null,
    plan: raw?.plan || null,
    subscription: raw?.subscription || null,
    subscriptionStatus: normalizeSubscriptionStatus(
      raw?.subscriptionStatus
      || raw?.subscription?.lifecycleStatus
      || raw?.subscription?.status,
    ),
    enabledFeatureKeys,
    featureSet: new Set(enabledFeatureKeys),
  };
}

function hasAnyFeature(featureAccess, requiredFeatures = []) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const rules = Array.isArray(requiredFeatures)
    ? requiredFeatures.map((value) => trimText(value, 120)).filter(Boolean)
    : [];
  if (!rules.length) return true;
  return rules.some((key) => normalized.featureSet.has(key));
}

function buildUpgradeCta(surface, featureKeys = []) {
  const normalizedSurface = trimText(surface, 40).toLowerCase() || 'tenant';
  const href = normalizedSurface === 'player'
    ? '/pricing'
    : '/tenant/billing';
  return {
    label: normalizedSurface === 'player' ? 'View available features' : 'Upgrade package',
    href,
    featureKeys: Array.isArray(featureKeys) ? featureKeys.filter(Boolean) : [],
  };
}

function buildSubscriptionLifecycleLock(featureAccess, surface = 'tenant') {
  const normalized = normalizeFeatureAccess(featureAccess);
  if (!normalized.subscriptionStatus || isOperationalSubscriptionStatus(normalized.subscriptionStatus)) {
    return null;
  }
  const reasons = {
    preview: 'This tenant is in preview mode. Start a trial or choose a package to unlock this operation.',
    past_due: 'This subscription is past due. Resolve billing to restore access.',
    cancelled: 'This subscription has been cancelled. Renew or choose a package to restore access.',
    expired: 'This subscription has expired. Renew or upgrade billing to restore access.',
  };
  return {
    subscriptionStatus: normalized.subscriptionStatus,
    reason: reasons[normalized.subscriptionStatus]
      || 'This subscription is not active. Resolve billing to restore access.',
    upgradeCta: normalized.subscriptionStatus === 'past_due' && trimText(surface, 40).toLowerCase() !== 'player'
      ? {
        label: 'Open billing',
        href: '/tenant/billing',
        featureKeys: [],
      }
      : buildUpgradeCta(surface, []),
  };
}

function buildLockedState(featureAccess, requiredFeatures, message, surface = 'tenant', options = {}) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const featureKeys = Array.isArray(requiredFeatures)
    ? requiredFeatures.map((value) => trimText(value, 120)).filter(Boolean)
    : [];
  const lifecycleLock = options.ignoreSubscription === true
    ? null
    : buildSubscriptionLifecycleLock(normalized, surface);
  if (lifecycleLock) {
    return {
      enabled: false,
      locked: true,
      reason: lifecycleLock.reason,
      requiredFeatures: featureKeys,
      upgradeCta: lifecycleLock.upgradeCta,
      lockType: 'subscription',
      subscriptionStatus: lifecycleLock.subscriptionStatus,
    };
  }
  const enabled = hasAnyFeature(normalized, featureKeys);
  return {
    enabled,
    locked: !enabled,
    reason: enabled ? null : trimText(message, 240) || 'This feature is not included in the current package.',
    requiredFeatures: featureKeys,
    upgradeCta: enabled ? null : buildUpgradeCta(surface, featureKeys),
    lockType: enabled ? null : 'feature',
    subscriptionStatus: normalized.subscriptionStatus || null,
  };
}

function buildTenantActionEntitlements(featureAccess) {
  return {
    can_create_server_bot: buildLockedState(
      featureAccess,
      ['sync_agent'],
      'Create Server Bot is locked until this tenant has Server Bot support.',
    ),
    can_create_delivery_agent: buildLockedState(
      featureAccess,
      ['execute_agent'],
      'Create Delivery Agent is locked until this tenant has delivery runtime support.',
    ),
    can_view_sync_status: buildLockedState(
      featureAccess,
      ['bot_log', 'sync_agent'],
      'Sync status is locked until log sync or Server Bot access is enabled.',
    ),
    can_edit_config: buildLockedState(
      featureAccess,
      ['server_settings'],
      'Server Config changes are locked until Server Settings is enabled.',
    ),
    can_restart_server: buildLockedState(
      featureAccess,
      ['server_hosting'],
      'Restart actions are locked until managed server hosting is enabled.',
    ),
    can_use_restart_announcements: buildLockedState(
      featureAccess,
      ['restart_announce_module'],
      'Restart announcements are locked until the restart announcement feature is enabled.',
    ),
    can_manage_players: buildLockedState(
      featureAccess,
      ['player_module'],
      'Player management is locked until player tools are enabled.',
    ),
    can_manage_orders: buildLockedState(
      featureAccess,
      ['orders_module'],
      'Order management is locked until the orders feature is enabled.',
    ),
    can_use_delivery: buildLockedState(
      featureAccess,
      ['bot_delivery', 'orders_module'],
      'Delivery actions are locked until delivery support is enabled.',
    ),
    can_manage_donations: buildLockedState(
      featureAccess,
      ['donation_module'],
      'Donations are locked until the donation feature is enabled.',
    ),
    can_manage_events: buildLockedState(
      featureAccess,
      ['event_module'],
      'Events are locked until the event feature is enabled.',
    ),
    can_manage_staff: buildLockedState(
      featureAccess,
      ['staff_roles'],
      'Staff access management is locked until the staff feature is enabled.',
    ),
    can_use_modules: buildLockedState(
      featureAccess,
      ['support_module', 'analytics_module', 'event_module', 'donation_module'],
      'Modules are locked until this tenant has at least one modular service enabled.',
    ),
    can_manage_modules: buildLockedState(
      featureAccess,
      ['support_module', 'analytics_module', 'event_module', 'donation_module'],
      'Modules are locked until this tenant has at least one modular service enabled.',
    ),
    can_view_analytics: buildLockedState(
      featureAccess,
      ['analytics_module'],
      'Analytics is locked until the analytics feature is enabled.',
    ),
  };
}

function buildTenantSectionEntitlements(featureAccess) {
  return {
    onboarding: buildLockedState(featureAccess, [], '', 'tenant', { ignoreSubscription: true }),
    server: buildLockedState(featureAccess, ['server_status', 'server_hosting'], 'Server operations are locked until server visibility is enabled.'),
    server_config: buildLockedState(featureAccess, ['server_settings'], 'Server Config is locked until Server Settings is enabled.'),
    restart_control: buildLockedState(featureAccess, ['server_hosting', 'restart_announce_module'], 'Restart Control is locked until restart support is enabled.'),
    delivery_agents: buildLockedState(featureAccess, ['execute_agent'], 'Delivery Agents are locked until delivery runtime support is enabled.'),
    server_bots: buildLockedState(featureAccess, ['sync_agent'], 'Server Bots are locked until Server Bot support is enabled.'),
    logs_sync: buildLockedState(featureAccess, ['bot_log', 'sync_agent'], 'Logs & Sync is locked until log sync support is enabled.'),
    players: buildLockedState(featureAccess, ['player_module'], 'Players is locked until player tools are enabled.'),
    orders: buildLockedState(featureAccess, ['orders_module'], 'Orders is locked until the orders feature is enabled.'),
    donations: buildLockedState(featureAccess, ['donation_module'], 'Donations is locked until the donation feature is enabled.'),
    events: buildLockedState(featureAccess, ['event_module'], 'Events is locked until the event feature is enabled.'),
    modules: buildLockedState(featureAccess, ['support_module', 'analytics_module', 'event_module', 'donation_module'], 'Modules are locked until a compatible module feature is enabled.'),
    staff: buildLockedState(featureAccess, ['staff_roles'], 'Staff is locked until staff roles are enabled.'),
    roles: buildLockedState(featureAccess, ['staff_roles'], 'Roles & Permissions is locked until staff roles are enabled.'),
    billing: buildLockedState(featureAccess, [], '', 'tenant', { ignoreSubscription: true }),
    settings: buildLockedState(featureAccess, ['discord_integration', 'support_module', 'analytics_module'], 'Settings includes package-specific options that may stay locked.'),
  };
}

function buildTenantProductEntitlements(featureAccess) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const sections = buildTenantSectionEntitlements(normalized);
  const actions = buildTenantActionEntitlements(normalized);
  const subscriptionLocked = Boolean(normalized.subscriptionStatus) && !isOperationalSubscriptionStatus(normalized.subscriptionStatus);
  return {
    tenantId: normalized.tenantId,
    package: normalized.package,
    plan: normalized.plan,
    subscription: normalized.subscription,
    subscriptionStatus: normalized.subscriptionStatus,
    enabledFeatureKeys: [...normalized.enabledFeatureKeys],
    sections,
    actions,
    locks: {
      packageLocked: Object.values(sections).some((entry) => entry.locked),
      subscriptionLocked,
    },
  };
}

function buildPlayerProductEntitlements(featureAccess) {
  const normalized = normalizeFeatureAccess(featureAccess);
  const sections = {
    home: buildLockedState(normalized, [], '', 'player', { ignoreSubscription: true }),
    stats: buildLockedState(normalized, ['player_module', 'ranking_module', 'analytics_module'], 'Stats is locked until stats tracking is enabled.', 'player'),
    leaderboard: buildLockedState(normalized, ['ranking_module', 'analytics_module'], 'Leaderboard is locked until ranking is enabled.', 'player'),
    shop: buildLockedState(normalized, ['shop_module'], 'Shop is locked until the shop feature is enabled.', 'player'),
    orders: buildLockedState(normalized, ['orders_module'], 'Orders is locked until the orders feature is enabled.', 'player'),
    delivery: buildLockedState(normalized, ['bot_delivery', 'orders_module'], 'Delivery is locked until delivery support is enabled.', 'player'),
    events: buildLockedState(normalized, ['event_module'], 'Events is locked until events are enabled.', 'player'),
    donations: buildLockedState(normalized, ['donation_module'], 'Donations is locked until supporter tools are enabled.', 'player'),
    profile: buildLockedState(normalized, [], '', 'player', { ignoreSubscription: true }),
    support: buildLockedState(normalized, ['support_module'], 'Support is locked until the support feature is enabled.', 'player'),
  };
  const actions = {
    can_view_shop: buildLockedState(normalized, ['shop_module'], 'Shop browsing is locked until the shop feature is enabled.', 'player'),
    can_buy_items: buildLockedState(normalized, ['shop_module', 'orders_module'], 'Purchases are locked until shop and orders are enabled.', 'player'),
    can_view_orders: buildLockedState(normalized, ['orders_module'], 'Orders are locked until the orders feature is enabled.', 'player'),
    can_view_delivery: buildLockedState(normalized, ['bot_delivery', 'orders_module'], 'Delivery details are locked until delivery support is enabled.', 'player'),
    can_join_events: buildLockedState(normalized, ['event_module'], 'Event participation is locked until events are enabled.', 'player'),
    can_view_donations: buildLockedState(normalized, ['donation_module'], 'Supporter pages are locked until donations are enabled.', 'player'),
    can_contact_support: buildLockedState(normalized, ['support_module'], 'Support is locked until the support feature is enabled.', 'player'),
  };
  const subscriptionLocked = Boolean(normalized.subscriptionStatus) && !isOperationalSubscriptionStatus(normalized.subscriptionStatus);
  return {
    tenantId: normalized.tenantId,
    package: normalized.package,
    plan: normalized.plan,
    subscription: normalized.subscription,
    subscriptionStatus: normalized.subscriptionStatus,
    enabledFeatureKeys: [...normalized.enabledFeatureKeys],
    sections,
    actions,
    locks: {
      packageLocked: Object.values({
        stats: sections.stats,
        shop: sections.shop,
        events: sections.events,
      }).some((entry) => entry.locked),
      subscriptionLocked,
    },
  };
}

module.exports = {
  buildPlayerProductEntitlements,
  buildTenantProductEntitlements,
  hasAnyFeature,
  normalizeFeatureAccess,
  normalizeSubscriptionStatus,
};
