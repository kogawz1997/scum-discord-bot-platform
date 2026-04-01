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
  createPlatformServerConfigService,
} = require('../src/services/platformServerConfigService');

const TENANT_ID = 'tenant-server-config-int';
const SERVER_ID = 'server-config-alpha';

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

test('platform server config service persists snapshots, jobs, and backups through prisma delegates', async (t) => {
  await cleanupServerConfigRows();
  t.after(async () => {
    await cleanupServerConfigRows();
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
