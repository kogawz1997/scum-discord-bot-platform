const test = require('node:test');
const assert = require('node:assert/strict');

const { renderOwnerVNext } = require('../src/admin/assets/owner-vnext.js');

function buildPayload() {
  return {
    tenantRows: [{
      tenantId: 'demo',
      name: 'Demo Tenant',
      owner: 'Ops',
      status: 'active',
      statusTone: 'success',
      packageName: 'FULL',
      renewsAt: '2026-04-09T10:00:00.000Z',
      outstandingCents: 0,
      quotaText: 'Normal',
      quotaTone: 'success',
      licenseState: 'Licensed',
      locale: 'th',
    }],
    packages: [{
      id: 'full',
      title: 'Full',
      description: 'All features',
      status: 'active',
      features: ['Shop', 'Delivery'],
      activeTenants: 1,
    }],
    subscriptions: [{
      tenantName: 'Demo Tenant',
      packageName: 'FULL',
      status: 'active',
      billingCycle: 'monthly',
      renewsAt: '2026-04-10T00:00:00.000Z',
      amountCents: 99000,
    }],
    invoices: [{
      tenantName: 'Demo Tenant',
      tenantId: 'demo',
      id: 'inv_1',
      status: 'open',
      amountCents: 99000,
      currency: 'THB',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    paymentAttempts: [{
      tenantName: 'Demo Tenant',
      tenantId: 'demo',
      id: 'pay_1',
      invoiceId: 'inv_1',
      status: 'failed',
      provider: 'stripe',
      amountCents: 99000,
      currency: 'THB',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    deliveryAgents: [{
      displayName: 'DA-1',
      runtimeKey: 'da-1',
      status: 'online',
      tenantId: 'demo',
      version: '1.0.0',
      minimumVersion: '1.0.0',
      lastSeenAt: '2026-04-09T10:00:00.000Z',
      runtimeKind: 'delivery-agent',
    }],
    serverBots: [{
      displayName: 'SB-1',
      runtimeKey: 'sb-1',
      status: 'online',
      tenantId: 'demo',
      version: '1.0.0',
      minimumVersion: '1.0.0',
      lastSeenAt: '2026-04-09T10:00:00.000Z',
      runtimeKind: 'server-bot',
    }],
    incidents: [{
      title: 'Queue lag',
      tone: 'warning',
      detail: 'Delivery queue is delayed',
      at: '2026-04-09T10:00:00.000Z',
    }],
    requestLogs: {
      items: [{
        method: 'GET',
        path: '/owner/api/platform/overview',
        statusCode: 500,
        error: 'boom',
        at: '2026-04-09T10:00:00.000Z',
      }],
    },
    queueWatch: [{
      purchaseCode: 'PO-1',
      detail: 'retry',
      signalKey: 'queued',
      status: 'queued',
      attempts: 1,
      tenantId: 'demo',
      at: '2026-04-09T10:00:00.000Z',
    }],
    deadLetterWatch: [{
      purchaseCode: 'PO-2',
      detail: 'failed',
      signalKey: 'dead-letter',
      status: 'dead-letter',
      attempts: 2,
      tenantId: 'demo',
    }],
    deliverySummary: {
      queueCount: 1,
      deadLetterCount: 1,
      inFlightCount: 0,
      retryableDeadLetters: 1,
    },
    deliveryTopErrors: [{
      key: 'TIMEOUT',
      count: 2,
      tone: 'warning',
    }],
    deliveryActions: [{
      key: 'retry',
      count: 2,
      codes: ['TIMEOUT'],
      tone: 'warning',
    }],
    deliverySignals: [{
      key: 'lag',
      count: 1,
      detail: 'Lag spike',
      tone: 'warning',
    }],
    notifications: [{
      id: 'n1',
      title: 'Signal',
      severity: 'warning',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    securityEvents: [{
      title: 'Suspicious login',
      severity: 'warning',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    sessions: [{
      id: 's1',
      username: 'owner',
      role: 'platform',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    adminUsers: [{
      username: 'owner',
      role: 'owner',
      isActive: true,
    }],
    controlPanelSettings: {
      managedServices: [{ key: 'api', label: 'API', pm2Name: 'api' }],
      adminUsers: [{ username: 'owner', role: 'owner', isActive: true }],
      reloadRequired: false,
    },
    backupFiles: [{
      backup: 'backup-1',
      type: 'full',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    restoreHistory: [{
      backup: 'backup-1',
      status: 'completed',
      createdAt: '2026-04-09T10:00:00.000Z',
    }],
    analytics: {
      subscriptions: { mrrCents: 99000 },
    },
    ownerUi: {},
  };
}

test('owner vnext renders every primary owner route without throwing', () => {
  const routes = [
    'overview',
    'tenants',
    'packages',
    'subscriptions',
    'billing',
    'runtime-health',
    'incidents',
    'observability',
    'jobs',
    'support',
    'audit',
    'security',
    'access',
    'diagnostics',
    'settings',
    'control',
    'recovery',
    'create-tenant',
    'tenant-demo',
    'support-demo',
  ];

  for (const route of routes) {
    const target = {
      innerHTML: '',
      querySelector() {
        return null;
      },
    };
    const result = renderOwnerVNext(target, buildPayload(), { currentRoute: route, currentPage: route });
    assert.ok(result, `render result should exist for ${route}`);
    assert.match(target.innerHTML, /ownerx-shell/, `route should render owner shell for ${route}`);
  }
});
