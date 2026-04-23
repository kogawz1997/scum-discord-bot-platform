const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildTestProcessEnv,
  collectTestFiles,
  resolveRequestedTestProvider,
  shouldIncludeTestFile,
} = require('../scripts/run-tests-with-provider.js');

test('resolveRequestedTestProvider defaults local runs to sqlite', () => {
  assert.equal(
    resolveRequestedTestProvider({}),
    'sqlite',
  );
  assert.equal(
    resolveRequestedTestProvider({
      DATABASE_URL: 'postgresql://local:test@127.0.0.1:55432/scum',
      DATABASE_PROVIDER: 'postgresql',
    }),
    'sqlite',
  );
});

test('resolveRequestedTestProvider honors explicit test provider and optional runtime-db opt-in', () => {
  assert.equal(
    resolveRequestedTestProvider({
      PRISMA_TEST_DATABASE_PROVIDER: 'postgresql',
    }),
    'postgresql',
  );
  assert.equal(
    resolveRequestedTestProvider({
      RUN_TESTS_WITH_PROVIDER_USE_RUNTIME_DB: 'true',
      DATABASE_URL: 'postgresql://local:test@127.0.0.1:55432/scum',
      DATABASE_PROVIDER: 'postgresql',
    }),
    'postgresql',
  );
  assert.equal(
    resolveRequestedTestProvider({
      PRISMA_TEST_DATABASE_URL: 'file:./prisma/test.db',
    }),
    'sqlite',
  );
});

test('buildTestProcessEnv keeps sqlite local runs free from stale provider overrides', () => {
  const env = buildTestProcessEnv({
    databaseUrl: 'file:./prisma/prisma/test.db',
    provider: 'sqlite',
  }, {
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
    TENANT_DB_SCHEMA_PREFIX: 'tenant_old_',
  });

  assert.equal(env.DATABASE_URL, 'file:./prisma/prisma/test.db');
  assert.equal(env.PRISMA_TEST_DATABASE_PROVIDER, 'sqlite');
  assert.equal(Object.prototype.hasOwnProperty.call(env, 'DATABASE_PROVIDER'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(env, 'PRISMA_SCHEMA_PROVIDER'), false);
  assert.equal(env.TENANT_DB_SCHEMA_PREFIX, 'tenant_old_');
});

test('buildTestProcessEnv pins provider overrides for server-engine runs', () => {
  const env = buildTestProcessEnv({
    databaseUrl: 'postgresql://local:test@127.0.0.1:55432/scum?schema=test_runtime',
    provider: 'postgresql',
    tenantSchemaPrefix: 'tenant_runtime_',
  }, {});

  assert.equal(env.DATABASE_URL, 'postgresql://local:test@127.0.0.1:55432/scum?schema=test_runtime');
  assert.equal(env.DATABASE_PROVIDER, 'postgresql');
  assert.equal(env.PRISMA_SCHEMA_PROVIDER, 'postgresql');
  assert.equal(env.PRISMA_TEST_DATABASE_PROVIDER, 'postgresql');
  assert.equal(env.TENANT_DB_SCHEMA_PREFIX, 'tenant_runtime_');
});

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
