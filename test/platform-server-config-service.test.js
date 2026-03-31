const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWorkspaceFromSnapshot,
} = require('../src/services/platformServerConfigService');

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
