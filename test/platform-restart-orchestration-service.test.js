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
  completeRestartPlan,
  ensurePlatformRestartTables,
  listDueRestartAnnouncements,
  listDueRestartPlans,
  listRestartExecutions,
  listRestartPlans,
  markRestartAnnouncementStatus,
  markRestartPlanRunning,
  recordRestartExecution,
  scheduleRestartPlan,
  verifyRestartPlanHealth,
} = require('../src/services/platformRestartOrchestrationService');

async function cleanupRestartFixtures() {
  await ensurePlatformRestartTables(prisma);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_executions WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_announcements WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
  await prisma.$executeRawUnsafe("DELETE FROM platform_restart_plans WHERE tenant_id = 'tenant-restart-test'").catch(() => null);
}

test('platform restart orchestration persists restart plan and execution history', async (t) => {
  await cleanupRestartFixtures();
  t.after(cleanupRestartFixtures);

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

test('platform restart orchestration blocks unsafe safe_restart plans when blockers exist', async (t) => {
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

test('platform restart orchestration lists due announcements and marks them sent', async (t) => {
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

test('platform restart orchestration lists due plans, marks them running, and verifies health', async (t) => {
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
