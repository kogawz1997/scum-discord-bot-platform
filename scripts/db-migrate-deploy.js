'use strict';

require('dotenv').config();

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const {
  normalizeProvider,
  resolveDatabaseRuntime,
} = require('../src/utils/dbEngine');
const { runPostgresPlatformSchemaUpgrade } = require('./postgres-platform-schema-upgrade');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRISMA_WITH_PROVIDER_SCRIPT = path.resolve(__dirname, 'prisma-with-provider.js');

function parseCliArgs(argv = process.argv.slice(2)) {
  let provider = '';
  const passthroughArgs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const part = String(argv[index] || '').trim();
    if (!part) continue;

    if (part === '--provider' && index + 1 < argv.length) {
      provider = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }

    if (part.startsWith('--provider=')) {
      provider = part.split('=').slice(1).join('=').trim();
      continue;
    }

    passthroughArgs.push(part);
  }

  return { provider, passthroughArgs };
}

function resolveMigrateDeployPlan(options = {}) {
  const env = options.env || process.env;
  const requestedProvider = String(options.provider || '').trim();
  const runtime = resolveDatabaseRuntime({
    provider: requestedProvider,
    projectRoot: PROJECT_ROOT,
    databaseUrl: env.DATABASE_URL,
  });
  const provider = normalizeProvider(
    requestedProvider || runtime.provider || runtime.engine,
    runtime.engine === 'unsupported' ? 'sqlite' : runtime.engine,
  );

  if (provider === 'postgresql') {
    return {
      mode: 'postgres-platform-schema-upgrade',
      provider,
      runtime,
    };
  }

  if (provider === 'sqlite' || provider === 'mysql') {
    return {
      mode: 'prisma-migrate-deploy',
      provider,
      runtime,
    };
  }

  throw new Error(`Unsupported migrate deploy provider: ${provider}`);
}

function runPrismaMigrateDeploy(provider, passthroughArgs = []) {
  const args = [
    PRISMA_WITH_PROVIDER_SCRIPT,
    '--provider',
    provider,
    'migrate',
    'deploy',
    ...passthroughArgs,
  ];
  return spawnSync(process.execPath, args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
}

function runMigrateDeploy(options = {}) {
  const plan = resolveMigrateDeployPlan(options);
  const passthroughArgs = Array.isArray(options.passthroughArgs)
    ? options.passthroughArgs
    : [];

  if (plan.mode === 'postgres-platform-schema-upgrade') {
    runPostgresPlatformSchemaUpgrade();
    return { status: 0, plan };
  }

  const result = runPrismaMigrateDeploy(plan.provider, passthroughArgs);
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    plan,
  };
}

function main() {
  const { provider, passthroughArgs } = parseCliArgs();
  const result = runMigrateDeploy({ provider, passthroughArgs });
  process.exit(result.status);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseCliArgs,
  resolveMigrateDeployPlan,
  runMigrateDeploy,
};
