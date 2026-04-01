'use strict';

require('dotenv').config();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
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
  path.resolve(
    process.cwd(),
    'prisma',
    'migrations',
    '20260401193000_platform_raid_tables',
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

function resolveSqliteDatabaseFilePath(databaseUrl) {
  const raw = String(databaseUrl || '').trim();
  if (!raw.startsWith('file:')) return '';
  const filePath = raw.slice('file:'.length).replace(/^"+|"+$/g, '');
  if (!filePath) return '';
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

function getSqliteTableColumns(databaseFilePath, tableName) {
  if (!databaseFilePath || !fs.existsSync(databaseFilePath)) {
    return new Set();
  }
  const db = new DatabaseSync(databaseFilePath, {
    readOnly: true,
  });
  try {
    const rows = db.prepare(`PRAGMA table_info("${String(tableName || '').replace(/"/g, '""')}")`).all();
    return new Set(
      Array.isArray(rows)
        ? rows.map((row) => String(row?.name || '').trim()).filter(Boolean)
        : [],
    );
  } finally {
    db.close();
  }
}

function buildSqliteCompatibleMigrationSql(sql, options = {}) {
  const source = String(sql || '');
  const databaseFilePath = String(options.databaseFilePath || '').trim();
  const columnCache = new Map();
  return source.replace(
    /ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN IF NOT EXISTS\s+"([^"]+)"\s+([^;]+);/gi,
    (_match, tableName, columnName, columnDefinition) => {
      const normalizedTable = String(tableName || '').trim();
      const normalizedColumn = String(columnName || '').trim();
      if (!columnCache.has(normalizedTable)) {
        columnCache.set(
          normalizedTable,
          getSqliteTableColumns(databaseFilePath, normalizedTable),
        );
      }
      const columns = columnCache.get(normalizedTable);
      if (columns && columns.has(normalizedColumn)) {
        return `-- skipped existing column ${normalizedTable}.${normalizedColumn}`;
      }
      if (columns) {
        columns.add(normalizedColumn);
      }
      return `ALTER TABLE "${normalizedTable}" ADD COLUMN "${normalizedColumn}" ${String(columnDefinition || '').trim()};`;
    },
  );
}

function materializeSqliteMigrationFile(migrationFile, databaseUrl) {
  const sourceSql = fs.readFileSync(migrationFile, 'utf8');
  const compatibleSql = buildSqliteCompatibleMigrationSql(sourceSql, {
    databaseFilePath: resolveSqliteDatabaseFilePath(databaseUrl),
  });
  const tempFile = path.join(
    os.tmpdir(),
    `codex-platform-schema-upgrade-${path.basename(path.dirname(migrationFile))}-${process.pid}.sql`,
  );
  fs.writeFileSync(tempFile, compatibleSql, 'utf8');
  return tempFile;
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
    const executionFile = materializeSqliteMigrationFile(migrationFile, sqliteDatabaseUrl);
    try {
      run(process.execPath, [
        prismaWithProviderScript,
        '--provider',
        'sqlite',
        'db',
        'execute',
        '--file',
        executionFile,
      ], {
        DATABASE_URL: sqliteDatabaseUrl,
        DATABASE_PROVIDER: 'sqlite',
        PRISMA_SCHEMA_PROVIDER: 'sqlite',
      });
    } finally {
      fs.rmSync(executionFile, { force: true });
    }
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
  buildSqliteCompatibleMigrationSql,
  main,
  resolveSqliteDatabaseFilePath,
  runSqlitePlatformSchemaUpgrade,
};
