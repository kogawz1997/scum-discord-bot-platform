const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = path.resolve(__dirname, '../scripts/doctor-topology.js');
const projectRoot = path.resolve(__dirname, '..');

function runTopology(env, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });
}

test('topology doctor passes valid production split runtime', () => {
  const result = runTopology(
    {
      NODE_ENV: 'production',
      BOT_ENABLE_ADMIN_WEB: 'true',
      BOT_ENABLE_RENTBIKE_SERVICE: 'false',
      BOT_ENABLE_DELIVERY_WORKER: 'false',
      WORKER_ENABLE_RENTBIKE: 'true',
      WORKER_ENABLE_DELIVERY: 'true',
      BOT_HEALTH_PORT: '3210',
      WORKER_HEALTH_PORT: '3211',
      SCUM_WATCHER_HEALTH_PORT: '3212',
      ADMIN_WEB_PORT: '3200',
      SCUM_WEBHOOK_PORT: '3100',
      WEB_PORTAL_PORT: '3300',
    },
    ['--production'],
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[topology\] PASS/);
});

test('topology doctor blocks duplicate bot and worker service overlap', () => {
  const result = runTopology(
    {
      NODE_ENV: 'production',
      BOT_ENABLE_ADMIN_WEB: 'true',
      BOT_ENABLE_RENTBIKE_SERVICE: 'true',
      BOT_ENABLE_DELIVERY_WORKER: 'true',
      WORKER_ENABLE_RENTBIKE: 'true',
      WORKER_ENABLE_DELIVERY: 'true',
      BOT_HEALTH_PORT: '3210',
      WORKER_HEALTH_PORT: '3211',
      SCUM_WATCHER_HEALTH_PORT: '3212',
      ADMIN_WEB_PORT: '3200',
      SCUM_WEBHOOK_PORT: '3100',
      WEB_PORTAL_PORT: '3300',
    },
    ['--production'],
  );

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /Duplicate rent bike service detected/i);
  assert.match(output, /Duplicate delivery worker detected/i);
});
