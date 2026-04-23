const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/statsService.js');
const storePath = path.resolve(__dirname, '../src/store/statsStore.js');

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

function loadService(statsStoreMock) {
  clearModule(servicePath);
  installMock(storePath, statsStoreMock);
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(storePath);
});

test('stats service forwards tenant and server scope to stats store', () => {
  const calls = [];
  const service = loadService({
    addKill(userId, amount, options) {
      calls.push({ type: 'kill', userId, amount, options });
      return { kills: amount };
    },
    addDeath(userId, amount, options) {
      calls.push({ type: 'death', userId, amount, options });
      return { deaths: amount };
    },
    addPlaytimeMinutes(userId, minutes, options) {
      calls.push({ type: 'playtime', userId, minutes, options });
      return { playtimeMinutes: minutes };
    },
  });

  const kill = service.addKillsForUser({
    userId: 'user-1',
    amount: 2,
    tenantId: 'tenant-stats',
    serverId: 'server-a',
  });
  const death = service.addDeathsForUser({
    userId: 'user-1',
    amount: 1,
    tenantId: 'tenant-stats',
    serverId: 'server-a',
  });
  const playtime = service.addPlaytimeForUser({
    userId: 'user-1',
    minutes: 30,
    tenantId: 'tenant-stats',
    serverId: 'server-a',
  });

  assert.equal(kill.ok, true);
  assert.equal(death.ok, true);
  assert.equal(playtime.ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.tenantId, 'tenant-stats');
  assert.equal(calls[0].options.serverId, 'server-a');
  assert.equal(calls[0].options.operation, 'add player kills');
  assert.equal(calls[2].options.operation, 'add player playtime');
});
