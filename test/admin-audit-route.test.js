'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createAdminAuditRoutes } = require('../src/admin/audit/adminAuditRoutes');

function createResponseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(payload) {
      this.body = payload;
    },
  };
}

test('admin audit query route passes explicit allowGlobal for owner global reads', async () => {
  let capturedPayload = null;
  let capturedOptions = null;
  const handler = createAdminAuditRoutes({
    ensureRole: () => ({ user: 'owner', role: 'owner', tenantId: null }),
    sendJson: (_res, _status, payload) => {
      capturedPayload = payload;
    },
    sendDownload: () => {},
    requiredString: (value) => String(value || '').trim(),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId || null,
    readJsonBody: async () => ({}),
    buildAuditDatasetService: async (options) => {
      capturedOptions = options;
      return {
        view: 'wallet',
        total: 0,
        returned: 0,
        rows: [],
        tableRows: [],
      };
    },
    buildAuditExportPayloadService: (data) => data,
    buildAuditCsvService: () => '',
    listAuditPresetsService: async () => [],
    saveAuditPresetService: async () => ({}),
    deleteAuditPresetService: async () => true,
    prisma: {},
    listEvents: () => [],
    getParticipants: () => [],
    jsonReplacer: null,
  });

  const req = { method: 'GET' };
  const res = createResponseRecorder();
  const urlObj = new URL('http://localhost/admin/api/audit/query?view=wallet&userId=user-1');

  const handled = await handler({
    req,
    res,
    urlObj,
    pathname: '/admin/api/audit/query',
  });

  assert.equal(handled, true);
  assert.equal(capturedOptions.allowGlobal, true);
  assert.equal(capturedOptions.tenantId, null);
  assert.equal(capturedPayload.ok, true);
});

test('admin audit query route forwards governance audit filters', async () => {
  let capturedOptions = null;
  const handler = createAdminAuditRoutes({
    ensureRole: () => ({ user: 'tenant-admin', role: 'admin', tenantId: 'tenant-a' }),
    sendJson: () => {},
    sendDownload: () => {},
    requiredString: (value) => String(value || '').trim(),
    resolveScopedTenantId: (_req, _res, _auth, requestedTenantId) => requestedTenantId || 'tenant-a',
    readJsonBody: async () => ({}),
    buildAuditDatasetService: async (options) => {
      capturedOptions = options;
      return {
        view: 'governance',
        total: 0,
        returned: 0,
        rows: [],
        tableRows: [],
      };
    },
    buildAuditExportPayloadService: (data) => data,
    buildAuditCsvService: () => '',
    listAuditPresetsService: async () => [],
    saveAuditPresetService: async () => ({}),
    deleteAuditPresetService: async () => true,
    listAdminSecurityEventsService: async () => [],
    prisma: {},
    listEvents: () => [],
    getParticipants: () => [],
    jsonReplacer: null,
  });

  const req = { method: 'GET' };
  const res = createResponseRecorder();
  const urlObj = new URL(
    'http://localhost/admin/api/audit/query?view=governance&tenantId=tenant-a&actionType=server.restart.schedule&targetType=server&targetId=server-a&requestId=req-1',
  );

  const handled = await handler({
    req,
    res,
    urlObj,
    pathname: '/admin/api/audit/query',
  });

  assert.equal(handled, true);
  assert.equal(capturedOptions.tenantId, 'tenant-a');
  assert.equal(capturedOptions.allowGlobal, false);
  assert.equal(capturedOptions.view, 'governance');
  assert.equal(capturedOptions.actionType, 'server.restart.schedule');
  assert.equal(capturedOptions.targetType, 'server');
  assert.equal(capturedOptions.targetId, 'server-a');
  assert.equal(capturedOptions.requestId, 'req-1');
  assert.equal(typeof capturedOptions.listAdminSecurityEvents, 'function');
});
