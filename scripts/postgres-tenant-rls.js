'use strict';

require('dotenv').config();

const { prisma, disconnectPrismaClient } = require('../src/prisma');
const {
  disableTenantDbIsolation,
  getTenantDbIsolationRuntime,
  getTenantDbIsolationStatus,
  installTenantDbIsolation,
} = require('../src/utils/tenantDbIsolation');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    action: 'status',
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const part = String(argv[index] || '').trim();
    if (!part) continue;
    if (part === '--json') {
      options.json = true;
      continue;
    }
    if (part === '--action' && index + 1 < argv.length) {
      options.action = String(argv[index + 1] || '').trim().toLowerCase();
      index += 1;
      continue;
    }
    if (part.startsWith('--action=')) {
      options.action = part.split('=').slice(1).join('=').trim().toLowerCase();
      continue;
    }
  }
  return options;
}

function printResult(result, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`[tenant-db-isolation] mode=${result.mode || 'application'} supported=${result.supported !== false}`);
  if (Array.isArray(result.tables)) {
    for (const table of result.tables) {
      console.log(
        `- ${table.tableName}: policy=${table.policyName} present=${table.present} rlsEnabled=${table.rlsEnabled} rlsForced=${table.rlsForced}`,
      );
    }
  }
  if (Array.isArray(result.applied) && result.applied.length > 0) {
    console.log(`[tenant-db-isolation] applied=${result.applied.length}`);
  }
  if (Array.isArray(result.removed) && result.removed.length > 0) {
    console.log(`[tenant-db-isolation] removed=${result.removed.length}`);
  }
}

async function main() {
  const options = parseArgs();
  const runtime = getTenantDbIsolationRuntime();
  if (!runtime.supported) {
    const result = {
      ok: false,
      mode: runtime.mode,
      supported: false,
      reason: 'database-not-postgresql',
    };
    printResult(result, options);
    process.exit(1);
  }

  let result;
  if (options.action === 'install') {
    result = await installTenantDbIsolation(prisma);
  } else if (options.action === 'disable') {
    result = await disableTenantDbIsolation(prisma);
  } else {
    result = await getTenantDbIsolationStatus(prisma);
  }
  printResult(result, options);
}

main()
  .catch((error) => {
    console.error('[tenant-db-isolation] failed:', error?.stack || error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient().catch(() => {});
  });
