const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/giveawayService.js');
const storePath = path.resolve(__dirname, '../src/store/giveawayStore.js');

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

test('giveaway service forwards tenant scope when reading giveaway by message id', () => {
  let receivedScope = null;
  const service = loadService({
    createGiveaway() {
      return null;
    },
    getGiveaway(messageId, options) {
      receivedScope = { messageId, options };
      return { messageId };
    },
    listGiveaways() {
      return [];
    },
    addEntrant() {
      return null;
    },
    removeGiveaway() {
      return null;
    },
  });

  const result = service.getGiveawayByMessageId('msg-1', {
    tenantId: 'tenant-giveaway',
    env: { TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict' },
  });

  assert.equal(result.messageId, 'msg-1');
  assert.equal(receivedScope.messageId, 'msg-1');
  assert.equal(receivedScope.options.tenantId, 'tenant-giveaway');
  assert.equal(receivedScope.options.operation, 'giveaway operation');
});
