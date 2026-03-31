const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyPlatformReconciliationSql,
  buildPostgresCompatibleMigrationSql,
} = require('../scripts/postgres-platform-schema-upgrade');

test('buildPostgresCompatibleMigrationSql converts SQLite datetime and boolean defaults', () => {
  const sql = [
    'CREATE TABLE "Example" (',
    '  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  "enabled" BOOLEAN NOT NULL DEFAULT 1,',
    '  "disabled" BOOLEAN DEFAULT 0',
    ');',
  ].join('\n');

  const rendered = buildPostgresCompatibleMigrationSql(sql);

  assert.match(rendered, /"createdAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
  assert.match(rendered, /"enabled" BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(rendered, /"disabled" BOOLEAN DEFAULT FALSE/);
});

test('buildLegacyPlatformReconciliationSql includes representative legacy backfills', () => {
  const sql = buildLegacyPlatformReconciliationSql();

  assert.match(
    sql,
    /ALTER TABLE IF EXISTS public\."platform_users" ADD COLUMN IF NOT EXISTS "primaryEmail" TEXT;/,
  );
  assert.match(
    sql,
    /ALTER TABLE IF EXISTS public\."platform_users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;/,
  );
  assert.match(
    sql,
    /UPDATE public\."platform_verification_tokens"\s+SET "purpose" = COALESCE\("purpose", NULLIF\("tokenType", ''\)\)/,
  );
  assert.match(
    sql,
    /ALTER TABLE IF EXISTS public\."platform_billing_invoices" ALTER COLUMN "amountCents" SET DEFAULT 0;/,
  );
});
