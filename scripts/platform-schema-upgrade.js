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

const CONTROL_PLANE_RUNTIME_DEFAULT_TABLES = Object.freeze([
  'ControlPlaneAgent',
  'ControlPlaneAgentTokenBinding',
  'ControlPlaneAgentProvisioningToken',
  'ControlPlaneAgentCredential',
  'ControlPlaneAgentSession',
  'ControlPlaneSyncRun',
]);

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
  return source
    .replace(
      /\s+DEFAULT\s+'hybrid'/gi,
      '',
    )
    .replace(
      /\s+DEFAULT\s+'sync_execute'/gi,
      '',
    )
    .replace(
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

function quoteSqliteIdentifier(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function listSqliteTableColumns(db, tableName) {
  const rows = db.prepare(`PRAGMA table_info(${quoteSqliteIdentifier(tableName)})`).all();
  return Array.isArray(rows)
    ? rows.map((row) => String(row?.name || '').trim()).filter(Boolean)
    : [];
}

function ensureSqlStatementTerminator(sqlText) {
  const text = String(sqlText || '').trim();
  if (!text) return '';
  return text.endsWith(';') ? text : `${text};`;
}

function rebuildSqliteTableWithoutLegacyRuntimeDefaults(db, tableName) {
  const tableRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
  `).get(tableName);
  const currentSql = String(tableRow?.sql || '').trim();
  if (!currentSql) return false;

  const scrubbedSql = currentSql
    .replace(/\s+DEFAULT\s+'hybrid'/gi, '')
    .replace(/\s+DEFAULT\s+'sync_execute'/gi, '');
  if (scrubbedSql === currentSql) {
    return false;
  }

  const indexRows = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'index'
      AND tbl_name = ?
      AND sql IS NOT NULL
    ORDER BY name ASC
  `).all(tableName);
  const tempTableName = `__legacy_runtime_scrub_${tableName}`;

  db.exec(`ALTER TABLE ${quoteSqliteIdentifier(tableName)} RENAME TO ${quoteSqliteIdentifier(tempTableName)};`);
  db.exec(ensureSqlStatementTerminator(scrubbedSql));

  const sourceColumns = listSqliteTableColumns(db, tempTableName);
  const targetColumns = new Set(listSqliteTableColumns(db, tableName));
  const sharedColumns = sourceColumns.filter((columnName) => targetColumns.has(columnName));
  if (sharedColumns.length > 0) {
    const quotedColumns = sharedColumns.map((columnName) => quoteSqliteIdentifier(columnName)).join(', ');
    db.exec(`
      INSERT INTO ${quoteSqliteIdentifier(tableName)} (${quotedColumns})
      SELECT ${quotedColumns}
      FROM ${quoteSqliteIdentifier(tempTableName)};
    `);
  }

  db.exec(`DROP TABLE ${quoteSqliteIdentifier(tempTableName)};`);
  for (const row of Array.isArray(indexRows) ? indexRows : []) {
    const sql = ensureSqlStatementTerminator(row?.sql || '');
    if (sql) {
      db.exec(sql);
    }
  }

  return true;
}

function stripLegacyHybridDefaultsFromSqliteDatabase(databaseFilePath) {
  const filePath = String(databaseFilePath || '').trim();
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      changed: false,
      updatedTables: [],
    };
  }

  const db = new DatabaseSync(filePath);
  try {
    const updatedTables = [];
    db.exec('PRAGMA foreign_keys=OFF;');
    db.exec('BEGIN IMMEDIATE;');
    for (const tableName of CONTROL_PLANE_RUNTIME_DEFAULT_TABLES) {
      if (rebuildSqliteTableWithoutLegacyRuntimeDefaults(db, tableName)) {
        updatedTables.push(tableName);
      }
    }
    if (updatedTables.length > 0) {
      db.exec('COMMIT;');
    } else {
      db.exec('ROLLBACK;');
    }
    db.exec('PRAGMA foreign_keys=ON;');

    const integrity = db.prepare('PRAGMA integrity_check').all();
    const integrityFailed = Array.isArray(integrity)
      && integrity.some((row) => String(row?.integrity_check || '').toLowerCase() !== 'ok');
    if (integrityFailed) {
      throw new Error(`sqlite integrity_check failed after legacy runtime scrub for ${path.basename(filePath)}`);
    }

    return {
      changed: updatedTables.length > 0,
      updatedTables,
    };
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw error;
  } finally {
    try {
      db.exec('PRAGMA foreign_keys=ON;');
    } catch {}
    db.close();
  }
}

function runSqlitePlatformSchemaUpgrade(options = {}) {
  const prismaWithProviderScript = path.resolve(process.cwd(), 'scripts', 'prisma-with-provider.js');
  const requestedDatabaseUrl = String(options.databaseUrl || '').trim();
  const runtime = requestedDatabaseUrl
    ? resolveDatabaseRuntime({
      provider: 'sqlite',
      projectRoot: process.cwd(),
      databaseUrl: requestedDatabaseUrl,
    })
    : resolveDatabaseRuntime({
      provider: 'sqlite',
      projectRoot: process.cwd(),
    });
  const sqliteDatabaseUrl = requestedDatabaseUrl
    || (runtime.isSqlite && runtime.rawUrl
      ? runtime.rawUrl
      : 'file:./prisma/dev.db');
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
  const scrubResult = stripLegacyHybridDefaultsFromSqliteDatabase(
    resolveSqliteDatabaseFilePath(sqliteDatabaseUrl),
  );
  if (scrubResult.changed) {
    console.log(
      `[platform-schema-upgrade] scrubbed legacy runtime defaults from ${scrubResult.updatedTables.join(', ')}`,
    );
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
  stripLegacyHybridDefaultsFromSqliteDatabase,
};
