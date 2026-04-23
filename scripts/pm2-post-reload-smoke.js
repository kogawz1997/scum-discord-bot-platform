'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  createValidationCheck,
  createValidationReport,
} = require('../src/utils/runtimeStatus');

const ROOT_DIR = process.cwd();
const MAX_CHILD_OUTPUT_BYTES = 32 * 1024 * 1024;
const DEFAULT_WAIT_MS = 5000;

const REQUIRED_PM2_ENV = Object.freeze({
  NODE_ENV: 'production',
  PERSIST_REQUIRE_DB: 'true',
  PERSIST_LEGACY_SNAPSHOTS: 'false',
  ADMIN_NOTIFICATION_STORE_MODE: 'db',
  ADMIN_SECURITY_EVENT_STORE_MODE: 'db',
  PLATFORM_AUTOMATION_STATE_STORE_MODE: 'db',
  PLATFORM_OPS_STATE_STORE_MODE: 'db',
  CONTROL_PLANE_REGISTRY_STORE_MODE: 'db',
  CONTROL_PLANE_REGISTRY_FILE_MIRROR_SLICES: 'none',
});

const PROFILE_DEFINITIONS = Object.freeze({
  production: Object.freeze({
    pm2ConfigPath: path.join(ROOT_DIR, 'deploy', 'pm2.ecosystem.config.cjs'),
    expectedApps: Object.freeze([
      'scum-bot',
      'scum-admin-web',
      'scum-worker',
      'scum-watcher',
      'scum-server-bot',
      'scum-console-agent',
      'scum-web-portal',
    ]),
    machineValidationRole: 'control-plane',
    includePostDeploySmoke: true,
  }),
  'machine-a-control-plane': Object.freeze({
    pm2ConfigPath: path.join(ROOT_DIR, 'deploy', 'pm2.machine-a-control-plane.config.cjs'),
    expectedApps: Object.freeze([
      'scum-bot',
      'scum-worker',
      'scum-web-portal',
    ]),
    machineValidationRole: 'control-plane',
    includePostDeploySmoke: true,
  }),
  'machine-b-game-bot': Object.freeze({
    pm2ConfigPath: path.join(ROOT_DIR, 'deploy', 'pm2.machine-b-game-bot.config.cjs'),
    expectedApps: Object.freeze([
      'scum-watcher',
      'scum-server-bot',
      'scum-console-agent',
    ]),
    machineValidationRole: 'game-node',
    includePostDeploySmoke: false,
  }),
});

const PROFILE_ALIASES = new Map([
  ['prod', 'production'],
  ['production', 'production'],
  ['machine-a', 'machine-a-control-plane'],
  ['machine-a-control-plane', 'machine-a-control-plane'],
  ['control-plane', 'machine-a-control-plane'],
  ['machine-b', 'machine-b-game-bot'],
  ['machine-b-game-bot', 'machine-b-game-bot'],
  ['game-node', 'machine-b-game-bot'],
]);

function printHelpAndExit() {
  console.log('Usage: node scripts/pm2-post-reload-smoke.js [options]');
  console.log('');
  console.log('Reload a PM2 profile, then verify PM2 env, DB persistence, and runtime health.');
  console.log('');
  console.log('Options:');
  console.log('  --profile <name>   production | machine-a-control-plane | machine-b-game-bot');
  console.log(`  --wait-ms <ms>     Wait after reload before smoke checks (default: ${DEFAULT_WAIT_MS})`);
  console.log('  --skip-reload      Skip PM2 reload and only run verification');
  console.log('  --json             Print JSON report');
  console.log('  --help, -h         Show this help');
  process.exit(0);
}

function normalizeProfile(value) {
  const normalized = String(value || 'production').trim().toLowerCase();
  const resolved = PROFILE_ALIASES.get(normalized);
  if (!resolved || !PROFILE_DEFINITIONS[resolved]) {
    throw new Error(`Unsupported profile: ${value}`);
  }
  return resolved;
}

function parseArgs(argv) {
  const options = {
    asJson: false,
    profile: 'production',
    skipReload: false,
    waitMs: DEFAULT_WAIT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '').trim();
    if (!arg) continue;

    if (arg === '--help' || arg === '-h') {
      printHelpAndExit();
    }

    if (arg === '--json') {
      options.asJson = true;
      continue;
    }

    if (arg === '--skip-reload') {
      options.skipReload = true;
      continue;
    }

    if (arg === '--profile') {
      index += 1;
      options.profile = argv[index];
      continue;
    }

    if (arg.startsWith('--profile=')) {
      options.profile = arg.slice('--profile='.length);
      continue;
    }

    if (arg === '--wait-ms') {
      index += 1;
      options.waitMs = argv[index];
      continue;
    }

    if (arg.startsWith('--wait-ms=')) {
      options.waitMs = arg.slice('--wait-ms='.length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  options.profile = normalizeProfile(options.profile);
  const parsedWaitMs = Number(options.waitMs);
  options.waitMs = Number.isFinite(parsedWaitMs) && parsedWaitMs >= 0
    ? Math.trunc(parsedWaitMs)
    : DEFAULT_WAIT_MS;

  return options;
}

function buildProfilePlan(profileInput) {
  const profile = normalizeProfile(profileInput);
  const definition = PROFILE_DEFINITIONS[profile];
  return {
    profile,
    pm2ConfigPath: definition.pm2ConfigPath,
    expectedApps: [...definition.expectedApps],
    machineValidationRole: definition.machineValidationRole,
    includePostDeploySmoke: definition.includePostDeploySmoke === true,
  };
}

function defaultSleep(waitMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(waitMs) || 0));
  });
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      ...(options.env && typeof options.env === 'object' ? options.env : {}),
    },
    shell: false,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
  });
}

function runPm2Command(pm2Args, options = {}) {
  const runner = options.runner || runCommand;
  if (process.platform === 'win32') {
    return runner('cmd', ['/c', 'pm2', ...pm2Args], options);
  }
  return runner('pm2', pm2Args, options);
}

function runNodeScript(scriptRelativePath, scriptArgs, options = {}) {
  const runner = options.runner || runCommand;
  return runner(
    process.execPath,
    [path.join(ROOT_DIR, scriptRelativePath), ...(scriptArgs || [])],
    {
      ...options,
      env: {
        NODE_ENV: 'production',
        ...(options.env && typeof options.env === 'object' ? options.env : {}),
      },
    },
  );
}

function extractTail(text, maxLines = 8) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-maxLines)
    .join(' | ');
}

function parseJsonOutput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}

  const candidateStarts = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === '{' || char === '[') {
      candidateStarts.push(index);
    }
  }

  for (const startIndex of candidateStarts) {
    try {
      return JSON.parse(trimmed.slice(startIndex));
    } catch {}
  }

  return null;
}

function pushJsonCommandResult(target, label, result, report) {
  const detail = report?.summary
    || extractTail(result.stderr || result.stdout)
    || 'check completed';
  target.checks.push(createValidationCheck(label, {
    status: report?.status || (result.status === 0 ? 'pass' : 'failed'),
    detail,
    data: report && typeof report === 'object'
      ? {
          kind: report.kind,
          status: report.status,
        }
      : undefined,
  }));

  if (report && typeof report === 'object') {
    for (const warning of Array.isArray(report.warnings) ? report.warnings : []) {
      target.warnings.push(`[${label}] ${String(warning || '').trim()}`);
    }
    for (const error of Array.isArray(report.errors) ? report.errors : []) {
      target.errors.push(`[${label}] ${String(error || '').trim()}`);
    }
  } else if (result.status !== 0) {
    target.errors.push(`[${label}] ${detail}`);
  }
}

function flattenPm2Env(entry) {
  const pm2Env = entry?.pm2_env && typeof entry.pm2_env === 'object'
    ? entry.pm2_env
    : {};
  const nestedEnv = pm2Env.env && typeof pm2Env.env === 'object'
    ? pm2Env.env
    : {};
  return {
    ...pm2Env,
    ...nestedEnv,
  };
}

function validatePm2ProcessSnapshot(entries, plan) {
  const target = {
    checks: [],
    warnings: [],
    errors: [],
  };

  const list = Array.isArray(entries) ? entries : [];

  for (const appName of plan.expectedApps) {
    const entry = list.find((candidate) => String(candidate?.name || '').trim() === appName);
    if (!entry) {
      target.checks.push(createValidationCheck(`pm2 app ${appName}`, {
        status: 'failed',
        detail: 'process is missing from pm2 list',
      }));
      target.errors.push(`[pm2 app ${appName}] process is missing from pm2 list`);
      continue;
    }

    const status = String(entry?.pm2_env?.status || entry?.status || '').trim().toLowerCase() || 'unknown';
    const env = flattenPm2Env(entry);
    const envMismatches = [];
    for (const [envKey, expectedValue] of Object.entries(REQUIRED_PM2_ENV)) {
      const actualValue = String(env[envKey] || '').trim();
      if (actualValue !== expectedValue) {
        envMismatches.push(`${envKey}=${actualValue || 'unset'} (expected ${expectedValue})`);
      }
    }

    const detailParts = [`status=${status}`];
    if (envMismatches.length > 0) {
      detailParts.push(`env=${envMismatches.join('; ')}`);
    }
    target.checks.push(createValidationCheck(`pm2 app ${appName}`, {
      status: status === 'online' && envMismatches.length === 0 ? 'pass' : 'failed',
      detail: detailParts.join(' | '),
      data: {
        pid: entry?.pid || null,
      },
    }));

    if (status !== 'online') {
      target.errors.push(`[pm2 app ${appName}] process status is ${status}`);
    }
    if (envMismatches.length > 0) {
      target.errors.push(`[pm2 app ${appName}] ${envMismatches.join('; ')}`);
    }
  }

  return target;
}

async function buildPm2PostReloadSmokeReport(options = {}) {
  const plan = buildProfilePlan(options.profile || 'production');
  const runner = options.runner || runCommand;
  const sleep = options.sleep || defaultSleep;
  const waitMs = Number.isFinite(Number(options.waitMs))
    ? Math.max(0, Math.trunc(Number(options.waitMs)))
    : DEFAULT_WAIT_MS;
  const target = {
    checks: [],
    warnings: [],
    errors: [],
  };

  if (options.skipReload !== true) {
    const reloadResult = runPm2Command(
      ['reload', plan.pm2ConfigPath, '--update-env'],
      { runner },
    );
    const reloadDetail = extractTail(reloadResult.stderr || reloadResult.stdout) || 'pm2 reload completed';
    target.checks.push(createValidationCheck('pm2 reload', {
      status: reloadResult.status === 0 ? 'pass' : 'failed',
      detail: reloadDetail,
      data: {
        profile: plan.profile,
        configPath: plan.pm2ConfigPath,
      },
    }));
    if (reloadResult.status !== 0) {
      target.errors.push(`[pm2 reload] ${reloadDetail}`);
    }
  } else {
    target.checks.push(createValidationCheck('pm2 reload', {
      status: 'skipped',
      detail: 'skipped by --skip-reload',
      data: {
        profile: plan.profile,
        configPath: plan.pm2ConfigPath,
      },
    }));
  }

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  const pm2ListResult = runPm2Command(['jlist'], { runner });
  const pm2List = parseJsonOutput(pm2ListResult.stdout);
  if (!Array.isArray(pm2List)) {
    const detail = extractTail(pm2ListResult.stderr || pm2ListResult.stdout)
      || 'pm2 jlist did not return JSON';
    target.checks.push(createValidationCheck('pm2 jlist', {
      status: 'failed',
      detail,
    }));
    target.errors.push(`[pm2 jlist] ${detail}`);
  } else {
    target.checks.push(createValidationCheck('pm2 jlist', {
      status: pm2ListResult.status === 0 ? 'pass' : 'warning',
      detail: `entries=${pm2List.length}`,
    }));
    const validation = validatePm2ProcessSnapshot(pm2List, plan);
    target.checks.push(...validation.checks);
    target.warnings.push(...validation.warnings);
    target.errors.push(...validation.errors);
  }

  const persistenceResult = runNodeScript(
    'scripts/persistence-production-smoke.js',
    ['--json'],
    { runner },
  );
  pushJsonCommandResult(
    target,
    'persistence smoke',
    persistenceResult,
    parseJsonOutput(persistenceResult.stdout),
  );

  const machineValidationResult = runNodeScript(
    'scripts/machine-validation.js',
    ['--role', plan.machineValidationRole, '--production', '--json'],
    { runner },
  );
  pushJsonCommandResult(
    target,
    'machine validation',
    machineValidationResult,
    parseJsonOutput(machineValidationResult.stdout),
  );

  if (plan.includePostDeploySmoke) {
    const postDeployResult = runNodeScript(
      'scripts/post-deploy-smoke.js',
      ['--json'],
      { runner },
    );
    pushJsonCommandResult(
      target,
      'post-deploy smoke',
      postDeployResult,
      parseJsonOutput(postDeployResult.stdout),
    );
  } else {
    target.checks.push(createValidationCheck('post-deploy smoke', {
      status: 'skipped',
      detail: `not required for profile ${plan.profile}`,
    }));
  }

  return createValidationReport({
    kind: 'pm2-post-reload-smoke',
    checks: target.checks,
    warnings: target.warnings,
    errors: target.errors,
    data: {
      profile: plan.profile,
      pm2ConfigPath: plan.pm2ConfigPath,
      expectedApps: plan.expectedApps,
      skipReload: options.skipReload === true,
      waitMs,
    },
  });
}

function printTextReport(report) {
  console.log(`[pm2-post-reload-smoke] profile=${report.data.profile}`);
  console.log(`[pm2-post-reload-smoke] status=${report.status}`);
  console.log(`[pm2-post-reload-smoke] summary=${report.summary}`);
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildPm2PostReloadSmokeReport(options);
  if (options.asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }
  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const report = createValidationReport({
      kind: 'pm2-post-reload-smoke',
      checks: [
        createValidationCheck('pm2 post-reload smoke bootstrap', {
          status: 'failed',
          detail: error?.message || String(error),
        }),
      ],
      errors: [error?.message || String(error)],
    });
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.error(`[pm2-post-reload-smoke] FAILED: ${error?.message || String(error)}`);
    }
    process.exit(1);
  });
}

module.exports = {
  PROFILE_DEFINITIONS,
  REQUIRED_PM2_ENV,
  buildPm2PostReloadSmokeReport,
  buildProfilePlan,
  normalizeProfile,
  parseArgs,
  parseJsonOutput,
  validatePm2ProcessSnapshot,
};
