'use strict';

require('dotenv').config();

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { resolveDatabaseRuntime } = require('../src/utils/dbEngine');
const { runPostgresPlatformSchemaUpgrade } = require('./postgres-platform-schema-upgrade');

const migrationFiles = [
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260315070000_platform_foundation',
    'migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260328190000_platform_state_and_control_plane_registry',
    'migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260328233000_platform_foundation_phase2',
    'migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260329153000_platform_request_log_restore_state',
    'migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260329193000_platform_package_catalog',
    'migration.sql',
  ),
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260331121000_platform_identity_auth_alignment',
    'migration.sql',
  ),
];

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
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

function runSqlitePlatformSchemaUpgrade() {
  const prismaWithProviderScript = path.resolve(process.cwd(), 'scripts', 'prisma-with-provider.js');
  const runtime = resolveDatabaseRuntime({
    provider: 'sqlite',
    projectRoot: process.cwd(),
  });
  const sqliteDatabaseUrl = runtime.isSqlite && runtime.rawUrl
    ? runtime.rawUrl
    : 'file:./prisma/dev.db';
  for (const migrationFile of migrationFiles) {
    console.log(`[platform-schema-upgrade] applying ${path.basename(path.dirname(migrationFile))}`);
    run(process.execPath, [
      prismaWithProviderScript,
      '--provider',
      'sqlite',
      'db',
      'execute',
      '--file',
      migrationFile,
    ], {
      DATABASE_URL: sqliteDatabaseUrl,
      DATABASE_PROVIDER: 'sqlite',
      PRISMA_SCHEMA_PROVIDER: 'sqlite',
    });
  }
  console.log('[platform-schema-upgrade] platform schema SQL applied');
}

function main() {
  const runtime = resolveDatabaseRuntime({
    projectRoot: process.cwd(),
  });
  if (runtime.provider === 'postgresql' || runtime.engine === 'postgresql') {
    runPostgresPlatformSchemaUpgrade();
    return;
  }
  runSqlitePlatformSchemaUpgrade();
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  runSqlitePlatformSchemaUpgrade,
};
