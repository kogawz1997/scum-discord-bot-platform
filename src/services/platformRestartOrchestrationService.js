'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('@prisma/client');

const { prisma } = require('../prisma');
const { normalizeRestartServerPayload } = require('../contracts/jobs/jobContracts');
const { buildRestartAnnouncementPlan } = require('../domain/servers/serverControlJobService');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');

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

function getRestartPersistenceMode() {
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
  if (getRestartPersistenceMode() !== 'prisma') return { ok: true };
  getRestartDelegatesOrThrow(db);
  return { ok: true };
}

async function readRestartPlan(planId, db = prisma) {
  const normalizedPlanId = trimText(planId, 160);
  if (!normalizedPlanId) return null;
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
          metadata: payload.metadata || {},
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
          metadata: payload.metadata || {},
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
  const executionId = trimText(input.id, 160) || createId('rexec');
  if (getRestartPersistenceMode() !== 'prisma') {
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
        metaJson: JSON.stringify(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
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
  return {
    ok: true,
    execution: {
      id: executionId,
      planId,
      resultStatus: trimText(input.resultStatus, 60) || 'pending',
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  if (getRestartPersistenceMode() !== 'prisma') {
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
  recordRestartExecution,
  scheduleRestartPlan,
  verifyRestartPlanHealth,
};
