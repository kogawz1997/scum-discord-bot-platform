const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/scumStatusService.js');
const storePath = path.resolve(__dirname, '../src/store/scumStore.js');

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

function loadService(mockStore) {
  clearModule(servicePath);
  installMock(storePath, mockStore);
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
});

test('scum status service forwards operation metadata and tenant scope to store', () => {
  let received = null;
  const service = loadService({
    updateStatus(data, options) {
      received = { data, options };
      return data;
    },
  });

  const result = service.updateScumStatusForAdmin({
    tenantId: 'tenant-status',
    onlinePlayers: 12,
    pingMs: 44,
  });

  assert.equal(result.ok, true);
  assert.equal(received.options.tenantId, 'tenant-status');
  assert.equal(received.options.operation, 'scum status update');
  assert.equal(received.data.onlinePlayers, 12);
});
