const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/adminRequestLogStore.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');

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

function createDelegateHarness() {
  const rows = new Map();

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  return {
    delegate: {
      async findMany() {
        return Array.from(rows.values())
          .sort((left, right) => String(left.occurredAt || '').localeCompare(String(right.occurredAt || '')))
          .map(clone);
      },
      async deleteMany(args = {}) {
        const ids = args?.where?.id?.in;
        if (!Array.isArray(ids) || ids.length === 0) {
          const count = rows.size;
          rows.clear();
          return { count };
        }
        let count = 0;
        for (const id of ids) {
          if (rows.delete(String(id))) count += 1;
        }
        return { count };
      },
      async createMany({ data }) {
        const seen = new Set();
        for (const row of Array.isArray(data) ? data : []) {
          const id = String(row.id);
          if (seen.has(id)) {
            const error = new Error('unique');
            error.code = 'P2002';
            throw error;
          }
          seen.add(id);
          rows.set(String(row.id), clone(row));
        }
        return { count: rows.size };
      },
      async upsert({ where, create, update }) {
        const id = String(where?.id || create?.id || update?.id || '');
        const nextValue = rows.has(id)
          ? {
              ...clone(rows.get(id)),
              ...clone(update),
            }
          : clone(create);
        rows.set(id, nextValue);
        return clone(nextValue);
      },
    },
    snapshot() {
      return Array.from(rows.values()).map(clone);
    },
  };
}

function loadStoreWithMocks(delegate) {
  clearModule(storePath);
  installMock(prismaPath, {
    prisma: {
      platformAdminRequestLog: delegate,
    },
  });
  installMock(persistPath, {
    atomicWriteJson() {},
    getFilePath(name) {
      return path.join(process.cwd(), 'tmp', name);
    },
    isDbPersistenceEnabled() {
      return false;
    },
  });
  return require(storePath);
}

function loadStoreWithStrictDbMocks(delegate) {
  clearModule(storePath);
  installMock(prismaPath, {
    prisma: {
      platformAdminRequestLog: delegate,
    },
  });
  installMock(persistPath, {
    atomicWriteJson() {
      throw new Error('file-fallback-should-not-run');
    },
    getFilePath(name) {
      return path.join(process.cwd(), 'tmp', name);
    },
    isDbPersistenceEnabled() {
      return true;
    },
  });
  return require(storePath);
}

test.afterEach(() => {
  clearModule(storePath);
  clearModule(prismaPath);
  clearModule(persistPath);
});

test('admin request log store persists request rows through the prisma delegate when available', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminRequestLogStore();
  store.clearAdminRequestLogs();

  store.recordAdminRequestLog({
    id: 'req-1',
    at: '2026-03-28T05:00:00.000Z',
    method: 'GET',
    path: '/owner/api/platform/overview',
    routeGroup: 'platform',
    statusCode: 500,
    latencyMs: 800,
    tenantId: 'tenant-a',
  });

  await store.waitForAdminRequestLogPersistence();

  const rows = store.listAdminRequestLogs({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'req-1');
  assert.equal(rows[0].routeGroup, 'platform');
  assert.equal(harness.snapshot().length, 1);

  store.clearAdminRequestLogs();
  await store.waitForAdminRequestLogPersistence();
  assert.equal(store.listAdminRequestLogs({ limit: 10 }).length, 0);
  assert.equal(harness.snapshot().length, 0);
});

test('admin request log store dedupes repeated request ids before db persistence', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminRequestLogStore();
  store.clearAdminRequestLogs();

  store.recordAdminRequestLog({
    id: 'req-dup',
    at: '2026-03-28T05:00:00.000Z',
    method: 'GET',
    path: '/admin/api/platform/tenant',
    routeGroup: 'platform',
    statusCode: 200,
    latencyMs: 120,
  });
  store.recordAdminRequestLog({
    id: 'req-dup',
    at: '2026-03-28T05:00:02.000Z',
    method: 'POST',
    path: '/admin/api/platform/tenant',
    routeGroup: 'platform',
    statusCode: 500,
    latencyMs: 820,
    note: 'retry',
  });

  await store.waitForAdminRequestLogPersistence();

  const rows = store.listAdminRequestLogs({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'req-dup');
  assert.equal(rows[0].statusCode, 500);
  assert.equal(rows[0].note, 'retry');
  assert.equal(harness.snapshot().length, 1);
});

test('admin request log store does not fall back to file mode when db persistence is required', async () => {
  const store = loadStoreWithStrictDbMocks({
    async findMany() {
      const error = new Error('missing-table');
      error.code = 'P2021';
      throw error;
    },
  });

  await assert.rejects(
    () => store.initAdminRequestLogStore(),
    /missing-table/,
  );
});
