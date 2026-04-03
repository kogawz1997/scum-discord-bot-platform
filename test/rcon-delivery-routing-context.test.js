const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const deliveryPath = path.resolve(__dirname, '../src/services/rconDelivery.js');

function randomPort() {
  return 40100 + Math.floor(Math.random() * 500);
}

function clearModules() {
  for (const entry of [repositoryPath, persistPath, runtimeDataDirPath, deliveryPath]) {
    delete require.cache[entry];
  }
}

test('delivery preflight routes execute checks through the control-plane registry context', async (t) => {
  const previousEnv = {
    BOT_DATA_DIR: process.env.BOT_DATA_DIR,
    DELIVERY_EXECUTION_MODE: process.env.DELIVERY_EXECUTION_MODE,
    SCUM_CONSOLE_AGENT_TOKEN: process.env.SCUM_CONSOLE_AGENT_TOKEN,
    SCUM_CONSOLE_AGENT_BASE_URL: process.env.SCUM_CONSOLE_AGENT_BASE_URL,
    SCUM_CONSOLE_AGENT_BACKEND: process.env.SCUM_CONSOLE_AGENT_BACKEND,
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-route-context-'));
  const port = randomPort();

  process.env.BOT_DATA_DIR = tempDir;
  process.env.DELIVERY_EXECUTION_MODE = 'agent';
  process.env.SCUM_CONSOLE_AGENT_TOKEN = 'route-context-token';
  process.env.SCUM_CONSOLE_AGENT_BASE_URL = 'http://127.0.0.1:9';
  process.env.SCUM_CONSOLE_AGENT_BACKEND = 'exec';

  clearModules();
  const repository = require(repositoryPath);
  const {
    getDeliveryPreflightReport,
  } = require(deliveryPath);
  await repository.initControlPlaneRegistryRepository();

  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        ready: true,
        backend: 'exec',
        status: 'online',
      }));
      return;
    }
    if (req.url === '/preflight') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        ready: true,
        backend: 'exec',
        result: {
          ready: true,
        },
      }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not-found' }));
  });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearModules();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  repository.upsertServer({
    tenantId: 'tenant-routing',
    id: 'server-routing',
    slug: 'server-routing',
    name: 'Server Routing',
    guildId: 'guild-routing',
  });
  repository.upsertServerDiscordLink({
    tenantId: 'tenant-routing',
    serverId: 'server-routing',
    guildId: 'guild-routing',
  });
  repository.upsertAgent({
    tenantId: 'tenant-routing',
    serverId: 'server-routing',
    guildId: 'guild-routing',
    agentId: 'exec-routing',
    runtimeKey: 'exec-routing-runtime',
    role: 'execute',
    scope: 'execute_only',
    channel: 'delivery',
    status: 'active',
    baseUrl: `http://127.0.0.1:${port}`,
  });
  repository.recordAgentSession({
    tenantId: 'tenant-routing',
    serverId: 'server-routing',
    guildId: 'guild-routing',
    agentId: 'exec-routing',
    runtimeKey: 'exec-routing-runtime',
    sessionId: 'exec-routing-session',
    heartbeatAt: '2026-03-25T14:00:00.000Z',
    channel: 'delivery',
    version: '1.0.0',
    baseUrl: `http://127.0.0.1:${port}`,
  });
  await repository.waitForControlPlaneRegistryPersistence();

  const report = await getDeliveryPreflightReport({
    tenantId: 'tenant-routing',
    guildId: 'guild-routing',
  });

  assert.equal(Boolean(report.agent?.health?.ok), true);
  assert.equal(String(report.agent?.health?.routeSource || ''), 'registry');
  assert.equal(String(report.agent?.health?.route?.serverId || ''), 'server-routing');
  assert.equal(String(report.agent?.health?.route?.guildId || ''), 'guild-routing');
  assert.equal(String(report.agent?.preflight?.routeSource || ''), 'registry');
  assert.equal(String(report.agent?.preflight?.route?.agentId || ''), 'exec-routing');
});
