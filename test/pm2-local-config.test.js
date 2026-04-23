const test = require('node:test');
const assert = require('node:assert/strict');

const pm2LocalConfig = require('../deploy/pm2.local.config.cjs');

function getAppByName(name) {
  return (Array.isArray(pm2LocalConfig?.apps) ? pm2LocalConfig.apps : []).find((app) => app?.name === name) || null;
}

function normalizeFileUrl(value) {
  return String(value || '').replace(/\\/g, '/');
}

test('pm2 local profile includes a dedicated admin-web process', () => {
  const app = getAppByName('scum-admin-web-local');

  assert.ok(app);
  assert.equal(app.script, 'apps/admin-web/server.js');
  assert.equal(app.env.ADMIN_WEB_HOST, '127.0.0.1');
  assert.equal(app.env.ADMIN_WEB_PORT, '3200');
});

test('pm2 local bot and worker runtimes are pinned to local sqlite env', () => {
  const bot = getAppByName('scum-bot-local');
  const worker = getAppByName('scum-worker-local');

  for (const app of [bot, worker]) {
    assert.ok(app);
    assert.match(normalizeFileUrl(app.env.DATABASE_URL), /^file:.*\/prisma\/prisma\/dev\.db$/);
    assert.equal(app.env.DATABASE_PROVIDER, 'sqlite');
    assert.equal(app.env.PRISMA_SCHEMA_PROVIDER, 'sqlite');
    assert.equal(app.env.TENANT_DB_TOPOLOGY_MODE, 'shared');
    assert.equal(app.env.TENANT_DB_ISOLATION_MODE, 'application');
  }

  assert.equal(bot.env.BOT_ENABLE_ADMIN_WEB, 'false');
});
