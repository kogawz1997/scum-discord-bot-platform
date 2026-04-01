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
    requiredString(value) {
      return String(value || '').trim();
    },
    asInt(value, fallback) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    clampMetricsWindowMs(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 3600000;
    },
    parseMetricsSeriesKeys(value) {
      return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
    },
    getCurrentObservabilitySnapshot: async (options = {}) => ({
      windowMs: options.windowMs || 3600000,
      seriesKeys: options.seriesKeys || [],
      totals: { requests: 12, errors: 1 },
    }),
    getAdminRequestLogMetrics: () => ({
      total: 12,
      errors: 1,
    }),
    listAdminRequestLogs: () => ([
      { requestId: 'req-1', routeGroup: 'admin', statusCode: 500 },
    ]),
    buildObservabilityCsv: () => 'section,key,value\ntotals,requests,12\n',
    buildObservabilityExportPayload: (data) => ({ snapshot: data }),
    jsonReplacer: null,
    ...overrides,
  });
}

test('admin observability route returns current snapshot', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/observability?windowMs=600000&series=requests,errors'),
    pathname: '/admin/api/observability',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(String(res.body || '{}'));
  assert.equal(payload.ok, true);
  assert.equal(payload.data.windowMs, 600000);
  assert.deepEqual(payload.data.seriesKeys, ['requests', 'errors']);
});

test('admin observability export route returns csv payload', async () => {
  const handler = buildRoutes();
  const res = createMockRes();

  const handled = await handler({
    client: null,
    req: { method: 'GET', headers: {} },
    res,
    urlObj: new URL('https://admin.example.com/admin/api/observability/export?format=csv'),
    pathname: '/admin/api/observability/export',
  });

  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/csv/i);
  assert.match(String(res.body || ''), /totals,requests,12/);
});
