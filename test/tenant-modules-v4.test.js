const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createTenantModulesV4Model,
  buildTenantModulesV4Html,
} = require('../src/admin/assets/tenant-modules-v4.js');

test('tenant modules v4 model surfaces package locks, runtime follow-up, and next actions', () => {
  const model = createTenantModulesV4Model({
    me: { tenantId: 'tenant-1' },
    tenantConfig: {
      name: 'Tenant Prime',
      featureFlags: {
        bot_log: true,
        donation_module: true,
      },
    },
    overview: {
      tenantFeatureAccess: {
        package: {
          features: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'analytics_module', 'sync_agent'],
        },
        enabledFeatureKeys: ['bot_log', 'donation_module', 'orders_module', 'player_module', 'analytics_module', 'sync_agent'],
      },
    },
    agents: [
      { role: 'sync', status: 'offline' },
    ],
    featureEntitlements: {
      actions: {
        can_use_modules: {
          locked: false,
          reason: '',
        },
      },
    },
  });

  assert.equal(model.header.title, 'โมดูลของระบบ');
  assert.equal(model.summaryStrip.length, 5);
  assert.equal(model.runtimeHealth.syncCount, 1);
  assert.equal(model.runtimeHealth.syncOnline, false);
  assert.ok(model.topActions.some((item) => item.featureKey === 'bot_log'));
  assert.equal(model.rolloutGroups.length, 4);

  const botLog = model.modules.find((row) => row.featureKey === 'bot_log');
  const donation = model.modules.find((row) => row.featureKey === 'donation_module');
  const events = model.modules.find((row) => row.featureKey === 'event_module');
  const runtimeGroup = model.rolloutGroups.find((row) => row.title === 'ยังต้องให้บอทเชื่อมก่อน');
  const upgradeGroup = model.rolloutGroups.find((row) => row.title === 'ต้องอัปเกรดแพ็กเกจ');

  assert.equal(botLog.stateLabel, 'Server Bot ยังไม่พร้อม');
  assert.equal(botLog.nextAction.href, '/tenant/server-bots');
  assert.equal(donation.stateLabel, 'พร้อมใช้งาน');
  assert.equal(donation.nextAction.href, '/tenant/donations');
  assert.equal(events.stateLabel, 'ต้องอัปเกรดแพ็กเกจ');
  assert.equal(events.nextAction.href, '/tenant/billing');
  assert.ok(runtimeGroup.rows.some((row) => row.featureKey === 'bot_log'));
  assert.ok(upgradeGroup.rows.some((row) => row.featureKey === 'event_module'));
});

test('tenant modules v4 html includes next actions, module statuses, and quick links', () => {
  const html = buildTenantModulesV4Html(createTenantModulesV4Model({
    me: { tenantId: 'tenant-1' },
    overview: {
      tenantFeatureAccess: {
        package: {
          features: ['analytics_module', 'event_module'],
        },
        enabledFeatureKeys: ['analytics_module', 'event_module'],
      },
    },
    agents: [
      { role: 'sync', status: 'online' },
      { role: 'execute', status: 'online' },
    ],
    featureEntitlements: {
      actions: {
        can_use_modules: {
          locked: false,
          reason: '',
        },
      },
    },
  }));

  assert.match(html, /คิวติดตามงานของโมดูล/);
  assert.match(html, /บอร์ดความพร้อมของโมดูล/);
  assert.match(html, /data-tenant-modules-rollout-board/);
  assert.match(html, /data-tenant-module-rollout-group="เปิดใช้ได้เลย"/);
  assert.match(html, /data-tenant-modules-next-actions/);
  assert.match(html, /data-tenant-module-card="analytics_module"/);
  assert.match(html, /data-tenant-module-rollout-item="donation_module"/);
  assert.match(html, /data-tenant-module-status="analytics_module"/);
  assert.match(html, /data-tenant-module-action-link="analytics_module"/);
  assert.match(html, /href="\/tenant\/analytics"/);
  assert.match(html, /href="\/tenant\/events"/);
  assert.match(html, /บันทึกการเปลี่ยนแปลง/);
  assert.match(html, /รีเซ็ตกลับตามแพ็กเกจ/);
});
