const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/deliveryAuditStore.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const persistencePath = path.resolve(__dirname, '../src/services/deliveryPersistenceDb.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function createAuditDbHarness() {
  const rowsByScope = new Map();

  function scopeKey(tenantId) {
    return String(tenantId || '__shared__');
  }

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function getRows(tenantId) {
    const key = scopeKey(tenantId);
    if (!rowsByScope.has(key)) {
      rowsByScope.set(key, new Map());
    }
    return rowsByScope.get(key);
  }

  function buildDb(tenantId) {
    return {
      deliveryAudit: {
        async count({ where } = {}) {
          const rows = Array.from(getRows(tenantId).values());
          if (!where?.tenantId) return rows.length;
          return rows.filter((row) => String(row.tenantId || '') === String(where.tenantId)).length;
        },
        async findMany({ where, orderBy, take } = {}) {
          let rows = Array.from(getRows(tenantId).values()).map(clone);
          if (where?.tenantId) {
            rows = rows.filter((row) => String(row.tenantId || '') === String(where.tenantId));
          }
          if (orderBy?.createdAt === 'asc') {
            rows.sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')));
          }
          if (Number.isFinite(take)) {
            rows = rows.slice(0, Number(take));
          }
          return rows;
        },
        async deleteMany({ where } = {}) {
          const rows = getRows(tenantId);
          if (!where || Object.keys(where).length === 0) {
            const count = rows.size;
            rows.clear();
            return { count };
          }
          let count = 0;
          for (const [id, row] of rows.entries()) {
            if (where?.tenantId && String(row.tenantId || '') !== String(where.tenantId)) {
              continue;
            }
            if (Array.isArray(where?.id?.in) && !where.id.in.includes(id)) {
              continue;
            }
            rows.delete(id);
            count += 1;
          }
          return { count };
        },
        async upsert({ where, create, update }) {
          const id = String(where?.id || create?.id || update?.id || '').trim();
          const rows = getRows(tenantId);
          const existing = rows.get(id);
          const next = clone(existing ? { ...existing, ...update } : create);
          rows.set(id, next);
          return clone(next);
        },
      },
    };
  }

  return {
    prisma: buildDb(null),
    runWithDeliveryPersistenceScope(tenantId, work) {
      return work(buildDb(tenantId));
    },
    readAcrossDeliveryPersistenceScopes() {
      return [];
    },
    snapshot(tenantId = null) {
      return Array.from(getRows(tenantId).values()).map(clone);
    },
  };
}

function loadStoreWithMocks(harness) {
  clearModule(storePath);
  installMock(prismaPath, {
    prisma: harness.prisma,
  });
  installMock(persistencePath, {
    normalizeTenantId(value) {
      const text = String(value || '').trim();
      return text || null;
    },
    runWithDeliveryPersistenceScope(tenantId, work) {
      return harness.runWithDeliveryPersistenceScope(tenantId, work);
    },
    readAcrossDeliveryPersistenceScopes() {
      return harness.readAcrossDeliveryPersistenceScopes();
    },
    groupRowsByTenant(rows) {
      const groups = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const tenantId = String(row?.tenantId || '').trim() || null;
        if (!groups.has(tenantId)) groups.set(tenantId, []);
        groups.get(tenantId).push(row);
      }
      return groups;
    },
    dedupeScopedRows(rows, fields = ['id']) {
      const out = [];
      const seen = new Map();
      const normalizedFields = Array.isArray(fields) ? fields : [fields];
      for (const row of Array.isArray(rows) ? rows : []) {
        const tenantId = String(row?.tenantId || '').trim() || '__shared__';
        const key = [tenantId, ...normalizedFields.map((field) => String(row?.[field] || ''))].join(':');
        if (!seen.has(key)) {
          seen.set(key, out.length);
          out.push(row);
          continue;
        }
        out[seen.get(key)] = row;
      }
      return out;
    },
  });
  return require(storePath);
}

test.afterEach(() => {
  clearModule(storePath);
  clearModule(prismaPath);
  clearModule(persistencePath);
});

test('delivery audit store dedupes repeated ids during replace before persistence', async () => {
  const harness = createAuditDbHarness();
  const store = loadStoreWithMocks(harness);

  store.replaceDeliveryAudit([
    {
      id: 'audit-dup',
      tenantId: 'tenant-a',
      action: 'delivery',
      message: 'first',
      createdAt: '2026-04-03T10:00:00.000Z',
    },
    {
      id: 'audit-dup',
      tenantId: 'tenant-a',
      action: 'delivery',
      message: 'second',
      createdAt: '2026-04-03T10:00:01.000Z',
    },
  ]);
  await store.flushDeliveryAuditStoreWrites();

  const rows = store.listDeliveryAudit(10, { tenantId: 'tenant-a' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'audit-dup');
  assert.equal(rows[0].message, 'second');

  const persisted = harness.snapshot('tenant-a');
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].id, 'audit-dup');
  assert.equal(persisted[0].message, 'second');
});

test('delivery audit store rejects tenant-owned audit writes without tenant scope', async () => {
  const harness = createAuditDbHarness();
  const store = loadStoreWithMocks(harness);

  assert.throws(
    () =>
      store.addDeliveryAudit({
        id: 'audit-tenantless-queued',
        action: 'queued',
        purchaseCode: 'P-TENANTLESS-AUDIT',
        itemId: 'bundle-ak',
        userId: 'u-1',
        message: 'Queued without tenant',
      }),
    (error) => error?.code === 'TENANT_MUTATION_SCOPE_REQUIRED',
  );
});

test('delivery audit store rejects tenant-owned restore rows without tenant scope', async () => {
  const harness = createAuditDbHarness();
  const store = loadStoreWithMocks(harness);

  assert.throws(
    () =>
      store.replaceDeliveryAudit([
        {
          id: 'audit-tenantless-restore',
          action: 'success',
          purchaseCode: 'P-TENANTLESS-RESTORE',
          itemId: 'bundle-ak',
          userId: 'u-1',
          message: 'Restored without tenant',
        },
      ]),
    (error) => error?.code === 'TENANT_MUTATION_SCOPE_REQUIRED',
  );
});

test('delivery audit store allows explicit platform-global manual audit writes', async () => {
  const harness = createAuditDbHarness();
  const store = loadStoreWithMocks(harness);

  const audit = store.addDeliveryAudit({
    id: 'audit-global-manual-test',
    action: 'manual-test-send',
    itemId: 'bundle-ak',
    userId: 'admin-test',
    message: 'Manual test send without tenant',
    allowGlobal: true,
  });
  await store.flushDeliveryAuditStoreWrites();

  assert.equal(audit.id, 'audit-global-manual-test');
  assert.equal(harness.snapshot(null).length, 1);
});
