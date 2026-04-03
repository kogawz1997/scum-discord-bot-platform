const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const scriptPath = path.resolve(__dirname, '../scripts/persistence-production-smoke.js');
const prismaPath = path.resolve(__dirname, '../src/prisma.js');

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

function loadScriptWithPrismaMock(prismaMock) {
  clearModule(scriptPath);
  installMock(prismaPath, {
    prisma: prismaMock,
  });
  return require(scriptPath);
}

test.afterEach(() => {
  clearModule(scriptPath);
  clearModule(prismaPath);
  delete process.env.NODE_ENV;
  delete process.env.PERSIST_REQUIRE_DB;
  delete process.env.DATABASE_URL;
  delete process.env.DATABASE_PROVIDER;
  delete process.env.PRISMA_SCHEMA_PROVIDER;
  delete process.env.ADMIN_SECURITY_EVENT_STORE_MODE;
  delete process.env.PLATFORM_AUTOMATION_STATE_STORE_MODE;
  delete process.env.PLATFORM_OPS_STATE_STORE_MODE;
  delete process.env.CONTROL_PLANE_REGISTRY_STORE_MODE;
  delete process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES;
});

test('persistence smoke passes when db-backed platform state and control-plane tables are reachable', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PERSIST_REQUIRE_DB = 'true';
  process.env.DATABASE_URL = 'postgresql://app:secret@127.0.0.1:5432/scum_th_platform?schema=public';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  process.env.ADMIN_SECURITY_EVENT_STORE_MODE = 'db';
  process.env.PLATFORM_AUTOMATION_STATE_STORE_MODE = 'db';
  process.env.PLATFORM_OPS_STATE_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = 'none';

  const { buildPersistenceSmokeReport } = loadScriptWithPrismaMock({
    platformAdminSecurityEvent: {
      async count() {
        return 0;
      },
    },
    platformAutomationState: {
      async findUnique() {
        return null;
      },
    },
    platformOpsState: {
      async findUnique() {
        return null;
      },
    },
    controlPlaneServer: {
      async count() {
        return 1;
      },
    },
    controlPlaneAgent: {
      async count() {
        return 1;
      },
    },
    controlPlaneAgentSession: {
      async count() {
        return 0;
      },
    },
    controlPlaneSyncRun: {
      async count() {
        return 0;
      },
    },
    async $disconnect() {},
  });

  const report = await buildPersistenceSmokeReport();

  assert.equal(report.kind, 'persistence-smoke');
  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
  assert.deepEqual(report.data.fileMirrorSlices, []);
  assert.ok(report.checks.some((check) => check.name === 'platform admin security event table'));
});

test('persistence smoke fails when db-required store mode or file mirror policy is missing', async () => {
  process.env.NODE_ENV = 'production';
  process.env.PERSIST_REQUIRE_DB = 'true';
  process.env.DATABASE_URL = 'postgresql://app:secret@127.0.0.1:5432/scum_th_platform?schema=public';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.PRISMA_SCHEMA_PROVIDER = 'postgresql';
  process.env.ADMIN_SECURITY_EVENT_STORE_MODE = 'auto';
  process.env.PLATFORM_AUTOMATION_STATE_STORE_MODE = 'db';
  process.env.PLATFORM_OPS_STATE_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_STORE_MODE = 'db';
  process.env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES = '';

  const { buildPersistenceSmokeReport } = loadScriptWithPrismaMock({
    async $disconnect() {},
  });

  const report = await buildPersistenceSmokeReport();

  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), /ADMIN_SECURITY_EVENT_STORE_MODE must be set to db/i);
  assert.match(report.errors.join('\n'), /CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES must be set explicitly/i);
});
