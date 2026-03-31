const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const storePath = path.resolve(__dirname, '../src/store/platformAutomationStateStore.js');
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
        if (String(where?.id || '') !== 'platform-automation-state') {
          return null;
        }
        return clone(row);
      },
      async upsert({ where, create, update }) {
        if (String(where?.id || '') !== 'platform-automation-state') {
          throw new Error('unexpected-id');
        }
        row = row
          ? {
            ...row,
            ...clone(update),
            id: 'platform-automation-state',
            updatedAt: new Date().toISOString(),
          }
          : {
            ...clone(create),
            id: 'platform-automation-state',
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
      platformAutomationState: delegate,
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
      platformAutomationState: delegate,
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

test('platform automation state store persists lifecycle state through the prisma delegate when available', async () => {
  const harness = createDelegateHarness();
  const store = loadStoreWithMocks(harness.delegate);

  await store.initPlatformAutomationStateStore();

  let current = await store.getPlatformAutomationState();
  assert.equal(current.lastAutomationAt, null);
  assert.deepEqual(current.recoveryAttemptsByKey, {});

  current = await store.updatePlatformAutomationState({
    lastAutomationAt: '2026-03-28T00:00:00.000Z',
    lastForcedMonitoringAt: '2026-03-28T00:05:00.000Z',
    lastRecoveryAtByKey: {
      worker: '2026-03-28T00:10:00.000Z',
    },
    recoveryWindowStartedAtByKey: {
      worker: '2026-03-28T00:09:00.000Z',
    },
    recoveryAttemptsByKey: {
      worker: 2,
    },
    lastRecoveryResultByKey: {
      worker: {
        at: '2026-03-28T00:10:00.000Z',
        ok: true,
        action: 'restart-managed-service',
        runtimeKey: 'worker',
        status: 'offline',
        reason: 'timeout',
        exitCode: 0,
      },
    },
  });
  assert.equal(current.lastAutomationAt, '2026-03-28T00:00:00.000Z');
  assert.equal(current.recoveryAttemptsByKey.worker, 2);
  await store.waitForPlatformAutomationStatePersistence();

  const snapshot = harness.snapshot();
  assert.equal(snapshot.id, 'platform-automation-state');
  assert.equal(snapshot.lastAutomationAt, '2026-03-28T00:00:00.000Z');
  assert.deepEqual(JSON.parse(snapshot.recoveryAttemptsByKeyJson), { worker: 2 });

  current = await store.resetPlatformAutomationState();
  assert.equal(current.lastAutomationAt, null);
  assert.deepEqual(current.recoveryAttemptsByKey, {});
  await store.waitForPlatformAutomationStatePersistence();

  const resetSnapshot = harness.snapshot();
  assert.equal(resetSnapshot.id, 'platform-automation-state');
  assert.equal(resetSnapshot.lastAutomationAt, null);
  assert.deepEqual(JSON.parse(resetSnapshot.recoveryAttemptsByKeyJson), {});
});

test('platform automation state store does not fall back to file mode when db persistence is required', async () => {
  const store = loadStoreWithStrictDbMocks({
    async findUnique() {
      const error = new Error('missing-table');
      error.code = 'P2021';
      throw error;
    },
  });

  await assert.rejects(
    () => store.initPlatformAutomationStateStore(),
    /missing-table/,
  );
});
