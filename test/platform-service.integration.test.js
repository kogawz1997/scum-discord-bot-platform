const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const crypto = require('node:crypto');

const { prisma, getTenantScopedPrismaClient, disconnectAllPrismaClients } = require('../src/prisma');
const {
  acceptPlatformLicenseLegal,
  createMarketplaceOffer,
  createPlatformApiKey,
  createPlatformWebhookEndpoint,
  createSubscription,
  createTenant,
  getTenantQuotaSnapshot,
  getPlatformAnalyticsOverview,
  getPlatformPublicOverview,
  issuePlatformLicense,
  listPlatformSubscriptions,
  recordPlatformAgentHeartbeat,
  reconcileDeliveryState,
  verifyPlatformApiKey,
} = require('../src/services/platformService');

async function cleanupPlatformTables() {
  await prisma.$transaction([
    prisma.platformMarketplaceOffer.deleteMany({}),
    prisma.platformAgentRuntime.deleteMany({}),
    prisma.platformWebhookEndpoint.deleteMany({}),
    prisma.platformApiKey.deleteMany({}),
    prisma.platformLicense.deleteMany({}),
    prisma.platformSubscription.deleteMany({}),
    prisma.platformTenant.deleteMany({}),
    prisma.deliveryAudit.deleteMany({}),
    prisma.deliveryDeadLetter.deleteMany({}),
    prisma.deliveryQueueJob.deleteMany({}),
    prisma.purchase.deleteMany({
      where: {
        code: {
          startsWith: 'PLATFORM-TEST-',
        },
      },
    }),
    prisma.shopItem.deleteMany({
      where: {
        id: {
          startsWith: 'platform-test-',
        },
      },
    }),
    prisma.vipMembership.deleteMany({
      where: {
        userId: {
          startsWith: 'platform-test-',
        },
      },
    }),
  ]);
  await prisma.$executeRawUnsafe('DELETE FROM platform_tenant_configs').catch(() => null);
}

function randomPort() {
  return 39500 + Math.floor(Math.random() * 500);
}

function isPostgresRuntime() {
  return /^postgres(?:ql)?:\/\//i.test(String(process.env.DATABASE_URL || '').trim());
}

test('platform service manages tenant lifecycle, webhook delivery, analytics, and reconcile output', async (t) => {
  await cleanupPlatformTables();
  t.after(async () => {
    await cleanupPlatformTables();
  });

  const received = [];
  const port = randomPort();
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk || '');
    });
    req.on('end', () => {
      received.push({
        url: req.url,
        headers: req.headers,
        body,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const tenant = await createTenant({
    id: 'tenant-test-platform',
    slug: 'tenant-platform',
    name: 'Tenant Platform',
    type: 'reseller',
    ownerEmail: 'ops@example.com',
  }, 'test');
  assert.equal(tenant.ok, true);

  const subscription = await createSubscription({
    tenantId: tenant.tenant.id,
    planId: 'platform-starter',
    amountCents: 490000,
  }, 'test');
  assert.equal(subscription.ok, true);

  const license = await issuePlatformLicense({
    tenantId: tenant.tenant.id,
    seats: 5,
  }, 'test');
  assert.equal(license.ok, true);
  assert.match(String(license.license.licenseKey || ''), /^[A-F0-9-]{10,}$/);

  const accepted = await acceptPlatformLicenseLegal({
    licenseId: license.license.id,
  }, 'test');
  assert.equal(accepted.ok, true);
  assert.ok(accepted.license.legalAcceptedAt);

  const apiKey = await createPlatformApiKey({
    tenantId: tenant.tenant.id,
    name: 'Tenant Integration',
    scopes: ['tenant:read', 'analytics:read', 'agent:write', 'delivery:reconcile'],
  }, 'test');
  assert.equal(apiKey.ok, true);
  assert.match(String(apiKey.rawKey || ''), /^sk_/);

  const verified = await verifyPlatformApiKey(apiKey.rawKey, ['analytics:read']);
  assert.equal(verified.ok, true);
  assert.equal(String(verified.tenant?.id || ''), tenant.tenant.id);

  const webhook = await createPlatformWebhookEndpoint({
    tenantId: tenant.tenant.id,
    name: 'Agent Hook',
    eventType: 'platform.agent.heartbeat',
    targetUrl: `http://127.0.0.1:${port}/hook`,
  }, 'test');
  assert.equal(webhook.ok, true);

  const agent = await recordPlatformAgentHeartbeat({
    tenantId: tenant.tenant.id,
    runtimeKey: 'agent-stable',
    version: '1.0.0',
    channel: 'stable',
    meta: { os: 'windows' },
  }, 'test');
  assert.equal(agent.ok, true);
  assert.equal(String(agent.runtime.status || ''), 'online');

  const outdatedAgent = await recordPlatformAgentHeartbeat({
    tenantId: tenant.tenant.id,
    runtimeKey: 'agent-old',
    version: '0.8.0',
    minRequiredVersion: '1.0.0',
  }, 'test');
  assert.equal(outdatedAgent.ok, true);
  assert.equal(String(outdatedAgent.runtime.status || ''), 'outdated');

  assert.equal(received.length >= 2, true);
  assert.match(String(received[0]?.headers?.['x-scum-platform-event'] || ''), /platform\.agent\.heartbeat/i);

  const offer = await createMarketplaceOffer({
    tenantId: tenant.tenant.id,
    title: 'Managed Delivery Package',
    kind: 'service',
    priceCents: 150000,
  }, 'test');
  assert.equal(offer.ok, true);

  const tenantPrisma = getTenantScopedPrismaClient(tenant.tenant.id);

  await tenantPrisma.purchase.createMany({
    data: [
      {
        code: 'PLATFORM-TEST-DELIVERED',
        tenantId: tenant.tenant.id,
        userId: 'user-platform-1',
        itemId: 'platform-test-item-1',
        price: 100,
        status: 'delivered',
      },
      {
        code: 'PLATFORM-TEST-FAILED',
        tenantId: tenant.tenant.id,
        userId: 'user-platform-1',
        itemId: 'platform-test-item-1',
        price: 100,
        status: 'delivery_failed',
      },
      {
        code: 'PLATFORM-TEST-STUCK',
        tenantId: tenant.tenant.id,
        userId: 'user-platform-2',
        itemId: 'platform-test-item-2',
        price: 100,
        status: 'pending',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        statusUpdatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
  });
  await tenantPrisma.shopItem.createMany({
    data: [
      {
        id: 'platform-test-item-1',
        name: 'Platform Item 1',
        price: 100,
        description: 'platform item',
        kind: 'item',
        gameItemId: 'Weapon_M1911',
      },
      {
        id: 'platform-test-item-2',
        name: 'Platform Item 2',
        price: 100,
        description: 'platform item',
        kind: 'item',
        gameItemId: 'Weapon_AK47',
      },
      {
        id: 'platform-test-vip',
        name: 'Platform VIP',
        price: 500,
        description: 'platform vip',
        kind: 'vip',
      },
    ],
  });
  await tenantPrisma.purchase.create({
    data: {
      code: 'PLATFORM-TEST-VIP-PENDING',
      tenantId: tenant.tenant.id,
      userId: 'platform-test-vip-user',
      itemId: 'platform-test-vip',
      price: 500,
      status: 'pending',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      statusUpdatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  const analytics = await getPlatformAnalyticsOverview({ allowGlobal: true });
  assert.equal(Number(analytics.tenants.total || 0) >= 1, true);
  assert.equal(Number(analytics.subscriptions.total || 0) >= 1, true);
  assert.equal(Number(analytics.licenses.acceptedLegal || 0) >= 1, true);
  assert.equal(Number(analytics.marketplace.offers || 0) >= 1, true);
  assert.equal(Number(analytics.delivery.purchaseCount30d || 0) >= 3, true);

  const scopedAnalytics = await getPlatformAnalyticsOverview({ tenantId: tenant.tenant.id });
  assert.equal(String(scopedAnalytics.scope?.tenantId || ''), tenant.tenant.id);
  assert.equal(Number(scopedAnalytics.tenants.total || 0), 1);
  assert.equal(Number(scopedAnalytics.subscriptions.total || 0), 1);
  assert.equal(Number(scopedAnalytics.delivery.purchaseCount30d || 0), 4);

  const quota = await getTenantQuotaSnapshot(tenant.tenant.id);
  assert.equal(quota.ok, true);
  assert.equal(String(quota.package?.id || ''), 'BOT_LOG_DELIVERY');
  assert.ok(quota.enabledFeatureKeys.includes('sync_agent'));
  assert.ok(quota.enabledFeatureKeys.includes('execute_agent'));

  const reconcile = await reconcileDeliveryState({
    pendingOverdueMs: 5 * 60 * 1000,
    allowGlobal: true,
  });
  assert.equal(Number(reconcile.summary.anomalies || 0) >= 3, true);
  assert.ok(
    reconcile.anomalies.some((entry) => String(entry.type || '') === 'delivered-without-audit'),
  );
  assert.ok(
    reconcile.anomalies.some((entry) => String(entry.type || '') === 'failed-without-dead-letter'),
  );
  assert.ok(
    !reconcile.anomalies.some((entry) => String(entry.code || '') === 'PLATFORM-TEST-VIP-PENDING'),
  );

  const scopedReconcile = await reconcileDeliveryState({
    tenantId: tenant.tenant.id,
    pendingOverdueMs: 5 * 60 * 1000,
  });
  assert.equal(String(scopedReconcile.scope?.tenantId || ''), tenant.tenant.id);
  assert.ok(
    scopedReconcile.anomalies.every((entry) =>
      String(entry.code || '').startsWith('PLATFORM-TEST-') || String(entry.code || '') === tenant.tenant.id || String(entry.type || '').startsWith('agent-') || String(entry.type || '').startsWith('webhook-')),
  );

  const publicOverview = await getPlatformPublicOverview();
  assert.equal(Boolean(publicOverview.trial?.enabled), true);
  assert.ok(Array.isArray(publicOverview.billing?.plans));
  assert.ok(Array.isArray(publicOverview.billing?.packages));
  assert.ok(Array.isArray(publicOverview.billing?.features));
  assert.ok(publicOverview.billing.packages.some((entry) => String(entry?.id || '') === 'FULL_OPTION'));
  assert.ok(publicOverview.billing.features.some((entry) => String(entry?.key || '') === 'sync_agent'));
  assert.ok(Array.isArray(publicOverview.legal?.docs));
  assert.match(String(publicOverview.legal.docs?.[0]?.url || ''), /^\/docs\//);
});

test('platform service strict mode requires explicit global access for tenant-scoped analytics and reconcile', async (t) => {
  const previousMode = process.env.TENANT_DB_ISOLATION_MODE;
  process.env.TENANT_DB_ISOLATION_MODE = 'postgres-rls-strict';
  t.after(() => {
    if (previousMode == null) {
      delete process.env.TENANT_DB_ISOLATION_MODE;
      return;
    }
    process.env.TENANT_DB_ISOLATION_MODE = previousMode;
  });

  await assert.rejects(
    () => getPlatformAnalyticsOverview(),
    /requires tenantId/i,
  );
  await assert.rejects(
    () => reconcileDeliveryState(),
    /requires tenantId/i,
  );

  const analytics = await getPlatformAnalyticsOverview({ allowGlobal: true });
  assert.equal(Boolean(analytics.generatedAt), true);

  const reconcile = await reconcileDeliveryState({ allowGlobal: true });
  assert.equal(Boolean(reconcile.generatedAt), true);
});

test('platform service prefers tenant-scoped rows over stale shared copies', async (t) => {
  if (!isPostgresRuntime()) {
    t.skip('postgres runtime is required for scope precedence integration');
    return;
  }

  const previousMode = process.env.TENANT_DB_TOPOLOGY_MODE;
  const tenantId = `tenant-platform-precedence-${Date.now()}`;
  const subscriptionId = `sub-precedence-${Date.now()}`;
  const apiKeyId = `apikey-precedence-${Date.now()}`;
  const tenantPrismaCleanup = () => getTenantScopedPrismaClient(tenantId);

  process.env.TENANT_DB_TOPOLOGY_MODE = 'schema-per-tenant';
  await disconnectAllPrismaClients().catch(() => null);

  t.after(async () => {
    const tenantPrisma = tenantPrismaCleanup();
    await tenantPrisma.platformApiKey.deleteMany({
      where: { id: apiKeyId },
    }).catch(() => null);
    await tenantPrisma.platformSubscription.deleteMany({
      where: { id: subscriptionId },
    }).catch(() => null);
    await prisma.platformApiKey.deleteMany({
      where: { id: apiKeyId },
    }).catch(() => null);
    await prisma.platformSubscription.deleteMany({
      where: { id: subscriptionId },
    }).catch(() => null);
    await prisma.platformTenant.deleteMany({
      where: { id: tenantId },
    }).catch(() => null);
    await disconnectAllPrismaClients().catch(() => null);
    if (previousMode == null) {
      delete process.env.TENANT_DB_TOPOLOGY_MODE;
    } else {
      process.env.TENANT_DB_TOPOLOGY_MODE = previousMode;
    }
  });

  const tenant = await createTenant({
    id: tenantId,
    slug: tenantId,
    name: 'Tenant Platform Precedence',
    type: 'direct',
    ownerEmail: 'precedence@example.com',
  }, 'test');
  assert.equal(tenant.ok, true);

  const subscription = await createSubscription({
    tenantId,
    id: subscriptionId,
    planId: 'platform-starter',
    amountCents: 490000,
    status: 'active',
  }, 'test');
  assert.equal(subscription.ok, true);

  await prisma.platformSubscription.create({
    data: {
      id: subscriptionId,
      tenantId,
      planId: 'platform-starter',
      billingCycle: 'monthly',
      status: 'canceled',
      currency: 'THB',
      amountCents: 0,
      startedAt: new Date(),
      renewsAt: null,
      canceledAt: new Date(),
      externalRef: 'stale-shared-copy',
      metadataJson: JSON.stringify({ source: 'shared-stale-copy' }),
    },
  });

  const globalSubscriptions = await listPlatformSubscriptions({
    allowGlobal: true,
    limit: 200,
  });
  const resolvedSubscription = globalSubscriptions.find((row) => row.id === subscriptionId);
  assert.equal(String(resolvedSubscription?.status || ''), 'active');
  assert.equal(Number(resolvedSubscription?.amountCents || 0), 490000);

  const apiKey = await createPlatformApiKey({
    tenantId,
    id: apiKeyId,
    name: 'Scoped Key',
    scopes: ['tenant:read'],
  }, 'test');
  assert.equal(apiKey.ok, true);

  await prisma.platformApiKey.create({
    data: {
      id: apiKeyId,
      tenantId,
      name: 'Shared Stale Key',
      keyPrefix: String(apiKey.rawKey || '').slice(0, 16),
      keyHash: crypto.createHash('sha256').update(String(apiKey.rawKey || ''), 'utf8').digest('hex'),
      scopesJson: JSON.stringify(['tenant:read']),
      status: 'active',
      revokedAt: null,
    },
  });

  const tenantPrisma = tenantPrismaCleanup();
  await tenantPrisma.platformApiKey.update({
    where: { id: apiKeyId },
    data: {
      status: 'revoked',
      revokedAt: new Date(),
    },
  });

  const verified = await verifyPlatformApiKey(apiKey.rawKey, ['tenant:read']);
  assert.equal(verified.ok, false);
  assert.equal(String(verified.reason || ''), 'invalid-api-key');
});
