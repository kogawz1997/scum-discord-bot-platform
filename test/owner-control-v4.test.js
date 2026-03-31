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
      items: [
        { method: 'GET', path: '/owner/api/platform/overview', statusCode: 200, at: '2026-03-29T08:30:00.000Z' },
      ],
    },
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
  assert.equal(normalizeOwnerControlRoute('observability'), 'analytics');
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
  assert.match(html, /เคสดูแลลูกค้า/);
  assert.match(html, /งานดูแลที่ควรเริ่มก่อน/);
  assert.match(html, /ส่งออก JSON/);
  assert.doesNotMatch(html, /data-owner-form="update-tenant"/);
});

test('owner control runtime workspace exposes runtime lifecycle actions', () => {
  const model = createOwnerControlV4Model(buildState(), {
    currentRoute: 'runtime-health',
    selectedRuntimeKey: 'sync-runtime',
    runtimeBootstrap: {
      rawSetupToken: 'stp_demo.token',
      bootstrap: { runtimeKey: 'sync-runtime', agentId: 'sync-1' },
    },
  });
  const html = buildOwnerControlV4Html(model);

  assert.equal(model.routeKind, 'runtime');
  assert.match(html, /data-owner-action="inspect-runtime"/);
  assert.match(html, /data-owner-action="reissue-runtime-token"/);
  assert.match(html, /data-owner-action="reset-runtime-binding"/);
  assert.match(html, /data-owner-action="revoke-runtime"/);
  assert.match(html, /setup token/i);
});

test('owner control packages and audit workspaces surface business and audit tables', () => {
  const packagesHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages' }));
  const auditHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'audit' }));

  assert.match(packagesHtml, /odvc4-feature-table/);
  assert.match(packagesHtml, /แค็ตตาล็อกแพ็กเกจและการใช้งาน/);
  assert.match(packagesHtml, /data-owner-form="create-package"/);
  assert.match(packagesHtml, /data-owner-form="update-package"/);
  assert.match(packagesHtml, /สร้างแพ็กเกจ/);
  assert.match(auditHtml, /odvc4-audit-table/);
  assert.match(auditHtml, /สัญญาณความปลอดภัยและหลักฐานออดิท/);
  assert.match(auditHtml, /data-owner-action="revoke-admin-session"/);
  assert.match(auditHtml, /data-owner-action="acknowledge-notification"/);
  assert.match(auditHtml, /data-owner-action="clear-acknowledged-notifications"/);
});

test('owner control subscriptions workspace exposes quick update forms', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'subscriptions' }));

  assert.match(html, /data-owner-form="quick-update-subscription"/);
  assert.match(html, /บันทึกการสมัครใช้งาน|สร้างการสมัครใช้งาน/);
  assert.match(html, /ภาพรวมการสมัครใช้งานและรายได้/);
  assert.match(html, /data-owner-action="update-billing-invoice-status"/);
  assert.match(html, /data-owner-action="update-payment-attempt-status"/);
  assert.match(html, /data-owner-action="retry-billing-checkout"/);
});

test('owner control settings workspace exposes billing and runtime policy forms', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings' }));

  assert.match(html, /บันทึกนโยบายสิทธิ์/);
  assert.match(html, /บันทึกนโยบายพอร์ทัล/);
  assert.match(html, /บันทึกนโยบายการชำระเงิน/);
  assert.match(html, /บันทึกนโยบายบริการ/);
  assert.match(html, /จัดการบัญชีเจ้าของระบบ/);
  assert.match(html, /ขอบเขตลูกค้า/);
  assert.match(html, /ปฏิบัติการ/);
  assert.match(html, /PLATFORM_BILLING_PROVIDER/);
  assert.match(html, /PERSIST_REQUIRE_DB/);
});

test('owner control subscriptions workspace can create the first subscription from the page', () => {
  const state = buildState();
  state.subscriptions = [];
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(state, { currentRoute: 'subscriptions' }));

  assert.match(html, /data-owner-form="quick-update-subscription"/);
  assert.match(html, /สร้างการสมัครใช้งาน/);
  assert.doesNotMatch(html, /No active subscriptions yet|ยังไม่มีข้อมูลลูกค้า/);
});

test('owner control settings workspace exposes env, admin, and service actions', () => {
  const html = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings' }));

  assert.match(html, /data-owner-form="update-control-panel-env"/);
  assert.match(html, /data-owner-form="upsert-admin-user"/);
  assert.match(html, /data-owner-action="restart-managed-service"/);
  assert.match(html, /อัปเดตนโยบายสิทธิ์ของเจ้าของระบบ/);
  assert.match(html, /บัญชีของเจ้าของระบบและทีมปฏิบัติการแพลตฟอร์ม/);
  assert.match(html, /งานของลูกค้าแต่ละรายยังอยู่ในพื้นที่ผู้ดูแลลูกค้า/);
});

test('owner control forms expose autocomplete hints for live owner workflows', () => {
  const tenantHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'tenant-tenant-1' }));
  const packagesHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'packages' }));
  const settingsHtml = buildOwnerControlV4Html(createOwnerControlV4Model(buildState(), { currentRoute: 'settings' }));

  assert.match(tenantHtml, /name="name"[^>]*autocomplete="organization"/);
  assert.match(tenantHtml, /name="ownerName"[^>]*autocomplete="name"/);
  assert.match(tenantHtml, /name="ownerEmail"[^>]*autocomplete="email"/);
  assert.match(settingsHtml, /name="username"[^>]*autocomplete="username"/);
  assert.match(settingsHtml, /name="password"[^>]*autocomplete="new-password"/);
  assert.match(packagesHtml, /แค็ตตาล็อกแพ็กเกจและการใช้งาน/);
  assert.match(packagesHtml, /สร้าง อัปเดต และเก็บถาวรแพ็กเกจเชิงพาณิชย์จากหน้า Owner/);
});
