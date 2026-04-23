const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDeliveryLifecycleReport,
  buildDeliveryLifecycleCsv,
} = require('../src/services/deliveryLifecycleService');

test('buildDeliveryLifecycleReport summarizes queue pressure, poison candidates, and dead letters', async () => {
  const now = Date.now();
  const report = await buildDeliveryLifecycleReport({
    tenantId: 'tenant-1',
    pendingOverdueMs: 10 * 60 * 1000,
    retryHeavyAttempts: 3,
    poisonAttempts: 5,
    deps: {
      getDeliveryRuntimeSnapshotSync: () => ({
        enabled: true,
        executionMode: 'worker',
        workerStarted: true,
        workerBusy: false,
        queueLength: 3,
        deadLetterCount: 2,
        inFlightCount: 1,
        recentSuccessCount: 9,
      }),
      listFilteredDeliveryQueue: () => ([
        {
          purchaseCode: 'P-OVERDUE',
          tenantId: 'tenant-1',
          attempts: 1,
          nextAttemptAt: new Date(now - (40 * 60 * 1000)).toISOString(),
          lastErrorCode: 'WAITING_FOR_RUNTIME',
        },
        {
          purchaseCode: 'P-RETRY',
          tenantId: 'tenant-1',
          attempts: 4,
          updatedAt: new Date(now - (3 * 60 * 1000)).toISOString(),
          lastErrorCode: 'AGENT_PREFLIGHT_FAILED',
          retryable: true,
        },
        {
          purchaseCode: 'P-POISON',
          tenantId: 'tenant-1',
          attempts: 6,
          updatedAt: new Date(now - (5 * 60 * 1000)).toISOString(),
          lastErrorCode: 'AGENT_PREFLIGHT_FAILED',
          retryable: false,
        },
      ]),
      listFilteredDeliveryDeadLetters: () => ([
        {
          purchaseCode: 'DL-RETRY',
          tenantId: 'tenant-1',
          attempts: 2,
          updatedAt: new Date(now - (6 * 60 * 1000)).toISOString(),
          reason: 'transient',
          retryable: true,
          lastErrorCode: 'AGENT_PREFLIGHT_FAILED',
        },
        {
          purchaseCode: 'DL-LOCKED',
          tenantId: 'tenant-1',
          attempts: 7,
          updatedAt: new Date(now - (15 * 60 * 1000)).toISOString(),
          reason: 'template-missing',
          retryable: false,
          lastErrorCode: 'AGENT_EXEC_TEMPLATE_MISSING',
        },
      ]),
    },
  });

  assert.equal(report.tenantId, 'tenant-1');
  assert.equal(report.summary.queueCount, 3);
  assert.equal(report.summary.deadLetterCount, 2);
  assert.equal(report.summary.overdueCount, 1);
  assert.equal(report.summary.retryHeavyCount, 3);
  assert.equal(report.summary.poisonCandidateCount, 2);
  assert.equal(report.summary.retryableDeadLetters, 1);
  assert.equal(report.summary.nonRetryableDeadLetters, 1);
  assert.ok(report.signals.some((row) => row.key === 'poisonCandidate'));
  assert.ok(report.topErrors.some((row) => row.key === 'AGENT_PREFLIGHT_FAILED' && row.count === 3));
  assert.ok(report.actionPlan);
  assert.ok(report.actionPlan.actions.some((row) => row.key === 'retry-dead-letter-batch' && row.count === 1));
  assert.ok(report.actionPlan.actions.some((row) => row.key === 'hold-poison-candidates' && row.count === 2));
  assert.deepEqual(report.actionPlan.codeSets.deadLetterRetryCodes, ['DL-RETRY']);
});

test('buildDeliveryLifecycleCsv flattens summary and error signatures', () => {
  const csv = buildDeliveryLifecycleCsv({
    generatedAt: '2026-03-20T10:00:00.000Z',
    scope: 'tenant-1',
    tenantId: 'tenant-1',
    summary: {
      queueCount: 3,
      deadLetterCount: 2,
      inFlightCount: 1,
      overdueCount: 1,
      retryHeavyCount: 3,
      poisonCandidateCount: 2,
      retryableDeadLetters: 1,
      nonRetryableDeadLetters: 1,
      recentSuccessCount: 9,
    },
    runtime: {
      executionMode: 'worker',
      workerStarted: true,
      workerBusy: false,
    },
    signals: [{ key: 'poisonCandidate', count: 2 }],
    topErrors: [{ key: 'AGENT_PREFLIGHT_FAILED', count: 3 }],
    actionPlan: {
      actions: [{ key: 'hold-poison-candidates', count: 2 }],
    },
  });

  assert.match(csv, /scope,tenant-1/);
  assert.match(csv, /queueCount,3/);
  assert.match(csv, /poisonCandidateCount,2/);
  assert.match(csv, /topErrors,AGENT_PREFLIGHT_FAILED:3/);
  assert.match(csv, /recommendedActions,hold-poison-candidates:2/);
});

test('buildDeliveryLifecycleReport requires tenant scope in strict postgres mode unless global access is explicit', async () => {
  await assert.rejects(
    () => buildDeliveryLifecycleReport({
      env: {
        DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
        TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
      },
      deps: {
        getDeliveryRuntimeSnapshotSync: () => ({}),
        listFilteredDeliveryQueue: () => ([]),
        listFilteredDeliveryDeadLetters: () => ([]),
      },
    }),
    /delivery lifecycle report requires tenantId/i,
  );
});

test('buildDeliveryLifecycleReport allows explicit global access in strict postgres mode', async () => {
  const report = await buildDeliveryLifecycleReport({
    allowGlobal: true,
    env: {
      DATABASE_URL: 'postgresql://app:secret@127.0.0.1:5432/scum',
      TENANT_DB_ISOLATION_MODE: 'postgres-rls-strict',
    },
    deps: {
      getDeliveryRuntimeSnapshotSync: () => ({
        enabled: true,
        executionMode: 'worker',
        workerStarted: true,
      }),
      listFilteredDeliveryQueue: () => ([]),
      listFilteredDeliveryDeadLetters: () => ([]),
    },
  });

  assert.equal(report.tenantId, null);
  assert.equal(report.scope, 'global');
  assert.equal(report.summary.queueCount, 0);
});
