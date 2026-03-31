'use strict';

function trimText(value, maxLen = 160) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeFeatureAccess(raw) {
  const enabledFeatureKeys = Array.isArray(raw?.enabledFeatureKeys)
    ? raw.enabledFeatureKeys.map((value) => trimText(value, 120)).filter(Boolean)
    : [];
  return {
    tenantId: trimText(raw?.tenantId, 160) || null,
    package: raw?.package || null,
    plan: raw?.plan || null,
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

function buildLockedState(featureAccess, requiredFeatures, message, surface = 'tenant') {
  const normalized = normalizeFeatureAccess(featureAccess);
  const featureKeys = Array.isArray(requiredFeatures)
    ? requiredFeatures.map((value) => trimText(value, 120)).filter(Boolean)
    : [];
  const enabled = hasAnyFeature(normalized, featureKeys);
  return {
    enabled,
    locked: !enabled,
    reason: enabled ? null : trimText(message, 240) || 'This feature is not included in the current package.',
    requiredFeatures: featureKeys,
    upgradeCta: enabled ? null : buildUpgradeCta(surface, featureKeys),
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
    can_view_analytics: buildLockedState(
      featureAccess,
      ['analytics_module'],
      'Analytics is locked until the analytics feature is enabled.',
    ),
  };
}

function buildTenantSectionEntitlements(featureAccess) {
  return {
    onboarding: buildLockedState(featureAccess, [], ''),
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
    billing: buildLockedState(featureAccess, [], ''),
    settings: buildLockedState(featureAccess, ['discord_integration', 'support_module', 'analytics_module'], 'Settings includes package-specific options that may stay locked.'),
  };
}

function buildTenantProductEntitlements(featureAccess) {
  const normalized = normalizeFeatureAccess(featureAccess);
  return {
    tenantId: normalized.tenantId,
    package: normalized.package,
    plan: normalized.plan,
    enabledFeatureKeys: [...normalized.enabledFeatureKeys],
    sections: buildTenantSectionEntitlements(normalized),
    actions: buildTenantActionEntitlements(normalized),
    locks: {
      packageLocked: Object.values(buildTenantSectionEntitlements(normalized)).some((entry) => entry.locked),
    },
  };
}

function buildPlayerProductEntitlements(featureAccess) {
  const normalized = normalizeFeatureAccess(featureAccess);
  return {
    tenantId: normalized.tenantId,
    package: normalized.package,
    plan: normalized.plan,
    enabledFeatureKeys: [...normalized.enabledFeatureKeys],
    sections: {
      home: buildLockedState(normalized, [], '', 'player'),
      stats: buildLockedState(normalized, ['player_module', 'ranking_module', 'analytics_module'], 'Stats is locked until stats tracking is enabled.', 'player'),
      leaderboard: buildLockedState(normalized, ['ranking_module', 'analytics_module'], 'Leaderboard is locked until ranking is enabled.', 'player'),
      shop: buildLockedState(normalized, ['shop_module'], 'Shop is locked until the shop feature is enabled.', 'player'),
      orders: buildLockedState(normalized, ['orders_module'], 'Orders is locked until the orders feature is enabled.', 'player'),
      delivery: buildLockedState(normalized, ['bot_delivery', 'orders_module'], 'Delivery is locked until delivery support is enabled.', 'player'),
      events: buildLockedState(normalized, ['event_module'], 'Events is locked until events are enabled.', 'player'),
      donations: buildLockedState(normalized, ['donation_module'], 'Donations is locked until supporter tools are enabled.', 'player'),
      profile: buildLockedState(normalized, [], '', 'player'),
      support: buildLockedState(normalized, ['support_module'], 'Support is locked until the support feature is enabled.', 'player'),
    },
    actions: {
      can_view_shop: buildLockedState(normalized, ['shop_module'], 'Shop browsing is locked until the shop feature is enabled.', 'player'),
      can_buy_items: buildLockedState(normalized, ['shop_module', 'orders_module'], 'Purchases are locked until shop and orders are enabled.', 'player'),
      can_view_orders: buildLockedState(normalized, ['orders_module'], 'Orders are locked until the orders feature is enabled.', 'player'),
      can_view_delivery: buildLockedState(normalized, ['bot_delivery', 'orders_module'], 'Delivery details are locked until delivery support is enabled.', 'player'),
      can_join_events: buildLockedState(normalized, ['event_module'], 'Event participation is locked until events are enabled.', 'player'),
      can_view_donations: buildLockedState(normalized, ['donation_module'], 'Supporter pages are locked until donations are enabled.', 'player'),
      can_contact_support: buildLockedState(normalized, ['support_module'], 'Support is locked until the support feature is enabled.', 'player'),
    },
    locks: {
      packageLocked: Object.values({
        stats: buildLockedState(normalized, ['player_module', 'ranking_module', 'analytics_module'], '', 'player'),
        shop: buildLockedState(normalized, ['shop_module'], '', 'player'),
        events: buildLockedState(normalized, ['event_module'], '', 'player'),
      }).some((entry) => entry.locked),
    },
  };
}

module.exports = {
  buildPlayerProductEntitlements,
  buildTenantProductEntitlements,
  hasAnyFeature,
  normalizeFeatureAccess,
};
