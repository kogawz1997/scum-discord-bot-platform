'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');

const { prisma } = require('../prisma');
const { normalizeRestartServerPayload } = require('../contracts/jobs/jobContracts');
const { buildRestartAnnouncementPlan } = require('../domain/servers/serverControlJobService');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const {
  getCompatibilityClientKey,
  ensureSqliteDateTimeSchemaCompatibility,
  reconcileSqliteDateColumns,
} = require('../utils/sqliteDateTimeCompatibility');
const { publishAdminLiveUpdate } = require('./adminLiveBus');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function createId(prefix = 'restart') {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numericDate = new Date(Number(trimmed));
      return Number.isNaN(numericDate.getTime()) ? null : numericDate;
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function createStableHash(value) {
  return crypto.createHash('sha256').update(stableSerialize(value)).digest('hex');
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function getRestartDelegates(db = prisma) {
  return {
    plan: db?.platformRestartPlan || null,
    announcement: db?.platformRestartAnnouncement || null,
    execution: db?.platformRestartExecution || null,
  };
}

function getRestartDelegatesOrThrow(db = prisma) {
  const delegates = getRestartDelegates(db);
  if (
    delegates.plan && typeof delegates.plan.findUnique === 'function'
    && delegates.announcement && typeof delegates.announcement.findUnique === 'function'
    && delegates.execution && typeof delegates.execution.findUnique === 'function'
  ) {
    return delegates;
  }
  const error = new Error(
    'Platform restart schema is not ready. Run the database migrations before using restart orchestration.',
  );
  error.code = 'PLATFORM_RESTART_SCHEMA_REQUIRED';
  error.statusCode = 500;
  throw error;
}

function isSharedRestartPrismaClient(db = null) {
  if (!db || !prisma) return false;
  if (db === prisma) return true;
  const clientOriginal = db && typeof db === 'object' ? db._originalClient : null;
  const sharedOriginal = prisma && typeof prisma === 'object' ? prisma._originalClient : null;
  return Boolean(clientOriginal && sharedOriginal && clientOriginal === sharedOriginal);
}

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

async function ensureSharedRestartSqliteCompatibility(db = prisma) {
  const runtime = resolveDatabaseRuntime();
  if (!runtime.isSqlite) return { ok: false, reason: 'runtime-not-sqlite' };
  if (!isSharedRestartPrismaClient(db)) return { ok: false, reason: 'shared-restart-client-unavailable' };
  try {
    getRestartDelegatesOrThrow(db);
  } catch {
    return { ok: false, reason: 'restart-delegates-unavailable' };
  }
  const key = getCompatibilityClientKey(db);
  if (key && sharedRestartSqliteCompatibilityReady.has(key)) {
    return { ok: true, reused: true, tables: [] };
  }

  if (runtime.filePath) {
    ensureSqliteDateTimeSchemaCompatibility(runtime.filePath, RESTART_SQLITE_COMPATIBILITY_TABLES);
  }

  const tables = [];
  tables.push(await reconcileSqliteDateColumns(db, {
    tableName: 'platform_restart_plans',
    idColumn: 'id',
    dateColumns: ['scheduled_for', 'health_verified_at', 'created_at', 'updated_at'],
  }));
  tables.push(await reconcileSqliteDateColumns(db, {
    tableName: 'platform_restart_announcements',
    idColumn: 'id',
    dateColumns: ['scheduled_for', 'sent_at', 'created_at', 'updated_at'],
  }));
  tables.push(await reconcileSqliteDateColumns(db, {
    tableName: 'platform_restart_executions',
    idColumn: 'id',
    dateColumns: ['started_at', 'completed_at', 'created_at', 'updated_at'],
  }));

  if (key) {
    sharedRestartSqliteCompatibilityReady.add(key);
  }
  return { ok: true, reused: false, tables };
}

function getRestartPersistenceMode(db = null) {
  if (db && !isSharedRestartPrismaClient(db)) {
    try {
      getRestartDelegatesOrThrow(db);
      return 'prisma';
    } catch {
      // Fall back to runtime engine detection for compatibility paths.
    }
  }
  if (db && hasSharedRestartSqliteCompatibility(db)) {
    return 'prisma';
  }
  const runtime = resolveDatabaseRuntime();
  return runtime.isServerEngine ? 'prisma' : 'sql';
}

function normalizePlanRow(row) {
  const scheduledFor = parseDate(row?.scheduledFor);
  const healthVerifiedAt = parseDate(row?.healthVerifiedAt);
  const createdAt = parseDate(row?.createdAt);
  const updatedAt = parseDate(row?.updatedAt);
  if (!row) return null;
  return {
    id: trimText(row.id, 160) || null,
    tenantId: trimText(row.tenantId, 160) || null,
    serverId: trimText(row.serverId, 160) || null,
    guildId: trimText(row.guildId, 160) || null,
    runtimeKey: trimText(row.runtimeKey, 200) || null,
    status: trimText(row.status, 60) || 'scheduled',
    restartMode: trimText(row.restartMode, 60) || 'delayed',
    controlMode: trimText(row.controlMode, 60) || 'service',
    requestedBy: trimText(row.requestedBy, 200) || null,
    scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
    delaySeconds: asInt(row.delaySeconds, 0, 0),
    reason: trimText(row.reason, 400) || null,
    payload: (() => {
      try {
        return row.payloadJson ? JSON.parse(String(row.payloadJson)) : {};
      } catch {
        return {};
      }
    })(),
    healthStatus: trimText(row.healthStatus, 60) || null,
    healthVerifiedAt: healthVerifiedAt ? healthVerifiedAt.toISOString() : null,
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

function normalizeAnnouncementRow(row) {
  const scheduledFor = parseDate(row?.scheduledFor);
  const sentAt = parseDate(row?.sentAt);
  const createdAt = parseDate(row?.createdAt);
  const updatedAt = parseDate(row?.updatedAt);
  return {
    id: trimText(row?.id, 160) || null,
    planId: trimText(row?.planId, 160) || null,
    tenantId: trimText(row?.tenantId, 160) || null,
    serverId: trimText(row?.serverId, 160) || null,
    checkpointSeconds: asInt(row?.checkpointSeconds, 0, 0),
    message: trimText(row?.message, 320) || null,
    channel: trimText(row?.channel, 120) || null,
    status: trimText(row?.status, 60) || 'pending',
    scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
    sentAt: sentAt ? sentAt.toISOString() : null,
    metadata: (() => {
      try {
        return row?.metaJson ? JSON.parse(String(row.metaJson)) : {};
      } catch {
        return {};
      }
    })(),
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

function normalizeExecutionRow(row) {
  const startedAt = parseDate(row?.startedAt);
  const completedAt = parseDate(row?.completedAt);
  const createdAt = parseDate(row?.createdAt);
  const updatedAt = parseDate(row?.updatedAt);
  return {
    id: trimText(row?.id, 160) || null,
    planId: trimText(row?.planId, 160) || null,
    tenantId: trimText(row?.tenantId, 160) || null,
    serverId: trimText(row?.serverId, 160) || null,
    runtimeKey: trimText(row?.runtimeKey, 200) || null,
    action: trimText(row?.action, 80) || 'restart',
    resultStatus: trimText(row?.resultStatus, 60) || 'pending',
    startedAt: startedAt ? startedAt.toISOString() : null,
    completedAt: completedAt ? completedAt.toISOString() : null,
    exitCode: row?.exitCode == null ? null : asInt(row.exitCode, 0, 0),
    detail: trimText(row?.detail, 800) || null,
    metadata: (() => {
      try {
        return row?.metaJson ? JSON.parse(String(row.metaJson)) : {};
      } catch {
        return {};
      }
    })(),
    createdAt: createdAt ? createdAt.toISOString() : null,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
  };
}

function getLatestArtifactDateMs(row = {}, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    const date = parseDate(row?.[key]);
    if (date) return date.getTime();
  }
  return Number.NEGATIVE_INFINITY;
}

function selectRetentionArtifactIds(rows = [], options = {}) {
  const keepLatest = Math.max(0, asInt(options.keepLatest, 0, 0));
  const cutoffMs = Number.isFinite(options.cutoffMs) ? options.cutoffMs : Number.NaN;
  const dateKeys = Array.isArray(options.dateKeys) ? options.dateKeys : ['updatedAt', 'createdAt'];
  const allowRow = typeof options.allowRow === 'function' ? options.allowRow : (() => true);
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((left, right) => getLatestArtifactDateMs(right, dateKeys) - getLatestArtifactDateMs(left, dateKeys))
    .filter((row, index) => {
      if (index < keepLatest) return false;
      if (!allowRow(row)) return false;
      if (!Number.isFinite(cutoffMs)) return true;
      return getLatestArtifactDateMs(row, dateKeys) <= cutoffMs;
    })
    .map((row) => trimText(row?.id, 160))
    .filter(Boolean);
}

async function deleteRestartRowsRaw(db, tableName, ids = []) {
  const wanted = (Array.isArray(ids) ? ids : []).map((entry) => trimText(entry, 160)).filter(Boolean);
  if (wanted.length === 0) return 0;
  const safeTable = String(tableName || '').trim();
  if (![
    'platform_restart_plans',
    'platform_restart_announcements',
    'platform_restart_executions',
  ].includes(safeTable)) {
    throw new Error('restart-retention-table-invalid');
  }
  await db.$executeRaw(
    Prisma.sql`DELETE FROM ${Prisma.raw(safeTable)} WHERE id IN (${Prisma.join(wanted)})`,
  );
  return wanted.length;
}

function buildRestartPlanRequestKey(input = {}, payload = {}, announcementPlan = []) {
  const explicitScheduledFor = parseDate(input.scheduledFor);
  return createStableHash({
    tenantId: trimText(payload.tenantId, 160) || null,
    serverId: trimText(payload.serverId, 160) || null,
    guildId: trimText(payload.guildId, 160) || null,
    runtimeKey: trimText(payload.agentId || input.runtimeKey, 200) || null,
    restartMode: trimText(payload.restartMode, 60) || 'delayed',
    controlMode: trimText(payload.controlMode, 60) || 'service',
    delaySeconds: asInt(payload.delaySeconds, 0, 0),
    explicitScheduledFor: explicitScheduledFor ? explicitScheduledFor.toISOString() : null,
    reason: trimText(payload.reason, 400) || null,
    channel: trimText(input.channel, 120) || null,
    force: Boolean(input.force),
    announcementPlan: Array.isArray(announcementPlan)
      ? announcementPlan.map((entry) => ({
        delaySeconds: asInt(entry?.delaySeconds, 0, 0),
        message: trimText(entry?.message, 320) || null,
      }))
      : [],
    safetyInputs: {
      queueDepth: input.queueDepth == null ? null : asInt(input.queueDepth, 0, 0),
      queueItemsCount: Array.isArray(input.queueItems) ? input.queueItems.length : null,
      deadLetterCount: input.deadLetterCount == null ? null : asInt(input.deadLetterCount, 0, 0),
      deadLettersCount: Array.isArray(input.deadLetters) ? input.deadLetters.length : null,
      deliveryRuntimeStatus: trimText(input.deliveryRuntimeStatus, 60) || null,
      announcementRuntimeStatus: trimText(input.announcementRuntimeStatus, 60) || null,
      serverBotReady: input.serverBotReady == null ? null : Boolean(input.serverBotReady),
      serverBotStatus: trimText(input.serverBotStatus, 60) || null,
      blockers: Array.isArray(input.blockers)
        ? input.blockers.map((entry) => trimText(entry, 240)).filter(Boolean).sort()
        : [],
    },
  });
}

function buildRestartExecutionRequestKey(input = {}) {
  return createStableHash({
    planId: trimText(input.planId, 160) || null,
    tenantId: trimText(input.tenantId, 160) || null,
    serverId: trimText(input.serverId, 160) || null,
    runtimeKey: trimText(input.runtimeKey, 200) || null,
    action: trimText(input.action, 80) || 'restart',
    resultStatus: trimText(input.resultStatus, 60) || 'pending',
    exitCode: input.exitCode == null ? null : asInt(input.exitCode, 0, 0),
    detail: trimText(input.detail, 800) || null,
  });
}

async function findReusableRestartPlan(filters = {}, db = prisma) {
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const requestKey = trimText(filters.requestKey, 160) || null;
  if (!tenantId || !serverId || !requestKey) return null;
  const rows = await listRestartPlans({ tenantId, serverId, limit: 50 }, db);
  return rows.find((row) => (
    ['scheduled', 'blocked', 'running'].includes(trimText(row?.status, 60))
    && trimText(row?.payload?.metadata?.requestKey, 160) === requestKey
  )) || null;
}

async function findReusableRestartExecution(filters = {}, db = prisma) {
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const requestKey = trimText(filters.requestKey, 160) || null;
  if (!tenantId || !serverId || !planId || !requestKey) return null;
  const rows = await listRestartExecutions({ tenantId, serverId, planId, limit: 50 }, db);
  return rows.find((row) => trimText(row?.metadata?.requestKey, 160) === requestKey) || null;
}

function isHealthyRuntimeStatus(value) {
  const normalized = trimText(value, 60).toLowerCase();
  return ['ready', 'ok', 'healthy', 'online', 'active', 'success', 'succeeded'].includes(normalized);
}

function isDegradedRuntimeStatus(value) {
  const normalized = trimText(value, 60).toLowerCase();
  return ['warning', 'degraded', 'stale', 'pending', 'unknown'].includes(normalized);
}

function normalizeHealthCheck(entry = {}) {
  return {
    key: trimText(entry.key || entry.name, 120) || 'runtime',
    label: trimText(entry.label || entry.name, 160) || trimText(entry.key, 120) || 'Runtime',
    status: trimText(entry.status, 60).toLowerCase() || 'unknown',
    detail: trimText(entry.detail, 400) || null,
  };
}

function deriveRestartHealthStatus(checks = []) {
  if (!Array.isArray(checks) || checks.length === 0) return 'pending_verification';
  const normalized = checks.map(normalizeHealthCheck);
  if (normalized.some((entry) => ['failed', 'error', 'offline', 'blocked'].includes(entry.status))) {
    return 'failed';
  }
  if (normalized.some((entry) => isDegradedRuntimeStatus(entry.status) || entry.status === 'unknown')) {
    return 'degraded';
  }
  if (normalized.every((entry) => isHealthyRuntimeStatus(entry.status))) {
    return 'verified';
  }
  return 'pending_verification';
}

function evaluateRestartSafety(input = {}) {
  const restartMode = trimText(input.restartMode, 60).toLowerCase() || 'safe_restart';
  const delaySeconds = asInt(input.delaySeconds, 0, 0);
  const queueDepth = asInt(
    input.queueDepth != null ? input.queueDepth : Array.isArray(input.queueItems) ? input.queueItems.length : 0,
    0,
    0,
  );
  const deadLetterCount = asInt(
    input.deadLetterCount != null ? input.deadLetterCount : Array.isArray(input.deadLetters) ? input.deadLetters.length : 0,
    0,
    0,
  );
  const deliveryRuntimeStatus = trimText(input.deliveryRuntimeStatus || input.announcementRuntimeStatus, 60).toLowerCase() || null;
  const serverBotStatus = trimText(input.serverBotStatus, 60).toLowerCase() || null;
  const serverBotReady = input.serverBotReady === false ? false : !serverBotStatus || isHealthyRuntimeStatus(serverBotStatus);
  const extraBlockers = Array.isArray(input.blockers)
    ? input.blockers.map((entry) => trimText(entry, 320)).filter(Boolean)
    : [];
  const blockers = [];

  if ((restartMode === 'safe_restart' || delaySeconds > 0) && deliveryRuntimeStatus && !isHealthyRuntimeStatus(deliveryRuntimeStatus)) {
    blockers.push('Delivery Agent is not fully ready for countdown announcements.');
  }
  if (queueDepth > 0) {
    blockers.push(`There are still ${queueDepth} queued jobs waiting to finish.`);
  }
  if (deadLetterCount > 0) {
    blockers.push(`There are ${deadLetterCount} failed jobs that should be reviewed first.`);
  }
  if (!serverBotReady) {
    blockers.push('Server Bot is not ready to execute the restart workflow.');
  }
  blockers.push(...extraBlockers);

  const force = input.force === true;
  const blocked = !force && restartMode === 'safe_restart' && blockers.length > 0;
  return {
    restartMode,
    delaySeconds,
    queueDepth,
    deadLetterCount,
    deliveryRuntimeStatus,
    serverBotReady,
    blockers,
    safeToRun: force || blockers.length === 0,
    blocked,
    recommendedStatus: blocked ? 'blocked' : 'scheduled',
  };
}

async function ensurePlatformRestartTables(db = prisma) {
  await ensureSharedRestartSqliteCompatibility(db).catch(() => null);
  if (getRestartPersistenceMode(db) !== 'prisma') return { ok: true };
  getRestartDelegatesOrThrow(db);
  return { ok: true };
}

async function readRestartPlan(planId, db = prisma) {
  const normalizedPlanId = trimText(planId, 160);
  if (!normalizedPlanId) return null;
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT
        id,
        tenant_id AS "tenantId",
        server_id AS "serverId",
        guild_id AS "guildId",
        runtime_key AS "runtimeKey",
        status,
        restart_mode AS "restartMode",
        control_mode AS "controlMode",
        requested_by AS "requestedBy",
        scheduled_for AS "scheduledFor",
        delay_seconds AS "delaySeconds",
        reason,
        payload_json AS "payloadJson",
        health_status AS "healthStatus",
        health_verified_at AS "healthVerifiedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_plans
      WHERE id = ${normalizedPlanId}
      LIMIT 1
    `;
    return normalizePlanRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { plan } = getRestartDelegatesOrThrow(db);
  return normalizePlanRow(await plan.findUnique({
    where: { id: normalizedPlanId },
  }));
}

async function readRestartAnnouncement(announcementId, db = prisma) {
  const normalizedAnnouncementId = trimText(announcementId, 160);
  if (!normalizedAnnouncementId) return null;
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw`
      SELECT
        id,
        plan_id AS "planId",
        tenant_id AS "tenantId",
        server_id AS "serverId",
        checkpoint_seconds AS "checkpointSeconds",
        message,
        channel,
        status,
        scheduled_for AS "scheduledFor",
        sent_at AS "sentAt",
        meta_json AS "metaJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_announcements
      WHERE id = ${normalizedAnnouncementId}
      LIMIT 1
    `;
    return normalizeAnnouncementRow(Array.isArray(rows) ? rows[0] : null);
  }
  const { announcement } = getRestartDelegatesOrThrow(db);
  return normalizeAnnouncementRow(await announcement.findUnique({
    where: { id: normalizedAnnouncementId },
  }));
}

async function scheduleRestartPlan(input = {}, actor = 'system', db = prisma) {
  const payload = normalizeRestartServerPayload({
    ...input,
    requestedBy: trimText(input.requestedBy, 200) || actor,
  });
  if (!payload.tenantId || !payload.serverId) {
    return { ok: false, reason: 'restart-plan-invalid' };
  }
  await ensurePlatformRestartTables(db);
  const planId = trimText(input.id, 160) || createId('rplan');
  const delaySeconds = asInt(payload.delaySeconds, 0, 0);
  const scheduledFor = parseDate(input.scheduledFor) || new Date(Date.now() + delaySeconds * 1000);
  const safety = evaluateRestartSafety({
    restartMode: payload.restartMode,
    delaySeconds,
    queueDepth: input.queueDepth,
    queueItems: input.queueItems,
    deadLetterCount: input.deadLetterCount,
    deadLetters: input.deadLetters,
    deliveryRuntimeStatus: input.deliveryRuntimeStatus,
    announcementRuntimeStatus: input.announcementRuntimeStatus,
    serverBotReady: input.serverBotReady,
    serverBotStatus: input.serverBotStatus,
    blockers: input.blockers,
    force: input.force,
  });
  const announcementPlan = Array.isArray(payload.announcementPlan) && payload.announcementPlan.length > 0
    ? payload.announcementPlan
    : buildRestartAnnouncementPlan(delaySeconds);
  const requestKey = buildRestartPlanRequestKey(input, payload, announcementPlan);
  const existingPlan = await findReusableRestartPlan({
    tenantId: payload.tenantId,
    serverId: payload.serverId,
    requestKey,
  }, db);
  if (existingPlan) {
    return {
      ok: true,
      plan: existingPlan,
      reused: true,
      noop: true,
      reason: 'already-scheduled',
    };
  }
  const planMetadata = {
    ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
    requestKey,
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      INSERT INTO platform_restart_plans (
        id, tenant_id, server_id, guild_id, runtime_key, status, restart_mode, control_mode, requested_by, scheduled_for, delay_seconds, reason, payload_json, created_at, updated_at
      )
      VALUES (
        ${planId},
        ${payload.tenantId},
        ${payload.serverId},
        ${payload.guildId},
        ${payload.agentId || input.runtimeKey || null},
        ${safety.recommendedStatus},
        ${payload.restartMode},
        ${payload.controlMode},
        ${trimText(actor, 200) || 'system'},
        ${scheduledFor},
        ${delaySeconds},
        ${payload.reason},
        ${JSON.stringify({
          metadata: planMetadata,
          requestedBy: payload.requestedBy,
          safety,
        })},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;

    if (safety.recommendedStatus === 'scheduled') {
      for (const entry of announcementPlan) {
        const checkpointSeconds = asInt(entry.delaySeconds, 0, 0);
        const announcementAt = new Date(Math.max(Date.now(), scheduledFor.getTime() - checkpointSeconds * 1000));
        await db.$executeRaw`
          INSERT INTO platform_restart_announcements (
            id, plan_id, tenant_id, server_id, checkpoint_seconds, message, channel, status, scheduled_for, sent_at, meta_json, created_at, updated_at
          )
          VALUES (
            ${createId('rann')},
            ${planId},
            ${payload.tenantId},
            ${payload.serverId},
            ${checkpointSeconds},
            ${trimText(entry.message, 320) || `Restart in ${checkpointSeconds} seconds`},
            ${trimText(input.channel, 120) || null},
            ${'pending'},
            ${announcementAt},
            ${null},
            ${JSON.stringify({ planId, restartMode: payload.restartMode })},
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
        `;
      }
    }
  } else {
    const { plan, announcement } = getRestartDelegatesOrThrow(db);
    await plan.create({
      data: {
        id: planId,
        tenantId: payload.tenantId,
        serverId: payload.serverId,
        guildId: payload.guildId || null,
        runtimeKey: payload.agentId || input.runtimeKey || null,
        status: safety.recommendedStatus,
        restartMode: payload.restartMode,
        controlMode: payload.controlMode,
        requestedBy: trimText(actor, 200) || 'system',
        scheduledFor,
        delaySeconds,
        reason: payload.reason || null,
        payloadJson: JSON.stringify({
          metadata: planMetadata,
          requestedBy: payload.requestedBy,
          safety,
        }),
      },
    });

    if (safety.recommendedStatus === 'scheduled') {
      for (const entry of announcementPlan) {
        const checkpointSeconds = asInt(entry.delaySeconds, 0, 0);
        const announcementAt = new Date(Math.max(Date.now(), scheduledFor.getTime() - checkpointSeconds * 1000));
        await announcement.create({
          data: {
            id: createId('rann'),
            planId,
            tenantId: payload.tenantId,
            serverId: payload.serverId,
            checkpointSeconds,
            message: trimText(entry.message, 320) || `Restart in ${checkpointSeconds} seconds`,
            channel: trimText(input.channel, 120) || null,
            status: 'pending',
            scheduledFor: announcementAt,
            sentAt: null,
            metaJson: JSON.stringify({ planId, restartMode: payload.restartMode }),
          },
        });
      }
    }
  }
  return {
    ok: true,
    plan: await readRestartPlan(planId, db),
  };
}

async function recordRestartExecution(input = {}, db = prisma) {
  const planId = trimText(input.planId, 160);
  const tenantId = trimText(input.tenantId, 160);
  const serverId = trimText(input.serverId, 160);
  if (!planId || !tenantId || !serverId) {
    return { ok: false, reason: 'restart-execution-invalid' };
  }
  await ensurePlatformRestartTables(db);
  const requestKey = buildRestartExecutionRequestKey(input);
  const existingExecution = await findReusableRestartExecution({
    planId,
    tenantId,
    serverId,
    requestKey,
  }, db);
  if (existingExecution) {
    return {
      ok: true,
      execution: existingExecution,
      reused: true,
      noop: true,
      reason: 'execution-already-recorded',
    };
  }
  const executionId = trimText(input.id, 160) || createId('rexec');
  const executionMetadata = {
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    requestKey,
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      INSERT INTO platform_restart_executions (
        id, plan_id, tenant_id, server_id, runtime_key, action, result_status, started_at, completed_at, exit_code, detail, meta_json, created_at, updated_at
      )
      VALUES (
        ${executionId},
        ${planId},
        ${tenantId},
        ${serverId},
        ${trimText(input.runtimeKey, 200) || null},
        ${trimText(input.action, 80) || 'restart'},
        ${trimText(input.resultStatus, 60) || 'pending'},
        ${input.startedAt ? new Date(input.startedAt) : new Date()},
        ${input.completedAt ? new Date(input.completedAt) : null},
        ${input.exitCode == null ? null : asInt(input.exitCode, 0, 0)},
        ${trimText(input.detail, 800) || null},
        ${JSON.stringify(executionMetadata)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    await db.$executeRaw`
      UPDATE platform_restart_plans
      SET
        status = ${
          trimText(input.resultStatus, 60) === 'failed'
            ? 'failed'
            : ['pending', 'running', 'processing'].includes(trimText(input.resultStatus, 60))
              ? 'running'
              : 'executed'
        },
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${planId}
    `;
  } else {
    const { execution, plan } = getRestartDelegatesOrThrow(db);
    await execution.create({
      data: {
        id: executionId,
        planId,
        tenantId,
        serverId,
        runtimeKey: trimText(input.runtimeKey, 200) || null,
        action: trimText(input.action, 80) || 'restart',
        resultStatus: trimText(input.resultStatus, 60) || 'pending',
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        exitCode: input.exitCode == null ? null : asInt(input.exitCode, 0, 0),
        detail: trimText(input.detail, 800) || null,
        metaJson: JSON.stringify(executionMetadata),
      },
    });
    await plan.updateMany({
      where: { id: planId },
      data: {
        status: trimText(input.resultStatus, 60) === 'failed'
          ? 'failed'
          : ['pending', 'running', 'processing'].includes(trimText(input.resultStatus, 60))
            ? 'running'
            : 'executed',
      },
    });
  }
  const normalizedResultStatus = trimText(input.resultStatus, 60) || 'pending';
  if (!['pending', 'running', 'processing'].includes(normalizedResultStatus)) {
    publishAdminLiveUpdate('restart-execution-result', {
      source: 'restart-orchestration',
      tenantId,
      serverId,
      planId,
      executionId,
      runtimeKey: trimText(input.runtimeKey, 200) || null,
      action: trimText(input.action, 80) || 'restart',
      resultStatus: normalizedResultStatus,
      exitCode: input.exitCode == null ? null : asInt(input.exitCode, 0, 0),
      detail: trimText(input.detail, 800) || null,
    });
  }
  return {
    ok: true,
    execution: {
      id: executionId,
      planId,
      resultStatus: normalizedResultStatus,
    },
  };
}

async function markRestartPlanRunning(input = {}, db = prisma) {
  const planId = trimText(input.planId, 160);
  if (!planId) return { ok: false, reason: 'restart-plan-required' };
  await ensurePlatformRestartTables(db);
  const existingPlan = await readRestartPlan(planId, db);
  if (!existingPlan) return { ok: false, reason: 'restart-plan-not-found' };
  const mergedPayload = {
    ...(existingPlan.payload || {}),
    running: {
      runtimeKey: trimText(input.runtimeKey, 200) || null,
      startedAt: input.startedAt ? new Date(input.startedAt).toISOString() : new Date().toISOString(),
      actor: trimText(input.actor, 200) || null,
    },
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      UPDATE platform_restart_plans
      SET
        status = ${'running'},
        runtime_key = COALESCE(${trimText(input.runtimeKey, 200) || null}, runtime_key),
        payload_json = ${JSON.stringify(mergedPayload)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${planId}
    `;
  } else {
    const { plan } = getRestartDelegatesOrThrow(db);
    await plan.update({
      where: { id: planId },
      data: {
        status: 'running',
        runtimeKey: trimText(input.runtimeKey, 200) || existingPlan.runtimeKey || null,
        payloadJson: JSON.stringify(mergedPayload),
      },
    });
  }
  return {
    ok: true,
    plan: await readRestartPlan(planId, db),
  };
}

async function completeRestartPlan(input = {}, db = prisma) {
  const planId = trimText(input.planId, 160);
  if (!planId) return { ok: false, reason: 'restart-plan-required' };
  await ensurePlatformRestartTables(db);
  const existingPlan = await readRestartPlan(planId, db);
  if (!existingPlan) return { ok: false, reason: 'restart-plan-not-found' };
  const mergedPayload = {
    ...(existingPlan.payload || {}),
    ...(input.payload && typeof input.payload === 'object' ? input.payload : {}),
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      UPDATE platform_restart_plans
      SET
        status = ${trimText(input.status, 60) || 'completed'},
        health_status = ${trimText(input.healthStatus, 60) || null},
        health_verified_at = ${input.healthVerifiedAt ? new Date(input.healthVerifiedAt) : new Date()},
        payload_json = ${JSON.stringify(mergedPayload)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${planId}
    `;
  } else {
    const { plan } = getRestartDelegatesOrThrow(db);
    await plan.update({
      where: { id: planId },
      data: {
        status: trimText(input.status, 60) || 'completed',
        healthStatus: trimText(input.healthStatus, 60) || null,
        healthVerifiedAt: input.healthVerifiedAt ? new Date(input.healthVerifiedAt) : new Date(),
        payloadJson: JSON.stringify(mergedPayload),
      },
    });
  }
  return { ok: true, planId, plan: await readRestartPlan(planId, db) };
}

async function listDueRestartPlans(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const now = parseDate(filters.now) || new Date();
  const limit = Math.max(1, Math.min(200, asInt(filters.limit, 20, 1)));
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        server_id AS "serverId",
        guild_id AS "guildId",
        runtime_key AS "runtimeKey",
        status,
        restart_mode AS "restartMode",
        control_mode AS "controlMode",
        requested_by AS "requestedBy",
        scheduled_for AS "scheduledFor",
        delay_seconds AS "delaySeconds",
        reason,
        payload_json AS "payloadJson",
        health_status AS "healthStatus",
        health_verified_at AS "healthVerifiedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_plans
      WHERE status = ${'scheduled'}
        AND scheduled_for <= ${now}
        ${tenantId ? Prisma.sql` AND tenant_id = ${tenantId}` : Prisma.empty}
        ${serverId ? Prisma.sql` AND server_id = ${serverId}` : Prisma.empty}
      ORDER BY scheduled_for ASC, created_at ASC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizePlanRow).filter(Boolean) : [];
  }
  const { plan } = getRestartDelegatesOrThrow(db);
  const rows = await plan.findMany({
    where: {
      status: 'scheduled',
      scheduledFor: { lte: now },
      ...(tenantId ? { tenantId } : {}),
      ...(serverId ? { serverId } : {}),
    },
    orderBy: [
      { scheduledFor: 'asc' },
      { createdAt: 'asc' },
    ],
    take: limit,
  });
  return Array.isArray(rows) ? rows.map(normalizePlanRow).filter(Boolean) : [];
}

async function listDueRestartAnnouncements(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const now = parseDate(filters.now) || new Date();
  const limit = Math.max(1, Math.min(400, asInt(filters.limit, 40, 1)));
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        ann.id,
        ann.plan_id AS "planId",
        ann.tenant_id AS "tenantId",
        ann.server_id AS "serverId",
        ann.checkpoint_seconds AS "checkpointSeconds",
        ann.message,
        ann.channel,
        ann.status,
        ann.scheduled_for AS "scheduledFor",
        ann.sent_at AS "sentAt",
        ann.meta_json AS "metaJson",
        ann.created_at AS "createdAt",
        ann.updated_at AS "updatedAt"
      FROM platform_restart_announcements ann
      INNER JOIN platform_restart_plans plan
        ON plan.id = ann.plan_id
      WHERE ann.status = ${'pending'}
        AND ann.scheduled_for <= ${now}
        AND plan.status IN (${Prisma.join(['scheduled', 'running'])})
        ${tenantId ? Prisma.sql` AND ann.tenant_id = ${tenantId}` : Prisma.empty}
        ${serverId ? Prisma.sql` AND ann.server_id = ${serverId}` : Prisma.empty}
        ${planId ? Prisma.sql` AND ann.plan_id = ${planId}` : Prisma.empty}
      ORDER BY ann.scheduled_for ASC, ann.created_at ASC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizeAnnouncementRow).filter(Boolean) : [];
  }
  const { plan, announcement } = getRestartDelegatesOrThrow(db);
  const candidateRows = await announcement.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
      ...(tenantId ? { tenantId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(planId ? { planId } : {}),
    },
    orderBy: [
      { scheduledFor: 'asc' },
      { createdAt: 'asc' },
    ],
    take: Math.min(limit * 5, 1000),
  });
  const candidatePlanIds = [...new Set(candidateRows.map((row) => trimText(row?.planId, 160)).filter(Boolean))];
  if (candidatePlanIds.length === 0) return [];
  const eligiblePlans = await plan.findMany({
    where: {
      id: { in: candidatePlanIds },
      status: { in: ['scheduled', 'running'] },
    },
    select: { id: true },
  });
  const eligiblePlanIds = new Set(eligiblePlans.map((row) => trimText(row?.id, 160)).filter(Boolean));
  return candidateRows
    .filter((row) => eligiblePlanIds.has(trimText(row?.planId, 160)))
    .map(normalizeAnnouncementRow)
    .filter(Boolean)
    .slice(0, limit);
}

async function markRestartAnnouncementStatus(input = {}, db = prisma) {
  const announcementId = trimText(input.announcementId || input.id, 160);
  if (!announcementId) return { ok: false, reason: 'restart-announcement-required' };
  await ensurePlatformRestartTables(db);
  const existing = await readRestartAnnouncement(announcementId, db);
  if (!existing) return { ok: false, reason: 'restart-announcement-not-found' };
  const status = trimText(input.status, 60) || 'sent';
  const mergedMeta = {
    ...(existing.metadata || {}),
    ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      UPDATE platform_restart_announcements
      SET
        status = ${status},
        sent_at = ${
          ['sent', 'delivered', 'succeeded'].includes(status)
            ? (input.sentAt ? new Date(input.sentAt) : new Date())
            : null
        },
        meta_json = ${JSON.stringify(mergedMeta)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${announcementId}
    `;
  } else {
    const { announcement } = getRestartDelegatesOrThrow(db);
    await announcement.update({
      where: { id: announcementId },
      data: {
        status,
        sentAt: ['sent', 'delivered', 'succeeded'].includes(status)
          ? (input.sentAt ? new Date(input.sentAt) : new Date())
          : null,
        metaJson: JSON.stringify(mergedMeta),
      },
    });
  }
  return {
    ok: true,
    announcement: await readRestartAnnouncement(announcementId, db),
  };
}

async function verifyRestartPlanHealth(input = {}, db = prisma) {
  const planId = trimText(input.planId, 160);
  if (!planId) return { ok: false, reason: 'restart-plan-required' };
  await ensurePlatformRestartTables(db);
  const existingPlan = await readRestartPlan(planId, db);
  if (!existingPlan) return { ok: false, reason: 'restart-plan-not-found' };
  const checks = Array.isArray(input.checks) ? input.checks.map(normalizeHealthCheck) : [];
  const healthStatus = trimText(input.healthStatus, 60) || deriveRestartHealthStatus(checks);
  const mergedPayload = {
    ...(existingPlan.payload || {}),
    verification: {
      checks,
      actor: trimText(input.actor, 200) || null,
      detail: trimText(input.detail, 800) || null,
      verifiedAt: input.healthVerifiedAt ? new Date(input.healthVerifiedAt).toISOString() : new Date().toISOString(),
    },
  };
  if (getRestartPersistenceMode(db) !== 'prisma') {
    await db.$executeRaw`
      UPDATE platform_restart_plans
      SET
        status = ${
          healthStatus === 'failed'
            ? 'failed'
            : trimText(input.status, 60) || existingPlan.status || 'completed'
        },
        health_status = ${healthStatus},
        health_verified_at = ${input.healthVerifiedAt ? new Date(input.healthVerifiedAt) : new Date()},
        payload_json = ${JSON.stringify(mergedPayload)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${planId}
    `;
  } else {
    const { plan } = getRestartDelegatesOrThrow(db);
    await plan.update({
      where: { id: planId },
      data: {
        status: healthStatus === 'failed'
          ? 'failed'
          : trimText(input.status, 60) || existingPlan.status || 'completed',
        healthStatus,
        healthVerifiedAt: input.healthVerifiedAt ? new Date(input.healthVerifiedAt) : new Date(),
        payloadJson: JSON.stringify(mergedPayload),
      },
    });
  }
  return {
    ok: true,
    plan: await readRestartPlan(planId, db),
  };
}

async function listRestartPlans(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const status = trimText(filters.status, 60) || null;
  const limit = Math.max(1, Math.min(200, asInt(filters.limit, 20, 1)));
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        server_id AS "serverId",
        guild_id AS "guildId",
        runtime_key AS "runtimeKey",
        status,
        restart_mode AS "restartMode",
        control_mode AS "controlMode",
        requested_by AS "requestedBy",
        scheduled_for AS "scheduledFor",
        delay_seconds AS "delaySeconds",
        reason,
        payload_json AS "payloadJson",
        health_status AS "healthStatus",
        health_verified_at AS "healthVerifiedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_plans
      WHERE 1 = 1
      ${tenantId ? Prisma.sql` AND tenant_id = ${tenantId}` : Prisma.empty}
      ${serverId ? Prisma.sql` AND server_id = ${serverId}` : Prisma.empty}
      ${status ? Prisma.sql` AND status = ${status}` : Prisma.empty}
      ORDER BY scheduled_for DESC, created_at DESC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizePlanRow).filter(Boolean) : [];
  }
  const { plan } = getRestartDelegatesOrThrow(db);
  const rows = await plan.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [
      { scheduledFor: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
  return Array.isArray(rows) ? rows.map(normalizePlanRow).filter(Boolean) : [];
}

async function listRestartAnnouncements(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const status = trimText(filters.status, 60) || null;
  const limit = Math.max(1, Math.min(400, asInt(filters.limit, 40, 1)));
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        id,
        plan_id AS "planId",
        tenant_id AS "tenantId",
        server_id AS "serverId",
        checkpoint_seconds AS "checkpointSeconds",
        message,
        channel,
        status,
        scheduled_for AS "scheduledFor",
        sent_at AS "sentAt",
        meta_json AS "metaJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_announcements
      WHERE 1 = 1
      ${tenantId ? Prisma.sql` AND tenant_id = ${tenantId}` : Prisma.empty}
      ${serverId ? Prisma.sql` AND server_id = ${serverId}` : Prisma.empty}
      ${planId ? Prisma.sql` AND plan_id = ${planId}` : Prisma.empty}
      ${status ? Prisma.sql` AND status = ${status}` : Prisma.empty}
      ORDER BY scheduled_for DESC, created_at DESC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizeAnnouncementRow).filter(Boolean) : [];
  }
  const { announcement } = getRestartDelegatesOrThrow(db);
  const rows = await announcement.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(planId ? { planId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [
      { scheduledFor: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
  return Array.isArray(rows) ? rows.map(normalizeAnnouncementRow).filter(Boolean) : [];
}

async function listRestartExecutions(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const status = trimText(filters.resultStatus || filters.status, 60) || null;
  const limit = Math.max(1, Math.min(200, asInt(filters.limit, 20, 1)));
  if (getRestartPersistenceMode(db) !== 'prisma') {
    const rows = await db.$queryRaw(Prisma.sql`
      SELECT
        id,
        plan_id AS "planId",
        tenant_id AS "tenantId",
        server_id AS "serverId",
        runtime_key AS "runtimeKey",
        action,
        result_status AS "resultStatus",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        exit_code AS "exitCode",
        detail,
        meta_json AS "metaJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM platform_restart_executions
      WHERE 1 = 1
      ${tenantId ? Prisma.sql` AND tenant_id = ${tenantId}` : Prisma.empty}
      ${serverId ? Prisma.sql` AND server_id = ${serverId}` : Prisma.empty}
      ${planId ? Prisma.sql` AND plan_id = ${planId}` : Prisma.empty}
      ${status ? Prisma.sql` AND result_status = ${status}` : Prisma.empty}
      ORDER BY started_at DESC, created_at DESC
      LIMIT ${limit}
    `);
    return Array.isArray(rows) ? rows.map(normalizeExecutionRow).filter(Boolean) : [];
  }
  const { execution } = getRestartDelegatesOrThrow(db);
  const rows = await execution.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(serverId ? { serverId } : {}),
      ...(planId ? { planId } : {}),
      ...(status ? { resultStatus: status } : {}),
    },
    orderBy: [
      { startedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
  return Array.isArray(rows) ? rows.map(normalizeExecutionRow).filter(Boolean) : [];
}

async function pruneRestartArtifacts(options = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(options.tenantId, 160) || null;
  const serverId = trimText(options.serverId, 160) || null;
  const now = parseDate(options.now) || new Date();
  const cutoffMs = now.getTime() - Math.max(0, asInt(options.olderThanMs, 30 * 24 * 60 * 60 * 1000, 60 * 1000));
  const keepLatestPlans = asInt(options.keepLatestPlans, 20, 0);
  const keepLatestAnnouncements = asInt(options.keepLatestAnnouncements, 20, 0);
  const keepLatestExecutions = asInt(options.keepLatestExecutions, 20, 0);

  const [plans, announcements, executions] = await Promise.all([
    listRestartPlans({ tenantId, serverId, limit: 1000 }, db),
    listRestartAnnouncements({ tenantId, serverId, limit: 1000 }, db),
    listRestartExecutions({ tenantId, serverId, limit: 1000 }, db),
  ]);

  const removableExecutionIds = selectRetentionArtifactIds(executions, {
    cutoffMs,
    keepLatest: keepLatestExecutions,
    dateKeys: ['completedAt', 'startedAt', 'createdAt', 'updatedAt'],
    allowRow: (row) => !['pending', 'running', 'processing'].includes(trimText(row?.resultStatus, 60).toLowerCase()),
  });

  const removablePlanIds = selectRetentionArtifactIds(plans, {
    cutoffMs,
    keepLatest: keepLatestPlans,
    dateKeys: ['scheduledFor', 'createdAt', 'updatedAt'],
    allowRow: (row) => ['completed', 'failed', 'executed', 'blocked', 'cancelled'].includes(trimText(row?.status, 60).toLowerCase()),
  });
  const removablePlanIdSet = new Set(removablePlanIds);

  const removableAnnouncementIds = selectRetentionArtifactIds(announcements, {
    cutoffMs,
    keepLatest: keepLatestAnnouncements,
    dateKeys: ['sentAt', 'scheduledFor', 'createdAt', 'updatedAt'],
    allowRow: (row) => {
      if (removablePlanIdSet.has(trimText(row?.planId, 160))) return true;
      return !['pending'].includes(trimText(row?.status, 60).toLowerCase());
    },
  });

  if (getRestartPersistenceMode(db) !== 'prisma') {
    return {
      ok: true,
      tenantId,
      serverId,
      removed: {
        executions: await deleteRestartRowsRaw(db, 'platform_restart_executions', removableExecutionIds),
        announcements: await deleteRestartRowsRaw(db, 'platform_restart_announcements', removableAnnouncementIds),
        plans: await deleteRestartRowsRaw(db, 'platform_restart_plans', removablePlanIds),
      },
      cutoffAt: new Date(cutoffMs).toISOString(),
    };
  }

  const { plan, announcement, execution } = getRestartDelegatesOrThrow(db);
  const [removedExecutions, removedAnnouncements, removedPlans] = await Promise.all([
    removableExecutionIds.length > 0
      ? execution.deleteMany({ where: { id: { in: removableExecutionIds } } }).then((result) => result?.count || 0)
      : Promise.resolve(0),
    removableAnnouncementIds.length > 0
      ? announcement.deleteMany({ where: { id: { in: removableAnnouncementIds } } }).then((result) => result?.count || 0)
      : Promise.resolve(0),
    removablePlanIds.length > 0
      ? plan.deleteMany({ where: { id: { in: removablePlanIds } } }).then((result) => result?.count || 0)
      : Promise.resolve(0),
  ]);

  return {
    ok: true,
    tenantId,
    serverId,
    removed: {
      executions: removedExecutions,
      announcements: removedAnnouncements,
      plans: removedPlans,
    },
    cutoffAt: new Date(cutoffMs).toISOString(),
  };
}

module.exports = {
  completeRestartPlan,
  evaluateRestartSafety,
  ensurePlatformRestartTables,
  listDueRestartAnnouncements,
  listDueRestartPlans,
  listRestartAnnouncements,
  listRestartExecutions,
  listRestartPlans,
  markRestartAnnouncementStatus,
  markRestartPlanRunning,
  pruneRestartArtifacts,
  recordRestartExecution,
  scheduleRestartPlan,
  verifyRestartPlanHealth,
};
