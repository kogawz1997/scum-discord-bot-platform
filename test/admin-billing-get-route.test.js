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
    ensureRole: () => ({ user: 'tenant-owner', role: 'owner', tenantId: 'tenant-1' }),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId || null,
    getAuthTenantId: (auth) => auth?.tenantId || null,
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    listBillingInvoices: async () => ([]),
    listBillingPaymentAttempts: async () => ([]),
    getBillingProviderConfigSummary: () => ({
      provider: 'stripe',
      mode: 'configured',
      configured: true,
    }),
    jsonReplacer: null,
    ...overrides,
  });
}

test('billing overview route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    invoicesTenantId: null,
    attemptsTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listBillingInvoices: async (options = {}) => {
      seen.invoicesTenantId = options.tenantId || null;
      return [];
    },
    listBillingPaymentAttempts: async (options = {}) => {
      seen.attemptsTenantId = options.tenantId || null;
      return [];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/overview'),
    pathname: '/admin/api/platform/billing/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.invoicesTenantId, 'tenant-1');
  assert.equal(seen.attemptsTenantId, 'tenant-1');
});

test('billing invoices route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    invoicesTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listBillingInvoices: async (options = {}) => {
      seen.invoicesTenantId = options.tenantId || null;
      return [];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/invoices'),
    pathname: '/admin/api/platform/billing/invoices',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.invoicesTenantId, 'tenant-1');
});

test('billing payment attempts route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    attemptsTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listBillingPaymentAttempts: async (options = {}) => {
      seen.attemptsTenantId = options.tenantId || null;
      return [];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/payment-attempts'),
    pathname: '/admin/api/platform/billing/payment-attempts',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.attemptsTenantId, 'tenant-1');
});

test('billing export route falls back to auth tenant when tenantId query is omitted', async () => {
  const seen = {
    requestedTenantId: null,
    invoicesTenantId: null,
    attemptsTenantId: null,
  };
  const handler = buildRoutes({
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => {
      seen.requestedTenantId = requestedTenantId;
      return requestedTenantId || null;
    },
    listBillingInvoices: async (options = {}) => {
      seen.invoicesTenantId = options.tenantId || null;
      return [];
    },
    listBillingPaymentAttempts: async (options = {}) => {
      seen.attemptsTenantId = options.tenantId || null;
      return [];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/export'),
    pathname: '/admin/api/platform/billing/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.requestedTenantId, 'tenant-1');
  assert.equal(seen.invoicesTenantId, 'tenant-1');
  assert.equal(seen.attemptsTenantId, 'tenant-1');
  assert.match(String(res.headers['content-disposition'] || ''), /billing-export-tenant-1/i);
});

test('billing overview route passes allowGlobal for owner global reads', async () => {
  const seen = {
    invoicesAllowGlobal: null,
    attemptsAllowGlobal: null,
  };
  const handler = buildRoutes({
    ensureRole: () => ({ user: 'owner-global', role: 'owner', tenantId: null }),
    resolveScopedTenantId: () => null,
    listBillingInvoices: async (options = {}) => {
      seen.invoicesAllowGlobal = options.allowGlobal === true;
      return [];
    },
    listBillingPaymentAttempts: async (options = {}) => {
      seen.attemptsAllowGlobal = options.allowGlobal === true;
      return [];
    },
  });
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/platform/billing/overview'),
    pathname: '/admin/api/platform/billing/overview',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(seen.invoicesAllowGlobal, true);
  assert.equal(seen.attemptsAllowGlobal, true);
});
