const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clearDeliveryAudit,
  flushDeliveryAuditStoreWrites,
  listDeliveryAudit,
  replaceDeliveryAudit,
} = require('../src/store/deliveryAuditStore');
const {
  runWithDeliveryPersistenceScope,
} = require('../src/services/deliveryPersistenceDb');

test('replaceDeliveryAudit dedupes duplicate ids and persists the latest row once', async (t) => {
  const tenantId = `tenant-audit-${Date.now()}`;
  const auditId = `audit-${Date.now()}`;

  t.after(async () => {
    clearDeliveryAudit({ tenantId });
    await flushDeliveryAuditStoreWrites();
    await runWithDeliveryPersistenceScope(tenantId, (db) =>
      db.deliveryAudit.deleteMany({ where: { tenantId } }),
    ).catch(() => null);
  });

  replaceDeliveryAudit([
    {
      id: auditId,
      tenantId,
      action: 'delivery-sent',
      message: 'first',
      createdAt: '2026-04-03T00:00:00.000Z',
    },
    {
      id: auditId,
      tenantId,
      action: 'delivery-sent',
      message: 'second',
      createdAt: '2026-04-03T00:01:00.000Z',
    },
  ], { tenantId });
  await flushDeliveryAuditStoreWrites();

  const rows = await runWithDeliveryPersistenceScope(tenantId, (db) =>
    db.deliveryAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    }),
  );

  assert.equal(rows.length, 1);
  assert.equal(String(rows[0]?.id || ''), auditId);
  assert.equal(String(rows[0]?.message || ''), 'second');

  const listed = listDeliveryAudit(10, { tenantId });
  assert.equal(listed.length, 1);
  assert.equal(String(listed[0]?.message || ''), 'second');
});
