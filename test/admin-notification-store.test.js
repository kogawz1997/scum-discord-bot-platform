const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/adminNotificationStore.js');
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

function createNotificationDelegateHarness() {
  const rows = new Map();

  function clone(row) {
    return row ? JSON.parse(JSON.stringify(row)) : row;
  }

  return {
    delegate: {
      async findMany() {
        return Array.from(rows.values()).sort((left, right) => {
          return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
        }).map(clone);
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
      platformAdminNotification: delegate,
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
      platformAdminNotification: delegate,
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

test('admin notification store persists notification lifecycle through the prisma delegate when available', async () => {
  const harness = createNotificationDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminNotificationStore();

  const added = store.addAdminNotification({
    id: 'note-1',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'error',
    title: 'Runtime Offline',
    message: 'watcher offline',
    entityKey: 'watcher',
    data: { runtimeKey: 'watcher' },
  });
  assert.equal(added.id, 'note-1');
  await store.waitForAdminNotificationPersistence();

  let rows = store.listAdminNotifications({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].entityKey, 'watcher');
  assert.equal(harness.snapshot().length, 1);

  const acknowledged = store.acknowledgeAdminNotifications(['note-1'], 'owner-user');
  assert.equal(acknowledged.updated, 1);
  await store.waitForAdminNotificationPersistence();

  rows = store.listAdminNotifications({ limit: 10, acknowledged: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].acknowledgedBy, 'owner-user');

  const cleared = store.clearAdminNotifications({ acknowledgedOnly: true });
  assert.equal(cleared.removed, 1);
  await store.waitForAdminNotificationPersistence();

  rows = store.listAdminNotifications({ limit: 10 });
  assert.equal(rows.length, 0);
  assert.equal(harness.snapshot().length, 0);
});

test('admin notification store does not fall back to file mode when db persistence is required', async () => {
  const store = loadStoreWithStrictDbMocks({
    async findMany() {
      const error = new Error('missing-table');
      error.code = 'P2021';
      throw error;
    },
  });

  await assert.rejects(
    () => store.initAdminNotificationStore(),
    /missing-table/,
  );
});
