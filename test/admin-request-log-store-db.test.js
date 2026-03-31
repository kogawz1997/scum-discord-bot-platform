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
      async deleteMany() {
        rows.clear();
        return { count: 0 };
      },
      async createMany({ data }) {
        for (const row of Array.isArray(data) ? data : []) {
          rows.set(String(row.id), clone(row));
        }
        return { count: rows.size };
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
