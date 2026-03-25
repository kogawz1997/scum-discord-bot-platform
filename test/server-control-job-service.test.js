const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRestartAnnouncementPlan,
  createServerControlJobService,
} = require('../src/domain/servers/serverControlJobService');

test('buildRestartAnnouncementPlan schedules countdown messages in descending checkpoints', () => {
  const plan = buildRestartAnnouncementPlan(300);
  assert.deepEqual(
    plan.map((entry) => entry.delaySeconds),
    [300, 60, 30, 10],
  );
  assert.match(String(plan[0]?.message || ''), /เซิร์ฟเวอร์จะรีสตาร์ต/);
});

test('server control job service normalizes config update and restart payloads', () => {
  const service = createServerControlJobService();

  const configJob = service.createConfigUpdateJob({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    patch: { General: { MaxPlayers: 64 } },
    schema: {
      section: 'General',
      key: 'MaxPlayers',
      type: 'number',
    },
    requiresRestart: true,
  });
  assert.equal(configJob.ok, true);
  assert.equal(configJob.job.jobType, 'config_update');
  assert.equal(configJob.job.requiresRestart, true);

  const restartJob = service.createRestartServerJob({
    tenantId: 'tenant-a',
    serverId: 'server-a',
    delaySeconds: 60,
    restartMode: 'safe_restart',
    controlMode: 'service',
  });
  assert.equal(restartJob.ok, true);
  assert.equal(restartJob.job.jobType, 'restart_server');
  assert.equal(restartJob.job.restartMode, 'safe_restart');
  assert.equal(restartJob.job.controlMode, 'service');
  assert.ok(Array.isArray(restartJob.job.announcementPlan));
  assert.equal(restartJob.job.announcementPlan.length, 3);
});
