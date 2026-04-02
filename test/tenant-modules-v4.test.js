const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantModulesV4Model,
  buildTenantModulesV4Html,
} = require('../src/admin/assets/tenant-modules-v4.js');

test('tenant modules v4 model surfaces backend summary, readiness, and rollout groups', () => {
  const model = createTenantModulesV4Model({
    me: { tenantId: 'tenant-1' },
    tenantConfig: {
      name: 'Tenant Prime',
      featureFlags: {
        bot_log: true,
        donation_module: true,
      },
    },
    overview: {
      tenantFeatureAccess: {
        package: {
          features: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'analytics_module', 'sync_agent'],
        },
        enabledFeatureKeys: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'analytics_module', 'sync_agent'],
      },
    },
    modulesOverview: {
      summary: {
        activeModules: 3,
        packageEnabledModules: 5,
        readyNow: 1,
        dependencyBlocked: 1,
        runtimeBlocked: 1,
        upgradeRequired: 3,
      },
      readiness: {
        percent: 67,
        completed: 2,
        total: 3,
        steps: [
          { key: 'package', label: 'Unlock at least one module', detail: 'Included already.', done: true, href: '/tenant/billing', actionLabel: 'Open billing' },
          { key: 'enable', label: 'Enable the first module', detail: 'Already enabled.', done: true, href: '/tenant/modules', actionLabel: 'Open modules' },
          { key: 'server-bot', label: 'Connect Server Bot', detail: 'Still needed.', done: false, href: '/tenant/server-bots', actionLabel: 'Open Server Bot' },
        ],
        nextRequiredStep: { key: 'server-bot', label: 'Connect Server Bot', detail: 'Still needed.', href: '/tenant/server-bots', actionLabel: 'Open Server Bot' },
      },
      issues: [
        { key: 'runtime-blocked', title: 'Runtime setup is incomplete', detail: 'One module is waiting on runtime connectivity.', href: '/tenant/server-bots', actionLabel: 'Review runtimes' },
      ],
      topActions: [
        {
          featureKey: 'bot_log',
          title: 'Server log sync',
          stateLabel: 'Server Bot is not connected',
          action: { href: '/tenant/server-bots', label: 'Open Server Bot', detail: 'Connect Server Bot first.' },
        },
      ],
    },
    agents: [
      { role: 'sync', status: 'offline' },
    ],
    featureEntitlements: {
      actions: {
        can_use_modules: {
          locked: false,
          reason: '',
        },
      },
    },
  });

  assert.equal(model.header.title, 'Bot modules');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.backendSummaryStrip.length, 4);
  assert.equal(model.runtimeHealth.syncCount, 1);
  assert.equal(model.runtimeHealth.syncOnline, false);
  assert.equal(model.readiness.percent, 67);
  assert.equal(model.issueSignals.length, 1);
  assert.ok(model.topActions.some((item) => item.featureKey === 'bot_log'));
  assert.equal(model.rolloutGroups.length, 4);

  const botLog = model.modules.find((row) => row.featureKey === 'bot_log');
  const donation = model.modules.find((row) => row.featureKey === 'donation_module');
  const events = model.modules.find((row) => row.featureKey === 'event_module');
  const runtimeGroup = model.rolloutGroups.find((row) => row.title === 'Runtime required');
  const upgradeGroup = model.rolloutGroups.find((row) => row.title === 'Upgrade required');

  assert.equal(botLog.stateLabel, 'Server Bot is not connected');
  assert.equal(botLog.nextAction.href, '/tenant/server-bots');
  assert.equal(donation.stateLabel, 'Ready');
  assert.equal(donation.nextAction.href, '/tenant/donations');
  assert.equal(events.stateLabel, 'Upgrade required');
  assert.equal(events.nextAction.href, '/tenant/billing');
  assert.ok(runtimeGroup.rows.some((row) => row.featureKey === 'bot_log'));
  assert.ok(upgradeGroup.rows.some((row) => row.featureKey === 'event_module'));
});

test('tenant modules v4 html includes backend readiness, rollout board, and module actions', () => {
  const html = buildTenantModulesV4Html(createTenantModulesV4Model({
    me: { tenantId: 'tenant-1' },
    overview: {
      tenantFeatureAccess: {
        package: {
          features: ['analytics_module', 'event_module'],
        },
        enabledFeatureKeys: ['analytics_module', 'event_module'],
      },
    },
    modulesOverview: {
      summary: {
        activeModules: 2,
        packageEnabledModules: 2,
        readyNow: 0,
        dependencyBlocked: 3,
        runtimeBlocked: 0,
        upgradeRequired: 6,
      },
      readiness: {
        percent: 50,
        completed: 1,
        total: 2,
        steps: [
          { key: 'package', label: 'Unlock at least one module', detail: 'Done.', done: true, href: '/tenant/billing', actionLabel: 'Open billing' },
          { key: 'enable', label: 'Enable the first module', detail: 'Done.', done: true, href: '/tenant/modules', actionLabel: 'Open modules' },
        ],
        nextRequiredStep: null,
      },
      issues: [],
      topActions: [
        {
          featureKey: 'event_module',
          title: 'Community events',
          stateLabel: 'Ready',
          action: { href: '/tenant/events', label: 'Open events', detail: 'Manage event workflows.' },
        },
      ],
    },
    agents: [
      { role: 'sync', status: 'online' },
      { role: 'execute', status: 'online' },
    ],
    featureEntitlements: {
      actions: {
        can_use_modules: {
          locked: false,
          reason: '',
        },
      },
    },
  }));

  assert.match(html, /Follow-up queue for modules/);
  assert.match(html, /Module rollout readiness/);
  assert.match(html, /data-tenant-modules-backend-summary/);
  assert.match(html, /data-tenant-modules-readiness/);
  assert.match(html, /data-tenant-modules-rollout-board/);
  assert.match(html, /data-tenant-module-rollout-group="Ready now"/);
  assert.match(html, /data-tenant-modules-next-actions/);
  assert.match(html, /data-tenant-module-card="analytics_module"/);
  assert.match(html, /data-tenant-module-rollout-item="donation_module"/);
  assert.match(html, /data-tenant-module-status="analytics_module"/);
  assert.match(html, /data-tenant-module-action-link="analytics_module"/);
  assert.match(html, /href="\/tenant\/analytics"/);
  assert.match(html, /href="\/tenant\/events"/);
  assert.match(html, /Reset to package defaults/);
  assert.match(html, /Save module changes/);
});
