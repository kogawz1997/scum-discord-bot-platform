const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createOwnerControlV4Model,
  buildOwnerControlV4Html,
  normalizeOwnerControlRoute,
} = require('../src/admin/assets/owner-control-v4.js');

function buildState() {
  return {
    overview: {
      packages: [
        { id: 'TRIAL', title: 'Trial', description: 'Entry plan', features: ['sync_agent'] },
        { id: 'PRO', title: 'Pro', description: 'Full plan', features: ['sync_agent', 'execute_agent', 'analytics_module'] },
      ],
      features: [
        { key: 'sync_agent', title: 'Server Bot' },
        { key: 'execute_agent', title: 'Delivery Agent' },
      ],
      plans: [
        { id: 'trial-14d', title: 'Trial 14 days' },
        { id: 'pro-monthly', title: 'Pro Monthly' },
      ],
      analytics: {
        tenants: { total: 2, active: 1 },
        subscriptions: { mrrCents: 120000 },
        delivery: { failedJobs: 1, queueDepth: 3 },
      },
      opsState: {
        lastMonitoringAt: '2026-03-29T10:00:00.000Z',
      },
      automationState: {
        lastAutomationAt: '2026-03-29T09:58:00.000Z',
        lastForcedMonitoringAt: '2026-03-29T09:59:00.000Z',
        lastRecoveryResultByKey: {
          watcher: {
            at: '2026-03-29T09:57:00.000Z',
            ok: true,
            action: 'restart-managed-service',
            runtimeKey: 'watcher',
            status: 'offline',
            reason: 'runtime-offline',
            exitCode: 0,
          },
        },
      },
      permissionCatalog: [{ key: 'platform:tenant-write' }],
      automationConfig: { enabled: true, maxActionsPerCycle: 3 },
    },
    tenants: [
      {
        id: 'tenant-1',
        name: 'Prime',
        slug: 'prime',
        type: 'direct',
        status: 'active',
        locale: 'th',
        ownerName: 'Ariya',
        ownerEmail: 'ariya@example.com',
      },
    ],
    subscriptions: [
      {
        id: 'sub-1',
        tenantId: 'tenant-1',
        status: 'active',
        packageId: 'PRO',
        planId: 'pro-monthly',
        billingCycle: 'monthly',
        amountCents: 99000,
        currency: 'THB',
        renewsAt: '2026-04-05T09:00:00.000Z',
        metadata: { packageId: 'PRO' },
      },
    ],
    tenantQuotaSnapshots: [
      {
        tenantId: 'tenant-1',
        quotas: {
          apiKeys: { used: 2, limit: 5 },
        },
      },
    ],
    billingOverview: {
      provider: { provider: 'stripe', mode: 'configured' },
    },
    billingInvoices: [
      {
        id: 'inv-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        status: 'paid',
        amountCents: 99000,
        currency: 'THB',
        paidAt: '2026-03-29T08:15:00.000Z',
        metadata: { targetPlanId: 'pro-monthly', targetPackageId: 'PRO', targetBillingCycle: 'monthly' },
      },
    ],
    billingPaymentAttempts: [
      {
        id: 'pay-1',
        tenantId: 'tenant-1',
        invoiceId: 'inv-1',
        provider: 'stripe',
        status: 'failed',
        amountCents: 99000,
        currency: 'THB',
        attemptedAt: '2026-03-29T08:16:00.000Z',
      },
    ],
    sessions: [
      {
        id: 'sess-1',
        user: 'owner',
        role: 'owner',
        authMethod: 'password',
        ip: '127.0.0.1',
        createdAt: '2026-03-29T08:10:00.000Z',
        lastSeenAt: '2026-03-29T08:40:00.000Z',
        current: true,
      },
      {
        id: 'sess-2',
        user: 'support-owner',
        role: 'admin',
        authMethod: 'password',
        ip: '127.0.0.2',
        createdAt: '2026-03-29T08:11:00.000Z',
        lastSeenAt: '2026-03-29T08:39:00.000Z',
        current: false,
      },
    ],
    notifications: [
      { id: 'note-open', title: 'Queue warning', severity: 'warning', createdAt: '2026-03-29T08:20:00.000Z', acknowledged: false },
      { id: 'note-ack', title: 'Recovered worker', severity: 'info', createdAt: '2026-03-29T08:10:00.000Z', acknowledged: true },
    ],
    securityEvents: [
      { type: 'login.step_up', severity: 'warning', createdAt: '2026-03-29T08:25:00.000Z' },
    ],
    requestLogs: {
      metrics: {
        windowMs: 3600000,
      },
      items: [
        { method: 'GET', path: '/owner/api/platform/overview', statusCode: 200, at: '2026-03-29T08:30:00.000Z' },
      ],
    },
    deliveryLifecycle: {
      summary: {
        pendingOverdueMs: 1200000,
      },
      items: [
        {
          tenantId: 'tenant-1',
          orderCode: 'ORD-1',
          status: 'pending',
        },
      ],
    },
    restoreState: {
      status: 'succeeded',
      previewBackup: 'platform-2026-03-29.zip',
      previewToken: 'preview-demo-token',
      previewExpiresAt: '2026-03-29T10:30:00.000Z',
      verification: {
        ready: true,
      },
    },
    restoreHistory: [
      {
        operationId: 'restore-1',
        status: 'succeeded',
        backup: 'platform-2026-03-29.zip',
        actor: 'owner',
        recordedAt: '2026-03-29T09:45:00.000Z',
        verification: {
          ready: true,
        },
      },
    ],
    backupFiles: [
      {
        id: 'backup-1',
        file: 'platform-2026-03-29.zip',
        sizeBytes: 1048576,
        createdAt: '2026-03-29T09:00:00.000Z',
        updatedAt: '2026-03-29T09:30:00.000Z',
      },
    ],
    agents: [
      {
        tenantId: 'tenant-1',
        serverId: 'server-1',
        guildId: 'guild-1',
        agentId: 'sync-1',
        runtimeKey: 'sync-runtime',
        role: 'sync',
        scope: 'sync_only',
        status: 'online',
        lastSeenAt: '2026-03-29T08:35:00.000Z',
        version: '2.0.0',
      },
    ],
    agentRegistry: [
      {
        tenantId: 'tenant-1',
        serverId: 'server-1',
        guildId: 'guild-1',
        agentId: 'sync-1',
        runtimeKey: 'sync-runtime',
        role: 'sync',
        scope: 'sync_only',
        status: 'online',
        machineName: 'machine-a',
        version: '2.0.0',
        lastSeenAt: '2026-03-29T08:35:00.000Z',
        displayName: 'Prime Server Bot',
        minimumVersion: '2.0.0',
      },
    ],
    agentDevices: [
      {
        tenantId: 'tenant-1',
        serverId: 'server-1',
        guildId: 'guild-1',
        agentId: 'sync-1',
        runtimeKey: 'sync-runtime',
        id: 'device-1',
        hostname: 'machine-a',
        lastSeenAt: '2026-03-29T08:35:00.000Z',
      },
    ],
    agentCredentials: [
      {
        tenantId: 'tenant-1',
        serverId: 'server-1',
        guildId: 'guild-1',
        agentId: 'sync-1',
        runtimeKey: 'sync-runtime',
        apiKeyId: 'cred-1',
        deviceId: 'device-1',
        role: 'sync',
        scope: 'sync_only',
        minVersion: '2.0.0',
      },
    ],
    agentProvisioning: [
      {
        tenantId: 'tenant-1',
        runtimeKey: 'sync-runtime',
        tokenId: 'setup-1',
      },
    ],
    controlPanelSettings: {
      env: {
        root: {
          ADMIN_WEB_SSO_DISCORD_ENABLED: {
            key: 'ADMIN_WEB_SSO_DISCORD_ENABLED',
            label: 'Discord SSO',
            type: 'boolean',
            editable: true,
            value: true,
            description: 'Enable Discord sign-in for owner accounts.',
            applyMode: 'reload-safe',
          },
          ADMIN_WEB_SESSION_TTL_HOURS: {
            key: 'ADMIN_WEB_SESSION_TTL_HOURS',
            label: 'Session TTL',
            type: 'number',
            editable: true,
            value: '12',
            description: 'Hours before session expires.',
            applyMode: 'restart-required',
          },
          PLATFORM_BILLING_PROVIDER: {
            key: 'PLATFORM_BILLING_PROVIDER',
            label: 'Billing provider',
            type: 'text',
            editable: true,
            value: 'stripe',
            description: 'Billing provider used for package purchase and renewal flows.',
            applyMode: 'reload-safe',
            options: [
              { value: 'platform_local', label: 'Platform local' },
              { value: 'stripe', label: 'Stripe' },
            ],
          },
          PLATFORM_PUBLIC_BASE_URL: {
            key: 'PLATFORM_PUBLIC_BASE_URL',
            label: 'Platform public base URL',
            type: 'text',
            editable: true,
            value: 'https://platform.example.com',
            description: 'Canonical public URL used in billing redirects.',
            applyMode: 'reload-safe',
          },
          PLATFORM_BILLING_STRIPE_SECRET_KEY: {
            key: 'PLATFORM_BILLING_STRIPE_SECRET_KEY',
            label: 'Stripe secret key',
            type: 'secret',
            editable: true,
            configured: true,
            value: '',
            description: 'Stripe secret key used for checkout and webhook operations.',
            applyMode: 'reload-safe',
            secret: true,
          },
          PERSIST_REQUIRE_DB: {
            key: 'PERSIST_REQUIRE_DB',
            label: 'Require database persistence',
            type: 'boolean',
            editable: true,
            value: true,
            description: 'Require database persistence at runtime.',
            applyMode: 'restart-required',
          },
          DELIVERY_EXECUTION_MODE: {
            key: 'DELIVERY_EXECUTION_MODE',
            label: 'Delivery execution mode',
            type: 'text',
            editable: true,
            value: 'agent',
            description: 'Delivery backend selection.',
            applyMode: 'restart-required',
            options: [
              { value: 'agent', label: 'Delivery Agent' },
              { value: 'rcon', label: 'RCON' },
            ],
          },
        },
        portal: {
          WEB_PORTAL_BASE_URL: {
            key: 'WEB_PORTAL_BASE_URL',
            label: 'Portal base URL',
            type: 'text',
            editable: true,
            value: 'http://127.0.0.1:3300',
            description: 'Player portal base URL.',
            applyMode: 'reload-safe',
          },
        },
      },
      adminUsers: [
        { username: 'owner', role: 'owner', isActive: true, tenantId: null },
      ],
      managedServices: [
        { key: 'admin-web', label: 'Owner web', pm2Name: 'scum-owner-web', description: 'Owner web frontend' },
      ],
    },
    supportCase: {
      tenantId: 'tenant-1',
      lifecycle: {
        key: 'attention',
        tone: 'warning',
        label: 'needs attention',
        detail: 'Support or runtime signals need follow-up before the tenant is considered quiet.',
      },
      onboarding: {
        completed: 2,
        total: 4,
        requiredCompleted: 2,
        requiredTotal: 3,
        items: [
          { key: 'tenant-record', required: true, status: 'done', detail: 'Tenant row exists.' },
          { key: 'subscription', required: true, status: 'done', detail: 'Subscription is active.' },
          { key: 'license', required: true, status: 'blocked', detail: 'License needs review.' },
        ],
      },
      signals: {
        total: 2,
        items: [
          { key: 'dead-letters', tone: 'danger', count: 2, detail: 'Delivery dead letters are present.' },
          { key: 'runtime-degraded', tone: 'warning', count: 1, detail: 'One managed runtime is degraded.' },
        ],
      },
      actions: [
        { key: 'inspect-dead-letters', tone: 'danger', detail: 'Review delivery dead letters before updating the customer.' },
      ],
      diagnostics: {
        delivery: { deadLetters: 2, anomalies: 1 },
      },
    },
  };
}

test('owner control route normalization maps canonical owner views', () => {
  assert.equal(normalizeOwnerControlRoute('overview'), 'overview');
  assert.equal(normalizeOwnerControlRoute('tenant-tenant-1'), 'tenant-detail');
  assert.equal(normalizeOwnerControlRoute('support-tenant-1'), 'support-detail');
  assert.equal(normalizeOwnerControlRoute('runtime-health'), 'runtime');
  assert.equal(normalizeOwnerControlRoute('agents-bots'), 'agents-bots');
  assert.equal(normalizeOwnerControlRoute('fleet-diagnostics'), 'fleet-diagnostics');
  assert.equal(normalizeOwnerControlRoute('packages-create'), 'packages-create');
  assert.equal(normalizeOwnerControlRoute('packages-entitlements'), 'packages-entitlements');
  assert.equal(normalizeOwnerControlRoute('subscriptions-registry'), 'subscriptions-registry');
  assert.equal(normalizeOwnerControlRoute('billing-attempts'), 'billing-attempts');
  assert.equal(normalizeOwnerControlRoute('recovery'), 'recovery');
  assert.equal(normalizeOwnerControlRoute('recovery-create'), 'recovery-create');
  assert.equal(normalizeOwnerControlRoute('recovery-preview'), 'recovery-preview');
  assert.equal(normalizeOwnerControlRoute('recovery-restore'), 'recovery-restore');
  assert.equal(normalizeOwnerControlRoute('recovery-history'), 'recovery-history');
  assert.equal(normalizeOwnerControlRoute('observability'), 'analytics');
  assert.equal(normalizeOwnerControlRoute('analytics-risk'), 'analytics-risk');
  assert.equal(normalizeOwnerControlRoute('analytics-packages'), 'analytics-packages');
  assert.equal(normalizeOwnerControlRoute('billing'), 'billing');
  assert.equal(normalizeOwnerControlRoute('billing-recovery'), 'billing-recovery');
  assert.equal(normalizeOwnerControlRoute('control'), 'control');
  assert.equal(normalizeOwnerControlRoute('access'), 'access');
  assert.equal(normalizeOwnerControlRoute('diagnostics'), 'diagnostics');
  assert.equal(normalizeOwnerControlRoute('settings-admin-users'), 'settings-admin-users');
  assert.equal(normalizeOwnerControlRoute('settings-services'), 'settings-services');
  assert.equal(normalizeOwnerControlRoute('settings-access-policy'), 'settings-access-policy');
  assert.equal(normalizeOwnerControlRoute('settings-portal-policy'), 'settings-portal-policy');
  assert.equal(normalizeOwnerControlRoute('settings-billing-policy'), 'settings-billing-policy');
  assert.equal(normalizeOwnerControlRoute('settings-runtime-policy'), 'settings-runtime-policy');
});

test('owner control tenant detail workspace exposes tenant and subscription actions', () => {
  const model = createOwnerControlV4Model(buildState(), { currentRoute: 'tenant-tenant-1' });
  const html = buildOwnerControlV4Html(model);

  assert.equal(model.routeKind, 'tenant-detail');
  assert.match(html, /data-owner-form="update-tenant"/);
  assert.match(html, /data-owner-form="update-subscription"/);
  assert.match(html, /data-owner-action="set-tenant-status"/);
  assert.match(html, /owner-tenant-detail-form/);
});

test('owner control support route renders a dedicated support case workspace', () => {
  const state = buildState();
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, {
    currentRoute: 'support-tenant-1',
    supportCase: state.supportCase,
  }));

  assert.match(html, /owner-tenant-support-workspace/);
  assert.match(html, /data-owner-focus-route="support-detail support-tenant-1"/);
  assert.match(html, /owner-tenant-support-actions-live/);
  assert.match(html, /export\?tenantId=tenant-1&amp;format=json/);
  assert.doesNotMatch(html, /data-owner-form="update-tenant"/);
});

test('owner control pages keep navigation out of the page body', () => {
  const state = buildState();
  const packageHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'packages' }));
  const tenantDetailHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'tenant-tenant-1' }));
  const billingHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'billing' }));
  const recoveryHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'recovery' }));
  const settingsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'settings' }));
  const securityHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'security' }));
  const supportDetailHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, {
    currentRoute: 'support-tenant-1',
    supportCase: state.supportCase,
  }));

  assert.doesNotMatch(packageHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(tenantDetailHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(billingHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(recoveryHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(settingsHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(securityHtml, /data-owner-topic-nav="true"/);
  assert.doesNotMatch(supportDetailHtml, /data-owner-topic-nav="true"/);
  assert.match(packageHtml, /data-owner-control-page="packages"/);
  assert.match(billingHtml, /data-owner-control-page="billing"/);
  assert.match(settingsHtml, /data-owner-control-page="settings"/);
  assert.match(securityHtml, /data-owner-control-page="security"/);
});

test('owner control runtime overview route isolates the service summary from mutation forms', () => {
  const model = createOwnerControlV4Model(buildState(), {
    currentRoute: 'runtime-health',
  });
  const html = buildOwnerControlV4Html(model);

  assert.equal(model.routeKind, 'runtime');
  assert.match(html, /id="owner-runtime-route-summary"/);
  assert.match(html, /Platform runtime posture/);
  assert.doesNotMatch(html, /data-owner-form="create-platform-server"/);
  assert.doesNotMatch(html, /data-owner-form="provision-runtime"/);
  assert.doesNotMatch(html, /id="owner-runtime-workspace"/);
  assert.doesNotMatch(html, /id="owner-runtime-shared-ops"/);
});

test('owner control runtime create and provision routes each keep one focused workflow', () => {
  const createHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), {
    currentRoute: 'runtime-create-server',
  }));
  const provisionHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), {
    currentRoute: 'runtime-provision-runtime',
    runtimeBootstrap: {
      rawSetupToken: 'stp_demo.token',
      bootstrap: { runtimeKey: 'sync-runtime', agentId: 'sync-1' },
    },
  }));

  assert.match(createHtml, /data-owner-form="create-platform-server"/);
  assert.doesNotMatch(createHtml, /data-owner-form="provision-runtime"/);
  assert.doesNotMatch(createHtml, /id="owner-runtime-workspace"/);
  assert.match(provisionHtml, /data-owner-form="provision-runtime"/);
  assert.match(provisionHtml, /stp_demo\.token/);
  assert.doesNotMatch(provisionHtml, /data-owner-form="create-platform-server"/);
  assert.doesNotMatch(provisionHtml, /id="owner-runtime-workspace"/);
});

test('owner control recovery overview keeps the shared recovery summary without mutation forms', () => {
  const state = buildState();
  const model = createOwnerControlV4Model(state, {
    currentRoute: 'recovery',
    restorePreview: {
      backup: 'platform-2026-03-29.zip',
      previewToken: 'preview-demo-token',
      warnings: ['One runtime will be restarted after restore.'],
      verificationPlan: {
        checks: [
          { id: 'runtime-health', label: 'Runtime health', detail: 'Verify core services after restore.' },
        ],
      },
    },
  });
  const html = buildOwnerControlV4Html(model);

  assert.equal(model.routeKind, 'recovery');
  assert.match(html, /data-owner-control-page="recovery"/);
  assert.match(html, /id="owner-recovery-workspace"/);
  assert.match(html, /data-owner-recovery-preview="true"/);
  assert.match(html, /Shared backup and restore workbench/);
  assert.doesNotMatch(html, /data-owner-form="backup-create"/);
  assert.doesNotMatch(html, /data-owner-form="backup-preview"/);
  assert.doesNotMatch(html, /data-owner-form="backup-restore"/);
  assert.doesNotMatch(html, /data-owner-recovery-backup-table/);
  assert.doesNotMatch(html, /data-owner-recovery-history-table/);
});

test('owner control recovery child routes isolate create preview restore and history work', () => {
  const state = buildState();
  const createHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'recovery-create' }));
  const previewHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, {
    currentRoute: 'recovery-preview',
    restorePreview: {
      backup: 'platform-2026-03-29.zip',
      previewToken: 'preview-demo-token',
      warnings: ['One runtime will be restarted after restore.'],
      verificationPlan: { checks: [{ id: 'runtime-health', label: 'Runtime health', detail: 'Verify core services after restore.' }] },
    },
  }));
  const restoreHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'recovery-restore' }));
  const historyHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'recovery-history' }));

  assert.match(createHtml, /data-owner-form="backup-create"/);
  assert.doesNotMatch(createHtml, /data-owner-form="backup-preview"/);
  assert.doesNotMatch(createHtml, /data-owner-form="backup-restore"/);
  assert.match(previewHtml, /data-owner-form="backup-preview"/);
  assert.doesNotMatch(previewHtml, /data-owner-form="backup-create"/);
  assert.doesNotMatch(previewHtml, /data-owner-form="backup-restore"/);
  assert.match(restoreHtml, /data-owner-form="backup-restore"/);
  assert.doesNotMatch(restoreHtml, /data-owner-form="backup-create"/);
  assert.match(historyHtml, /data-owner-recovery-history-table/);
  assert.doesNotMatch(historyHtml, /data-owner-form="backup-create"/);
});

test('owner control support route keeps runtime evidence visible without duplicating provisioning or ops panels', () => {
  const state = buildState();
  state.agents = [];
  state.agentRegistry = [];
  state.agentDevices = [];
  state.agentCredentials = [];
  state.agentProvisioning = [];

  const model = createOwnerControlV4Model(state, {
    currentRoute: 'support',
  });
  const html = buildOwnerControlV4Html(model);

  assert.equal(model.routeKind, 'support');
  assert.match(html, /id="owner-runtime-route-summary"/);
  assert.match(html, /id="owner-runtime-workspace"/);
  assert.doesNotMatch(html, /data-owner-form="create-platform-server"/);
  assert.doesNotMatch(html, /data-owner-form="provision-runtime"/);
  assert.doesNotMatch(html, /data-owner-action="run-platform-automation"/);
  assert.doesNotMatch(html, /data-owner-action="restart-managed-service"/);
  assert.match(html, /data-owner-focus-route="runtime runtime-health runtime-create-server runtime-provision-runtime incidents jobs support agents-bots fleet-diagnostics"/);
});

test('owner control jobs and agents routes split shared operations from runtime inventory', () => {
  const jobsState = buildState();
  jobsState.agents = [];
  jobsState.agentRegistry = [];
  jobsState.agentDevices = [];
  jobsState.agentCredentials = [];
  jobsState.agentProvisioning = [];

  const jobsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(jobsState, {
    currentRoute: 'jobs',
  }));
  const agentsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), {
    currentRoute: 'agents-bots',
  }));

  assert.match(jobsHtml, /id="owner-runtime-shared-ops"/);
  assert.match(jobsHtml, /data-owner-action="run-platform-automation"/);
  assert.match(jobsHtml, /data-owner-action="restart-managed-service"/);
  assert.doesNotMatch(jobsHtml, /id="owner-runtime-workspace"/);
  assert.match(agentsHtml, /id="owner-runtime-workspace"/);
  assert.match(agentsHtml, /data-owner-action="inspect-runtime"/);
  assert.match(agentsHtml, /data-owner-action="reissue-runtime-token"/);
  assert.doesNotMatch(agentsHtml, /data-owner-form="create-platform-server"/);
  assert.doesNotMatch(agentsHtml, /data-owner-form="provision-runtime"/);
  assert.doesNotMatch(agentsHtml, /data-owner-action="run-platform-automation"/);
});

test('owner control package routes split catalog creation and entitlements', () => {
  const packagesHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages' }));
  const packageCreateHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages-create' }));
  const packageEntitlementsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages-entitlements' }));
  const auditHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'audit' }));
  const diagnosticsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'diagnostics' }));

  assert.match(packagesHtml, /id="owner-packages-workspace"/);
  assert.match(packagesHtml, /data-owner-form="update-package"/);
  assert.doesNotMatch(packagesHtml, /data-owner-form="create-package"/);
  assert.doesNotMatch(packagesHtml, /odvc4-feature-table/);
  assert.match(packageCreateHtml, /data-owner-form="create-package"/);
  assert.doesNotMatch(packageCreateHtml, /data-owner-form="update-package"/);
  assert.match(packageCreateHtml, /id="owner-packages-create-form"/);
  assert.match(packageEntitlementsHtml, /odvc4-feature-table/);
  assert.doesNotMatch(packageEntitlementsHtml, /data-owner-form="create-package"/);
  assert.match(packageEntitlementsHtml, /id="owner-packages-entitlements-workspace"/);
  assert.match(auditHtml, /odvc4-audit-table/);
  assert.match(auditHtml, /id="owner-audit-workspace"/);
  assert.match(auditHtml, /data-owner-action="revoke-admin-session"/);
  assert.match(auditHtml, /data-owner-action="acknowledge-notification"/);
  assert.match(auditHtml, /data-owner-action="clear-acknowledged-notifications"/);
  assert.doesNotMatch(auditHtml, /id="owner-audit-export-console"/);
  assert.match(diagnosticsHtml, /id="owner-audit-export-console"/);
  assert.match(diagnosticsHtml, /data-owner-audit-retention-summary/);
  assert.match(diagnosticsHtml, /data-owner-audit-export-card="observability"/);
  assert.match(diagnosticsHtml, /data-owner-audit-export-card="security"/);
  assert.match(diagnosticsHtml, /data-owner-audit-export-card="notifications"/);
  assert.match(diagnosticsHtml, /data-owner-audit-export-card="delivery"/);
  assert.match(diagnosticsHtml, /\/owner\/api\/observability\/export\?format=csv/);
  assert.match(diagnosticsHtml, /\/owner\/api\/auth\/security-events\/export\?format=json/);
  assert.match(diagnosticsHtml, /\/owner\/api\/security\/rotation-check\/export\?format=csv/);
  assert.match(diagnosticsHtml, /\/owner\/api\/notifications\/export\?format=json/);
  assert.match(diagnosticsHtml, /\/owner\/api\/snapshot\/export\?format=json/);
  assert.match(diagnosticsHtml, /\/owner\/api\/delivery\/lifecycle\/export\?format=csv/);
  assert.match(diagnosticsHtml, /data-owner-form="export-tenant-diagnostics"/);
  assert.match(diagnosticsHtml, /data-owner-form="export-tenant-support-case"/);
  assert.match(diagnosticsHtml, /data-owner-form="export-delivery-lifecycle"/);
  assert.match(diagnosticsHtml, /Current request evidence window: 60 minutes/);
  assert.match(diagnosticsHtml, /Delivery overdue threshold: 20 minutes/);
});

test('owner control analytics routes split summary risk queue and package adoption', () => {
  const state = buildState();
  state.notifications = [
    {
      id: 'note-abuse',
      kind: 'delivery-abuse-suspected',
      title: 'Delivery Abuse Suspected',
      severity: 'warning',
      createdAt: '2026-03-29T08:20:00.000Z',
      acknowledged: false,
      tenantId: 'tenant-1',
      data: {
        kind: 'delivery-abuse-suspected',
        tenantId: 'tenant-1',
        count: 2,
        sample: [{ type: 'order-burst' }],
      },
    },
    {
      id: 'note-runtime',
      kind: 'runtime-offline',
      title: 'Runtime Offline',
      severity: 'critical',
      createdAt: '2026-03-29T08:22:00.000Z',
      acknowledged: false,
      tenantId: 'tenant-1',
      data: {
        kind: 'runtime-offline',
        tenantId: 'tenant-1',
        runtimeKey: 'sync-runtime',
      },
    },
  ];
  state.securityEvents = [
    { type: 'admin.login_failed', severity: 'error', createdAt: '2026-03-29T08:25:00.000Z' },
  ];
  state.requestLogs = {
    metrics: {
      windowMs: 3600000,
    },
    items: [
      { method: 'POST', path: '/owner/api/auth/login', statusCode: 503, at: '2026-03-29T08:31:00.000Z' },
    ],
  };
  state.deliveryLifecycle = {
    runtime: {
      workerStarted: false,
    },
    summary: {
      overdueCount: 2,
      poisonCandidateCount: 1,
      nonRetryableDeadLetters: 1,
    },
    actionPlan: {
      actions: [{ key: 'hold-poison-candidates', count: 1 }],
    },
  };

  const overviewHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'analytics' }));
  const riskHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'analytics-risk' }));
  const packagesHtml = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'analytics-packages' }));

  assert.match(overviewHtml, /id="owner-analytics-workspace"/);
  assert.doesNotMatch(overviewHtml, /data-owner-risk-queue="true"/);
  assert.doesNotMatch(overviewHtml, /owner-analytics-packages-workspace/);
  assert.match(riskHtml, /data-owner-risk-queue="true"/);
  assert.match(riskHtml, /data-owner-risk-item="notification-note-abuse"/);
  assert.match(riskHtml, /data-owner-risk-item="notification-note-runtime"/);
  assert.match(riskHtml, /data-owner-risk-item="delivery-lifecycle-risk"/);
  assert.match(riskHtml, /\/owner\/support\/tenant-1/);
  assert.match(riskHtml, /\/owner\/tenants\/tenant-1/);
  assert.match(riskHtml, /\/owner\/runtime/);
  assert.match(riskHtml, /\/owner\/audit/);
  assert.match(riskHtml, /data-owner-action="acknowledge-notification"/);
  assert.match(riskHtml, /data-notification-id="note-abuse"/);
  assert.match(riskHtml, /Open support case/);
  assert.match(packagesHtml, /owner-analytics-packages-workspace/);
  assert.doesNotMatch(packagesHtml, /data-owner-risk-queue="true"/);
});

test('owner control subscriptions workspace exposes quick update forms', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'subscriptions' }));

  assert.match(html, /data-owner-form="quick-update-subscription"/);
  assert.match(html, /id="owner-subscriptions-actions"/);
  assert.doesNotMatch(html, /data-owner-billing-risk-spotlight/);
  assert.doesNotMatch(html, /data-owner-billing-recovery-queue/);
  assert.match(html, /data-owner-focus-route="subscriptions renewal customer-success"/);
  assert.doesNotMatch(html, /owner-billing-invoices-workspace/);
  assert.doesNotMatch(html, /owner-billing-attempts-workspace/);
  assert.doesNotMatch(html, /data-owner-action="update-billing-invoice-status"/);
  assert.doesNotMatch(html, /data-owner-action="update-payment-attempt-status"/);
});

test('owner control subscription registry route isolates the registry table', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'subscriptions-registry' }));

  assert.match(html, /owner-subscriptions-registry-workspace/);
  assert.doesNotMatch(html, /data-owner-form="quick-update-subscription"/);
  assert.doesNotMatch(html, /owner-billing-invoices-workspace/);
  assert.doesNotMatch(html, /owner-billing-attempts-workspace/);
});

test('owner control billing recovery route isolates overdue and failed-payment follow-up', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'billing-recovery' }));

  assert.match(html, /owner-billing-recovery-queue/);
  assert.match(html, /data-owner-billing-recovery-item="attempt-pay-1"/);
  assert.match(html, /data-owner-focus-route="billing recovery attempts"/);
  assert.doesNotMatch(html, /owner-subscriptions-actions/);
  assert.doesNotMatch(html, /owner-subscriptions-registry-workspace/);
  assert.doesNotMatch(html, /owner-billing-invoices-workspace/);
  assert.doesNotMatch(html, /owner-billing-attempts-workspace/);
});

test('owner control subscriptions workspace exposes reactivate action for canceled subscriptions', () => {
  const state = buildState();
  state.subscriptions[0].status = 'canceled';
  state.subscriptions[0].canceledAt = '2026-03-30T09:00:00.000Z';

  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'billing-recovery' }));

  assert.match(html, /owner-billing-recovery-queue/);
  assert.match(html, /data-owner-action="reactivate-billing-subscription"/);
});

test('owner control billing workspace focuses invoice and payment attempt operations', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'billing' }));
  const recoveryHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'billing-recovery' }));
  const attemptsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'billing-attempts' }));

  assert.match(html, /data-owner-billing-export-actions/);
  assert.match(html, /owner-billing-invoices-workspace/);
  assert.match(html, /data-owner-action="update-billing-invoice-status"/);
  assert.match(html, /\/owner\/api\/platform\/billing\/export\?format=csv/);
  assert.match(html, /\/owner\/api\/platform\/billing\/export\?format=json/);
  assert.doesNotMatch(html, /data-owner-form="quick-update-subscription"/);
  assert.doesNotMatch(html, /owner-billing-recovery-queue/);
  assert.doesNotMatch(html, /owner-billing-attempts-workspace/);
  assert.doesNotMatch(html, /data-owner-action="update-payment-attempt-status"/);
  assert.match(recoveryHtml, /owner-billing-recovery-queue/);
  assert.doesNotMatch(recoveryHtml, /owner-billing-invoices-workspace/);
  assert.doesNotMatch(recoveryHtml, /owner-billing-attempts-workspace/);
  assert.match(attemptsHtml, /owner-billing-attempts-workspace/);
  assert.match(attemptsHtml, /data-owner-action="update-payment-attempt-status"/);
  assert.doesNotMatch(attemptsHtml, /owner-billing-invoices-workspace/);
  assert.doesNotMatch(attemptsHtml, /data-owner-action="update-billing-invoice-status"/);
});

test('owner control billing recovery route prioritizes past-due invoices and subscription recovery', () => {
  const state = buildState();
  state.billingInvoices.unshift({
    id: 'inv-2',
    tenantId: 'tenant-1',
    subscriptionId: 'sub-1',
    status: 'past_due',
    amountCents: 99000,
    currency: 'THB',
    dueAt: '2026-03-30T08:30:00.000Z',
    metadata: { targetPlanId: 'pro-monthly', targetPackageId: 'PRO', targetBillingCycle: 'monthly' },
  });
  state.subscriptions[0].status = 'canceled';
  state.subscriptions[0].canceledAt = '2026-03-30T09:00:00.000Z';

  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'billing-recovery' }));

  assert.match(html, /data-owner-billing-recovery-item="invoice-inv-2"/);
  assert.match(html, /data-owner-billing-recovery-item="subscription-sub-1"/);
  assert.match(html, /data-owner-action="reactivate-billing-subscription"/);
  assert.match(html, /data-owner-action="retry-billing-checkout"/);
});

test('owner control billing recovery route shows a calm recovery queue when billing is healthy', () => {
  const state = buildState();
  state.billingPaymentAttempts[0].status = 'succeeded';

  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'billing-recovery' }));

  assert.match(html, /data-owner-billing-recovery-queue/);
  assert.doesNotMatch(html, /data-owner-billing-recovery-item="/);
  assert.match(html, /No urgent billing recovery work/);
});

test('owner control settings overview stays summary-only after policy routes split out', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings' }));

  assert.match(html, /data-owner-focus-route="settings overview governance"/);
  assert.doesNotMatch(html, /id="owner-settings-access-policy"/);
  assert.doesNotMatch(html, /id="owner-settings-portal-policy"/);
  assert.doesNotMatch(html, /id="owner-settings-billing-policy"/);
  assert.doesNotMatch(html, /id="owner-settings-runtime-policy"/);
  assert.doesNotMatch(html, /id="owner-settings-admin-users"/);
  assert.doesNotMatch(html, /id="owner-settings-managed-services"/);
});

test('owner control subscriptions workspace can create the first subscription from the page', () => {
  const state = buildState();
  state.subscriptions = [];
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'subscriptions' }));

  assert.match(html, /data-owner-form="quick-update-subscription"/);
  assert.match(html, /owner-subscriptions-actions/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /owner-subscriptions-registry-workspace/);
  assert.doesNotMatch(html, /owner-billing-invoices-workspace/);
});

test('owner control settings routes split policy admin users and services', () => {
  const settingsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings' }));
  const accessPolicyHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-access-policy' }));
  const portalPolicyHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-portal-policy' }));
  const billingPolicyHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-billing-policy' }));
  const runtimePolicyHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-runtime-policy' }));
  const adminUsersHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-admin-users' }));
  const servicesHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-services' }));

  assert.doesNotMatch(settingsHtml, /owner-settings-access-policy/);
  assert.doesNotMatch(settingsHtml, /owner-settings-billing-policy/);
  assert.doesNotMatch(settingsHtml, /owner-settings-runtime-policy/);
  assert.doesNotMatch(settingsHtml, /owner-settings-admin-users/);
  assert.doesNotMatch(settingsHtml, /owner-settings-managed-services/);
  assert.doesNotMatch(settingsHtml, /owner-settings-automation-workspace/);
  assert.match(accessPolicyHtml, /owner-settings-access-policy/);
  assert.doesNotMatch(accessPolicyHtml, /owner-settings-portal-policy/);
  assert.doesNotMatch(accessPolicyHtml, /owner-settings-billing-policy/);
  assert.match(portalPolicyHtml, /owner-settings-portal-policy/);
  assert.doesNotMatch(portalPolicyHtml, /owner-settings-access-policy/);
  assert.match(billingPolicyHtml, /owner-settings-billing-policy/);
  assert.doesNotMatch(billingPolicyHtml, /owner-settings-runtime-policy/);
  assert.match(runtimePolicyHtml, /owner-settings-runtime-policy/);
  assert.doesNotMatch(runtimePolicyHtml, /owner-settings-billing-policy/);
  assert.match(adminUsersHtml, /owner-settings-admin-users/);
  assert.match(adminUsersHtml, /data-owner-form="upsert-admin-user"/);
  assert.doesNotMatch(adminUsersHtml, /owner-settings-managed-services/);
  assert.match(servicesHtml, /owner-settings-managed-services/);
  assert.match(servicesHtml, /data-owner-action="restart-managed-service"/);
  assert.doesNotMatch(servicesHtml, /owner-settings-admin-users/);
});

test('owner control control route removes duplicated settings panels', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'control' }));

  assert.match(html, /owner-settings-managed-services/);
  assert.match(html, /data-owner-action="restart-managed-service"/);
  assert.doesNotMatch(html, /owner-settings-access-policy/);
  assert.doesNotMatch(html, /owner-settings-portal-policy/);
  assert.doesNotMatch(html, /owner-settings-billing-policy/);
  assert.doesNotMatch(html, /owner-settings-runtime-policy/);
  assert.doesNotMatch(html, /owner-settings-automation-workspace/);
  assert.doesNotMatch(html, /data-owner-form="upsert-admin-user"/);
});

test('owner control automation route isolates shared automation controls', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'automation' }));

  assert.match(html, /owner-settings-automation-workspace/);
  assert.match(html, /data-owner-action="run-platform-automation"/);
  assert.match(html, /data-owner-automation-recovery/);
  assert.doesNotMatch(html, /owner-settings-access-policy/);
  assert.doesNotMatch(html, /owner-settings-runtime-policy/);
  assert.doesNotMatch(html, /data-owner-form="upsert-admin-user"/);
  assert.doesNotMatch(html, /data-owner-action="restart-managed-service"/);
});

test('owner control audit variants keep access, security, and diagnostics distinct', () => {
  const accessHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'access' }));
  const securityHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'security' }));
  const diagnosticsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'diagnostics' }));

  assert.match(accessHtml, /data-owner-action="revoke-admin-session"/);
  assert.match(accessHtml, /\/owner\/settings#owner-settings-access-policy/);
  assert.match(accessHtml, /\/owner\/diagnostics#owner-audit-export-console/);
  assert.doesNotMatch(accessHtml, /login\.step_up/);
  assert.doesNotMatch(accessHtml, /id="owner-audit-export-console"/);
  assert.match(securityHtml, /login\.step_up/);
  assert.match(securityHtml, /\/owner\/access/);
  assert.match(securityHtml, /\/owner\/settings#owner-settings-access-policy/);
  assert.doesNotMatch(securityHtml, /GET<\/td><td>\/owner\/api\/platform\/overview/);
  assert.doesNotMatch(securityHtml, /id="owner-audit-export-console"/);
  assert.match(diagnosticsHtml, /owner-audit-export-console/);
  assert.match(diagnosticsHtml, /data-owner-audit-export-card="observability"/);
  assert.doesNotMatch(diagnosticsHtml, /data-owner-action="revoke-admin-session"/);
  assert.doesNotMatch(diagnosticsHtml, /data-owner-action="acknowledge-notification"/);
});

test('owner control automation route renders manual automation preview data', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), {
    currentRoute: 'automation',
    automationPreview: {
      dryRun: true,
      generatedAt: '2026-03-29T10:03:00.000Z',
      skipped: false,
      runtimeSupervisor: {
        overall: 'degraded',
        counts: {
          online: 3,
          offline: 1,
          degraded: 1,
        },
      },
      evaluated: [
        {
          runtimeKey: 'watcher',
          runtimeLabel: 'Watcher',
          serviceKey: 'watcher',
          decision: 'restart',
          reason: 'runtime-offline',
        },
      ],
      actions: [
        {
          runtimeKey: 'watcher',
          runtimeLabel: 'Watcher',
          serviceKey: 'watcher',
          status: 'offline',
          reason: 'runtime-offline',
          dryRun: true,
          ok: true,
        },
      ],
      automationConfig: {
        enabled: true,
        maxActionsPerCycle: 3,
        maxAttemptsPerRuntime: 2,
      },
    },
  }));

  assert.match(html, /data-owner-automation-preview/);
  assert.match(html, /data-owner-automation-actions/);
  assert.match(html, /data-owner-automation-decisions/);
  assert.match(html, /Latest automation report/);
  assert.match(html, /Watcher/);
});

test('owner control forms expose autocomplete hints for live owner workflows', () => {
  const tenantHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'tenant-tenant-1' }));
  const packagesCreateHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages-create' }));
  const settingsAdminHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings-admin-users' }));

  assert.match(tenantHtml, /name="name"[^>]*autocomplete="organization"/);
  assert.match(tenantHtml, /name="ownerName"[^>]*autocomplete="name"/);
  assert.match(tenantHtml, /name="ownerEmail"[^>]*autocomplete="email"/);
  assert.match(settingsAdminHtml, /name="username"[^>]*autocomplete="username"/);
  assert.match(settingsAdminHtml, /name="password"[^>]*autocomplete="new-password"/);
  assert.match(packagesCreateHtml, /name="id"[^>]*autocomplete="off"/);
  assert.match(packagesCreateHtml, /name="title"[^>]*autocomplete="off"/);
});
