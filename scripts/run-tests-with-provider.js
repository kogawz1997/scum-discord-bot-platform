'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { URL } = require('node:url');
require('dotenv').config();

const PROJECT_ROOT = process.cwd();
const GENERATED_SCHEMA_PATH = path.join(PROJECT_ROOT, 'node_modules', '.prisma', 'client', 'schema.prisma');
const GENERATED_CLIENT_METADATA_PATH = path.join(
  PROJECT_ROOT,
  'artifacts',
  'prisma',
  'generated',
  'current.json',
);
const TEST_ROOT = path.join(PROJECT_ROOT, 'test');

function readGeneratedProvider() {
  if (fs.existsSync(GENERATED_CLIENT_METADATA_PATH)) {
    try {
      const raw = fs.readFileSync(GENERATED_CLIENT_METADATA_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      const provider = String(parsed?.provider || '').trim().toLowerCase();
      if (provider) {
        return provider;
      }
    } catch {}
  }
  if (!fs.existsSync(GENERATED_SCHEMA_PATH)) {
    return String(process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || 'sqlite').trim().toLowerCase();
  }
  const text = fs.readFileSync(GENERATED_SCHEMA_PATH, 'utf8');
  const match = text.match(/datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
  return String(match?.[1] || process.env.PRISMA_SCHEMA_PROVIDER || process.env.DATABASE_PROVIDER || 'sqlite')
    .trim()
    .toLowerCase();
}

function findPgBinDir() {
  const candidates = [
    process.env.PG_BIN_DIR,
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\18\\bin',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'psql.exe'))) {
      return candidate;
    }
  }
  throw new Error('PostgreSQL bin directory not found');
}

function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || PROJECT_ROOT,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    stdio: options.stdio || 'inherit',
    shell: options.shell === true,
    encoding: options.encoding || 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status || 0) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return result;
}

function escapeSqlLiteral(value) {
  return String(value || '').replace(/'/g, "''");
}

function escapeSqlLikePattern(value) {
  return escapeSqlLiteral(String(value || ''))
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

function quoteIdentifier(value) {
  return `"${String(value || '').replaceAll('"', '""')}"`;
}

function buildPostgresTestRuntime() {
  const rawUrl = String(process.env.DATABASE_URL || '').trim();
  if (!/^postgres(?:ql)?:\/\//i.test(rawUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL when generated client provider is postgresql');
  }
  const url = new URL(rawUrl);
  const schema = `test_runtime_${Date.now()}`;
  const tenantSchemaPrefix = `${schema}_tenant_`;
  const baseUrl = new URL(rawUrl);
  baseUrl.search = '';
  url.searchParams.set('schema', schema);
  const pgBinDir = findPgBinDir();
  const sql = `DROP SCHEMA IF EXISTS "${schema}" CASCADE; CREATE SCHEMA "${schema}";`;
  runCommand(path.join(pgBinDir, 'psql.exe'), ['-v', 'ON_ERROR_STOP=1', baseUrl.toString(), '-c', sql]);
  runCommand(
    process.execPath,
    ['scripts/prisma-with-provider.js', '--provider', 'postgresql', 'db', 'push', '--skip-generate'],
    {
      env: {
        DATABASE_URL: url.toString(),
        DATABASE_PROVIDER: 'postgresql',
        PRISMA_SCHEMA_PROVIDER: 'postgresql',
      },
    },
  );
  return {
    databaseUrl: url.toString(),
    provider: 'postgresql',
    tenantSchemaPrefix,
    cleanup: () => {
      const listSql = `
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE '${escapeSqlLikePattern(tenantSchemaPrefix)}%' ESCAPE '\\'
        ORDER BY schema_name ASC;
      `;
      const listResult = runCommand(
        path.join(pgBinDir, 'psql.exe'),
        ['-v', 'ON_ERROR_STOP=1', '-At', baseUrl.toString(), '-c', listSql],
        {
          stdio: 'pipe',
        },
      );
      const schemaNames = String(listResult.stdout || '')
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const schemaName of schemaNames) {
        runCommand(
          path.join(pgBinDir, 'psql.exe'),
          ['-v', 'ON_ERROR_STOP=1', baseUrl.toString(), '-c', `DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE;`],
        );
      }
      runCommand(
        path.join(pgBinDir, 'psql.exe'),
        ['-v', 'ON_ERROR_STOP=1', baseUrl.toString(), '-c', `DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE;`],
      );
    },
  };
}

function buildTestRuntime() {
  const provider = readGeneratedProvider();
  if (provider === 'postgresql') {
    return buildPostgresTestRuntime();
  }
  return {
    databaseUrl: `file:${path.join(PROJECT_ROOT, 'prisma', 'prisma', 'test.db')}`,
    provider: 'sqlite',
    cleanup: null,
  };
}

function shouldIncludeTestFile(entryPath, rootDir = TEST_ROOT) {
  const relativePath = path.relative(rootDir, entryPath);
  if (!relativePath || relativePath.startsWith('..')) return false;
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('fixtures/')) return false;
  return /\.test\.js$/i.test(path.basename(entryPath));
}

function collectTestFiles(rootDir) {
  const results = [];
  if (!fs.existsSync(rootDir)) return results;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'fixtures') continue;
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (shouldIncludeTestFile(fullPath, rootDir)) {
        results.push(path.relative(PROJECT_ROOT, fullPath));
      }
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function main() {
  const testRuntime = buildTestRuntime();
  const requestedArgs = process.argv.slice(2);
  const args = requestedArgs.length > 0 ? requestedArgs : collectTestFiles(TEST_ROOT);
  let result;
  try {
    result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...args], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: testRuntime.databaseUrl,
        DATABASE_PROVIDER: testRuntime.provider,
        PRISMA_SCHEMA_PROVIDER: testRuntime.provider,
        PRISMA_TEST_DATABASE_URL: testRuntime.databaseUrl,
        PRISMA_TEST_DATABASE_PROVIDER: testRuntime.provider,
        TENANT_DB_SCHEMA_PREFIX: testRuntime.tenantSchemaPrefix || process.env.TENANT_DB_SCHEMA_PREFIX || 'tenant_',
        PLATFORM_DEFAULT_TENANT_ID: '',
        DEFAULT_TENANT_ID: '',
      },
      stdio: 'inherit',
    });
  } finally {
    if (typeof testRuntime.cleanup === 'function') {
      try {
        testRuntime.cleanup();
      } catch (error) {
        console.error(`[run-tests-with-provider] cleanup failed: ${error.message}`);
      }
    }
  }
  process.exit(result?.status || 0);
}

module.exports = {
  collectTestFiles,
  shouldIncludeTestFile,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[run-tests-with-provider] ${error.message}`);
    process.exit(1);
  }
}
