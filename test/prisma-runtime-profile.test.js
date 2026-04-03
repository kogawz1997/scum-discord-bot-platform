const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getPrismaRuntimeProfile,
  readSourceSchemaProvider,
} = require('../src/prisma');

test('readSourceSchemaProvider reports the compatibility template provider from schema.prisma', () => {
  assert.equal(readSourceSchemaProvider({ projectRoot: 'C:/new' }), 'sqlite');
});

test('getPrismaRuntimeProfile exposes provider-rendered runtime truth for PostgreSQL environments', () => {
  const profile = getPrismaRuntimeProfile({
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55432/scum?schema=public',
      DATABASE_PROVIDER: 'postgresql',
      PRISMA_SCHEMA_PROVIDER: 'postgresql',
      NODE_ENV: 'production',
    },
    projectRoot: 'C:/new',
  });

  assert.equal(profile.sourceSchemaProvider, 'sqlite');
  assert.equal(profile.runtimeDatabaseProvider, 'postgresql');
  assert.equal(profile.databaseEngine, 'postgresql');
  assert.equal(profile.compatibilityTemplate, true);
  assert.equal(profile.truthMode, 'provider-rendered-runtime');
});

test('getPrismaRuntimeProfile keeps source-schema runtime truth for sqlite environments', () => {
  const profile = getPrismaRuntimeProfile({
    env: {
      DATABASE_URL: 'file:./prisma/dev.db',
      DATABASE_PROVIDER: 'sqlite',
      PRISMA_SCHEMA_PROVIDER: 'sqlite',
      NODE_ENV: 'development',
    },
    projectRoot: 'C:/new',
  });

  assert.equal(profile.sourceSchemaProvider, 'sqlite');
  assert.equal(profile.runtimeDatabaseProvider, 'sqlite');
  assert.equal(profile.databaseEngine, 'sqlite');
  assert.equal(profile.compatibilityTemplate, false);
  assert.equal(profile.truthMode, 'source-schema-runtime');
});
