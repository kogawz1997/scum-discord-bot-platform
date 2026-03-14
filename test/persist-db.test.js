const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function freshPersistModule() {
  const modulePath = path.resolve(__dirname, '../src/store/_persist.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('legacy file snapshot save/load roundtrip in optional mode', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scumdb-'));
  process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`;
  process.env.BOT_DATA_DIR = path.join(tempDir, 'legacy-data');
  delete process.env.PERSIST_REQUIRE_DB;
  delete process.env.PERSIST_LEGACY_SNAPSHOTS;

  const persist = freshPersistModule();
  const schedule = persist.saveJsonDebounced('unit.json', () => ({ ok: true }), 10);
  schedule();

  await new Promise((r) => setTimeout(r, 50));
  const got = persist.loadJson('unit.json', null);
  assert.deepEqual(got, { ok: true });
  const status = persist.getPersistenceStatus();
  assert.equal(status.mode, 'legacy-file-snapshot');
  assert.equal(status.legacySnapshotsEnabled, true);
  process.env.NODE_ENV = originalNodeEnv;
});

test('db-only mode disables legacy snapshots cleanly', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scumdb-fallback-'));
  const modulePath = path.resolve(__dirname, '../src/store/_persist.js');
  const script = [
    `const mod = require(${JSON.stringify(modulePath)});`,
    'const schedule = mod.saveJsonDebounced("unit.json", () => ({ ok: true }), 10);',
    'schedule();',
    'console.log(`STATUS:${JSON.stringify(mod.getPersistenceStatus())}`);',
    'console.log(`VALUE:${JSON.stringify(mod.loadJson("unit.json", { fallback: true }))}`);',
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: `file:${path.join(tempDir, 'required.db')}`,
      BOT_DATA_DIR: path.join(tempDir, 'legacy-data'),
      PERSIST_REQUIRE_DB: 'true',
    },
  });

  assert.equal(result.status, 0);
  const lines = String(result.stdout || '')
    .split(/\r?\n/)
    .filter(Boolean);
  const statusLine = lines.find((row) => row.startsWith('STATUS:'));
  const valueLine = lines.find((row) => row.startsWith('VALUE:'));
  assert.ok(statusLine, 'expected STATUS output');
  assert.ok(valueLine, 'expected VALUE output');
  const status = JSON.parse(statusLine.slice('STATUS:'.length));
  const value = JSON.parse(valueLine.slice('VALUE:'.length));
  assert.equal(status.mode, 'db-only');
  assert.equal(status.requireDb, true);
  assert.equal(status.legacySnapshotsEnabled, false);
  assert.equal(status.fallbackReason, 'db-only-mode');
  assert.deepEqual(value, { fallback: true });
  assert.equal(fs.existsSync(path.join(tempDir, 'legacy-data', 'unit.json')), false);
});

test('production still fails fast when PERSIST_REQUIRE_DB=false', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scumdb-required-'));
  const modulePath = path.resolve(__dirname, '../src/store/_persist.js');
  const script = `require(${JSON.stringify(modulePath)});`;

  const result = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: `file:${path.join(tempDir, 'required.db')}`,
      BOT_DATA_DIR: path.join(tempDir, 'legacy-data'),
      NODE_ENV: 'production',
      PERSIST_REQUIRE_DB: 'false',
    },
  });

  assert.notEqual(result.status, 0);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.match(output, /PERSIST_REQUIRE_DB=true/i);
});

test('production fails fast when legacy snapshots are explicitly enabled', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PERSIST_REQUIRE_DB: 'true',
    PERSIST_LEGACY_SNAPSHOTS: 'true',
  };
  const script = [
    'try {',
    '  require("./src/store/_persist");',
    '} catch (error) {',
    '  console.error(String(error.message || error));',
    '  process.exit(1);',
    '}',
    'process.exit(0);',
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /PERSIST_LEGACY_SNAPSHOTS=false/i);
});
