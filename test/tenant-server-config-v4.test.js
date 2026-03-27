const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantServerConfigV4Html,
  createTenantServerConfigV4Model,
} = require('../src/admin/assets/tenant-server-config-v4.js');

function createFixture() {
  return {
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    overview: {
      tenantFeatureAccess: {
        package: { features: ['server_settings', 'orders_module', 'player_module', 'sync_agent', 'execute_agent'] },
        features: [
          { key: 'server_settings', title: 'Server Settings' },
          { key: 'orders_module', title: 'Orders Module' },
          { key: 'player_module', title: 'Player Module' },
          { key: 'sync_agent', title: 'Server Bot' },
          { key: 'execute_agent', title: 'Delivery Agent' },
        ],
      },
    },
    tenantConfig: {
      featureFlags: { orders_module: false },
      configPatch: {
        serverLabel: 'Alpha Server',
        deliveryQueueBatchSize: 12,
        maintenanceModeEnabled: true,
      },
      portalEnvPatch: {
        publicTheme: 'midnight-ops',
        communityFeedEnabled: true,
      },
    },
    serverConfigWorkspace: {
      snapshotStatus: 'ready',
      snapshotCollectedAt: '2026-03-27T10:00:00.000Z',
      snapshotUpdatedBy: 'server-bot-alpha',
      files: [
        { file: 'ServerSettings.ini', label: 'Server Settings', exists: true },
        { file: 'AdminUsers.ini', label: 'Admin Users', exists: true, rawEntries: ['76561198000000000', 'AdminSteam'] },
        { file: 'BannedUsers.ini', label: 'Banned Users', exists: true, rawEntries: ['76561198000000001'] },
      ],
      backups: [{
        id: 'backup-1',
        file: 'ServerSettings.ini',
        createdAt: '2026-03-27T09:00:00.000Z',
        changedBy: 'admin',
        changeSummary: [{ key: 'MaxPlayers' }],
      }],
      categories: [
        {
          key: 'general',
          label: 'General',
          description: 'Core server identity.',
          groups: [
            {
              key: 'identity',
              label: 'Identity',
              settings: [
                {
                  id: 'cfg-general-name',
                  file: 'ServerSettings.ini',
                  section: 'General',
                  key: 'ServerName',
                  label: 'Server Name',
                  description: 'Name shown to players.',
                  type: 'string',
                  currentValue: 'SCUM TH Alpha',
                  defaultValue: 'SCUM TH',
                  requiresRestart: true,
                },
                {
                  id: 'cfg-general-players',
                  file: 'ServerSettings.ini',
                  section: 'General',
                  key: 'MaxPlayers',
                  label: 'Max Players',
                  description: 'Player slot limit.',
                  type: 'number',
                  currentValue: 80,
                  defaultValue: 64,
                  min: 1,
                  max: 100,
                  requiresRestart: true,
                },
              ],
            },
          ],
        },
      ],
      advanced: {
        rawSnapshot: {
          status: 'ready',
          files: [{ file: 'ServerSettings.ini', settings: [{ section: 'General', key: 'ServerName', value: 'SCUM TH Alpha' }] }],
        },
      },
    },
  };
}

test('tenant server config model builds a real server-bot workspace', () => {
  const model = createTenantServerConfigV4Model(createFixture());

  assert.equal(model.header.title, 'ตั้งค่าเซิร์ฟเวอร์');
  assert.equal(model.workspace.available, true);
  assert.equal(model.workspace.categories.length >= 2, true);
  assert.equal(model.workspace.categories[0].key, 'general');
  assert.ok(model.workspace.categories.some((category) => category.key === 'security'));
  assert.equal(model.workspace.backups.length, 1);
  assert.equal(model.featureFlags.items.length, 5);
  assert.equal(model.configPatch.groups.length > 0, true);
  assert.equal(model.portalEnvPatch.groups.length > 0, true);
});

test('tenant server config html renders category form, save actions, and advanced editors', () => {
  const html = buildTenantServerConfigV4Html(createTenantServerConfigV4Model(createFixture()));

  assert.match(html, /ตั้งค่าเซิร์ฟเวอร์/);
  assert.match(html, /data-server-config-save-mode="save_only"/);
  assert.match(html, /data-server-config-save-mode="save_apply"/);
  assert.match(html, /data-server-config-save-mode="save_restart"/);
  assert.match(html, /data-config-category-tab="general"/);
  assert.match(html, /data-config-category-panel="general"/);
  assert.match(html, /data-server-config-field/);
  assert.match(html, /data-setting-file="ServerSettings\.ini"/);
  assert.match(html, /data-setting-key="ServerName"/);
  assert.match(html, /data-setting-file="AdminUsers\.ini"/);
  assert.match(html, /data-setting-file="BannedUsers\.ini"/);
  assert.match(html, /data-setting-type="line-list"/);
  assert.match(html, /data-line-list-add/);
  assert.match(html, /76561198000000000/);
  assert.match(html, /data-server-config-rollback="backup-1"/);
  assert.match(html, /data-feature-flag-toggle/);
  assert.match(html, /data-config-patch-field="serverLabel"/);
  assert.match(html, /data-portal-env-field="publicTheme"/);
  assert.match(html, /tdv4-editor-featureFlags/);
  assert.match(html, /tdv4-editor-configPatch/);
  assert.match(html, /tdv4-editor-portalEnvPatch/);
  assert.match(html, /ดู snapshot ดิบจาก Server Bot/);
});

test('tenant server config preview html points to the live asset pair', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-server-config-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-server-config-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-server-config-v4\.js/);
  assert.match(html, /tenantServerConfigV4PreviewRoot/);
  assert.match(html, /serverConfigWorkspace/);
});
