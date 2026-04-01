'use strict';

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');
const {
  getDeliveryAgentRuntimeErrors,
  getServerBotRuntimeErrors,
} = require('../src/utils/env');

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const PORTAL_ENV_PATH = path.join(ROOT_DIR, 'apps', 'web-portal-standalone', '.env');

function trimText(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  const normalized = trimText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'watcher' || normalized === 'sync-node') return 'server-bot';
  if (normalized === 'console-agent' || normalized === 'execute-node') return 'delivery-agent';
  return normalized;
}

function printHelpAndExit() {
  console.log('Usage: node scripts/runtime-env-check.js --role <delivery-agent|server-bot> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --role <name>          delivery-agent | server-bot');
  console.log('  --env-file <path>      Load a generated env file before validation');
  console.log('  --production           Apply production-only validation rules too');
  console.log('  --json                 Print JSON report');
  console.log('  --help, -h             Show help');
  process.exit(0);
}

function parseArgs(argv) {
  const options = {
    role: '',
    envFile: '',
    production: false,
    asJson: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = trimText(argv[index]);
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      printHelpAndExit();
    }
    if (arg === '--json') {
      options.asJson = true;
      continue;
    }
    if (arg === '--production') {
      options.production = true;
      continue;
    }
    if (arg === '--role') {
      index += 1;
      options.role = argv[index];
      continue;
    }
    if (arg.startsWith('--role=')) {
      options.role = arg.slice('--role='.length);
      continue;
    }
    if (arg === '--env-file') {
      index += 1;
      options.envFile = argv[index];
      continue;
    }
    if (arg.startsWith('--env-file=')) {
      options.envFile = arg.slice('--env-file='.length);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  const normalizedRole = normalizeRole(options.role);
  if (!normalizedRole || !['delivery-agent', 'server-bot'].includes(normalizedRole)) {
    throw new Error(`Unsupported or missing role: ${options.role || '(empty)'}`);
  }
  options.role = normalizedRole;
  return options;
}

function resolveEnvFilePath(value) {
  const text = trimText(value);
  if (!text) return '';
  if (path.isAbsolute(text)) return text;
  return path.join(ROOT_DIR, text);
}

function loadEnvFromFile(filePath) {
  const resolvedPath = resolveEnvFilePath(filePath);
  if (!resolvedPath) {
    return { filePath: '', values: {} };
  }
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Env file not found: ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return {
    filePath: resolvedPath,
    values: dotenv.parse(raw),
  };
}

function collectBaseErrors(role, env) {
  const errors = [];
  const controlPlaneUrl = trimText(env.PLATFORM_API_BASE_URL || env.SCUM_SYNC_CONTROL_PLANE_URL);
  const setupToken = trimText(env.PLATFORM_AGENT_SETUP_TOKEN || env.SCUM_PLATFORM_SETUP_TOKEN);
  const agentToken = trimText(env.PLATFORM_AGENT_TOKEN || env.SCUM_AGENT_TOKEN || env.SCUM_SYNC_AGENT_TOKEN);
  const tenantId = trimText(env.PLATFORM_TENANT_ID || env.SCUM_TENANT_ID || env.TENANT_ID);
  const serverId = trimText(env.PLATFORM_SERVER_ID || env.SCUM_SERVER_ID);

  if (role === 'delivery-agent') {
    if (!trimText(env.SCUM_CONSOLE_AGENT_TOKEN)) {
      errors.push('SCUM_CONSOLE_AGENT_TOKEN is required.');
    }
    if (!trimText(env.SCUM_AGENT_ID)) {
      errors.push('SCUM_AGENT_ID is required.');
    }
    if (!trimText(env.SCUM_AGENT_RUNTIME_KEY)) {
      errors.push('SCUM_AGENT_RUNTIME_KEY is required.');
    }
    if (setupToken || agentToken || controlPlaneUrl || tenantId || serverId) {
      if (!controlPlaneUrl) {
        errors.push('PLATFORM_API_BASE_URL is required for platform-managed delivery-agent mode.');
      }
      if (!tenantId) {
        errors.push('PLATFORM_TENANT_ID is required for platform-managed delivery-agent mode.');
      }
      if (!serverId) {
        errors.push('PLATFORM_SERVER_ID is required for platform-managed delivery-agent mode.');
      }
      if (!setupToken && !agentToken) {
        errors.push('PLATFORM_AGENT_SETUP_TOKEN or PLATFORM_AGENT_TOKEN is required for platform-managed delivery-agent mode.');
      }
    }
    return errors;
  }

  if (!controlPlaneUrl) {
    errors.push('PLATFORM_API_BASE_URL or SCUM_SYNC_CONTROL_PLANE_URL is required.');
  }
  if (!setupToken && !agentToken) {
    errors.push('PLATFORM_AGENT_SETUP_TOKEN or PLATFORM_AGENT_TOKEN is required.');
  }
  if (!tenantId) {
    errors.push('PLATFORM_TENANT_ID or SCUM_TENANT_ID is required.');
  }
  if (!serverId) {
    errors.push('PLATFORM_SERVER_ID or SCUM_SERVER_ID is required.');
  }
  if (!trimText(env.SCUM_SERVER_BOT_AGENT_ID)) {
    errors.push('SCUM_SERVER_BOT_AGENT_ID is required.');
  }
  if (!trimText(env.SCUM_SERVER_BOT_RUNTIME_KEY)) {
    errors.push('SCUM_SERVER_BOT_RUNTIME_KEY is required.');
  }
  if (!trimText(env.SCUM_SERVER_CONFIG_ROOT || env.SCUM_SERVER_SETTINGS_DIR || env.SCUM_SERVER_DIR)) {
    errors.push('SCUM_SERVER_CONFIG_ROOT is required.');
  }
  return errors;
}

function collectWarnings(role, env) {
  const warnings = [];
  if (role === 'server-bot') {
    if (!trimText(env.SCUM_LOG_PATH) && trimText(env.SCUM_WATCHER_ENABLED).toLowerCase() !== 'false') {
      warnings.push('SCUM_LOG_PATH is empty; watcher/log sync may stay idle until you set the real log path.');
    }
    if (!trimText(env.SCUM_SERVER_RESTART_TEMPLATE)) {
      warnings.push('SCUM_SERVER_RESTART_TEMPLATE is not set yet; restart actions will stay unavailable until you add it.');
    }
  }
  if (role === 'delivery-agent') {
    const backend = trimText(env.SCUM_CONSOLE_AGENT_BACKEND || 'exec').toLowerCase() || 'exec';
    if (backend === 'exec' && !trimText(env.SCUM_CONSOLE_AGENT_EXEC_TEMPLATE)) {
      warnings.push('SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is empty; delivery execution cannot run until you set a command bridge.');
    }
  }
  return warnings;
}

function buildRuntimeEnvCheckReport(role, env, options = {}) {
  const mergedEnv = { ...env };
  mergedEnv.NODE_ENV = options.production ? 'production' : 'development';

  const baseErrors = collectBaseErrors(role, mergedEnv);
  const runtimeErrors = role === 'delivery-agent'
    ? getDeliveryAgentRuntimeErrors(mergedEnv)
    : getServerBotRuntimeErrors(mergedEnv);
  const errors = [...baseErrors, ...runtimeErrors];
  const warnings = collectWarnings(role, mergedEnv);

  return {
    role,
    envFile: options.envFile || '',
    production: options.production === true,
    status: errors.length ? 'failed' : 'passed',
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
}

function formatReport(report) {
  const lines = [];
  lines.push(`Runtime env check: ${report.role}`);
  lines.push(`Status: ${report.status}`);
  if (report.envFile) {
    lines.push(`Env file: ${report.envFile}`);
  }
  lines.push(`Production rules: ${report.production ? 'on' : 'off'}`);
  lines.push('');

  if (report.errors.length) {
    lines.push('Errors:');
    for (const item of report.errors) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push('Errors: none');
  }

  lines.push('');

  if (report.warnings.length) {
    lines.push('Warnings:');
    for (const item of report.warnings) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push('Warnings: none');
  }

  return lines.join('\n');
}

function createEnvForCheck(options) {
  loadMergedEnvFiles({
    basePath: ROOT_ENV_PATH,
    overlayPath: fs.existsSync(PORTAL_ENV_PATH) ? PORTAL_ENV_PATH : null,
    ignoreEmptyOverlay: true,
    overrideExisting: false,
  });
  const envFile = loadEnvFromFile(options.envFile);
  return {
    env: {
      ...process.env,
      ...envFile.values,
    },
    envFilePath: envFile.filePath,
  };
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const prepared = createEnvForCheck(options);
  const report = buildRuntimeEnvCheckReport(options.role, prepared.env, {
    production: options.production,
    envFile: prepared.envFilePath,
  });

  if (options.asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  if (report.status !== 'passed') {
    process.exitCode = 1;
  }
  return report;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  buildRuntimeEnvCheckReport,
  formatReport,
  loadEnvFromFile,
  normalizeRole,
  parseArgs,
  resolveEnvFilePath,
};
