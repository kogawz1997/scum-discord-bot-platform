const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repositoryPath = path.resolve(__dirname, '../src/data/repositories/controlPlaneRegistryRepository.js');
const persistPath = path.resolve(__dirname, '../src/store/_persist.js');
const runtimeDataDirPath = path.resolve(__dirname, '../src/utils/runtimeDataDir.js');
const deliveryPath = path.resolve(__dirname, '../src/services/rconDelivery.js');
const agentExecutionRoutingServicePath = path.resolve(
  __dirname,
  '../src/domain/delivery/agentExecutionRoutingService.js',
);
const consoleAgentClientPath = path.resolve(
  __dirname,
  '../src/integrations/scum/adapters/consoleAgentClient.js',
);

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModules() {
  for (const entry of [
    repositoryPath,
    persistPath,
    runtimeDataDirPath,
    deliveryPath,
    agentExecutionRoutingServicePath,
    consoleAgentClientPath,
  ]) {
    delete require.cache[entry];
  }
}

test('delivery preflight routes execute checks through the control-plane registry context', async (t) => {
  const previousEnv = {
    BOT_DATA_DIR: process.env.BOT_DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
    PERSIST_REQUIRE_DB: process.env.PERSIST_REQUIRE_DB,
    PERSIST_LEGACY_SNAPSHOTS: process.env.PERSIST_LEGACY_SNAPSHOTS,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_PROVIDER: process.env.DATABASE_PROVIDER,
    PRISMA_SCHEMA_PROVIDER: process.env.PRISMA_SCHEMA_PROVIDER,
    DELIVERY_EXECUTION_MODE: process.env.DELIVERY_EXECUTION_MODE,
    SCUM_CONSOLE_AGENT_TOKEN: process.env.SCUM_CONSOLE_AGENT_TOKEN,
    SCUM_CONSOLE_AGENT_BASE_URL: process.env.SCUM_CONSOLE_AGENT_BASE_URL,
    SCUM_CONSOLE_AGENT_BACKEND: process.env.SCUM_CONSOLE_AGENT_BACKEND,
    CONTROL_PLANE_REGISTRY_STORE_MODE: process.env.CONTROL_PLANE_REGISTRY_STORE_MODE,
    CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES: process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES,
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-route-context-'));
  const baseUrl = 'http://127.0.0.1:40123';
  const agentRequests = [];

  process.env.BOT_DATA_DIR = tempDir;
  process.env.NODE_ENV = 'test';
  process.env.PERSIST_REQUIRE_DB = 'false';
  process.env.PERSIST_LEGACY_SNAPSHOTS = 'true';
  process.env.DATABASE_URL = `file:${path.join(tempDir, 'routing-context.db')}`;
  process.env.DATABASE_PROVIDER = 'sqlite';
  process.env.PRISMA_SCHEMA_PROVIDER = 'sqlite';
  process.env.DELIVERY_EXECUTION_MODE = 'agent';
  process.env.SCUM_CONSOLE_AGENT_TOKEN = 'route-context-token';
  process.env.SCUM_CONSOLE_AGENT_BASE_URL = 'http://127.0.0.1:9';
  process.env.SCUM_CONSOLE_AGENT_BACKEND = 'exec';
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'file';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';

  clearModules();
  const repository = require(repositoryPath);
  installMock(consoleAgentClientPath, {
    async requestConsoleAgent(pathname, options = {}) {
      agentRequests.push({
        pathname,
        baseUrl: options.baseUrl,
        token: options.token,
      });
      if (pathname === '/healthz') {
        return {
          ok: true,
          status: 200,
          payload: {
            ok: true,
            ready: true,
            backend: 'exec',
            status: 'online',
          },
        };
      }
      if (pathname === '/preflight') {
        return {
          ok: true,
          status: 200,
          payload: {
            ok: true,
            ready: true,
            backend: 'exec',
            result: {
              ready: true,
            },
          },
        };
      }
      return {
        ok: false,
        status: 404,
        payload: {
          ok: false,
          error: 'not-found',
        },
      };
    },
  });

  t.after(async () => {
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
    baseUrl,
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
    baseUrl,
  });

  delete require.cache[deliveryPath];
  const {
    getDeliveryPreflightReport,
  } = require(deliveryPath);

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
  assert.deepEqual(
    agentRequests.map((entry) => entry.pathname),
    ['/healthz', '/preflight'],
  );
  assert.equal(new Set(agentRequests.map((entry) => entry.baseUrl)).size, 1);
  assert.match(
    String(agentRequests[0]?.baseUrl || ''),
    /^http:\/\/127\.0\.0\.1:\d+$/i,
  );
});
