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
