'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');

const { prisma } = require('../prisma');
const { normalizeRestartServerPayload } = require('../contracts/jobs/jobContracts');
const { buildRestartAnnouncementPlan } = require('../domain/servers/serverControlJobService');

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
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asInt(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
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

async function ensurePlatformRestartTables(db = prisma) {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_restart_plans (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      guild_id TEXT,
      runtime_key TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      restart_mode TEXT NOT NULL DEFAULT 'delayed',
      control_mode TEXT NOT NULL DEFAULT 'service',
      requested_by TEXT,
      scheduled_for TEXT NOT NULL,
      delay_seconds INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      payload_json TEXT,
      health_status TEXT,
      health_verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_restart_plans_tenant_scheduled_idx ON platform_restart_plans(tenant_id, scheduled_for)');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_restart_plans_status_scheduled_idx ON platform_restart_plans(status, scheduled_for)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_restart_announcements (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      checkpoint_seconds INTEGER NOT NULL,
      message TEXT NOT NULL,
      channel TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_for TEXT NOT NULL,
      sent_at TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_restart_announcements_plan_scheduled_idx ON platform_restart_announcements(plan_id, scheduled_for)');
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_restart_executions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      runtime_key TEXT,
      action TEXT NOT NULL DEFAULT 'restart',
      result_status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      exit_code INTEGER,
      detail TEXT,
      meta_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS platform_restart_executions_plan_started_idx ON platform_restart_executions(plan_id, started_at)');
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
  const announcementPlan = Array.isArray(payload.announcementPlan) && payload.announcementPlan.length > 0
    ? payload.announcementPlan
    : buildRestartAnnouncementPlan(delaySeconds);

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
      ${'scheduled'},
      ${payload.restartMode},
      ${payload.controlMode},
      ${trimText(actor, 200) || 'system'},
      ${scheduledFor},
      ${delaySeconds},
      ${payload.reason},
      ${JSON.stringify({
        metadata: payload.metadata || {},
        requestedBy: payload.requestedBy,
      })},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;

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
    WHERE id = ${planId}
    LIMIT 1
  `;
  return {
    ok: true,
    plan: normalizePlanRow(Array.isArray(rows) ? rows[0] : null),
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
  const executionId = trimText(input.id, 160) || createId('rexec');
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
      ${JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `;
  await db.$executeRaw`
    UPDATE platform_restart_plans
    SET
      status = ${trimText(input.resultStatus, 60) === 'failed' ? 'failed' : 'executed'},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${planId}
  `;
  return {
    ok: true,
    execution: {
      id: executionId,
      planId,
      resultStatus: trimText(input.resultStatus, 60) || 'pending',
    },
  };
}

async function completeRestartPlan(input = {}, db = prisma) {
  const planId = trimText(input.planId, 160);
  if (!planId) return { ok: false, reason: 'restart-plan-required' };
  await ensurePlatformRestartTables(db);
  await db.$executeRaw`
    UPDATE platform_restart_plans
    SET
      status = ${trimText(input.status, 60) || 'completed'},
      health_status = ${trimText(input.healthStatus, 60) || null},
      health_verified_at = ${input.healthVerifiedAt ? new Date(input.healthVerifiedAt) : new Date()},
      payload_json = ${JSON.stringify(input.payload && typeof input.payload === 'object' ? input.payload : {})},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${planId}
  `;
  return { ok: true, planId };
}

async function listRestartPlans(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const status = trimText(filters.status, 60) || null;
  const limit = Math.max(1, Math.min(200, asInt(filters.limit, 20, 1)));
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

async function listRestartAnnouncements(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const status = trimText(filters.status, 60) || null;
  const limit = Math.max(1, Math.min(400, asInt(filters.limit, 40, 1)));
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

async function listRestartExecutions(filters = {}, db = prisma) {
  await ensurePlatformRestartTables(db);
  const tenantId = trimText(filters.tenantId, 160) || null;
  const serverId = trimText(filters.serverId, 160) || null;
  const planId = trimText(filters.planId, 160) || null;
  const status = trimText(filters.resultStatus || filters.status, 60) || null;
  const limit = Math.max(1, Math.min(200, asInt(filters.limit, 20, 1)));
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

module.exports = {
  completeRestartPlan,
  ensurePlatformRestartTables,
  listRestartAnnouncements,
  listRestartExecutions,
  listRestartPlans,
  recordRestartExecution,
  scheduleRestartPlan,
};
