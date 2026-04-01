const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAdminGetRoutes,
} = require('../src/admin/api/adminGetRoutes');

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
    },
    end(body = null) {
      this.ended = true;
      this.body = body;
    },
  };
}

function buildRoutes(overrides = {}) {
  return createAdminGetRoutes({
    sendJson(res, statusCode, payload) {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    },
    sendDownload(res, statusCode, content, options = {}) {
      res.writeHead(statusCode, {
        'content-type': options.contentType || 'application/octet-stream',
        'content-disposition': `attachment; filename="${options.filename || 'download.txt'}"`,
      });
      res.end(content);
    },
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId || null,
    getAuthTenantId: () => null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    listBillingInvoices: async () => ([
      {
        id: 'inv-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        status: 'paid',
        amountCents: 99000,
        currency: 'THB',
        paidAt: '2026-04-01T10:00:00.000Z',
      },
      {
        id: 'inv-2',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        status: 'disputed',
        amountCents: 99000,
        currency: 'THB',
        dueAt: '2026-04-02T10:00:00.000Z',
      },
    ]),
    listBillingPaymentAttempts: async () => ([
      {
        id: 'pay-1',
        tenantId: 'tenant-1',
        invoiceId: 'inv-2',
        provider: 'stripe',
        status: 'failed',
        amountCents: 99000,
        currency: 'THB',
        attemptedAt: '2026-04-01T10:05:00.000Z',
        errorCode: 'card_declined',
      },
    ]),
    getBillingProviderConfigSummary: () => ({
      provider: 'stripe',
      mode: 'configured',
      configured: true,
    }),
    jsonReplacer: null,
    ...overrides,
  });
}

test('admin billing export route returns JSON payload with summary and records', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/export?tenantId=tenant-1'),
    pathname: '/admin/api/platform/billing/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /application\/json/i);
  assert.match(String(res.headers['content-disposition'] || ''), /billing-export-tenant-1/i);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.tenantId, 'tenant-1');
  assert.equal(payload.data.summary.invoiceCount, 2);
  assert.equal(payload.data.summary.disputedInvoiceCount, 1);
  assert.equal(payload.data.summary.failedAttemptCount, 1);
  assert.equal(payload.data.invoices.length, 2);
  assert.equal(payload.data.paymentAttempts.length, 1);
});

test('admin billing export route returns CSV payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/export?tenantId=tenant-1&format=csv'),
    pathname: '/admin/api/platform/billing/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/csv/i);
  assert.match(String(res.headers['content-disposition'] || ''), /billing-export-tenant-1/i);
  assert.match(String(res.body || ''), /section,tenantId,recordId,status,amountCents,currency,provider,timestamp,detail/);
  assert.match(String(res.body || ''), /summary,tenant-1,invoiceCount/);
  assert.match(String(res.body || ''), /invoice,tenant-1,inv-2,disputed/);
  assert.match(String(res.body || ''), /payment_attempt,tenant-1,pay-1,failed,99000,THB,stripe/);
});
