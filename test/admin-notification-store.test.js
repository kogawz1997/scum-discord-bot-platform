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
        const seen = new Set();
        for (const row of Array.isArray(data) ? data : []) {
          const id = String(row.id || '');
          if (id && seen.has(id)) {
            const error = new Error('unique');
            error.code = 'P2002';
            throw error;
          }
          seen.add(id);
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

test('admin notification store dedupes repeated notification ids before db persistence', async () => {
  const harness = createNotificationDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminNotificationStore();

  store.addAdminNotification({
    id: 'note-dup',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'warn',
    title: 'Runtime Offline',
    message: 'watcher offline',
    entityKey: 'watcher',
  });
  store.addAdminNotification({
    id: 'note-dup',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'error',
    title: 'Runtime Offline',
    message: 'watcher hard-down',
    entityKey: 'watcher',
  });
  await store.waitForAdminNotificationPersistence();

  const rows = store.listAdminNotifications({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'note-dup');
  assert.equal(rows[0].severity, 'error');
  assert.equal(rows[0].message, 'watcher hard-down');
  assert.equal(harness.snapshot().length, 1);
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

test('admin notification store filters notifications by tenant id from payload data', async () => {
  const harness = createNotificationDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminNotificationStore();

  store.addAdminNotification({
    id: 'note-tenant-1',
    type: 'billing',
    source: 'platform-monitor',
    kind: 'subscription-expiring',
    severity: 'warn',
    title: 'Subscription Expiring Soon',
    message: 'tenant-1 plan is ending soon',
    entityKey: 'sub-1',
    data: { tenantId: 'tenant-1', subscriptionId: 'sub-1' },
  });
  store.addAdminNotification({
    id: 'note-tenant-2',
    type: 'billing',
    source: 'platform-monitor',
    kind: 'subscription-expiring',
    severity: 'warn',
    title: 'Subscription Expiring Soon',
    message: 'tenant-2 plan is ending soon',
    entityKey: 'sub-2',
    data: { tenantId: 'tenant-2', subscriptionId: 'sub-2' },
  });
  await store.waitForAdminNotificationPersistence();

  const tenantOneRows = store.listAdminNotifications({ limit: 10, tenantId: 'tenant-1' });
  assert.equal(tenantOneRows.length, 1);
  assert.equal(tenantOneRows[0].id, 'note-tenant-1');
  assert.equal(tenantOneRows[0].tenantId, 'tenant-1');
});

test('admin notification store prunes old notifications while keeping the newest entries', async () => {
  const harness = createNotificationDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminNotificationStore();

  store.addAdminNotification({
    id: 'note-old',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'warn',
    title: 'Old',
    message: 'old note',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  store.addAdminNotification({
    id: 'note-mid',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'warn',
    title: 'Mid',
    message: 'mid note',
    createdAt: '2026-02-01T00:00:00.000Z',
  });
  store.addAdminNotification({
    id: 'note-new',
    type: 'ops-alert',
    source: 'ops',
    kind: 'runtime-offline',
    severity: 'warn',
    title: 'New',
    message: 'new note',
    createdAt: '2026-03-01T00:00:00.000Z',
  });
  await store.waitForAdminNotificationPersistence();

  const result = store.pruneAdminNotifications({
    now: '2026-04-01T00:00:00.000Z',
    olderThanMs: 45 * 24 * 60 * 60 * 1000,
    keepLatest: 1,
  });
  assert.equal(result.removed, 2);
  await store.waitForAdminNotificationPersistence();

  const rows = store.listAdminNotifications({ limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'note-new');
  assert.equal(harness.snapshot().length, 1);
});
