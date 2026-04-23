const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getManagedLocalPm2AppNames,
  pickExistingManagedLocalPm2AppNames,
  PM2_LOCAL_CONFIG_PATH,
} = require('../scripts/pm2-local-start');

test('pm2 local start manages the same app set as the local ecosystem config', () => {
  const names = getManagedLocalPm2AppNames();

  assert.deepEqual(names, [
    'scum-bot-local',
    'scum-worker-local',
    'scum-watcher-local',
    'scum-console-agent-local',
    'scum-web-portal-local',
    'scum-admin-web-local',
    'scum-owner-web-local',
    'scum-tenant-web-local',
  ]);
  assert.match(PM2_LOCAL_CONFIG_PATH.replace(/\\/g, '/'), /\/deploy\/pm2\.local\.config\.cjs$/);
});

test('pm2 local start only deletes apps already present in pm2', () => {
  const namesToDelete = pickExistingManagedLocalPm2AppNames([
    'scum-worker-local',
    'scum-admin-web-local',
    'unrelated-process',
  ]);

  assert.deepEqual(namesToDelete, [
    'scum-worker-local',
    'scum-admin-web-local',
  ]);
});
