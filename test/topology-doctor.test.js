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
      ADMIN_WEB_ALLOWED_ORIGINS: 'https://admin.example.com',
      WEB_PORTAL_BASE_URL: 'https://player.example.com',
      WEB_PORTAL_LEGACY_ADMIN_URL: 'https://admin.example.com/admin',
      ADMIN_WEB_LOCAL_RECOVERY: 'false',
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

test('topology doctor emits JSON report for CI/tooling consumers', () => {
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
    ['--production', '--json'],
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.kind, 'topology');
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'pass');
  assert.equal(payload.mode, 'split-runtime');
  assert.equal(payload.roles.bot.adminWeb, true);
  assert.equal(payload.roles.worker.delivery, true);
});

test('topology doctor passes supported single-host production runtime', () => {
  const result = runTopology(
    {
      NODE_ENV: 'production',
      BOT_ENABLE_ADMIN_WEB: 'true',
      BOT_ENABLE_RENTBIKE_SERVICE: 'true',
      BOT_ENABLE_DELIVERY_WORKER: 'true',
      WORKER_ENABLE_RENTBIKE: 'false',
      WORKER_ENABLE_DELIVERY: 'false',
      BOT_HEALTH_PORT: '3210',
      WORKER_HEALTH_PORT: '0',
      SCUM_WATCHER_HEALTH_PORT: '3212',
      ADMIN_WEB_PORT: '3200',
      SCUM_WEBHOOK_PORT: '3100',
      WEB_PORTAL_PORT: '3300',
    },
    ['--production'],
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[topology\] mode: single-host-prod/);
  assert.match(result.stdout, /\[topology\] PASS/);
});

test('topology doctor passes supported execution-node production runtime', () => {
  const result = runTopology(
    {
      NODE_ENV: 'production',
      BOT_ENABLE_ADMIN_WEB: 'false',
      BOT_ENABLE_SCUM_WEBHOOK: 'false',
      BOT_ENABLE_RENTBIKE_SERVICE: 'false',
      BOT_ENABLE_DELIVERY_WORKER: 'false',
      WORKER_ENABLE_RENTBIKE: 'false',
      WORKER_ENABLE_DELIVERY: 'false',
      BOT_HEALTH_PORT: '0',
      WORKER_HEALTH_PORT: '0',
      SCUM_WATCHER_ENABLED: 'true',
      SCUM_WATCHER_HEALTH_PORT: '3212',
      SCUM_CONSOLE_AGENT_PORT: '3213',
      ADMIN_WEB_PORT: '3200',
      SCUM_WEBHOOK_PORT: '3100',
      WEB_PORTAL_PORT: '3300',
    },
    ['--production'],
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[topology\] mode: execution-node/);
  assert.match(result.stdout, /\[topology\] PASS/);
});
