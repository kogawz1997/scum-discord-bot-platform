'use strict';

const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const {
  getCompatibilityClientKey,
  ensureSqliteDateTimeSchemaCompatibility,
  reconcileSqliteDateColumns,
} = require('../utils/sqliteDateTimeCompatibility');

const sharedRestartSqliteCompatibilityReady = new WeakSet();

const RESTART_SQLITE_COMPATIBILITY_TABLES = [
  {
    tableName: 'platform_restart_plans',
    columns: ['id', 'tenant_id', 'server_id', 'guild_id', 'runtime_key', 'status', 'restart_mode', 'control_mode', 'requested_by', 'scheduled_for', 'delay_seconds', 'reason', 'payload_json', 'health_status', 'health_verified_at', 'created_at', 'updated_at'],
    dateColumns: ['scheduled_for', 'health_verified_at', 'created_at', 'updated_at'],
    createTableSql: `
      CREATE TABLE "platform_restart_plans" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenant_id" TEXT NOT NULL,
        "server_id" TEXT NOT NULL,
        "guild_id" TEXT,
        "runtime_key" TEXT,
        "status" TEXT NOT NULL DEFAULT 'scheduled',
        "restart_mode" TEXT NOT NULL DEFAULT 'delayed',
        "control_mode" TEXT NOT NULL DEFAULT 'service',
        "requested_by" TEXT,
        "scheduled_for" DATETIME NOT NULL,
        "delay_seconds" INTEGER NOT NULL DEFAULT 0,
        "reason" TEXT,
        "payload_json" TEXT,
        "health_status" TEXT,
        "health_verified_at" DATETIME,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_restart_plans_tenant_scheduled_idx" ON "platform_restart_plans"("tenant_id", "scheduled_for");',
      'CREATE INDEX "platform_restart_plans_server_scheduled_idx" ON "platform_restart_plans"("server_id", "scheduled_for");',
      'CREATE INDEX "platform_restart_plans_status_scheduled_idx" ON "platform_restart_plans"("status", "scheduled_for");',
    ],
  },
  {
    tableName: 'platform_restart_announcements',
    columns: ['id', 'plan_id', 'tenant_id', 'server_id', 'checkpoint_seconds', 'message', 'channel', 'status', 'scheduled_for', 'sent_at', 'meta_json', 'created_at', 'updated_at'],
    dateColumns: ['scheduled_for', 'sent_at', 'created_at', 'updated_at'],
    createTableSql: `
      CREATE TABLE "platform_restart_announcements" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plan_id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "server_id" TEXT NOT NULL,
        "checkpoint_seconds" INTEGER NOT NULL,
        "message" TEXT NOT NULL,
        "channel" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "scheduled_for" DATETIME NOT NULL,
        "sent_at" DATETIME,
        "meta_json" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_restart_announcements_plan_scheduled_idx" ON "platform_restart_announcements"("plan_id", "scheduled_for");',
      'CREATE INDEX "platform_restart_announcements_status_scheduled_idx" ON "platform_restart_announcements"("status", "scheduled_for");',
    ],
  },
  {
    tableName: 'platform_restart_executions',
    columns: ['id', 'plan_id', 'tenant_id', 'server_id', 'runtime_key', 'action', 'result_status', 'started_at', 'completed_at', 'exit_code', 'detail', 'meta_json', 'created_at', 'updated_at'],
    dateColumns: ['started_at', 'completed_at', 'created_at', 'updated_at'],
    createTableSql: `
      CREATE TABLE "platform_restart_executions" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "plan_id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "server_id" TEXT NOT NULL,
        "runtime_key" TEXT,
        "action" TEXT NOT NULL DEFAULT 'restart',
        "result_status" TEXT NOT NULL DEFAULT 'pending',
        "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" DATETIME,
        "exit_code" INTEGER,
        "detail" TEXT,
        "meta_json" TEXT,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
    indexSql: [
      'CREATE INDEX "platform_restart_executions_plan_started_idx" ON "platform_restart_executions"("plan_id", "started_at");',
      'CREATE INDEX "platform_restart_executions_tenant_server_started_idx" ON "platform_restart_executions"("tenant_id", "server_id", "started_at");',
    ],
  },
];

function hasSharedRestartSqliteCompatibility(db = null) {
  const key = getCompatibilityClientKey(db);
  return Boolean(key && sharedRestartSqliteCompatibilityReady.has(key));
}

async function ensureSharedRestartSqliteCompatibility(options = {}) {
  const {
    db,
    prisma,
    getRestartDelegatesOrThrow,
    isSharedRestartPrismaClient,
  } = options;
  const runtime = resolveDatabaseRuntime();
  if (!runtime.isSqlite) return { ok: false, reason: 'runtime-not-sqlite' };
  if (!isSharedRestartPrismaClient(db || prisma)) return { ok: false, reason: 'shared-restart-client-unavailable' };
  try {
    getRestartDelegatesOrThrow(db || prisma);
  } catch {
    return { ok: false, reason: 'restart-delegates-unavailable' };
  }
  const key = getCompatibilityClientKey(db || prisma);
  if (key && sharedRestartSqliteCompatibilityReady.has(key)) {
    return { ok: true, reused: true, tables: [] };
  }

  if (runtime.filePath) {
    ensureSqliteDateTimeSchemaCompatibility(runtime.filePath, RESTART_SQLITE_COMPATIBILITY_TABLES);
  }

  const client = db || prisma;
  const tables = [];
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_restart_plans',
    idColumn: 'id',
    dateColumns: ['scheduled_for', 'health_verified_at', 'created_at', 'updated_at'],
  }));
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_restart_announcements',
    idColumn: 'id',
    dateColumns: ['scheduled_for', 'sent_at', 'created_at', 'updated_at'],
  }));
  tables.push(await reconcileSqliteDateColumns(client, {
    tableName: 'platform_restart_executions',
    idColumn: 'id',
    dateColumns: ['started_at', 'completed_at', 'created_at', 'updated_at'],
  }));

  if (key) {
    sharedRestartSqliteCompatibilityReady.add(key);
  }
  return { ok: true, reused: false, tables };
}

module.exports = {
  ensureSharedRestartSqliteCompatibility,
  hasSharedRestartSqliteCompatibility,
};
