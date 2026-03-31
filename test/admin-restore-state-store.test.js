const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/adminRestoreStateStore.js');
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
  let row = null;

  function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  return {
    delegate: {
      async findUnique({ where }) {
        if (String(where?.id || '') !== 'admin-restore-state') {
          return null;
        }
        return clone(row);
      },
      async upsert({ where, create, update }) {
        if (String(where?.id || '') !== 'admin-restore-state') {
          throw new Error('unexpected-id');
        }
        row = row
          ? {
            ...row,
            ...clone(update),
            id: 'admin-restore-state',
            updatedAt: new Date().toISOString(),
          }
          : {
            ...clone(create),
            id: 'admin-restore-state',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        return clone(row);
      },
    },
    snapshot() {
      return clone(row);
    },
  };
}

function loadStoreWithMocks(delegate) {
  clearModule(storePath);
  installMock(prismaPath, {
    prisma: {
      platformAdminRestoreState: delegate,
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
      platformAdminRestoreState: delegate,
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

test('admin restore state store persists state and history through the prisma delegate when available', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initAdminRestoreStateStore();

  const current = store.setAdminRestoreState({
    status: 'running',
    active: true,
    maintenance: true,
    operationId: 'restore-1',
    actor: 'owner-user',
    role: 'owner',
    backup: 'backup-a.zip',
    updatedAt: '2026-03-28T08:00:00.000Z',
    warnings: ['queue paused'],
    verification: {
      checkedAt: '2026-03-28T08:05:00.000Z',
      ready: true,
      countsMatch: true,
      checks: [
        { id: 'counts', ok: true, detail: 'ok' },
      ],
    },
  });
  assert.equal(current.status, 'running');
  assert.equal(current.operationId, 'restore-1');

  const history = store.appendAdminRestoreHistory({
    operationId: 'restore-1',
    status: 'running',
    actor: 'owner-user',
    recordedAt: '2026-03-28T08:01:00.000Z',
  });
  assert.equal(history.length, 1);

  await store.waitForAdminRestoreStatePersistence();

  const snapshot = harness.snapshot();
  assert.equal(snapshot.id, 'admin-restore-state');
  assert.equal(snapshot.status, 'running');
  assert.equal(snapshot.operationId, 'restore-1');
  assert.deepEqual(JSON.parse(snapshot.warningsJson), ['queue paused']);
  assert.equal(JSON.parse(snapshot.historyJson).length, 1);
});

test('admin restore state store does not fall back to file mode when db persistence is required', async () => {
  const store = loadStoreWithStrictDbMocks({
    async findUnique() {
      const error = new Error('missing-table');
      error.code = 'P2021';
      throw error;
    },
  });

  await assert.rejects(
    () => store.initAdminRestoreStateStore(),
    /missing-table/,
  );
});
