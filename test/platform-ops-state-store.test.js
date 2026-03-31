const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/platformOpsStateStore.js');
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
        if (String(where?.id || '') !== 'platform-ops-state') {
          return null;
        }
        return clone(row);
      },
      async upsert({ where, create, update }) {
        if (String(where?.id || '') !== 'platform-ops-state') {
          throw new Error('unexpected-id');
        }
        row = row
          ? {
            ...row,
            ...clone(update),
            id: 'platform-ops-state',
            updatedAt: new Date().toISOString(),
          }
          : {
            ...clone(create),
            id: 'platform-ops-state',
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
      platformOpsState: delegate,
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
      platformOpsState: delegate,
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

test('platform ops state store persists monitoring lifecycle through the prisma delegate when available', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initPlatformOpsStateStore();

  let current = await store.getPlatformOpsState();
  assert.equal(current.lastMonitoringAt, null);
  assert.deepEqual(current.lastAlertAtByKey, {});

  current = await store.updatePlatformOpsState({
    lastMonitoringAt: '2026-03-28T03:00:00.000Z',
    lastAutoBackupAt: '2026-03-28T03:10:00.000Z',
    lastReconcileAt: '2026-03-28T03:20:00.000Z',
    lastAlertAtByKey: {
      'runtime-offline:worker': '2026-03-28T03:21:00.000Z',
    },
  });
  assert.equal(current.lastMonitoringAt, '2026-03-28T03:00:00.000Z');
  assert.equal(current.lastAlertAtByKey['runtime-offline:worker'], '2026-03-28T03:21:00.000Z');
  await store.waitForPlatformOpsStatePersistence();

  const snapshot = harness.snapshot();
  assert.equal(snapshot.id, 'platform-ops-state');
  assert.equal(snapshot.lastMonitoringAt, '2026-03-28T03:00:00.000Z');
  assert.deepEqual(JSON.parse(snapshot.lastAlertAtByKeyJson), {
    'runtime-offline:worker': '2026-03-28T03:21:00.000Z',
  });

  current = await store.resetPlatformOpsState();
  assert.equal(current.lastMonitoringAt, null);
  assert.deepEqual(current.lastAlertAtByKey, {});
  await store.waitForPlatformOpsStatePersistence();

  const resetSnapshot = harness.snapshot();
  assert.equal(resetSnapshot.lastMonitoringAt, null);
  assert.deepEqual(JSON.parse(resetSnapshot.lastAlertAtByKeyJson), {});
});

test('platform ops state store does not fall back to file mode when db persistence is required', async () => {
  const store = loadStoreWithStrictDbMocks({
    async findUnique() {
      const error = new Error('missing-table');
      error.code = 'P2021';
      throw error;
    },
  });

  await assert.rejects(
    () => store.initPlatformOpsStateStore(),
    /missing-table/,
  );
});
