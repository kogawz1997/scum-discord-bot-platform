const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const loaderPath = path.resolve(__dirname, '../src/prismaClientLoader.js');

function clearLoader() {
  delete require.cache[loaderPath];
}

test.afterEach(() => {
  delete process.env.PRISMA_CLIENT_MODULE_PATH;
  delete process.env.PRISMA_SCHEMA_PROVIDER;
  delete process.env.DATABASE_PROVIDER;
  delete process.env.PRISMA_TEST_DATABASE_PROVIDER;
  delete process.env.PRISMA_TEST_DATABASE_URL;
  delete process.env.DATABASE_URL;
  clearLoader();
});

test('prisma client loader uses explicit generated client module path when provided', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-client-loader-'));
  const modulePath = path.join(tempDir, 'index.js');
  fs.writeFileSync(
    modulePath,
    'class FakePrismaClient {}\nmodule.exports = { PrismaClient: FakePrismaClient, Prisma: { marker: true } };',
    'utf8',
  );

  process.env.PRISMA_CLIENT_MODULE_PATH = modulePath;
  clearLoader();
  const loader = require(loaderPath);

  assert.equal(typeof loader.PrismaClient, 'function');
  assert.equal(loader.Prisma.marker, true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolveRequestedProvider infers sqlite from test database url when explicit provider is absent', () => {
  delete process.env.PRISMA_SCHEMA_PROVIDER;
  delete process.env.DATABASE_PROVIDER;
  delete process.env.PRISMA_TEST_DATABASE_PROVIDER;
  process.env.DATABASE_URL = 'file:./prisma/test.db';
  clearLoader();
  const loader = require(loaderPath);

  assert.equal(loader.resolveProviderFromDatabaseUrl(process.env.DATABASE_URL), 'sqlite');
  assert.equal(loader.resolveRequestedProvider(), 'sqlite');
});
