'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAuditDataset } = require('../src/services/adminAuditService');

test('buildAuditDataset rejects global reads without explicit allowGlobal', async () => {
  await assert.rejects(
    () => buildAuditDataset({
      prisma: {
        walletLedger: {
          findMany: async () => [],
          count: async () => 0,
        },
      },
      view: 'wallet',
      userId: 'user-1',
    }),
    /admin-audit-global-scope-required/,
  );
});

test('buildAuditDataset rejects global governance audit reads without explicit allowGlobal', async () => {
  await assert.rejects(
    () => buildAuditDataset({
      view: 'governance',
      listAdminSecurityEvents: async () => [],
    }),
    /admin-audit-global-scope-required/,
  );
});

test('buildAuditDataset exposes tenant-scoped destructive governance audit rows', async () => {
  const dataset = await buildAuditDataset({
    view: 'governance',
    tenantId: 'tenant-a',
    actionType: 'server.restart.schedule',
    actor: 'owner',
    targetType: 'server',
    targetId: 'server-a',
    requestId: 'req-1',
    listAdminSecurityEvents: async () => ([
      {
        id: 'evt-1',
        at: '2026-04-22T10:00:00.000Z',
        type: 'server.restart.schedule',
        severity: 'info',
        actor: 'owner',
        role: 'owner',
        reason: 'maintenance',
        detail: 'Restart scheduled',
        data: {
          governance: true,
          tenantId: 'tenant-a',
          serverId: 'server-a',
          actionType: 'server.restart.schedule',
          targetType: 'server',
          targetId: 'server-a',
          requestId: 'req-1',
          resultStatus: 'scheduled',
        },
      },
      {
        id: 'evt-2',
        at: '2026-04-22T10:01:00.000Z',
        type: 'server.restart.schedule',
        severity: 'info',
        actor: 'owner',
        data: {
          governance: true,
          tenantId: 'tenant-b',
          serverId: 'server-b',
          actionType: 'server.restart.schedule',
          targetType: 'server',
          targetId: 'server-b',
          requestId: 'req-2',
          resultStatus: 'scheduled',
        },
      },
    ]),
  });

  assert.equal(dataset.view, 'governance');
  assert.equal(dataset.total, 1);
  assert.equal(dataset.rows.length, 1);
  assert.equal(dataset.rows[0].tenantId, 'tenant-a');
  assert.equal(dataset.rows[0].actionType, 'server.restart.schedule');
  assert.equal(dataset.rows[0].targetType, 'server');
  assert.equal(dataset.rows[0].targetId, 'server-a');
  assert.equal(dataset.rows[0].requestId, 'req-1');
  assert.equal(dataset.rows[0].resultStatus, 'scheduled');
  assert.equal(dataset.tableRows[0]['Action'], 'server.restart.schedule');
});
