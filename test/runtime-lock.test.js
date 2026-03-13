const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshRuntimeLockModule() {
  const modulePath = path.resolve(__dirname, '../src/services/runtimeLock.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('runtime lock blocks duplicate acquisition until released', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scum-lock-'));
  process.env.BOT_DATA_DIR = tempDir;

  const locks = freshRuntimeLockModule();
  const first = locks.acquireRuntimeLock('delivery-worker', 'test-a');
  assert.equal(first.ok, true);

  const second = locks.acquireRuntimeLock('delivery-worker', 'test-b');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already-locked');
  assert.equal(second.data.owner, 'test-a');

  assert.equal(locks.releaseRuntimeLock('delivery-worker'), true);

  const third = locks.acquireRuntimeLock('delivery-worker', 'test-c');
  assert.equal(third.ok, true);
  assert.equal(locks.releaseRuntimeLock('delivery-worker'), true);
});

test('runtime lock removes stale pid lock and acquires successfully', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scum-lock-stale-'));
  process.env.BOT_DATA_DIR = tempDir;

  const lockDir = path.join(tempDir, 'runtime-locks');
  fs.mkdirSync(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, 'rent-bike-service.lock.json');
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      name: 'rent-bike-service',
      owner: 'dead-process',
      pid: 999999,
      hostname: 'test-host',
      acquiredAt: new Date().toISOString(),
    }),
    'utf8',
  );

  const locks = freshRuntimeLockModule();
  const result = locks.acquireRuntimeLock('rent-bike-service', 'worker');
  assert.equal(result.ok, true);
  assert.equal(result.data.owner, 'worker');
  assert.equal(locks.releaseRuntimeLock('rent-bike-service'), true);
});
