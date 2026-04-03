const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createOwnerControlV4Model,
  buildOwnerControlV4Html,
} = require('../src/admin/assets/owner-control-v4.js');

function buildState() {
  return {
    overview: {
      packages: [
        { id: 'TRIAL', title: 'Trial', description: 'Entry plan', features: ['sync_agent'] },
        { id: 'PRO', title: 'Pro', description: 'Full plan', features: ['sync_agent', 'execute_agent'] },
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
        tenants: { total: 1, active: 1 },
        subscriptions: { mrrCents: 120000 },
        delivery: { failedJobs: 1, queueDepth: 2 },
      },
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
        status: 'past_due',
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
    billingInvoices: [
      {
        id: 'inv-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        status: 'past_due',
        amountCents: 99000,
        currency: 'THB',
        dueAt: '2026-03-29T08:15:00.000Z',
        metadata: { targetPlanId: 'pro-monthly', targetPackageId: 'PRO', targetBillingCycle: 'monthly' },
      },
    ],
    billingPaymentAttempts: [
      {
        id: 'attempt-1',
        tenantId: 'tenant-1',
        invoiceId: 'inv-1',
        subscriptionId: 'sub-1',
        provider: 'stripe',
        status: 'failed',
        amountCents: 99000,
        currency: 'THB',
        attemptedAt: '2026-03-29T08:16:00.000Z',
        errorCode: 'card_declined',
        errorDetail: 'Customer card requires a retry.',
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
        runtimeKind: 'server-bots',
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
  };
}

function buildSupportCase() {
  return {
    tenantId: 'tenant-1',
    lifecycle: {
      label: 'needs attention',
      detail: 'Delivery and alert signals still need owner follow-up.',
      tone: 'warning',
    },
    onboarding: {
      completed: 2,
      total: 3,
      requiredCompleted: 1,
      requiredTotal: 2,
      items: [
        { key: 'tenant-record', required: true, status: 'done', detail: 'Tenant exists' },
      ],
    },
    signals: {
      total: 3,
      items: [
        { key: 'dead-letters', tone: 'danger', count: 1, detail: 'A failed delivery still needs review.' },
      ],
    },
    actions: [
      { key: 'inspect-dead-letters', tone: 'danger', detail: 'Retry or clear the failed delivery before closing the case.' },
    ],
    diagnostics: {
      delivery: {
        deadLetters: 1,
        anomalies: 0,
      },
      notifications: [
        {
          id: 'note-1',
          title: 'Queue warning',
          detail: 'Delivery worker needs review',
          severity: 'warning',
          createdAt: '2026-03-29T09:00:00.000Z',
          acknowledged: false,
        },
      ],
      requestErrors: {
        summary: { total: 1 },
        items: [
          {
            method: 'POST',
            path: '/owner/api/platform/subscription/update',
            statusCode: 500,
            detail: 'Simulated billing failure',
            at: '2026-03-29T09:05:00.000Z',
          },
        ],
      },
    },
  };
}

test('tenant detail workspace exposes support shortcut and tenant runtime actions', () => {
  const model = createOwnerControlV4Model(buildState(), {
    currentRoute: 'tenant-tenant-1',
    supportCase: buildSupportCase(),
    supportCaseLoading: false,
  });
  const html = buildOwnerControlV4Html(model);
  assert.match(html, /href="\/owner\/support\/tenant-1"/);
  assert.match(html, /data-owner-form="update-tenant"/);
  assert.match(html, /id="owner-tenant-detail-runtime-live"/);
  assert.match(html, /id="owner-tenant-commercial-live"/);
  assert.doesNotMatch(html, /Commercial recovery and billing context/);
  assert.match(html, /data-owner-billing-export-actions/);
  assert.match(html, /\/owner\/api\/platform\/billing\/export\?tenantId=tenant-1&amp;format=json/);
  assert.match(html, /data-owner-action="retry-billing-checkout"/);
  assert.match(html, /data-owner-action="inspect-runtime"/);
});

test('support workspace exposes dead-letter, alert, and request-error tools', () => {
  const model = createOwnerControlV4Model(buildState(), {
    currentRoute: 'support-tenant-1',
    supportCase: buildSupportCase(),
    supportCaseLoading: false,
    supportDeadLetters: [
      {
        purchaseCode: 'PUR-001',
        tenantId: 'tenant-1',
        guildId: 'guild-1',
        itemName: 'VIP Pack',
        lastErrorCode: 'missing-steam-link',
        lastError: 'Player has no linked Steam account',
        updatedAt: '2026-03-29T09:10:00.000Z',
      },
    ],
    supportDeadLettersLoading: false,
  });
  const html = buildOwnerControlV4Html(model);
  assert.match(html, /id="owner-tenant-support-commercial-live"/);
  assert.doesNotMatch(html, /Commercial recovery and billing context/);
  assert.match(html, /data-owner-action="update-billing-invoice-status"/);
  assert.match(html, /data-owner-action="retry-billing-checkout"/);
  assert.match(html, /data-owner-action="reactivate-billing-subscription"/);
  assert.match(html, /\/owner\/api\/platform\/billing\/export\?tenantId=tenant-1&amp;format=csv/);
  assert.match(html, /id="owner-tenant-support-dead-letters-live"/);
  assert.match(html, /data-owner-action="retry-dead-letter"/);
  assert.match(html, /data-owner-action="clear-dead-letter"/);
  assert.match(html, /data-owner-action="acknowledge-notification"/);
  assert.match(html, /id="owner-tenant-support-request-errors-live"/);
});
