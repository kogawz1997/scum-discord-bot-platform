'use strict';

const path = require('node:path');

const { prisma, getPrismaRuntimeProfile } = require('../src/prisma');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');
const { resolveDatabaseRuntime } = require('../src/utils/dbEngine');
const {
  CONTROL_PLANE_REGISTRY_HIGH_CHURN_FILE_MIRROR_SLICES,
  resolveControlPlaneRegistryFileMirrorSlices,
} = require('../src/utils/controlPlaneRegistryFileMirror');
const {
  createValidationCheck,
  createValidationReport,
} = require('../src/utils/runtimeStatus');

loadMergedEnvFiles({
  basePath: path.resolve(process.cwd(), '.env'),
  overlayPath: path.resolve(process.cwd(), 'apps/web-portal-standalone/.env'),
  ignoreEmptyOverlay: true,
  overrideExisting: false,
});

const REQUIRED_DB_MODE_KEYS = Object.freeze([
  'ADMIN_NOTIFICATION_STORE_MODE',
  'ADMIN_SECURITY_EVENT_STORE_MODE',
  'PLATFORM_AUTOMATION_STATE_STORE_MODE',
  'PLATFORM_OPS_STATE_STORE_MODE',
  'CONTROL_PLANE_REGISTRY_STORE_MODE',
]);

const FORBIDDEN_RUNTIME_BOOTSTRAP_KEYS = Object.freeze([
  'ADMIN_WEB_RUNTIME_BOOTSTRAP',
  'PLATFORM_IDENTITY_RUNTIME_BOOTSTRAP',
  'PLATFORM_RAID_RUNTIME_BOOTSTRAP',
]);

const TABLE_PROBES = Object.freeze([
  {
    name: 'platform admin notification table',
    run: (client) => client.platformAdminNotification.count(),
  },
  {
    name: 'platform admin security event table',
    run: (client) => client.platformAdminSecurityEvent.count(),
  },
  {
    name: 'platform automation state table',
    run: (client) => client.platformAutomationState.findUnique({
      where: { id: 'platform-automation-state' },
    }),
  },
  {
    name: 'platform ops state table',
    run: (client) => client.platformOpsState.findUnique({
      where: { id: 'platform-ops-state' },
    }),
  },
  {
    name: 'control-plane server table',
    run: (client) => client.controlPlaneServer.count(),
  },
  {
    name: 'control-plane agent table',
    run: (client) => client.controlPlaneAgent.count(),
  },
  {
    name: 'control-plane agent session table',
    run: (client) => client.controlPlaneAgentSession.count(),
  },
  {
    name: 'control-plane sync run table',
    run: (client) => client.controlPlaneSyncRun.count(),
  },
  {
    name: 'platform identity user table',
    run: (client) => client.platformUser.count(),
  },
  {
    name: 'platform identity verification token table',
    run: (client) => client.platformVerificationToken.count(),
  },
  {
    name: 'platform identity player profile table',
    run: (client) => client.platformPlayerProfile.count(),
  },
  {
    name: 'platform restart plan table',
    run: (client) => client.platformRestartPlan.count(),
  },
  {
    name: 'platform restart announcement table',
    run: (client) => client.platformRestartAnnouncement.count(),
  },
  {
    name: 'platform restart execution table',
    run: (client) => client.platformRestartExecution.count(),
  },
  {
    name: 'platform server config snapshot table',
    run: (client) => client.platformServerConfigSnapshot.count(),
  },
  {
    name: 'platform server config job table',
    run: (client) => client.platformServerConfigJob.count(),
  },
  {
    name: 'platform server config backup table',
    run: (client) => client.platformServerConfigBackup.count(),
  },
  {
    name: 'platform raid request table',
    run: (client) => client.platformRaidRequest.count(),
  },
  {
    name: 'platform raid window table',
    run: (client) => client.platformRaidWindow.count(),
  },
  {
    name: 'platform raid summary table',
    run: (client) => client.platformRaidSummary.count(),
  },
]);

function envFlag(value, fallback = false) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(text);
}

function getEffectiveStoreMode(envKey, env = process.env) {
  const explicit = String(env[envKey] || '').trim().toLowerCase();
  if (explicit === 'file') return 'file';
  if (explicit === 'db') return 'db';
  if (
    envFlag(env.PERSIST_REQUIRE_DB, false)
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
  ) {
    return 'db';
  }
  return 'auto';
}

function parseArgs(argv) {
  return {
    asJson: argv.includes('--json'),
  };
}

async function buildPersistenceSmokeReport(options = {}) {
  const env = options.env && typeof options.env === 'object'
    ? options.env
    : process.env;
  const client = options.client || prisma;
  const checks = [];
  const warnings = [];
  const errors = [];
  const runtime = resolveDatabaseRuntime({
    projectRoot: process.cwd(),
    databaseUrl: env.DATABASE_URL,
    provider: env.PRISMA_SCHEMA_PROVIDER || env.DATABASE_PROVIDER,
  });
  const requireDb = envFlag(env.PERSIST_REQUIRE_DB, false)
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const runtimeProfile = typeof getPrismaRuntimeProfile === 'function'
    ? getPrismaRuntimeProfile({
      env,
      projectRoot: process.cwd(),
    })
    : null;

  checks.push(createValidationCheck('database runtime', {
    status: requireDb && runtime.engine === 'sqlite' ? 'warning' : 'pass',
    detail: `engine=${runtime.engine || 'unknown'} | provider=${runtime.provider || 'unknown'}`,
  }));
  if (requireDb && runtime.engine === 'sqlite') {
    warnings.push(
      'PERSIST_REQUIRE_DB is enabled while DATABASE_URL resolves to sqlite; production should use PostgreSQL',
    );
  }

  if (runtimeProfile) {
    const runtimeDetail = `${runtimeProfile.runtimeMode} | source=${runtimeProfile.sourceSchemaProvider} | runtime=${runtimeProfile.runtimeProvider} | client=${runtimeProfile.generatedClientProvider}`;
    const providerMismatch = requireDb
      && runtime.isServerEngine
      && runtimeProfile.generatedClientProvider
      && runtimeProfile.generatedClientProvider !== runtime.provider;
    checks.push(createValidationCheck('prisma runtime profile', {
      status: providerMismatch ? 'failed' : 'pass',
      detail: runtimeDetail,
    }));
    if (providerMismatch) {
      errors.push(`Generated Prisma client provider (${runtimeProfile.generatedClientProvider}) does not match runtime provider (${runtime.provider})`);
    }
  }

  for (const envKey of FORBIDDEN_RUNTIME_BOOTSTRAP_KEYS) {
    const raw = String(env[envKey] || '').trim().toLowerCase();
    const enabled = ['1', 'true', 'yes', 'on'].includes(raw);
    checks.push(createValidationCheck(envKey, {
      status: enabled ? 'failed' : 'pass',
      detail: raw ? `explicit=${raw}` : 'explicit=unset',
    }));
    if (enabled) {
      errors.push(`${envKey} must stay disabled for production db-only posture`);
    }
  }

  for (const envKey of REQUIRED_DB_MODE_KEYS) {
    const raw = String(env[envKey] || '').trim().toLowerCase();
    const effectiveMode = getEffectiveStoreMode(envKey, env);
    const detail = raw
      ? `explicit=${raw} | effective=${effectiveMode}`
      : `explicit=unset | effective=${effectiveMode}`;
    if (raw && raw !== 'db') {
      checks.push(createValidationCheck(envKey, {
        status: 'failed',
        detail,
      }));
      errors.push(`${envKey} must be set to db`);
      continue;
    }
    if (effectiveMode !== 'db') {
      checks.push(createValidationCheck(envKey, {
        status: 'failed',
        detail,
      }));
      errors.push(`${envKey} must resolve to db mode`);
      continue;
    }
    checks.push(createValidationCheck(envKey, {
      status: raw === 'db' ? 'pass' : 'warning',
      detail,
    }));
    if (!raw) {
      warnings.push(`${envKey} relies on implicit db-only mode; set it explicitly in PM2/env config`);
    }
  }

  const rawMirrorSlices = String(env.CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES || '').trim();
  const mirrorConfig = resolveControlPlaneRegistryFileMirrorSlices({
    env,
    persistenceMode: 'db',
  });
  if (!rawMirrorSlices) {
    checks.push(createValidationCheck('control-plane registry file mirror slices', {
      status: 'failed',
      detail: 'explicit file mirror slice list is missing',
    }));
    errors.push('CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES must be set explicitly');
  } else if (mirrorConfig.invalid.length > 0) {
    checks.push(createValidationCheck('control-plane registry file mirror slices', {
      status: 'failed',
      detail: `invalid=${mirrorConfig.invalid.join(', ')}`,
    }));
    errors.push(`CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES has unknown slices: ${mirrorConfig.invalid.join(', ')}`);
  } else {
    checks.push(createValidationCheck('control-plane registry file mirror slices', {
      status: 'pass',
      detail: mirrorConfig.slices.length > 0
        ? mirrorConfig.slices.join(', ')
        : 'none',
    }));
    const highChurnSlices = mirrorConfig.slices.filter((sliceKey) => (
      CONTROL_PLANE_REGISTRY_HIGH_CHURN_FILE_MIRROR_SLICES.includes(sliceKey)
    ));
    if (highChurnSlices.length > 0) {
      warnings.push(
        `CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES still mirrors high-churn slices: ${highChurnSlices.join(', ')}`,
      );
    }
  }

  if (errors.length === 0) {
    for (const probe of TABLE_PROBES) {
      try {
        const result = await probe.run(client);
        const detail = typeof result === 'number'
          ? `query-ok | count=${result}`
          : 'query-ok';
        checks.push(createValidationCheck(probe.name, {
          status: 'pass',
          detail,
        }));
      } catch (error) {
        checks.push(createValidationCheck(probe.name, {
          status: 'failed',
          detail: error?.message || String(error),
        }));
        errors.push(`${probe.name} failed: ${error?.message || String(error)}`);
      }
    }
  }

  return createValidationReport({
    kind: 'persistence-smoke',
    checks,
    warnings,
    errors,
    data: {
      databaseEngine: runtime.engine,
      databaseProvider: runtime.provider,
      requireDb,
      fileMirrorSlices: mirrorConfig.slices,
    },
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildPersistenceSmokeReport();
  if (options.asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[persistence-smoke] status=${report.status}`);
    console.log(`[persistence-smoke] summary=${report.summary}`);
    for (const check of report.checks) {
      console.log(`- [${check.status}] ${check.name}: ${check.detail || 'ok'}`);
    }
    if (report.warnings.length > 0) {
      console.log('');
      console.log('Warnings:');
      for (const warning of report.warnings) {
        console.log(`- ${warning}`);
      }
    }
    if (report.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const error of report.errors) {
        console.log(`- ${error}`);
      }
    }
  }
  if (!report.ok) {
    process.exitCode = 1;
  }
  await clientDisconnect(options.client || prisma);
}

async function clientDisconnect(client) {
  if (client && typeof client.$disconnect === 'function') {
    await client.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  void main().catch(async (error) => {
    const report = createValidationReport({
      kind: 'persistence-smoke',
      checks: [
        createValidationCheck('persistence-smoke bootstrap', {
          status: 'failed',
          detail: error?.message || String(error),
        }),
      ],
      errors: [error?.message || String(error)],
    });
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.error(`[persistence-smoke] FAILED: ${error?.message || String(error)}`);
    }
    await clientDisconnect(prisma);
    process.exit(1);
  });
}

module.exports = {
  buildPersistenceSmokeReport,
  getEffectiveStoreMode,
};
