const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PRISMA_TEST_DATABASE_URL = 'file:C:/new/prisma/prisma/test.db';
process.env.PRISMA_TEST_DATABASE_PROVIDER = 'sqlite';
process.env.DATABASE_URL = process.env.PRISMA_TEST_DATABASE_URL;
process.env.DATABASE_PROVIDER = 'sqlite';
process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';

const { getTenantScopedPrismaClient } = require('../src/prisma');
const {
  listAdminNotifications,
  replaceAdminNotifications,
  waitForAdminNotificationPersistence,
} = require('../src/store/adminNotificationStore');
const {
  createPlatformServerConfigService,
} = require('../src/services/platformServerConfigService');

const TENANT_ID = 'tenant-server-config-int';
const SERVER_ID = 'server-config-alpha';

function createMockServerConfigDelegatePrisma() {
  const jobs = new Map();
  const backups = new Map();
  const snapshots = new Map();
  let rawQueryCalls = 0;
  let rawExecuteCalls = 0;
  let getterCalls = 0;
  let isolationCalls = 0;

  function dateMs(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function matchesScalar(value, condition) {
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      if (Array.isArray(condition.in)) {
        return condition.in.map((entry) => String(entry)).includes(String(value));
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

  function sortRows(rows = [], orderBy = []) {
    const orderEntries = Array.isArray(orderBy) ? orderBy : [orderBy];
    return [...rows].sort((left, right) => {
      for (const entry of orderEntries) {
        const [key, direction] = Object.entries(entry || {})[0] || [];
        if (!key) continue;
        const leftValue = left?.[key] instanceof Date || right?.[key] instanceof Date
          ? dateMs(left?.[key]) - dateMs(right?.[key])
          : String(left?.[key] ?? '').localeCompare(String(right?.[key] ?? ''));
        if (leftValue === 0) continue;
        return direction === 'asc' ? leftValue : -leftValue;
      }
      return 0;
    });
  }

  const prisma = {
    platformServerConfigJob: {
      async findUnique({ where } = {}) {
        return jobs.get(String(where?.id || '').trim()) || null;
      },
      async findFirst({ where, orderBy } = {}) {
        const rows = sortRows(
          [...jobs.values()].filter((row) => matchesWhere(row, where)),
          orderBy,
        );
        return rows[0] || null;
      },
      async findMany({ where, orderBy, take } = {}) {
        const rows = sortRows(
          [...jobs.values()].filter((row) => matchesWhere(row, where)),
          orderBy,
        );
        return rows.slice(0, take || rows.length);
      },
      async create({ data }) {
        const now = new Date();
        const row = {
          requestedAt: now,
          claimedAt: null,
          completedAt: null,
          ...data,
        };
        jobs.set(row.id, row);
        return row;
      },
      async update({ where, data }) {
        const id = String(where?.id || '').trim();
        const current = jobs.get(id);
        if (!current) throw new Error(`missing config job: ${id}`);
        const row = { ...current, ...data };
        jobs.set(id, row);
        return row;
      },
      async deleteMany({ where } = {}) {
        const ids = [...jobs.values()].filter((row) => matchesWhere(row, where)).map((row) => row.id);
        ids.forEach((id) => jobs.delete(id));
        return { count: ids.length };
      },
    },
    platformServerConfigBackup: {
      async findMany({ where, orderBy, take } = {}) {
        const rows = sortRows(
          [...backups.values()].filter((row) => matchesWhere(row, where)),
          orderBy,
        );
        return rows.slice(0, take || rows.length);
      },
      async create({ data }) {
        const row = {
          createdAt: new Date(),
          ...data,
        };
        backups.set(row.id, row);
        return row;
      },
      async deleteMany({ where } = {}) {
        const ids = [...backups.values()].filter((row) => matchesWhere(row, where)).map((row) => row.id);
        ids.forEach((id) => backups.delete(id));
        return { count: ids.length };
      },
    },
    platformServerConfigSnapshot: {
      async findUnique({ where } = {}) {
        return [...snapshots.values()].find((row) => matchesWhere(row, where)) || null;
      },
      async upsert({ where, create, update }) {
        const existing = [...snapshots.values()].find((row) => matchesWhere(row, where)) || null;
        if (existing) {
          const row = { ...existing, ...update, updatedAt: new Date() };
          snapshots.set(row.serverId, row);
          return row;
        }
        const row = {
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        };
        snapshots.set(row.serverId, row);
        return row;
      },
      async updateMany({ where, data }) {
        const rows = [...snapshots.values()].filter((row) => matchesWhere(row, where));
        rows.forEach((row) => snapshots.set(row.serverId, { ...row, ...data, updatedAt: new Date() }));
        return { count: rows.length };
      },
      async deleteMany({ where } = {}) {
        const ids = [...snapshots.values()].filter((row) => matchesWhere(row, where)).map((row) => row.serverId);
        ids.forEach((id) => snapshots.delete(id));
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
    async $transaction(work) {
      return work(this);
    },
    async $disconnect() {},
  };

  return {
    prisma,
    getTenantScopedPrismaClient(tenantId) {
      getterCalls += 1;
      assert.equal(String(tenantId || ''), TENANT_ID);
      return prisma;
    },
    async withTenantDbIsolation(db, options, work) {
      isolationCalls += 1;
      assert.equal(db, prisma);
      assert.equal(String(options?.tenantId || ''), TENANT_ID);
      return work(db);
    },
    getSnapshot() {
      return {
        getterCalls,
        isolationCalls,
        rawQueryCalls,
        rawExecuteCalls,
        jobCount: jobs.size,
        backupCount: backups.size,
        snapshotCount: snapshots.size,
      };
    },
  };
}

function createService() {
  return createPlatformServerConfigService({
    async listServerRegistry({ tenantId, serverId }) {
      if (tenantId !== TENANT_ID || serverId !== SERVER_ID) {
        return [];
      }
      return [{
        tenantId,
        id: serverId,
        name: 'Alpha Server',
        guildId: 'guild-alpha',
      }];
    },
  });
}

test('platform server config service supports injected tenant-scoped delegate persistence', async () => {
  const mock = createMockServerConfigDelegatePrisma();
  const service = createPlatformServerConfigService({
    getTenantScopedPrismaClient: mock.getTenantScopedPrismaClient,
    withTenantDbIsolation: mock.withTenantDbIsolation,
    async listServerRegistry({ tenantId, serverId }) {
      if (tenantId !== TENANT_ID || serverId !== SERVER_ID) return [];
      return [{
        tenantId,
        id: serverId,
        name: 'Injected Config Server',
        guildId: 'guild-alpha',
      }];
    },
  });

  const snapshotResult = await service.upsertServerConfigSnapshot({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
    snapshot: {
      status: 'ready',
      collectedAt: '2026-03-31T16:30:00.000Z',
      files: [],
    },
  }, 'server-bot');
  assert.equal(snapshotResult.ok, true);

  const saveJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Injected Alpha',
      },
    ],
    applyMode: 'save_only',
    runtimeKey: 'server-bot-alpha',
  }, 'owner');
  assert.equal(saveJob.ok, true);

  const claimed = await service.claimNextServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.job?.status, 'processing');

  const completed = await service.completeServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
    runtimeKey: 'server-bot-alpha',
    status: 'succeeded',
    result: { detail: 'Injected config path ok.' },
    backups: [
      {
        id: 'cfgbak-injected-1',
        file: 'ServerSettings.ini',
        backupPath: 'C:/backups/injected.bak',
      },
    ],
    snapshot: {
      status: 'ready',
      collectedAt: '2026-03-31T16:31:00.000Z',
      files: [],
    },
  }, 'server-bot');
  assert.equal(completed.ok, true);

  const jobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  const backups = await service.listServerConfigBackups({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  const workspace = await service.getServerConfigWorkspace({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  const snapshot = mock.getSnapshot();

  assert.equal(jobs.length, 1);
  assert.equal(backups.length, 1);
  assert.equal(workspace.snapshotStatus, 'ready');
  assert.ok(snapshot.getterCalls >= 1);
  assert.ok(snapshot.isolationCalls >= 1);
  assert.equal(snapshot.rawQueryCalls, 0);
  assert.equal(snapshot.rawExecuteCalls, 0);
  assert.equal(snapshot.jobCount, 1);
  assert.equal(snapshot.backupCount, 1);
  assert.equal(snapshot.snapshotCount, 1);
});

async function cleanupServerConfigRows() {
  const tenantPrisma = getTenantScopedPrismaClient(TENANT_ID);
  await tenantPrisma.platformServerConfigBackup.deleteMany({
    where: {
      tenantId: TENANT_ID,
      serverId: SERVER_ID,
    },
  }).catch(() => null);
  await tenantPrisma.platformServerConfigJob.deleteMany({
    where: {
      tenantId: TENANT_ID,
      serverId: SERVER_ID,
    },
  }).catch(() => null);
  await tenantPrisma.platformServerConfigSnapshot.deleteMany({
    where: {
      tenantId: TENANT_ID,
      serverId: SERVER_ID,
    },
  }).catch(() => null);
}

async function cleanupNotifications() {
  replaceAdminNotifications([]);
  await waitForAdminNotificationPersistence();
}

test('platform server config service persists snapshots, jobs, and backups through prisma delegates', async (t) => {
  await cleanupServerConfigRows();
  await cleanupNotifications();
  t.after(async () => {
    await cleanupServerConfigRows();
    await cleanupNotifications();
  });

  const service = createService();

  const snapshotResult = await service.upsertServerConfigSnapshot({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
    snapshot: {
      status: 'ready',
      collectedAt: '2026-03-31T16:30:00.000Z',
      files: [
        {
          file: 'ServerSettings.ini',
          settings: [
            {
              file: 'ServerSettings.ini',
              section: 'General',
              key: 'ServerName',
              value: 'Alpha Server',
            },
          ],
        },
      ],
    },
  }, 'server-bot');
  assert.equal(snapshotResult.ok, true);
  assert.equal(snapshotResult.snapshot?.status, 'ready');

  const saveJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Alpha Prime',
      },
    ],
    applyMode: 'save_restart',
    runtimeKey: 'server-bot-alpha',
    delaySeconds: 15,
  }, 'owner');
  assert.equal(saveJob.ok, true);
  assert.equal(saveJob.job?.status, 'queued');
  assert.equal(saveJob.job?.jobType, 'config_update');

  const claimed = await service.claimNextServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.job?.status, 'processing');

  const completed = await service.completeServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
    runtimeKey: 'server-bot-alpha',
    status: 'succeeded',
    result: {
      detail: 'Config applied successfully.',
    },
    backups: [
      {
        id: 'cfgbak-alpha-1',
        file: 'ServerSettings.ini',
        backupPath: 'C:/backups/ServerSettings.ini.bak',
        changedBy: 'server-bot-alpha',
        changeSummary: [{ key: 'ServerName' }],
      },
    ],
    snapshot: {
      status: 'ready',
      collectedAt: '2026-03-31T16:31:00.000Z',
      files: [
        {
          file: 'ServerSettings.ini',
          settings: [
            {
              file: 'ServerSettings.ini',
              section: 'General',
              key: 'ServerName',
              value: 'Alpha Prime',
            },
          ],
        },
      ],
    },
  }, 'server-bot');
  assert.equal(completed.ok, true);
  assert.equal(completed.job?.status, 'succeeded');
  assert.equal(completed.snapshot?.lastJobId, claimed.job.id);
  assert.equal(completed.backups.length, 1);
  assert.equal(completed.backups[0].file, 'ServerSettings.ini');

  const listedBackups = await service.listServerConfigBackups({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(listedBackups.length, 1);
  assert.equal(listedBackups[0].id, 'cfgbak-alpha-1');

  const workspace = await service.getServerConfigWorkspace({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(workspace.snapshotStatus, 'ready');
  assert.equal(workspace.backups.length, 1);
  assert.equal(workspace.serverId, SERVER_ID);
});

test('platform server config service lists jobs with normalized queue status and retries failed jobs', async (t) => {
  await cleanupServerConfigRows();
  await cleanupNotifications();
  t.after(async () => {
    await cleanupServerConfigRows();
    await cleanupNotifications();
  });

  const service = createService();

  const saveJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Alpha Retry',
      },
    ],
    applyMode: 'save_restart',
    runtimeKey: 'server-bot-alpha',
  }, 'owner');
  assert.equal(saveJob.ok, true);

  const claimed = await service.claimNextServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
  });
  assert.equal(claimed.ok, true);

  const failed = await service.completeServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
    runtimeKey: 'server-bot-alpha',
    status: 'failed',
    error: 'Config apply failed',
    result: {
      detail: 'Config apply failed.',
    },
  }, 'server-bot');
  assert.equal(failed.ok, true);
  assert.equal(failed.job?.queueStatus, 'failed');
  assert.equal(failed.job?.retryable, true);
  await waitForAdminNotificationPersistence();

  const notifications = listAdminNotifications({
    limit: 10,
    tenantId: TENANT_ID,
    kind: 'config-job-failed',
  });
  assert.equal(notifications.length, 1);
  assert.equal(String(notifications[0]?.entityKey || ''), String(claimed.job.id || ''));

  const failedJobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    queueStatus: 'failed',
    limit: 10,
  });
  assert.equal(failedJobs.length, 1);
  assert.equal(failedJobs[0].id, claimed.job.id);
  assert.equal(failedJobs[0].queueStatus, 'failed');

  const retried = await service.retryServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
  }, 'owner');
  assert.equal(retried.ok, true);
  assert.equal(retried.sourceJob?.id, claimed.job.id);
  assert.equal(retried.job?.status, 'queued');
  assert.equal(retried.job?.queueStatus, 'pending');
  assert.equal(retried.job?.meta?.retryOfJobId, claimed.job.id);
  assert.equal(retried.job?.meta?.retryAttempt, 1);

  const allJobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(allJobs.length, 2);
  assert.ok(allJobs.some((row) => row.id === claimed.job.id && row.queueStatus === 'failed'));
  assert.ok(allJobs.some((row) => row.id === retried.job.id && row.queueStatus === 'pending'));
});

test('platform server config service reuses duplicate pending save jobs', async (t) => {
  await cleanupServerConfigRows();
  await cleanupNotifications();
  t.after(async () => {
    await cleanupServerConfigRows();
    await cleanupNotifications();
  });

  const service = createService();
  const input = {
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Alpha Deduped',
      },
    ],
    applyMode: 'save_only',
    runtimeKey: 'server-bot-alpha',
  };

  const first = await service.createServerConfigSaveJob(input, 'owner');
  const second = await service.createServerConfigSaveJob(input, 'owner');

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.reused, true);
  assert.equal(second.job?.id, first.job?.id);

  const allJobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(allJobs.length, 1);
  assert.equal(allJobs[0].id, first.job.id);
});

test('platform server config service reuses duplicate retry requests while a retry job is still pending', async (t) => {
  await cleanupServerConfigRows();
  await cleanupNotifications();
  t.after(async () => {
    await cleanupServerConfigRows();
    await cleanupNotifications();
  });

  const service = createService();

  const saveJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Alpha Retry Dedup',
      },
    ],
    applyMode: 'save_only',
    runtimeKey: 'server-bot-alpha',
  }, 'owner');
  assert.equal(saveJob.ok, true);

  const claimed = await service.claimNextServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
  });
  assert.equal(claimed.ok, true);

  const failed = await service.completeServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
    runtimeKey: 'server-bot-alpha',
    status: 'failed',
    error: 'Retry me',
  }, 'server-bot');
  assert.equal(failed.ok, true);

  const firstRetry = await service.retryServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
  }, 'owner');
  const secondRetry = await service.retryServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
  }, 'owner');

  assert.equal(firstRetry.ok, true);
  assert.equal(secondRetry.ok, true);
  assert.equal(secondRetry.reused, true);
  assert.equal(secondRetry.job?.id, firstRetry.job?.id);

  const allJobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(allJobs.length, 2);
  assert.ok(allJobs.some((row) => row.id === claimed.job.id && row.queueStatus === 'failed'));
  assert.ok(allJobs.some((row) => row.id === firstRetry.job.id && row.queueStatus === 'pending'));
});

test('platform server config service prunes old terminal jobs and backups while keeping active artifacts', async (t) => {
  await cleanupServerConfigRows();
  await cleanupNotifications();
  t.after(async () => {
    await cleanupServerConfigRows();
    await cleanupNotifications();
  });

  const service = createService();

  const oldJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'ServerName',
        value: 'Alpha Old',
      },
    ],
    applyMode: 'save_only',
    runtimeKey: 'server-bot-alpha',
  }, 'owner');
  assert.equal(oldJob.ok, true);

  const claimed = await service.claimNextServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    runtimeKey: 'server-bot-alpha',
  });
  assert.equal(claimed.ok, true);

  const completed = await service.completeServerConfigJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    jobId: claimed.job.id,
    runtimeKey: 'server-bot-alpha',
    status: 'succeeded',
    backups: [
      {
        id: 'cfgbak-prune-old',
        file: 'ServerSettings.ini',
        backupPath: 'C:/backups/old.bak',
      },
    ],
  }, 'server-bot');
  assert.equal(completed.ok, true);

  const activeJob = await service.createServerConfigSaveJob({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    changes: [
      {
        file: 'ServerSettings.ini',
        section: 'General',
        key: 'Motd',
        value: 'Keep me',
      },
    ],
    applyMode: 'save_only',
    runtimeKey: 'server-bot-alpha',
  }, 'owner');
  assert.equal(activeJob.ok, true);

  const tenantPrisma = getTenantScopedPrismaClient(TENANT_ID);
  const oldAt = new Date('2026-01-01T00:00:00.000Z');
  await tenantPrisma.platformServerConfigJob.updateMany({
    where: { id: claimed.job.id },
    data: {
      requestedAt: oldAt,
      completedAt: oldAt,
    },
  }).catch(() => null);
  await tenantPrisma.platformServerConfigBackup.updateMany({
    where: { id: 'cfgbak-prune-old' },
    data: {
      createdAt: oldAt,
    },
  }).catch(() => null);

  const pruned = await service.pruneServerConfigArtifacts({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    now: '2026-04-01T00:00:00.000Z',
    jobRetentionMs: 30 * 24 * 60 * 60 * 1000,
    backupRetentionMs: 30 * 24 * 60 * 60 * 1000,
    keepLatestJobs: 0,
    keepLatestBackups: 0,
  });
  assert.equal(pruned.ok, true);
  assert.equal(pruned.removed.jobs, 1);
  assert.equal(pruned.removed.backups, 1);

  const jobs = await service.listServerConfigJobs({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  const backups = await service.listServerConfigBackups({
    tenantId: TENANT_ID,
    serverId: SERVER_ID,
    limit: 10,
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, activeJob.job.id);
  assert.equal(backups.length, 0);
});
