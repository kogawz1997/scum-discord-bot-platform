const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectTestFiles,
  shouldIncludeTestFile,
} = require('../scripts/run-tests-with-provider.js');

test('shouldIncludeTestFile accepts *.test.js and excludes fixtures', () => {
  const testRoot = path.resolve(process.cwd(), 'test');
  assert.equal(
    shouldIncludeTestFile(path.join(testRoot, 'sample.test.js'), testRoot),
    true,
  );
  assert.equal(
    shouldIncludeTestFile(path.join(testRoot, 'fixtures', 'sample.test.js'), testRoot),
    false,
  );
  assert.equal(
    shouldIncludeTestFile(path.join(testRoot, 'helpers', 'sample.helper.js'), testRoot),
    false,
  );
});

test('collectTestFiles returns only explicit test files and skips fixtures', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'run-tests-with-provider-'));
  const nestedDir = path.join(tempRoot, 'nested');
  const fixtureDir = path.join(tempRoot, 'fixtures');
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'alpha.test.js'), '');
  fs.writeFileSync(path.join(nestedDir, 'beta.integration.test.js'), '');
  fs.writeFileSync(path.join(fixtureDir, 'ignored.test.js'), '');
  fs.writeFileSync(path.join(tempRoot, 'not-a-test.cjs'), '');

  try {
    const files = collectTestFiles(tempRoot);
    assert.deepEqual(
      files.map((entry) => entry.replace(/\\/g, '/')),
      [
        path.relative(process.cwd(), path.join(tempRoot, 'alpha.test.js')).replace(/\\/g, '/'),
        path.relative(process.cwd(), path.join(nestedDir, 'beta.integration.test.js')).replace(/\\/g, '/'),
      ].sort(),
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
