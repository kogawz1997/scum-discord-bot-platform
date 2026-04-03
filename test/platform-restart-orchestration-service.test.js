const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = 'file:C:/new/prisma/prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';

const { prisma } = require('../src/prisma');
const {
  listAdminNotifications,
  replaceAdminNotifications,
  waitForAdminNotificationPersistence,
} = require('../src/store/adminNotificationStore');
const {
  completeRestartPlan,
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
} = require('../src/services/platformRestartOrchestrationService');

function createStrictSharedRestartPrisma(base = prisma) {
  return {
    _originalClient: base,
    platformRestartPlan: base.platformRestartPlan,
    platformRestartAnnouncement: base.platformRestartAnnouncement,
    platformRestartExecution: base.platformRestartExecution,
    async $queryRawUnsafe() {
      throw new Error('shared sqlite restart compatibility test unexpectedly used raw query path');
    },
    async $executeRawUnsafe() {
      throw new Error('shared sqlite restart compatibility test unexpectedly used raw execute path');
    },
    async $queryRaw() {
      throw new Error('shared sqlite restart compatibility test unexpectedly used raw query path');
    },
    async $executeRaw() {
      throw new Error('shared sqlite restart compatibility test unexpectedly used raw execute path');
    },
  };
}

function createMockRestartDelegatePrisma() {
  const plans = new Map();
  const announcements = new Map();
  const executions = new Map();
  let rawQueryCalls = 0;
  let rawExecuteCalls = 0;

  function rowTimeMs(row, key) {
    const value = row?.[key];
    const date = value instanceof Date ? value : new Date(value || 0);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function compareRows(left, right, orderBy = []) {
    const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
    for (const entry of entries) {
      const [key, direction] = Object.entries(entry || {})[0] || [];
      if (!key) continue;
      const leftValue = rowTimeMs(left, key) || String(left?.[key] || '');
      const rightValue = rowTimeMs(right, key) || String(right?.[key] || '');
      if (leftValue === rightValue) continue;
      if (direction === 'asc') return leftValue < rightValue ? -1 : 1;
      return leftValue > rightValue ? -1 : 1;
    }
    return 0;
  }

  function applySelect(row, select) {
    if (!select || typeof select !== 'object') return row;
    return Object.keys(select).reduce((acc, key) => {
      if (select[key]) acc[key] = row?.[key];
      return acc;
    }, {});
  }

  function matchesScalar(value, condition) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      if (Array.isArray(condition.in)) {
        return condition.in.map((entry) => String(entry)).includes(String(value));
      }
      if (condition.lte != null) {
        return rowTimeMs({ value }, 'value') <= rowTimeMs({ value: condition.lte }, 'value');
      }
    }
    return String(value ?? '') === String(condition ?? '');
  }

  function matchesWhere(row, where = {}) {
    return Object.entries(where || {}).every(([key, condition]) => {
      if (condition == null) return true;
      return matchesScalar(row?.[key], condition);
    });
  }

  function sortedRows(map, where, orderBy, take, select) {
    const rows = [...map.values()]
      .filter((row) => matchesWhere(row, where))
      .sort((left, right) => compareRows(left, right, orderBy));
    const limited = rows.slice(0, take || rows.length);
    return limited.map((row) => applySelect(row, select));
  }

  const prisma = {
    platformRestartPlan: {
      async findUnique({ where } = {}) {
        return plans.get(String(where?.id || '').trim()) || null;
      },
      async create({ data }) {
        const row = { ...data };
        plans.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = plans.get(id);
        if (!current) throw new Error(`missing restart plan: ${id}`);
        const row = { ...current, ...data };
        plans.set(id, row);
        return row;
      },
      async updateMany({ where, data }) {
        const rows = [...plans.values()].filter((row) => matchesWhere(row, where));
        rows.forEach((row) => plans.set(row.id, { ...row, ...data }));
        return { count: rows.length };
      },
      async findMany({ where, orderBy, take, select } = {}) {
        return sortedRows(plans, where, orderBy, take, select);
      },
      async deleteMany({ where } = {}) {
        const ids = [...plans.values()].filter((row) => matchesWhere(row, where)).map((row) => row.id);
        ids.forEach((id) => plans.delete(id));
        return { count: ids.length };
      },
    },
    platformRestartAnnouncement: {
      async findUnique({ where } = {}) {
        return announcements.get(String(where?.id || '').trim()) || null;
      },
      async create({ data }) {
        const row = { ...data };
        announcements.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = announcements.get(id);
        if (!current) throw new Error(`missing restart announcement: ${id}`);
        const row = { ...current, ...data };
        announcements.set(id, row);
        return row;
      },
      async findMany({ where, orderBy, take, select } = {}) {
        return sortedRows(announcements, where, orderBy, take, select);
      },
      async deleteMany({ where } = {}) {
        const ids = [...announcements.values()].filter((row) => matchesWhere(row, where)).map((row) => row.id);
        ids.forEach((id) => announcements.delete(id));
        return { count: ids.length };
      },
    },
    platformRestartExecution: {
      async findUnique({ where } = {}) {
        return executions.get(String(where?.id || '').trim()) || null;
      },
      async create({ data }) {
        const row = { ...data };
        executions.set(row.id, row);
        return row;
      },
      async findMany({ where, orderBy, take, select } = {}) {
        return sortedRows(executions, where, orderBy, take, select);
      },
      async deleteMany({ where } = {}) {
        const ids = [...executions.values()].filter((row) => matchesWhere(row, where)).map((row) => row.id);
        ids.forEach((id) => executions.delete(id));
        return { count: ids.length };
      },
    },
    async $queryRaw() {
      rawQueryCalls += 1;
      return [];
    },
    async $executeRaw() {
      rawExecuteCalls += 1;
      return [];
    },
    async $executeRawUnsafe() {
      rawExecuteCalls += 1;
      return [];
    },
    async $transaction(work) {
      return work(this);
    },
    async $disconnect() {},
  };

  return {
    prisma,
    getSnapshot() {
      return {
        rawQueryCalls,
        rawExecuteCalls,
        planCount: plans.size,
        announcementCount: announcements.size,
        executionCount: executions.size,
      };
    },
  };
}

async function cleanupRestartFixtures() {
  await ensurePlatformRestartTables(prisma);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_executions WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_announcements WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_plans WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
}

async function cleanupNotifications() {
  replaceAdminNotifications([]);
  await waitForAdminNotificationPersistence();
}

test('platform restart orchestration prefers Prisma delegates when sqlite runtime has delegate-backed persistence', { concurrency: false }, async () => {
  const mock = createMockRestartDelegatePrisma();

  await ensurePlatformRestartTables(mock.prisma);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-delegate-test',
    serverId: 'server-restart-delegate-test',
    guildId: 'guild-restart-delegate-test',
    delaySeconds: 45,
    restartMode: 'delayed',
    controlMode: 'service',
    reason: 'delegate-backed-restart',
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite', mock.prisma);
  assert.equal(plan.ok, true);

  const announcements = await listRestartAnnouncements({
    tenantId: 'tenant-restart-delegate-test',
    serverId: 'server-restart-delegate-test',
    limit: 20,
  }, mock.prisma);
  assert.ok(announcements.length >= 1);

  const execution = await recordRestartExecution({
    planId: plan.plan.id,
    tenantId: 'tenant-restart-delegate-test',
    serverId: 'server-restart-delegate-test',
    runtimeKey: 'server-bot-runtime',
    resultStatus: 'pending',
    detail: 'Restart queued',
  }, mock.prisma);
  assert.equal(execution.ok, true);

  const plans = await listRestartPlans({
    tenantId: 'tenant-restart-delegate-test',
    serverId: 'server-restart-delegate-test',
    limit: 10,
  }, mock.prisma);
  const executions = await listRestartExecutions({
    tenantId: 'tenant-restart-delegate-test',
    serverId: 'server-restart-delegate-test',
    planId: plan.plan.id,
    limit: 10,
  }, mock.prisma);
  const snapshot = mock.getSnapshot();

  assert.equal(plans.length, 1);
  assert.equal(executions.length, 1);
  assert.equal(snapshot.rawQueryCalls, 0);
  assert.equal(snapshot.rawExecuteCalls, 0);
  assert.equal(snapshot.planCount, 1);
  assert.ok(snapshot.announcementCount >= 1);
  assert.equal(snapshot.executionCount, 1);
});

test('platform restart orchestration repairs shared sqlite DateTime rows before using Prisma delegates', { concurrency: false }, async (t) => {
  const planId = 'rplan-shared-sqlite-compat';
  const tenantId = 'tenant-restart-shared-sqlite-compat';
  const strictSharedPrisma = createStrictSharedRestartPrisma(prisma);

  const cleanup = async () => {
    await prisma.$executeRawUnsafe('DELETE FROM platform_restart_announcements WHERE plan_id = ?', planId).catch(() => null);
    await prisma.$executeRawUnsafe('DELETE FROM platform_restart_executions WHERE plan_id = ?', planId).catch(() => null);
    await prisma.$executeRawUnsafe('DELETE FROM platform_restart_plans WHERE id = ?', planId).catch(() => null);
  };

  await cleanup();
  t.after(async () => {
    await cleanup();
  });

  await prisma.$executeRawUnsafe(
    `INSERT INTO platform_restart_plans (
      id, tenant_id, server_id, guild_id, runtime_key, status, restart_mode, control_mode, requested_by, scheduled_for, delay_seconds, reason, payload_json, health_status, health_verified_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    planId,
    tenantId,
    'server-shared-sqlite-compat',
    'guild-shared-sqlite-compat',
    'server-bot-shared-sqlite-compat',
    'scheduled',
    'delayed',
    'service',
    'compat-test',
    '1774951200000',
    30,
    'compat-test',
    '{"source":"compat-test"}',
    null,
    '1774951200000',
    '1774951200000',
    '1774951200000',
  );

  const beforeRepair = await prisma.$queryRawUnsafe(
    'SELECT scheduled_for, health_verified_at, created_at, updated_at FROM platform_restart_plans WHERE id = ?',
    planId,
  );
  assert.equal(Array.isArray(beforeRepair), true);
  assert.equal(Boolean(beforeRepair[0]?.scheduled_for), true);

  await ensurePlatformRestartTables(prisma);

  const repaired = await prisma.platformRestartPlan.findUnique({
    where: { id: planId },
  });
  assert.equal(repaired.id, planId);
  assert.ok(repaired.scheduledFor instanceof Date);
  assert.match(repaired.scheduledFor.toISOString(), /^\d{4}-\d{2}-\d{2}T/);

  const plans = await listRestartPlans({
    tenantId,
    serverId: 'server-shared-sqlite-compat',
    limit: 10,
  }, strictSharedPrisma);

  assert.equal(plans.some((entry) => entry.id === planId), true);
  assert.equal(plans.find((entry) => entry.id === planId)?.scheduledFor, repaired.scheduledFor.toISOString());
});

test('platform restart orchestration persists restart plan and execution history', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  await cleanupNotifications();
  t.after(cleanupRestartFixtures);
  t.after(cleanupNotifications);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    guildId: 'guild-restart-test',
    delaySeconds: 60,
    restartMode: 'safe_restart',
    controlMode: 'service',
    reason: 'config-update',
  }, 'test-suite');
  assert.equal(plan.ok, true);
  assert.equal(String(plan.plan?.status || ''), 'scheduled');
  assert.equal(String(plan.plan?.restartMode || ''), 'safe_restart');

  const execution = await recordRestartExecution({
    planId: plan.plan.id,
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    runtimeKey: 'server-bot-runtime',
    resultStatus: 'succeeded',
    exitCode: 0,
    detail: 'Restart completed',
  });
  assert.equal(execution.ok, true);
  await waitForAdminNotificationPersistence();

  const notifications = listAdminNotifications({
    limit: 10,
    tenantId: 'tenant-restart-test',
    kind: 'restart-succeeded',
  });
  assert.equal(notifications.length, 1);
  assert.equal(String(notifications[0]?.entityKey || ''), String(execution.execution?.id || ''));

  const completed = await completeRestartPlan({
    planId: plan.plan.id,
    status: 'completed',
    healthStatus: 'pending_verification',
  });
  assert.equal(completed.ok, true);

  const plans = await listRestartPlans({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    limit: 5,
  });
  const executions = await listRestartExecutions({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    limit: 5,
  });
  assert.equal(plans.length >= 1, true);
  assert.equal(executions.length >= 1, true);
  assert.equal(String(plans[0]?.id || ''), String(plan.plan.id || ''));
  assert.equal(String(executions[0]?.planId || ''), String(plan.plan.id || ''));
});

test('platform restart orchestration blocks unsafe safe_restart plans when blockers exist', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  t.after(cleanupRestartFixtures);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    restartMode: 'safe_restart',
    queueItems: [{}],
    deadLetters: [{}],
    deliveryRuntimeStatus: 'degraded',
    serverBotReady: false,
  }, 'test-suite');

  assert.equal(plan.ok, true);
  assert.equal(String(plan.plan?.status || ''), 'blocked');
  assert.equal(Array.isArray(plan.plan?.payload?.safety?.blockers), true);
  assert.ok(plan.plan.payload.safety.blockers.length >= 3);
});

test('platform restart orchestration reuses duplicate active restart plans', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  t.after(cleanupRestartFixtures);

  const first = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    guildId: 'guild-restart-test',
    delaySeconds: 90,
    restartMode: 'delayed',
    controlMode: 'service',
    reason: 'config-apply',
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(first.ok, true);
  assert.equal(first.reused, undefined);

  const second = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    guildId: 'guild-restart-test',
    delaySeconds: 90,
    restartMode: 'delayed',
    controlMode: 'service',
    reason: 'config-apply',
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(second.noop, true);
  assert.equal(String(second.plan?.id || ''), String(first.plan?.id || ''));

  const plans = await listRestartPlans({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    limit: 10,
  });
  assert.equal(plans.length, 1);
});

test('platform restart orchestration lists due announcements and marks them sent', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  t.after(cleanupRestartFixtures);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    restartMode: 'delayed',
    delaySeconds: 60,
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(plan.ok, true);

  const dueAnnouncements = await listDueRestartAnnouncements({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    now: new Date(Date.now() + 61_000),
    limit: 10,
  });
  assert.ok(dueAnnouncements.length >= 1);

  const updated = await markRestartAnnouncementStatus({
    announcementId: dueAnnouncements[0].id,
    status: 'sent',
    metadata: { actor: 'test-suite' },
  });
  assert.equal(updated.ok, true);
  assert.equal(String(updated.announcement?.status || ''), 'sent');
  assert.ok(updated.announcement?.sentAt);
  assert.equal(String(updated.announcement?.metadata?.actor || ''), 'test-suite');
});

test('platform restart orchestration reuses duplicate execution results and avoids duplicate notifications', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  await cleanupNotifications();
  t.after(cleanupRestartFixtures);
  t.after(cleanupNotifications);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    delaySeconds: 30,
    restartMode: 'delayed',
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(plan.ok, true);

  const first = await recordRestartExecution({
    planId: plan.plan.id,
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    runtimeKey: 'server-bot-runtime',
    resultStatus: 'succeeded',
    exitCode: 0,
    detail: 'Restart completed',
  });
  const second = await recordRestartExecution({
    planId: plan.plan.id,
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    runtimeKey: 'server-bot-runtime',
    resultStatus: 'succeeded',
    exitCode: 0,
    detail: 'Restart completed',
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(second.noop, true);
  assert.equal(String(second.execution?.id || ''), String(first.execution?.id || ''));

  await waitForAdminNotificationPersistence();
  const executions = await listRestartExecutions({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    planId: plan.plan.id,
    limit: 10,
  });
  assert.equal(executions.length, 1);

  const notifications = listAdminNotifications({
    limit: 10,
    tenantId: 'tenant-restart-test',
    kind: 'restart-succeeded',
  });
  assert.equal(notifications.length, 1);
});

test('platform restart orchestration prunes old terminal artifacts', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  await cleanupNotifications();
  t.after(cleanupRestartFixtures);
  t.after(cleanupNotifications);

  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    delaySeconds: 10,
    restartMode: 'delayed',
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(plan.ok, true);

  const dueAnnouncements = await listDueRestartAnnouncements({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    now: new Date(Date.now() + 11_000),
    limit: 10,
  });
  assert.ok(dueAnnouncements.length >= 1);
  await markRestartAnnouncementStatus({
    announcementId: dueAnnouncements[0].id,
    status: 'sent',
    metadata: { actor: 'test-suite' },
  });

  const execution = await recordRestartExecution({
    planId: plan.plan.id,
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    runtimeKey: 'server-bot-runtime',
    resultStatus: 'succeeded',
    exitCode: 0,
    detail: 'Restart completed',
  });
  assert.equal(execution.ok, true);
  await completeRestartPlan({
    planId: plan.plan.id,
    status: 'completed',
    healthStatus: 'healthy',
  });

  const oldAt = '2026-01-01T00:00:00.000Z';
  await prisma.platformRestartPlan.updateMany({
    where: { id: plan.plan.id },
    data: {
      scheduledFor: new Date(oldAt),
      createdAt: new Date(oldAt),
      updatedAt: new Date(oldAt),
    },
  }).catch(() => null);
  await prisma.platformRestartAnnouncement.updateMany({
    where: { planId: plan.plan.id },
    data: {
      scheduledFor: new Date(oldAt),
      sentAt: new Date(oldAt),
      createdAt: new Date(oldAt),
      updatedAt: new Date(oldAt),
    },
  }).catch(() => null);
  await prisma.platformRestartExecution.updateMany({
    where: { planId: plan.plan.id },
    data: {
      startedAt: new Date(oldAt),
      completedAt: new Date(oldAt),
      createdAt: new Date(oldAt),
      updatedAt: new Date(oldAt),
    },
  }).catch(() => null);

  const pruned = await pruneRestartArtifacts({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    now: '2026-04-01T00:00:00.000Z',
    olderThanMs: 30 * 24 * 60 * 60 * 1000,
    keepLatestPlans: 0,
    keepLatestAnnouncements: 0,
    keepLatestExecutions: 0,
  });
  assert.equal(pruned.ok, true);
  assert.equal(pruned.removed.plans >= 1, true);
  assert.equal(pruned.removed.announcements >= 1, true);
  assert.equal(pruned.removed.executions >= 1, true);

  const plans = await listRestartPlans({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    limit: 10,
  });
  const executions = await listRestartExecutions({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    limit: 10,
  });
  assert.equal(plans.length, 0);
  assert.equal(executions.length, 0);
});

test('platform restart orchestration lists due plans, marks them running, and verifies health', { concurrency: false }, async (t) => {
  await cleanupRestartFixtures();
  t.after(cleanupRestartFixtures);

  const scheduledFor = new Date(Date.now() + 5_000);
  const plan = await scheduleRestartPlan({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    restartMode: 'delayed',
    delaySeconds: 0,
    scheduledFor,
    serverBotReady: true,
    deliveryRuntimeStatus: 'online',
  }, 'test-suite');
  assert.equal(plan.ok, true);

  const duePlans = await listDueRestartPlans({
    tenantId: 'tenant-restart-test',
    serverId: 'server-restart-test',
    now: new Date(Date.now() + 10_000),
    limit: 10,
  });
  assert.ok(duePlans.some((entry) => String(entry.id) === String(plan.plan.id)));

  const running = await markRestartPlanRunning({
    planId: plan.plan.id,
    runtimeKey: 'server-bot-runtime',
    actor: 'test-suite',
  });
  assert.equal(running.ok, true);
  assert.equal(String(running.plan?.status || ''), 'running');
  assert.equal(String(running.plan?.payload?.running?.actor || ''), 'test-suite');

  const verified = await verifyRestartPlanHealth({
    planId: plan.plan.id,
    status: 'completed',
    actor: 'test-suite',
    checks: [
      { key: 'server-bot', status: 'online' },
      { key: 'delivery-agent', status: 'warning' },
    ],
  });
  assert.equal(verified.ok, true);
  assert.equal(String(verified.plan?.status || ''), 'completed');
  assert.equal(String(verified.plan?.healthStatus || ''), 'degraded');
  assert.equal(Array.isArray(verified.plan?.payload?.verification?.checks), true);
  assert.equal(verified.plan.payload.verification.checks.length, 2);
});
