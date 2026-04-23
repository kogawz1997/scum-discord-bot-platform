const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildScopedRowKey,
  dedupeScopedRows,
  listDeliveryPersistenceScopes,
} = require('../src/services/deliveryPersistenceDb');

function scopedRow(row, scopeTenantId) {
  if (row && typeof row === 'object') {
    Object.defineProperty(row, '__scopeTenantId', {
      value: scopeTenantId,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
  return row;
}

test('dedupeScopedRows prefers tenant-scoped rows over shared cutover copies', () => {
  const rows = dedupeScopedRows(
    [
      scopedRow({ purchaseCode: 'P-1', tenantId: 'tenant-a' }, null),
      scopedRow({ purchaseCode: 'P-1', tenantId: 'tenant-a' }, 'tenant-a'),
      scopedRow({ purchaseCode: 'P-2', tenantId: 'tenant-a' }, 'tenant-a'),
    ],
    (row) => buildScopedRowKey(row, ['purchaseCode'], { mapSharedScopeToDefaultTenant: true }),
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].__scopeTenantId, 'tenant-a');
});

test('buildScopedRowKey maps shared rows onto the default tenant when requested', () => {
  const sharedKey = buildScopedRowKey(
    scopedRow({ userId: 'user-1' }, null),
    ['userId'],
    { mapSharedScopeToDefaultTenant: true, defaultTenantId: 'tenant-a' },
  );
  const tenantKey = buildScopedRowKey(
    scopedRow({ userId: 'user-1' }, 'tenant-a'),
    ['userId'],
    { mapSharedScopeToDefaultTenant: true, defaultTenantId: 'tenant-a' },
  );

  assert.equal(sharedKey, tenantKey);
});

test('delivery persistence scope enumeration requires allowGlobal in strict postgres mode', async () => {
  const env = {
    DATABASE_URL: 'postgresql://scum:test@localhost:5432/scum',
    TENANT_DB_ISOLATION_MODE: 'strict',
    TENANT_DB_TOPOLOGY_MODE: 'shared',
  };

  await assert.rejects(
    () => listDeliveryPersistenceScopes({ env }),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
});

test('delivery persistence scope enumeration allows explicit global reads in strict postgres mode', async () => {
  const env = {
    DATABASE_URL: 'postgresql://scum:test@localhost:5432/scum',
    TENANT_DB_ISOLATION_MODE: 'strict',
    TENANT_DB_TOPOLOGY_MODE: 'shared',
  };

  const scopes = await listDeliveryPersistenceScopes({
    env,
    allowGlobal: true,
    operation: 'delivery persistence test',
  });

  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].tenantId, null);
});
