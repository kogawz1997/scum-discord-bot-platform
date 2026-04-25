'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { runSqlitePlatformSchemaUpgrade } = require('./platform-schema-upgrade');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRISMA_WITH_PROVIDER_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'prisma-with-provider.js');
const SQLITE_SCHEMA_PATH = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
const PRISMA_CLI_PATH = process.platform === 'win32'
  ? path.join(PROJECT_ROOT, 'node_modules', '.bin', 'prisma.cmd')
  : path.join(PROJECT_ROOT, 'node_modules', '.bin', 'prisma');

const LOCAL_SQLITE_ARTIFACT_DATABASE_URLS = Object.freeze([
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'dev.db').replace(/\\/g, '/')}`,
  `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'test.db').replace(/\\/g, '/')}`,
]);

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...env,
    },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function generateLocalSqliteClients() {
  const sqliteEnv = {
    DATABASE_PROVIDER: 'sqlite',
    PRISMA_SCHEMA_PROVIDER: 'sqlite',
  };
  console.log('[local-sqlite-artifacts] generating provider-scoped sqlite Prisma client metadata');
  run(process.execPath, [
    PRISMA_WITH_PROVIDER_SCRIPT,
    '--provider',
    'sqlite',
    'generate',
  ], sqliteEnv);
  console.log('[local-sqlite-artifacts] generating default @prisma/client for sqlite');
  if (process.platform === 'win32') {
    run('cmd', [
      '/c',
      PRISMA_CLI_PATH,
      'generate',
      '--schema',
      SQLITE_SCHEMA_PATH,
    ], sqliteEnv);
    return;
  }
  run(PRISMA_CLI_PATH, [
    'generate',
    '--schema',
    SQLITE_SCHEMA_PATH,
  ], sqliteEnv);
}

function refreshLocalSqliteArtifacts(databaseUrls = LOCAL_SQLITE_ARTIFACT_DATABASE_URLS) {
  generateLocalSqliteClients();
  for (const databaseUrl of databaseUrls) {
    console.log(`[local-sqlite-artifacts] refreshing ${databaseUrl}`);
    runSqlitePlatformSchemaUpgrade({ databaseUrl });
  }
  console.log('[local-sqlite-artifacts] seeding deterministic local owner login');
  const results = spawnSync(process.execPath, [
    path.join(PROJECT_ROOT, 'scripts', 'seed-local-owner-login.js'),
  ], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
    },
  });
  if (results.error) {
    throw results.error;
  }
  if (results.status !== 0) {
    throw new Error(`seed-local-owner-login failed with exit code ${results.status}`);
  }
}

if (require.main === module) {
  refreshLocalSqliteArtifacts();
}

module.exports = {
  LOCAL_SQLITE_ARTIFACT_DATABASE_URLS,
  generateLocalSqliteClients,
  refreshLocalSqliteArtifacts,
};
