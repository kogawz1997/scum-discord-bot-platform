const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  getPrismaRuntimeProfile,
  readSourceSchemaProvider,
} = require('../src/prisma');

test('readSourceSchemaProvider reads datasource provider from source schema', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-runtime-profile-'));
  const schemaPath = path.join(tempRoot, 'schema.prisma');
  fs.writeFileSync(schemaPath, [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "sqlite"',
    '  url      = env("DATABASE_URL")',
    '}',
  ].join('\n'), 'utf8');

  try {
    assert.equal(readSourceSchemaProvider(schemaPath), 'sqlite');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('getPrismaRuntimeProfile reports provider-rendered postgres runtime against sqlite source schema', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-runtime-profile-'));
  const schemaPath = path.join(tempRoot, 'schema.prisma');
  fs.writeFileSync(schemaPath, [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "sqlite"',
    '  url      = env("DATABASE_URL")',
    '}',
  ].join('\n'), 'utf8');

  try {
    const profile = getPrismaRuntimeProfile({
      schemaPath,
      projectRoot: tempRoot,
      env: {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
      generatedClientMetadata: {
        provider: 'postgresql',
        outputPath: 'artifacts/prisma/generated/postgresql/current/client',
      },
      clientModulePath: 'C:/generated/postgresql/client',
    });

    assert.equal(profile.sourceSchemaProvider, 'sqlite');
    assert.equal(profile.runtimeProvider, 'postgresql');
    assert.equal(profile.generatedClientProvider, 'postgresql');
    assert.equal(profile.usesProviderRenderedSchema, true);
    assert.equal(profile.runtimeMode, 'provider-rendered-runtime');
    assert.match(profile.summary, /runtime uses postgresql/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('getPrismaRuntimeProfile reports sqlite compatibility runtime when source schema matches runtime', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-runtime-profile-'));
  const schemaPath = path.join(tempRoot, 'schema.prisma');
  fs.writeFileSync(schemaPath, [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "sqlite"',
    '  url      = env("DATABASE_URL")',
    '}',
  ].join('\n'), 'utf8');

  try {
    const profile = getPrismaRuntimeProfile({
      schemaPath,
      projectRoot: tempRoot,
      env: {
        DATABASE_URL: 'file:./prisma/dev.db',
        DATABASE_PROVIDER: 'sqlite',
        PRISMA_SCHEMA_PROVIDER: 'sqlite',
      },
      generatedClientMetadata: {
        provider: 'sqlite',
        outputPath: 'artifacts/prisma/generated/sqlite/current/client',
      },
      clientModulePath: 'C:/generated/sqlite/client',
    });

    assert.equal(profile.sourceSchemaProvider, 'sqlite');
    assert.equal(profile.runtimeProvider, 'sqlite');
    assert.equal(profile.generatedClientProvider, 'sqlite');
    assert.equal(profile.usesProviderRenderedSchema, false);
    assert.equal(profile.runtimeMode, 'sqlite-compatibility');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
