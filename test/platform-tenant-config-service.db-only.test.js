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

function createDateCompatibilityError() {
  const error = new Error('created_at type `DateTime` is invalid');
  error.code = 'P2023';
  return error;
}

function loadServiceWithMocks(options = {}) {
  const runtime = options.runtime || {
    engine: 'sqlite',
    provider: 'sqlite',
    isServerEngine: false,
    isSqlite: true,
  };
  const globalState = {
    rawQueryCalls: 0,
    rawExecuteCalls: 0,
  };
  const scopedState = {
    rawQueryCalls: 0,
    rawExecuteCalls: 0,
    rawUnsafeQueryCalls: 0,
    rawUnsafeExecuteCalls: 0,
    upsertCalls: 0,
  };
  const globalDb = {
    platformTenantConfig: {
      async findUnique() {
        return null;
      },
      async findMany() {
        if (options.globalFindManyError) {
          throw options.globalFindManyError;
        }
        return [];
      },
      async upsert() {
        return null;
      },
    },
    platformTenant: {
      async findMany() {
        return [];
      },
      async findUnique() {
        return { id: 'tenant-a' };
      },
    },
    async $queryRaw() {
      globalState.rawQueryCalls += 1;
      return [];
    },
    async $executeRaw() {
      globalState.rawExecuteCalls += 1;
      return [];
    },
  };
  const scopedDb = {
    platformTenantConfig: {
      async findUnique() {
        return null;
      },
      async findMany() {
        return [];
      },
      async upsert() {
        scopedState.upsertCalls += 1;
        if (
          options.scopedUpsertError &&
          (!options.scopedUpsertErrorOnce || scopedState.upsertCalls === 1)
        ) {
          throw options.scopedUpsertError;
        }
        return null;
      },
    },
    async $queryRaw() {
      scopedState.rawQueryCalls += 1;
      return [];
    },
    async $executeRaw() {
      scopedState.rawExecuteCalls += 1;
      return [];
    },
    async $queryRawUnsafe() {
      scopedState.rawUnsafeQueryCalls += 1;
      return [
        {
          tenant_id: 'tenant-a',
          created_at: 1776874648458,
          updated_at: 1776874648458,
        },
      ];
    },
    async $executeRawUnsafe() {
      scopedState.rawUnsafeExecuteCalls += 1;
      return 1;
    },
  };

  clearModule(servicePath);
  installMock(prismaPath, {
    prisma: globalDb,
    getTenantScopedPrismaClient() {
      return scopedDb;
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
    async withTenantDbIsolation(db, _scope, work) {
      return work(db);
    },
    assertTenantDbIsolationScope({ tenantId, allowGlobal }) {
      if (!tenantId && !allowGlobal) {
        const error = new Error('platform tenant config listing requires tenantId');
        error.code = 'TENANT_DB_SCOPE_REQUIRED';
        throw error;
      }
      return { tenantId: tenantId || null, allowGlobal };
    },
  });

  return {
    service: require(servicePath),
    globalState,
    scopedState,
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(prismaPath);
  clearModule(dbEnginePath);
  clearModule(topologyPath);
  clearModule(isolationPath);
  delete process.env.PERSIST_REQUIRE_DB;
  delete process.env.NODE_ENV;
});

test('platform tenant config does not fall back to raw sql reads in db-only posture', async () => {
  process.env.PERSIST_REQUIRE_DB = 'true';
  const { service, globalState } = loadServiceWithMocks({
    globalFindManyError: createDateCompatibilityError(),
  });

  await assert.rejects(
    () => service.listPlatformTenantConfigs({ allowGlobal: true, limit: 20 }),
    (error) => String(error?.code || '') === 'P2023',
  );
  assert.equal(globalState.rawQueryCalls, 0);
});

test('platform tenant config does not fall back to raw sql writes in db-only posture', async () => {
  process.env.PERSIST_REQUIRE_DB = 'true';
  const { service, scopedState } = loadServiceWithMocks({
    scopedUpsertError: createDateCompatibilityError(),
  });

  await assert.rejects(
    () =>
      service.upsertPlatformTenantConfig({
        tenantId: 'tenant-a',
        configPatch: { enabled: true },
        updatedBy: 'test-suite',
      }),
    (error) => String(error?.code || '') === 'P2023',
  );
  assert.equal(scopedState.rawExecuteCalls, 0);
});

test('platform tenant config repairs sqlite datetime columns and retries prisma writes in db-only posture', async () => {
  process.env.PERSIST_REQUIRE_DB = 'true';
  const { service, scopedState } = loadServiceWithMocks({
    scopedUpsertError: createDateCompatibilityError(),
    scopedUpsertErrorOnce: true,
  });

  const result = await service.upsertPlatformTenantConfig({
    tenantId: 'tenant-a',
    configPatch: { enabled: true },
    updatedBy: 'test-suite',
  });

  assert.equal(result.ok, true);
  assert.equal(scopedState.upsertCalls, 2);
  assert.equal(scopedState.rawQueryCalls, 0);
  assert.equal(scopedState.rawExecuteCalls, 0);
  assert.equal(scopedState.rawUnsafeQueryCalls, 2);
  assert.equal(scopedState.rawUnsafeExecuteCalls, 2);
});
