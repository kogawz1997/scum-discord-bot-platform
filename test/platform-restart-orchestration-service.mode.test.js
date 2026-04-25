const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const servicePath = path.resolve(__dirname, '../src/services/platformRestartOrchestrationService.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');
const jobContractsPath = path.resolve(__dirname, '../src/contracts/jobs/jobContracts.js');
const serverControlPath = path.resolve(__dirname, '../src/domain/servers/serverControlJobService.js');
const dbEnginePath = path.resolve(__dirname, '../src/utils/dbEngine.js');
const isolationPath = path.resolve(__dirname, '../src/utils/tenantDbIsolation.js');
const liveBusPath = path.resolve(__dirname, '../src/services/adminLiveBus.js');
const compatibilityPath = path.resolve(__dirname, '../src/services/platformRestartCompatibilityService.js');

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

function createRestartDb() {
  return {
    platformRestartPlan: {
      async findUnique() {
        return null;
      },
    },
    platformRestartAnnouncement: {
      async findUnique() {
        return null;
      },
    },
    platformRestartExecution: {
      async findUnique() {
        return null;
      },
    },
  };
}

function loadRestartService(options = {}) {
  const compatibilityCalls = {
    ensure: 0,
  };
  const sharedPrisma = createRestartDb();

  clearModule(servicePath);
  installMock(prismaPath, {
    prisma: sharedPrisma,
  });
  installMock(jobContractsPath, {
    normalizeRestartServerPayload(input) {
      return input || {};
    },
  });
  installMock(serverControlPath, {
    buildRestartAnnouncementPlan() {
      return [];
    },
  });
  installMock(dbEnginePath, {
    resolveDatabaseRuntime() {
      return {
        engine: 'sqlite',
        provider: 'sqlite',
        isServerEngine: false,
        isSqlite: true,
      };
    },
  });
  installMock(isolationPath, {
    assertTenantDbIsolationScope({ tenantId, allowGlobal }) {
      return { tenantId: tenantId || null, allowGlobal };
    },
  });
  installMock(liveBusPath, {
    publishAdminLiveUpdate() {},
  });
  installMock(compatibilityPath, {
    async ensureSharedRestartSqliteCompatibility() {
      compatibilityCalls.ensure += 1;
      return { ok: true };
    },
    hasSharedRestartSqliteCompatibility() {
      return false;
    },
  });

  if (options.requireDb) {
    process.env.PERSIST_REQUIRE_DB = 'true';
  } else {
    delete process.env.PERSIST_REQUIRE_DB;
  }

  return {
    service: require(servicePath),
    db: createRestartDb(),
    compatibilityCalls,
  };
}

test.afterEach(() => {
  clearModule(servicePath);
  clearModule(prismaPath);
  clearModule(jobContractsPath);
  clearModule(serverControlPath);
  clearModule(dbEnginePath);
  clearModule(isolationPath);
  clearModule(liveBusPath);
  clearModule(compatibilityPath);
  delete process.env.PERSIST_REQUIRE_DB;
  delete process.env.NODE_ENV;
});

test('platform restart orchestration skips sqlite compatibility in db-only posture', async () => {
  const { service, db, compatibilityCalls } = loadRestartService({ requireDb: true });

  const result = await service.ensurePlatformRestartTables(db);

  assert.equal(result.ok, true);
  assert.equal(compatibilityCalls.ensure, 0);
});

test('platform restart orchestration still allows sqlite compatibility in non-db-only posture', async () => {
  const { service, db, compatibilityCalls } = loadRestartService({ requireDb: false });

  const result = await service.ensurePlatformRestartTables(db);

  assert.equal(result.ok, true);
  assert.equal(compatibilityCalls.ensure, 1);
});
