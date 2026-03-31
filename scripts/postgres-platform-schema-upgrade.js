'use strict';

require('dotenv').config();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { resolveDatabaseRuntime } = require('../src/utils/dbEngine');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRISMA_WITH_PROVIDER_SCRIPT = path.resolve(__dirname, 'prisma-with-provider.js');
const MIGRATION_FILES = Object.freeze([
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260315070000_platform_foundation',
    'migration.sql',
  ),
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260328190000_platform_state_and_control_plane_registry',
    'migration.sql',
  ),
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260328233000_platform_foundation_phase2',
    'migration.sql',
  ),
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260329153000_platform_request_log_restore_state',
    'migration.sql',
  ),
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260329193000_platform_package_catalog',
    'migration.sql',
  ),
  path.resolve(
    PROJECT_ROOT,
    'prisma',
    'migrations',
    '20260331121000_platform_identity_auth_alignment',
    'migration.sql',
  ),
]);

function legacyTimestampSource(columnName) {
  return `NULLIF("${columnName}"::text, '')::timestamp`;
}

function legacyBooleanSource(columnName) {
  return `CASE
    WHEN LOWER(COALESCE(NULLIF("${columnName}"::text, ''), '0')) IN ('1', 'true', 't', 'yes', 'y', 'on')
      THEN TRUE
    ELSE FALSE
  END`;
}

const LEGACY_PLATFORM_COLUMN_MAPPINGS = Object.freeze([
  {
    table: 'platform_users',
    columns: [
      {
        target: 'primaryEmail',
        type: 'TEXT',
        sourceColumns: ['primaryemail'],
        sourceExpression: 'NULLIF("primaryemail", \'\')',
      },
      {
        target: 'displayName',
        type: 'TEXT',
        sourceColumns: ['displayname'],
        sourceExpression: 'NULLIF("displayname", \'\')',
      },
      {
        target: 'passwordHash',
        type: 'TEXT',
        sourceColumns: ['passwordhash'],
        sourceExpression: 'NULLIF("passwordhash", \'\')',
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_user_identities',
    columns: [
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
        fallbackExpression: '"id"',
      },
      {
        target: 'providerUserId',
        type: 'TEXT',
        sourceColumns: ['provideruserid'],
        sourceExpression: 'NULLIF("provideruserid", \'\')',
        fallbackExpression: '"id"',
      },
      {
        target: 'providerEmail',
        type: 'TEXT',
        sourceColumns: ['provideremail'],
        sourceExpression: 'NULLIF("provideremail", \'\')',
      },
      {
        target: 'displayName',
        type: 'TEXT',
        sourceColumns: ['displayname'],
        sourceExpression: 'NULLIF("displayname", \'\')',
      },
      {
        target: 'avatarUrl',
        type: 'TEXT',
        sourceColumns: ['avatarurl'],
        sourceExpression: 'NULLIF("avatarurl", \'\')',
      },
      {
        target: 'verifiedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['verifiedat'],
        sourceExpression: legacyTimestampSource('verifiedat'),
      },
      {
        target: 'linkedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['linkedat'],
        sourceExpression: legacyTimestampSource('linkedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_memberships',
    columns: [
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
        fallbackExpression: '"id"',
      },
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'membershipType',
        type: 'TEXT',
        sourceColumns: ['membershiptype'],
        sourceExpression: 'NULLIF("membershiptype", \'\')',
        fallbackExpression: '\'tenant\'',
        defaultExpression: '\'tenant\'',
      },
      {
        target: 'isPrimary',
        type: 'BOOLEAN',
        sourceColumns: ['isprimary'],
        sourceExpression: legacyBooleanSource('isprimary'),
        fallbackExpression: 'FALSE',
        defaultExpression: 'FALSE',
      },
      {
        target: 'invitedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['invitedat'],
        sourceExpression: legacyTimestampSource('invitedat'),
      },
      {
        target: 'acceptedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['acceptedat'],
        sourceExpression: legacyTimestampSource('acceptedat'),
      },
      {
        target: 'revokedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['revokedat'],
        sourceExpression: legacyTimestampSource('revokedat'),
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_player_profiles',
    columns: [
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
        fallbackExpression: '"id"',
      },
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'discordUserId',
        type: 'TEXT',
        sourceColumns: ['discorduserid'],
        sourceExpression: 'NULLIF("discorduserid", \'\')',
      },
      {
        target: 'steamId',
        type: 'TEXT',
        sourceColumns: ['steamid'],
        sourceExpression: 'NULLIF("steamid", \'\')',
      },
      {
        target: 'inGameName',
        type: 'TEXT',
        sourceColumns: ['ingamename'],
        sourceExpression: 'NULLIF("ingamename", \'\')',
      },
      {
        target: 'verificationState',
        type: 'TEXT',
        sourceColumns: ['verificationstate'],
        sourceExpression: 'NULLIF("verificationstate", \'\')',
        fallbackExpression: '\'unverified\'',
        defaultExpression: '\'unverified\'',
      },
      {
        target: 'linkedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['linkedat'],
        sourceExpression: legacyTimestampSource('linkedat'),
      },
      {
        target: 'lastSeenAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['lastseenat'],
        sourceExpression: legacyTimestampSource('lastseenat'),
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_verification_tokens',
    columns: [
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
      },
      {
        target: 'previewAccountId',
        type: 'TEXT',
        sourceColumns: ['previewaccountid'],
        sourceExpression: 'NULLIF("previewaccountid", \'\')',
      },
      {
        target: 'tokenPrefix',
        type: 'TEXT',
        sourceColumns: ['tokenprefix'],
        sourceExpression: 'NULLIF("tokenprefix", \'\')',
        fallbackExpression: 'SUBSTRING(md5(COALESCE("id", \'legacy-token\')) FROM 1 FOR 16)',
      },
      {
        target: 'tokenHash',
        type: 'TEXT',
        sourceColumns: ['tokenhash'],
        sourceExpression: 'NULLIF("tokenhash", \'\')',
        fallbackExpression: 'md5(COALESCE("id", \'legacy-token\'))',
      },
      {
        target: 'target',
        type: 'TEXT',
      },
      {
        target: 'expiresAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['expiresat'],
        sourceExpression: legacyTimestampSource('expiresat'),
        fallbackExpression: 'CURRENT_TIMESTAMP + INTERVAL \'30 days\'',
      },
      {
        target: 'consumedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['consumedat'],
        sourceExpression: legacyTimestampSource('consumedat'),
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_password_reset_tokens',
    columns: [
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
      },
      {
        target: 'previewAccountId',
        type: 'TEXT',
        sourceColumns: ['previewaccountid'],
        sourceExpression: 'NULLIF("previewaccountid", \'\')',
      },
      {
        target: 'tokenPrefix',
        type: 'TEXT',
        sourceColumns: ['tokenprefix'],
        sourceExpression: 'NULLIF("tokenprefix", \'\')',
        fallbackExpression: 'SUBSTRING(md5(COALESCE("id", \'legacy-reset\')) FROM 1 FOR 16)',
      },
      {
        target: 'tokenHash',
        type: 'TEXT',
        sourceColumns: ['tokenhash'],
        sourceExpression: 'NULLIF("tokenhash", \'\')',
        fallbackExpression: 'md5(COALESCE("id", \'legacy-reset\'))',
      },
      {
        target: 'expiresAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['expiresat'],
        sourceExpression: legacyTimestampSource('expiresat'),
        fallbackExpression: 'CURRENT_TIMESTAMP + INTERVAL \'30 days\'',
      },
      {
        target: 'consumedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['consumedat'],
        sourceExpression: legacyTimestampSource('consumedat'),
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_billing_customers',
    columns: [
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'userId',
        type: 'TEXT',
        sourceColumns: ['userid'],
        sourceExpression: 'NULLIF("userid", \'\')',
      },
      {
        target: 'displayName',
        type: 'TEXT',
        sourceColumns: ['displayname'],
        sourceExpression: 'NULLIF("displayname", \'\')',
      },
      {
        target: 'externalRef',
        type: 'TEXT',
        sourceColumns: ['externalref'],
        sourceExpression: 'NULLIF("externalref", \'\')',
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_billing_invoices',
    columns: [
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'subscriptionId',
        type: 'TEXT',
        sourceColumns: ['subscriptionid'],
        sourceExpression: 'NULLIF("subscriptionid", \'\')',
      },
      {
        target: 'customerId',
        type: 'TEXT',
        sourceColumns: ['customerid'],
        sourceExpression: 'NULLIF("customerid", \'\')',
      },
      {
        target: 'amountCents',
        type: 'INTEGER',
        sourceColumns: ['amountcents'],
        sourceExpression: 'COALESCE("amountcents", 0)',
        fallbackExpression: '0',
        defaultExpression: '0',
      },
      {
        target: 'dueAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['dueat'],
        sourceExpression: legacyTimestampSource('dueat'),
      },
      {
        target: 'paidAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['paidat'],
        sourceExpression: legacyTimestampSource('paidat'),
      },
      {
        target: 'externalRef',
        type: 'TEXT',
        sourceColumns: ['externalref'],
        sourceExpression: 'NULLIF("externalref", \'\')',
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_billing_payment_attempts',
    columns: [
      {
        target: 'invoiceId',
        type: 'TEXT',
        sourceColumns: ['invoiceid'],
        sourceExpression: 'NULLIF("invoiceid", \'\')',
      },
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'amountCents',
        type: 'INTEGER',
        sourceColumns: ['amountcents'],
        sourceExpression: 'COALESCE("amountcents", 0)',
        fallbackExpression: '0',
        defaultExpression: '0',
      },
      {
        target: 'externalRef',
        type: 'TEXT',
        sourceColumns: ['externalref'],
        sourceExpression: 'NULLIF("externalref", \'\')',
      },
      {
        target: 'errorCode',
        type: 'TEXT',
        sourceColumns: ['errorcode'],
        sourceExpression: 'NULLIF("errorcode", \'\')',
      },
      {
        target: 'errorDetail',
        type: 'TEXT',
        sourceColumns: ['errordetail'],
        sourceExpression: 'NULLIF("errordetail", \'\')',
      },
      {
        target: 'attemptedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['attemptedat'],
        sourceExpression: legacyTimestampSource('attemptedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'completedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['completedat'],
        sourceExpression: legacyTimestampSource('completedat'),
      },
      {
        target: 'metadataJson',
        type: 'TEXT',
        sourceColumns: ['metadatajson'],
        sourceExpression: 'NULLIF("metadatajson", \'\')',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
  {
    table: 'platform_subscription_events',
    columns: [
      {
        target: 'tenantId',
        type: 'TEXT',
        sourceColumns: ['tenantid'],
        sourceExpression: 'NULLIF("tenantid", \'\')',
      },
      {
        target: 'subscriptionId',
        type: 'TEXT',
        sourceColumns: ['subscriptionid'],
        sourceExpression: 'NULLIF("subscriptionid", \'\')',
      },
      {
        target: 'eventType',
        type: 'TEXT',
        sourceColumns: ['eventtype'],
        sourceExpression: 'NULLIF("eventtype", \'\')',
        fallbackExpression: '\'subscription_event\'',
      },
      {
        target: 'billingStatus',
        type: 'TEXT',
        sourceColumns: ['billingstatus'],
        sourceExpression: 'NULLIF("billingstatus", \'\')',
      },
      {
        target: 'payloadJson',
        type: 'TEXT',
        sourceColumns: ['payloadjson'],
        sourceExpression: 'NULLIF("payloadjson", \'\')',
      },
      {
        target: 'occurredAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['occurredat'],
        sourceExpression: legacyTimestampSource('occurredat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'createdAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['createdat'],
        sourceExpression: legacyTimestampSource('createdat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
      {
        target: 'updatedAt',
        type: 'TIMESTAMP(3)',
        sourceColumns: ['updatedat'],
        sourceExpression: legacyTimestampSource('updatedat'),
        fallbackExpression: 'CURRENT_TIMESTAMP',
        defaultExpression: 'CURRENT_TIMESTAMP',
      },
    ],
  },
]);

function trimText(value, maxLen = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeDatabaseUrl(value) {
  return trimText(value, 12000).replace(/^"|"$/g, '');
}

function sqlLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function buildPostgresCompatibleMigrationSql(sqlText = '') {
  return String(sqlText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\bDATETIME\b/g, 'TIMESTAMP(3)')
    .replace(/BOOLEAN\s+NOT NULL\s+DEFAULT\s+1/gi, 'BOOLEAN NOT NULL DEFAULT TRUE')
    .replace(/BOOLEAN\s+NOT NULL\s+DEFAULT\s+0/gi, 'BOOLEAN NOT NULL DEFAULT FALSE')
    .replace(/BOOLEAN\s+DEFAULT\s+1/gi, 'BOOLEAN DEFAULT TRUE')
    .replace(/BOOLEAN\s+DEFAULT\s+0/gi, 'BOOLEAN DEFAULT FALSE');
}

function buildGuardedUpdateSql(tableName, columnConfig) {
  const sourceColumns = Array.isArray(columnConfig.sourceColumns)
    ? columnConfig.sourceColumns.filter(Boolean)
    : [];
  if (!columnConfig.sourceExpression || sourceColumns.length === 0) {
    return '';
  }
  const sourceChecks = sourceColumns.map((columnName) => `
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = ${sqlLiteral(tableName)}
            AND column_name = ${sqlLiteral(columnName)}
        )`).join(' AND');
  return `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${sqlLiteral(tableName)}
  ) AND ${sourceChecks} THEN
    UPDATE public."${tableName}"
    SET "${columnConfig.target}" = COALESCE("${columnConfig.target}", ${columnConfig.sourceExpression})
    WHERE "${columnConfig.target}" IS NULL;
  END IF;
END $$;`;
}

function buildFallbackUpdateSql(tableName, columnConfig) {
  if (!columnConfig.fallbackExpression) return '';
  return `
UPDATE public."${tableName}"
SET "${columnConfig.target}" = COALESCE("${columnConfig.target}", ${columnConfig.fallbackExpression})
WHERE "${columnConfig.target}" IS NULL;`;
}

function buildDefaultSql(tableName, columnConfig) {
  if (!columnConfig.defaultExpression) return '';
  return `ALTER TABLE IF EXISTS public."${tableName}" ALTER COLUMN "${columnConfig.target}" SET DEFAULT ${columnConfig.defaultExpression};`;
}

function buildLegacyPlatformReconciliationSql() {
  const statements = [];
  for (const tableConfig of LEGACY_PLATFORM_COLUMN_MAPPINGS) {
    statements.push(`-- Reconcile legacy lowercase columns for ${tableConfig.table}`);
    for (const columnConfig of tableConfig.columns) {
      statements.push(
        `ALTER TABLE IF EXISTS public."${tableConfig.table}" ADD COLUMN IF NOT EXISTS "${columnConfig.target}" ${columnConfig.type};`,
      );
    }
    for (const columnConfig of tableConfig.columns) {
      const guardedUpdate = buildGuardedUpdateSql(tableConfig.table, columnConfig);
      if (guardedUpdate) statements.push(guardedUpdate);
      const fallbackUpdate = buildFallbackUpdateSql(tableConfig.table, columnConfig);
      if (fallbackUpdate) statements.push(fallbackUpdate);
      const defaultSql = buildDefaultSql(tableConfig.table, columnConfig);
      if (defaultSql) statements.push(defaultSql);
    }
  }
  statements.push('-- Reconcile platform verification token purpose compatibility');
  statements.push(`
UPDATE public."platform_verification_tokens"
SET "purpose" = COALESCE("purpose", NULLIF("tokenType", ''))
WHERE "purpose" IS NULL;`);
  statements.push(`
UPDATE public."platform_verification_tokens"
SET "tokenType" = COALESCE("tokenType", NULLIF("purpose", ''), 'email_verification')
WHERE "tokenType" IS NULL;`);
  statements.push(`
UPDATE public."platform_verification_tokens"
SET "target" = COALESCE("target", "email")
WHERE "target" IS NULL
  AND "email" IS NOT NULL;`);
  return `${statements.join('\n')}\n`;
}

function writeTempSqlFile(prefix, sqlText) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-schema-upgrade-'));
  const filePath = path.join(tempDir, `${prefix}.sql`);
  fs.writeFileSync(filePath, sqlText, 'utf8');
  return {
    filePath,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function runPrismaDbExecute(label, sqlText, env) {
  const sqlFile = writeTempSqlFile(label, sqlText);
  try {
    const result = spawnSync(
      process.execPath,
      [
        PRISMA_WITH_PROVIDER_SCRIPT,
        '--provider',
        'postgresql',
        'db',
        'execute',
        '--file',
        sqlFile.filePath,
      ],
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        env,
      },
    );
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(
        trimText(result.stderr || result.stdout || `${label} failed`, 12000),
      );
    }
  } finally {
    sqlFile.cleanup();
  }
}

function runPrismaGenerate(env) {
  const result = spawnSync(
    process.execPath,
    [PRISMA_WITH_PROVIDER_SCRIPT, '--provider', 'postgresql', 'generate'],
    {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      env,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(trimText(result.stderr || result.stdout || 'prisma generate failed', 12000));
  }
}

function runPostgresPlatformSchemaUpgrade() {
  const runtime = resolveDatabaseRuntime({
    provider: 'postgresql',
    projectRoot: PROJECT_ROOT,
  });
  const databaseUrl = normalizeDatabaseUrl(runtime.rawUrl || process.env.DATABASE_URL);
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('postgresql DATABASE_URL is required for postgres platform schema upgrade');
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_PROVIDER: 'postgresql',
    PRISMA_SCHEMA_PROVIDER: 'postgresql',
  };

  const reconciliationSql = buildLegacyPlatformReconciliationSql();
  console.log('[platform-schema-upgrade] reconciling legacy PostgreSQL platform columns');
  runPrismaDbExecute('postgres-legacy-reconcile', reconciliationSql, env);

  for (const migrationFile of MIGRATION_FILES) {
    const sqlText = fs.readFileSync(migrationFile, 'utf8');
    const compatibleSql = buildPostgresCompatibleMigrationSql(sqlText);
    console.log(`[platform-schema-upgrade] applying ${path.basename(path.dirname(migrationFile))} for PostgreSQL`);
    runPrismaDbExecute(path.basename(path.dirname(migrationFile)), compatibleSql, env);
  }

  console.log('[platform-schema-upgrade] regenerating Prisma client for PostgreSQL');
  runPrismaGenerate(env);
  console.log('[platform-schema-upgrade] PostgreSQL platform schema upgrade complete');
}

if (require.main === module) {
  runPostgresPlatformSchemaUpgrade();
}

module.exports = {
  LEGACY_PLATFORM_COLUMN_MAPPINGS,
  buildLegacyPlatformReconciliationSql,
  buildPostgresCompatibleMigrationSql,
  runPostgresPlatformSchemaUpgrade,
};
