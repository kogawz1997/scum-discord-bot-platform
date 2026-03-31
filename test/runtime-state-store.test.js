const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const runtimeStateStorePath = path.resolve(__dirname, '../src/store/runtimeStateStore.js');
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

test.afterEach(() => {
  clearModule(runtimeStateStorePath);
  clearModule(persistPath);
});

test('persistent runtime store reloads durable entries and drops expired rows', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-state-store-'));
  const dataFile = path.join(tempDir, 'store.json');

  installMock(persistPath, {
    atomicWriteJson(filePath, payload) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    },
    getFilePath() {
      return dataFile;
    },
  });

  const { createPersistentRuntimeStore } = require(runtimeStateStorePath);
  const store = createPersistentRuntimeStore({
    filename: 'store.json',
    expiryField: 'expiresAt',
    persistDelayMs: 0,
  });
  store.set('active', { value: 1, expiresAt: Date.now() + 60_000 });
  store.set('expired', { value: 2, expiresAt: Date.now() - 1_000 });
  store.flush();

  const reloaded = createPersistentRuntimeStore({
    filename: 'store.json',
    expiryField: 'expiresAt',
    persistDelayMs: 0,
  });

  assert.equal(reloaded.has('active'), true);
  assert.equal(reloaded.get('active').value, 1);
  assert.equal(reloaded.has('expired'), false);
});
