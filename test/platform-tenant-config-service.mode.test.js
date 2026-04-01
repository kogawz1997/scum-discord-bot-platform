const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/platformTenantConfigService.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const dbEnginePath = path.resolve(__dirname, '../src/utils/dbEngine.js');
const topologyPath = path.resolve(__dirname, '../src/utils/tenantDatabaseTopology.js');
const isolationPath = path.resolve(__dirname, '../src/utils/tenantDbIsolation.js');

function installMock(modulePath, exportsValue) {
  delete require.cache[modulePath];
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports: exportsValue,
  };
}

function clearModule(modulePath) {
  delete require.cache[modulePath];
}

function loadServiceWithRuntime(runtime) {
  clearModule(servicePath);
  installMock(prismaPath, {
    prisma: {},
    getTenantScopedPrismaClient() {
      return {};
    },
  });
  installMock(dbEnginePath, {
    resolveDatabaseRuntime() {
      return runtime;
    },
  });
  installMock(topologyPath, {
    getTenantDatabaseTopologyMode() {
      return 'shared';
    },
  });
  installMock(isolationPath, {
    async withTenantDbIsolation(_db, _scope, work) {
      return work({});
    },
  });
  return require(servicePath);
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(prismaPath);
  clearModule(dbEnginePath);
  clearModule(topologyPath);
  clearModule(isolationPath);
});

test('platform tenant config persistence mode uses prisma on PostgreSQL runtimes', () => {
  const service = loadServiceWithRuntime({
    engine: 'postgresql',
    provider: 'postgresql',
    isServerEngine: true,
  });
  assert.equal(service.__test.getTenantConfigPersistenceMode(), 'prisma');
});

test('platform tenant config persistence mode uses prisma on MySQL runtimes', () => {
  const service = loadServiceWithRuntime({
    engine: 'mysql',
    provider: 'mysql',
    isServerEngine: true,
  });
  assert.equal(service.__test.getTenantConfigPersistenceMode(), 'prisma');
});

test('platform tenant config persistence mode keeps SQL compatibility on SQLite runtimes', () => {
  const service = loadServiceWithRuntime({
    engine: 'sqlite',
    provider: 'sqlite',
    isServerEngine: false,
  });
  assert.equal(service.__test.getTenantConfigPersistenceMode(), 'sql');
});
