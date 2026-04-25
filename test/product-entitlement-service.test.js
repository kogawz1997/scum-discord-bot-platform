const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPlayerProductEntitlements,
  buildTenantProductEntitlements,
} = require('../src/domain/billing/productEntitlementService');

test('tenant entitlements stay enabled for operational subscriptions with matching features', () => {
  const entitlements = buildTenantProductEntitlements({
    tenantId: 'tenant-1',
    subscriptionStatus: 'active',
    enabledFeatureKeys: ['sync_agent', 'server_settings', 'server_hosting', 'orders_module'],
  });

  assert.equal(entitlements.subscriptionStatus, 'active');
  assert.equal(entitlements.actions.can_create_server_bot.locked, false);
  assert.equal(entitlements.actions.can_edit_config.locked, false);
  assert.equal(entitlements.actions.can_restart_server.locked, false);
  assert.equal(entitlements.actions.can_manage_orders.locked, false);
  assert.equal(entitlements.locks.subscriptionLocked, false);
});

test('tenant entitlements lock protected actions when subscription is expired', () => {
  const entitlements = buildTenantProductEntitlements({
    tenantId: 'tenant-1',
    subscriptionStatus: 'expired',
    enabledFeatureKeys: ['sync_agent', 'server_settings', 'server_hosting', 'orders_module', 'support_module'],
  });

  assert.equal(entitlements.actions.can_create_server_bot.locked, true);
  assert.equal(entitlements.actions.can_edit_config.locked, true);
  assert.equal(entitlements.actions.can_restart_server.locked, true);
  assert.equal(entitlements.actions.can_manage_orders.locked, true);
  assert.equal(entitlements.actions.can_use_delivery.locked, true);
  assert.equal(entitlements.actions.can_manage_modules.locked, true);
  assert.equal(entitlements.sections.billing.locked, false);
  assert.equal(entitlements.sections.onboarding.locked, false);
  assert.equal(entitlements.locks.subscriptionLocked, true);
  assert.match(String(entitlements.actions.can_restart_server.reason || ''), /expired/i);
});

test('player entitlements lock commerce on past-due subscriptions but keep discovery pages open', () => {
  const entitlements = buildPlayerProductEntitlements({
    tenantId: 'tenant-1',
    subscriptionStatus: 'past_due',
    enabledFeatureKeys: ['shop_module', 'orders_module', 'bot_delivery'],
  });

  assert.equal(entitlements.sections.home.locked, false);
  assert.equal(entitlements.sections.profile.locked, false);
  assert.equal(entitlements.sections.shop.locked, true);
  assert.equal(entitlements.actions.can_buy_items.locked, true);
  assert.equal(entitlements.locks.subscriptionLocked, true);
  assert.match(String(entitlements.actions.can_buy_items.reason || ''), /past due/i);
});
