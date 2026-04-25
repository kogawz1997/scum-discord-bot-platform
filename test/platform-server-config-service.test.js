const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWorkspaceFromSnapshot,
  createPlatformServerConfigService,
} = require('../src/services/platformServerConfigService');

function createMockConfigDb() {
  const rows = new Map();
  const db = {
    platformServerConfigSnapshot: {
      findUnique: async () => null,
      upsert: async () => ({}),
    },
    platformServerConfigBackup: {
      findMany: async () => [],
      create: async () => ({}),
    },
    platformServerConfigJob: {
      findUnique: async ({ where }) => rows.get(where.id) || null,
      findMany: async () => [],
      create: async ({ data }) => {
        const row = {
          ...data,
          createdAt: new Date('2026-04-23T00:00:00.000Z'),
          updatedAt: new Date('2026-04-23T00:00:00.000Z'),
        };
        rows.set(data.id, row);
        return row;
      },
    },
    $transaction: async (work) => work(db),
  };
  return db;
}

test('buildWorkspaceFromSnapshot merges discovered snapshot settings into workspace categories', () => {
  const workspace = buildWorkspaceFromSnapshot(
    { tenantId: 'tenant-1', id: 'server-1', name: 'Alpha Server' },
    {
      status: 'ready',
      snapshot: {
        status: 'ready',
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
              {
                file: 'ServerSettings.ini',
                section: 'General',
                key: 'ExtraWelcomeRule',
                value: 'Enabled',
                type: 'string',
              },
              {
                file: 'ServerSettings.ini',
                section: 'Loot',
                key: 'LootRespawnMultiplier',
                value: '1.5',
              },
            ],
          },
        ],
      },
    },
    [],
  );

  const generalCategory = workspace.categories.find((entry) => entry.key === 'general');
  const lootCategory = workspace.categories.find((entry) => entry.key === 'loot');
  const generalKeys = generalCategory.groups.flatMap((group) => group.settings.map((setting) => setting.key));
  const lootSetting = lootCategory.groups[0].settings.find((setting) => setting.key === 'LootRespawnMultiplier');

  assert.ok(generalCategory);
  assert.ok(generalKeys.includes('ExtraWelcomeRule'));
  assert.ok(lootCategory);
  assert.equal(lootSetting.type, 'number');
  assert.equal(lootSetting.currentValue, '1.5');
  assert.match(lootCategory.description, /live server config/i);
});

test('createServerConfigSaveJob stores governance audit metadata for operator config changes', async () => {
  const db = createMockConfigDb();
  const service = createPlatformServerConfigService({
    listServerRegistry: () => [{
      id: 'server-1',
      tenantId: 'tenant-1',
      guildId: 'guild-1',
      name: 'Alpha Server',
    }],
    getTenantScopedPrismaClient: () => db,
    withTenantDbIsolation: (_scopedDb, _scope, work) => work(db),
  });

  const result = await service.createServerConfigSaveJob({
    tenantId: 'tenant-1',
    serverId: 'server-1',
    jobId: 'cfgjob-1',
    applyMode: 'save_only',
    requestId: 'req-config-1',
    actorRole: 'admin',
    reason: 'operator tune',
    changes: [{
      file: 'ServerSettings.ini',
      section: 'General',
      key: 'ServerName',
      value: 'Alpha',
    }],
  }, 'admin-web:tenant-admin');

  assert.equal(result.ok, true);
  assert.equal(result.job.id, 'cfgjob-1');
  assert.equal(result.job.meta.audit.governance, true);
  assert.equal(result.job.meta.audit.actionType, 'server.config.save');
  assert.equal(result.job.meta.audit.tenantId, 'tenant-1');
  assert.equal(result.job.meta.audit.serverId, 'server-1');
  assert.equal(result.job.meta.audit.actorId, 'admin-web:tenant-admin');
  assert.equal(result.job.meta.audit.actorRole, 'admin');
  assert.equal(result.job.meta.audit.requestId, 'req-config-1');
  assert.equal(result.job.meta.audit.jobId, 'cfgjob-1');
  assert.equal(result.job.meta.audit.resultStatus, 'queued');
  assert.equal(result.job.meta.audit.reason, 'operator tune');
  assert.deepEqual(result.job.meta.audit.afterState, {
    applyMode: 'save_only',
    changeCount: 1,
    requiresRestart: true,
  });
});
