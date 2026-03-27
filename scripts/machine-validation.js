'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { validateCommandTemplate } = require('../src/utils/commandTemplate');
const {
  getConfigFileDefinitions,
  getConfigSettingDefinitions,
} = require('../src/services/serverBotConfigSchemaService');
const {
  parseIniContent,
  parseLineListContent,
  readIniValue,
} = require('../src/services/serverBotIniService');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');
const {
  classifyRuntimeStatus,
  createValidationCheck,
  createValidationReport,
  summarizeRuntimeReason,
  unwrapRuntimePayload,
} = require('../src/utils/runtimeStatus');

const ROOT_DIR = process.cwd();
const ROOT_ENV_PATH = path.join(ROOT_DIR, '.env');
const PORTAL_ENV_PATH = path.join(
  ROOT_DIR,
  'apps',
  'web-portal-standalone',
  '.env',
);
const DEFAULT_REPORT_DIR = path.join(ROOT_DIR, 'artifacts', 'machine-validation');
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_CHILD_OUTPUT_BYTES = 32 * 1024 * 1024;
const ISSUE_SAMPLE_LIMIT = 8;

loadMergedEnvFiles({
  basePath: ROOT_ENV_PATH,
  overlayPath: fs.existsSync(PORTAL_ENV_PATH) ? PORTAL_ENV_PATH : null,
  ignoreEmptyOverlay: true,
  overrideExisting: false,
});

const ROLE_ALIASES = new Map([
  ['control-plane', 'control-plane'],
  ['machine-a-control-plane', 'control-plane'],
  ['delivery-agent', 'delivery-agent'],
  ['console-agent', 'delivery-agent'],
  ['server-bot', 'server-bot'],
  ['watcher', 'server-bot'],
  ['sync-node', 'server-bot'],
  ['game-node', 'game-node'],
  ['machine-b-game-bot', 'game-node'],
]);

function buildServerConfigFilePathMap(configRoot) {
  return Object.fromEntries(
    getConfigFileDefinitions().map((definition) => [
      definition.file,
      path.join(configRoot, definition.file),
    ]),
  );
}

function buildServerConfigFileSnapshot(fileDefinition, filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) {
    return {
      file: fileDefinition.file,
      path: filePath,
      parseMode: fileDefinition.parseMode || 'ini',
      exists: false,
      settings: [],
      rawEntries: [],
      readError: 'file-missing',
    };
  }

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (String(fileDefinition.parseMode || 'ini') === 'line-list') {
    return {
      file: fileDefinition.file,
      path: filePath,
      parseMode: 'line-list',
      exists: true,
      lastModifiedAt: stat.mtime.toISOString(),
      settings: [],
      rawEntries: parseLineListContent(content),
    };
  }

  const parsed = parseIniContent(content);
  const settings = getConfigSettingDefinitions()
    .filter((definition) => definition.file === fileDefinition.file)
    .map((definition) => ({
      file: definition.file,
      category: definition.category,
      group: definition.group,
      section: definition.section,
      key: definition.key,
      value: readIniValue(parsed, definition.section, definition.key),
      defaultValue: Object.prototype.hasOwnProperty.call(definition, 'defaultValue')
        ? definition.defaultValue
        : null,
      requiresRestart: definition.requiresRestart === true,
      visibility: definition.visibility || 'basic',
    }));

  return {
    file: fileDefinition.file,
    path: filePath,
    parseMode: 'ini',
    exists: true,
    lastModifiedAt: stat.mtime.toISOString(),
    settings,
    rawEntries: [],
  };
}

function createLocalServerConfigSnapshot(configRoot) {
  const filePathMap = buildServerConfigFilePathMap(configRoot);
  return {
    status: 'ready',
    collectedAt: new Date().toISOString(),
    files: getConfigFileDefinitions().map((definition) => (
      buildServerConfigFileSnapshot(definition, filePathMap[definition.file])
    )),
  };
}

function printHelpAndExit() {
  console.log('Usage: node scripts/machine-validation.js [options]');
  console.log('');
  console.log('Role-based validation for running this platform across multiple machines.');
  console.log('');
  console.log('Options:');
  console.log('  --role <name>              control-plane | delivery-agent | server-bot | game-node');
  console.log('  --production               Force NODE_ENV=production for child checks');
  console.log('  --with-delivery-test       Pass through to preflight-prod.js for live test-send');
  console.log('  --skip-preflight           Skip preflight-prod.js for control-plane validation');
  console.log('  --control-plane-url <url>  Override control-plane URL for server-bot reachability checks');
  console.log(`  --report-dir <path>        Where JSON reports are written (default: ${DEFAULT_REPORT_DIR})`);
  console.log(`  --timeout-ms <number>      HTTP timeout for direct endpoint checks (default: ${DEFAULT_TIMEOUT_MS})`);
  console.log('  --json                     Print the final report as JSON');
  console.log('  --help, -h                Show this help');
  process.exit(0);
}

function normalizeRole(value) {
  const normalized = String(value || 'control-plane').trim().toLowerCase();
  return ROLE_ALIASES.get(normalized) || '';
}

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseArgs(argv) {
  const options = {
    role: 'control-plane',
    asJson: false,
    production: false,
    withDeliveryTest: false,
    skipPreflight: false,
    reportDir: DEFAULT_REPORT_DIR,
    controlPlaneUrl: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
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

    if (arg === '--production') {
      options.production = true;
      continue;
    }

    if (arg === '--with-delivery-test') {
      options.withDeliveryTest = true;
      continue;
    }

    if (arg === '--skip-preflight') {
      options.skipPreflight = true;
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

    if (arg === '--report-dir') {
      index += 1;
      options.reportDir = argv[index];
      continue;
    }

    if (arg.startsWith('--report-dir=')) {
      options.reportDir = arg.slice('--report-dir='.length);
      continue;
    }

    if (arg === '--control-plane-url') {
      index += 1;
      options.controlPlaneUrl = argv[index];
      continue;
    }

    if (arg.startsWith('--control-plane-url=')) {
      options.controlPlaneUrl = arg.slice('--control-plane-url='.length);
      continue;
    }

    if (arg === '--timeout-ms') {
      index += 1;
      options.timeoutMs = argv[index];
      continue;
    }

    if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = arg.slice('--timeout-ms='.length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  const normalizedRole = normalizeRole(options.role);
  if (!normalizedRole) {
    throw new Error(`Unsupported role: ${options.role}`);
  }
  options.role = normalizedRole;

  const parsedTimeout = Number(options.timeoutMs);
  options.timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout >= 1000
    ? Math.trunc(parsedTimeout)
    : DEFAULT_TIMEOUT_MS;

  options.reportDir = path.resolve(
    ROOT_DIR,
    String(options.reportDir || DEFAULT_REPORT_DIR).trim() || DEFAULT_REPORT_DIR,
  );
  options.controlPlaneUrl = trimTrailingSlash(options.controlPlaneUrl);

  return options;
}

function envFlag(name, fallback = false, env = process.env) {
  const value = String(env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function readPort(value, fallback = 0) {
  const parsed = Number(String(value == null ? fallback : value).trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeLoopbackHost(host) {
  const text = String(host || '').trim() || '127.0.0.1';
  if (text === '0.0.0.0' || text === '::') return '127.0.0.1';
  return text;
}

function buildHttpBaseUrl(host, port, fallbackPort = 0) {
  const normalizedPort = readPort(port, fallbackPort);
  if (!normalizedPort) return '';
  return `http://${normalizeLoopbackHost(host)}:${normalizedPort}`;
}

function extractTail(text, maxLines = 10) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-maxLines)
    .join(' | ');
}

function buildChildEnv(options) {
  const env = { ...process.env };
  if (options.production) {
    env.NODE_ENV = 'production';
  }
  return env;
}

function addIssues(target, label, items, fieldName) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return;
  const bucket = target[fieldName];
  const limit = Math.min(list.length, ISSUE_SAMPLE_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    bucket.push(`[${label}] ${String(list[index] || '').trim()}`);
  }
  if (list.length > ISSUE_SAMPLE_LIMIT) {
    bucket.push(
      `[${label}] ... ${list.length - ISSUE_SAMPLE_LIMIT} more ${fieldName === 'errors' ? 'errors' : 'warnings'}`,
    );
  }
}

function createAccumulator(context) {
  return {
    context,
    checks: [],
    warnings: [],
    errors: [],
  };
}

function pushCheck(target, name, options = {}) {
  target.checks.push(createValidationCheck(name, options));
}

function runNodeScript(scriptRelativePath, scriptArgs, options = {}) {
  const scriptPath = path.join(ROOT_DIR, scriptRelativePath);
  return spawnSync(process.execPath, [scriptPath, ...(scriptArgs || [])], {
    cwd: ROOT_DIR,
    env: buildChildEnv(options),
    shell: false,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: MAX_CHILD_OUTPUT_BYTES,
  });
}

function parseJsonOutput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function mergeChildReport(target, label, result, report) {
  pushCheck(target, label, {
    status: report?.status || (result.status === 0 ? 'pass' : 'failed'),
    detail: report?.summary || extractTail(result.stderr || result.stdout) || 'check completed',
    data: report && typeof report === 'object'
      ? {
          kind: report.kind,
          summary: report.summary,
          status: report.status,
        }
      : undefined,
  });
  if (report && typeof report === 'object') {
    addIssues(target, label, report.warnings, 'warnings');
    addIssues(target, label, report.errors, 'errors');
  } else if (result.status !== 0) {
    target.errors.push(`[${label}] ${extractTail(result.stderr || result.stdout) || `exit code ${result.status || 1}`}`);
  }
}

function runChildJsonCheck(target, label, scriptRelativePath, scriptArgs, options = {}) {
  const result = runNodeScript(
    scriptRelativePath,
    [...(scriptArgs || []), '--json'],
    options,
  );
  const report = parseJsonOutput(result.stdout);

  if (!report) {
    pushCheck(target, label, {
      status: result.status === 0 ? 'warning' : 'failed',
      detail: extractTail(result.stderr || result.stdout) || 'child script did not emit JSON',
    });
    if (result.status !== 0) {
      target.errors.push(
        `[${label}] ${extractTail(result.stderr || result.stdout) || `exit code ${result.status || 1}`}`,
      );
    } else {
      target.warnings.push(`[${label}] child script did not emit JSON report`);
    }
    return null;
  }

  mergeChildReport(target, label, result, report);
  return report;
}

function runChildTextCheck(target, label, scriptRelativePath, scriptArgs, options = {}) {
  const result = runNodeScript(scriptRelativePath, scriptArgs, options);
  const detail = extractTail(result.stderr || result.stdout) || 'check completed';
  pushCheck(target, label, {
    status: result.status === 0 ? 'pass' : 'failed',
    detail,
  });
  if (result.status !== 0) {
    target.errors.push(`[${label}] ${detail}`);
  }
  return result;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  );
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
      redirect: 'manual',
    });
    const text = await response.text();
    const payload = parseJsonOutput(text);
    return {
      ok: response.ok,
      status: response.status,
      payload,
      text,
    };
  } catch (error) {
    const timeoutMs = Math.max(
      1000,
      Number(options.timeoutMs || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    );
    const message = error?.name === 'AbortError'
      ? `request timed out after ${timeoutMs}ms`
      : (error?.message || String(error));
    return {
      ok: false,
      status: 0,
      error: message,
      payload: null,
      text: '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveConsoleAgentBaseUrl(env = process.env) {
  const localUrl = buildHttpBaseUrl(
    env.SCUM_CONSOLE_AGENT_HOST || '127.0.0.1',
    env.SCUM_CONSOLE_AGENT_PORT || 0,
    0,
  );
  return trimTrailingSlash(localUrl || env.SCUM_CONSOLE_AGENT_BASE_URL || '');
}

function resolveWatcherHealthBaseUrl(env = process.env) {
  return trimTrailingSlash(
    buildHttpBaseUrl(
      env.SCUM_WATCHER_HEALTH_HOST || '127.0.0.1',
      env.SCUM_WATCHER_HEALTH_PORT || 0,
      0,
    ),
  );
}

function resolveServerConfigRoot(env = process.env) {
  return String(
    env.SCUM_SERVER_CONFIG_ROOT
      || env.SCUM_SERVER_SETTINGS_DIR
      || env.SCUM_SERVER_DIR
      || '',
  ).trim();
}

function resolveServerConfigBackupRoot(env = process.env) {
  const configured = String(env.SCUM_SERVER_CONFIG_BACKUP_DIR || '').trim();
  if (configured) return configured;
  const configRoot = resolveServerConfigRoot(env);
  return configRoot ? path.join(configRoot, '.control-plane-backups') : '';
}

function resolveWatcherEnabledLocally(env = process.env) {
  const explicit = String(env.SCUM_WATCHER_ENABLED || '').trim();
  if (explicit) {
    return envFlag('SCUM_WATCHER_ENABLED', false, env);
  }
  return String(env.SCUM_LOG_PATH || '').trim().length > 0;
}

function resolveConfiguredControlPlaneBaseUrl(env = process.env) {
  return trimTrailingSlash(
    env.SCUM_SYNC_CONTROL_PLANE_URL
      || env.PLATFORM_API_BASE_URL
      || env.ADMIN_WEB_BASE_URL
      || '',
  );
}

function resolvePlatformAgentIdentity(env = process.env) {
  return {
    tenantId: String(
      env.SCUM_TENANT_ID
        || env.TENANT_ID
        || env.PLATFORM_TENANT_ID
        || '',
    ).trim(),
    serverId: String(
      env.SCUM_SERVER_ID
        || env.PLATFORM_SERVER_ID
        || '',
    ).trim(),
    token: String(
      env.PLATFORM_AGENT_TOKEN
        || env.SCUM_SYNC_AGENT_TOKEN
        || env.SCUM_AGENT_TOKEN
        || '',
    ).trim(),
    setupToken: String(
      env.PLATFORM_AGENT_SETUP_TOKEN
        || env.SCUM_PLATFORM_SETUP_TOKEN
        || '',
    ).trim(),
  };
}

async function checkHealthEndpoint(target, name, baseUrl, options = {}) {
  if (!baseUrl) {
    pushCheck(target, name, {
      status: options.required === false ? 'skipped' : 'failed',
      detail: 'endpoint URL is not configured',
    });
    if (options.required !== false) {
      target.errors.push(`[${name}] endpoint URL is not configured`);
    }
    return null;
  }

  const url = `${trimTrailingSlash(baseUrl)}/healthz`;
  const result = await fetchJson(url, { timeoutMs: options.timeoutMs });
  if (result.error) {
    pushCheck(target, name, {
      status: options.required === false ? 'warning' : 'failed',
      detail: result.error,
    });
    if (options.required === false) {
      target.warnings.push(`[${name}] ${result.error}`);
    } else {
      target.errors.push(`[${name}] ${result.error}`);
    }
    return null;
  }
  if (result.status !== 200 || !result.payload || result.payload.ok !== true) {
    const detail = `HTTP ${result.status || 0}${result.payload?.error ? `: ${result.payload.error}` : ''}`;
    pushCheck(target, name, {
      status: options.required === false ? 'warning' : 'failed',
      detail,
    });
    if (options.required === false) {
      target.warnings.push(`[${name}] ${detail}`);
    } else {
      target.errors.push(`[${name}] ${detail}`);
    }
    return null;
  }

  const classification = classifyRuntimeStatus(result.payload, {
    required: options.required !== false,
    allowDisabled: options.allowDisabled === true,
    requireDiscordReady: options.requireDiscordReady === true,
  });
  let status = classification.ok ? 'pass' : 'failed';
  if (classification.state === 'disabled') {
    status = options.allowDisabled === true ? 'warning' : 'failed';
  } else if (options.required === false && !classification.ok) {
    status = 'warning';
  }

  const reason = summarizeRuntimeReason(result.payload);
  const detailParts = [
    `url=${url}`,
    `state=${classification.state}`,
  ];
  if (reason) {
    detailParts.push(`reason=${reason}`);
  }
  pushCheck(target, name, {
    status,
    detail: detailParts.join(' | '),
  });

  if (status === 'warning') {
    target.warnings.push(`[${name}] ${detailParts.join(' | ')}`);
  }
  if (status === 'failed') {
    target.errors.push(`[${name}] ${detailParts.join(' | ')}`);
  }

  return result.payload;
}

function addConsoleAgentConfigCheck(target, context) {
  const env = context.env;
  const backend = String(env.SCUM_CONSOLE_AGENT_BACKEND || 'exec').trim().toLowerCase() || 'exec';
  const token = String(env.SCUM_CONSOLE_AGENT_TOKEN || '').trim();
  const baseUrl = resolveConsoleAgentBaseUrl(env);
  const issues = [];
  const warnings = [];

  if (!token) {
    issues.push('SCUM_CONSOLE_AGENT_TOKEN is missing');
  } else if (token.length < 16) {
    warnings.push(`SCUM_CONSOLE_AGENT_TOKEN is shorter than recommended (current=${token.length})`);
  }

  if (!baseUrl) {
    issues.push('SCUM_CONSOLE_AGENT_HOST/PORT or SCUM_CONSOLE_AGENT_BASE_URL must be configured');
  }

  if (backend === 'exec') {
    const template = String(env.SCUM_CONSOLE_AGENT_EXEC_TEMPLATE || '').trim();
    if (!template) {
      issues.push('SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is missing for exec backend');
    } else if (!template.includes('{command}')) {
      issues.push('SCUM_CONSOLE_AGENT_EXEC_TEMPLATE must include {command}');
    } else {
      try {
        validateCommandTemplate(template);
      } catch (error) {
        issues.push(`SCUM_CONSOLE_AGENT_EXEC_TEMPLATE is unsafe: ${error.message}`);
      }
    }
  }

  if (backend === 'process' && envFlag('SCUM_CONSOLE_AGENT_AUTOSTART', false, env)) {
    const serverExe = String(env.SCUM_CONSOLE_AGENT_SERVER_EXE || '').trim();
    if (!serverExe) {
      issues.push('SCUM_CONSOLE_AGENT_SERVER_EXE is required when autostart is enabled');
    } else if (!fs.existsSync(serverExe)) {
      warnings.push(`SCUM_CONSOLE_AGENT_SERVER_EXE does not exist yet: ${serverExe}`);
    }
  }

  if (process.platform !== 'win32') {
    warnings.push('Current host is not Windows; live SCUM client automation is usually expected on Windows');
  }

  pushCheck(target, 'delivery-agent config', {
    status: issues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'pass',
    detail: `backend=${backend}${baseUrl ? ` | baseUrl=${baseUrl}` : ''}`,
  });
  addIssues(target, 'delivery-agent config', warnings, 'warnings');
  addIssues(target, 'delivery-agent config', issues, 'errors');

  return {
    backend,
    baseUrl,
    ok: issues.length === 0,
  };
}

async function addConsoleAgentRuntimeChecks(target, context) {
  const baseUrl = resolveConsoleAgentBaseUrl(context.env);
  const healthPayload = await checkHealthEndpoint(
    target,
    'delivery-agent health',
    baseUrl,
    {
      required: true,
      timeoutMs: context.options.timeoutMs,
    },
  );

  if (!healthPayload) {
    pushCheck(target, 'delivery-agent preflight', {
      status: 'skipped',
      detail: 'skipped because health check did not pass',
    });
    return;
  }

  const preflightUrl = `${trimTrailingSlash(baseUrl)}/preflight`;
  const result = await fetchJson(preflightUrl, {
    timeoutMs: Math.max(context.options.timeoutMs, 12000),
  });

  if (result.error) {
    pushCheck(target, 'delivery-agent preflight', {
      status: 'failed',
      detail: result.error,
    });
    target.errors.push(`[delivery-agent preflight] ${result.error}`);
    return;
  }

  const payload = result.payload || {};
  const ready = payload.ready === true;
  const detailParts = [
    `url=${preflightUrl}`,
    `status=${payload.status || payload.statusCode || result.status}`,
  ];
  if (payload.error || payload.errorCode) {
    detailParts.push(`error=${payload.errorCode || payload.error}`);
  }
  if (!ready && payload.recovery?.hint) {
    detailParts.push(`recovery=${payload.recovery.hint}`);
  }

  pushCheck(target, 'delivery-agent preflight', {
    status:
      result.status === 200 && payload.ok === true && ready
        ? 'pass'
        : 'failed',
    detail: detailParts.join(' | '),
  });

  if (!(result.status === 200 && payload.ok === true && ready)) {
    target.errors.push(`[delivery-agent preflight] ${detailParts.join(' | ')}`);
  }
}

function addServerBotControlPlaneConfigCheck(target, context) {
  const env = context.env;
  const baseUrl = context.options.controlPlaneUrl || resolveConfiguredControlPlaneBaseUrl(env);
  const identity = resolvePlatformAgentIdentity(env);
  const issues = [];
  const warnings = [];

  if (!baseUrl) {
    issues.push('SCUM_SYNC_CONTROL_PLANE_URL or PLATFORM_API_BASE_URL is missing');
  }
  if (!identity.token && !identity.setupToken) {
    issues.push('PLATFORM_AGENT_TOKEN or PLATFORM_AGENT_SETUP_TOKEN is required');
  }
  if (identity.token && identity.token.length < 16) {
    warnings.push(`PLATFORM_AGENT_TOKEN looks short (current=${identity.token.length})`);
  }
  if (identity.setupToken && identity.setupToken.length < 16) {
    warnings.push(`PLATFORM_AGENT_SETUP_TOKEN looks short (current=${identity.setupToken.length})`);
  }
  if (!identity.tenantId) {
    issues.push('SCUM_TENANT_ID / TENANT_ID / PLATFORM_TENANT_ID is missing');
  }
  if (!identity.serverId) {
    issues.push('SCUM_SERVER_ID / PLATFORM_SERVER_ID is missing');
  }

  pushCheck(target, 'server-bot control-plane config', {
    status: issues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'pass',
    detail: `${baseUrl ? `baseUrl=${baseUrl}` : 'baseUrl=missing'} | tenantId=${identity.tenantId || 'missing'} | serverId=${identity.serverId || 'missing'}`,
  });
  addIssues(target, 'server-bot control-plane config', warnings, 'warnings');
  addIssues(target, 'server-bot control-plane config', issues, 'errors');

  return {
    baseUrl,
    ok: issues.length === 0,
  };
}

async function addControlPlaneReachabilityCheck(target, context, baseUrl) {
  if (!baseUrl) {
    pushCheck(target, 'server-bot control-plane reachability', {
      status: 'failed',
      detail: 'control-plane URL is missing',
    });
    target.errors.push('[server-bot control-plane reachability] control-plane URL is missing');
    return;
  }

  const overviewUrl = new URL('/platform/api/v1/public/overview', baseUrl).toString();
  const healthUrl = new URL('/healthz', baseUrl).toString();
  const overviewResult = await fetchJson(overviewUrl, {
    timeoutMs: context.options.timeoutMs,
  });

  if (
    !overviewResult.error
    && overviewResult.status === 200
    && overviewResult.payload
    && overviewResult.payload.ok === true
  ) {
    pushCheck(target, 'server-bot control-plane reachability', {
      status: 'pass',
      detail: `public overview reachable at ${overviewUrl}`,
    });
    return;
  }

  const healthResult = await fetchJson(healthUrl, {
    timeoutMs: context.options.timeoutMs,
  });
  if (
    !healthResult.error
    && healthResult.status === 200
    && healthResult.payload
    && healthResult.payload.ok === true
  ) {
    pushCheck(target, 'server-bot control-plane reachability', {
      status: 'warning',
      detail: `healthz reachable at ${healthUrl} but public overview failed`,
    });
    target.warnings.push(
      `[server-bot control-plane reachability] public overview did not respond cleanly at ${overviewUrl}`,
    );
    return;
  }

  const detail = [
    `overview=${overviewResult.error || `HTTP ${overviewResult.status || 0}`}`,
    `health=${healthResult.error || `HTTP ${healthResult.status || 0}`}`,
  ].join(' | ');
  pushCheck(target, 'server-bot control-plane reachability', {
    status: 'failed',
    detail,
  });
  target.errors.push(`[server-bot control-plane reachability] ${detail}`);
}

function addServerCommandTemplateCheck(target, context) {
  const env = context.env;
  const applyTemplate = String(env.SCUM_SERVER_APPLY_TEMPLATE || '').trim();
  const restartTemplate = String(env.SCUM_SERVER_RESTART_TEMPLATE || '').trim();
  const issues = [];
  const warnings = [];

  if (!applyTemplate) {
    warnings.push('SCUM_SERVER_APPLY_TEMPLATE is empty, so save/apply will not execute host commands');
  } else {
    try {
      validateCommandTemplate(applyTemplate);
    } catch (error) {
      issues.push(`SCUM_SERVER_APPLY_TEMPLATE is unsafe: ${error.message}`);
    }
  }

  if (restartTemplate) {
    try {
      validateCommandTemplate(restartTemplate);
    } catch (error) {
      issues.push(`SCUM_SERVER_RESTART_TEMPLATE is unsafe: ${error.message}`);
    }
  } else if (applyTemplate) {
    warnings.push('SCUM_SERVER_RESTART_TEMPLATE is empty, restart jobs will fall back to apply template');
  }

  pushCheck(target, 'server-bot command templates', {
    status: issues.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'pass',
    detail: `apply=${applyTemplate ? 'configured' : 'missing'} | restart=${restartTemplate ? 'configured' : 'fallback'}`,
  });
  addIssues(target, 'server-bot command templates', warnings, 'warnings');
  addIssues(target, 'server-bot command templates', issues, 'errors');
}

function addServerConfigSnapshotCheck(target, context) {
  const env = context.env;
  const configRoot = resolveServerConfigRoot(env);
  const backupRoot = resolveServerConfigBackupRoot(env);

  if (!configRoot) {
    pushCheck(target, 'server-bot config snapshot', {
      status: 'failed',
      detail: 'SCUM_SERVER_CONFIG_ROOT / SCUM_SERVER_SETTINGS_DIR / SCUM_SERVER_DIR is missing',
    });
    target.errors.push(
      '[server-bot config snapshot] SCUM_SERVER_CONFIG_ROOT / SCUM_SERVER_SETTINGS_DIR / SCUM_SERVER_DIR is missing',
    );
    return;
  }

  if (!fs.existsSync(configRoot)) {
    pushCheck(target, 'server-bot config snapshot', {
      status: 'failed',
      detail: `config root does not exist: ${configRoot}`,
    });
    target.errors.push(`[server-bot config snapshot] config root does not exist: ${configRoot}`);
    return;
  }

  try {
    const snapshot = createLocalServerConfigSnapshot(configRoot);
    const files = Array.isArray(snapshot.files) ? snapshot.files : [];
    const existingFiles = files.filter((entry) => entry.exists === true);
    const missingFiles = files
      .filter((entry) => entry.exists !== true)
      .map((entry) => entry.file);

    let status = 'pass';
    if (existingFiles.length === 0) {
      status = 'failed';
    } else if (missingFiles.length > 0) {
      status = 'warning';
    }

    pushCheck(target, 'server-bot config snapshot', {
      status,
      detail: `configRoot=${configRoot} | files=${existingFiles.length}/${files.length} | backupRoot=${backupRoot || 'unset'}`,
      data: {
        configRoot,
        backupRoot,
        totalFiles: files.length,
        existingFiles: existingFiles.length,
      },
    });

    if (missingFiles.length > 0) {
      addIssues(target, 'server-bot config snapshot', [
        `missing config files: ${missingFiles.join(', ')}`,
      ], 'warnings');
    }
    if (existingFiles.length === 0) {
      target.errors.push('[server-bot config snapshot] no readable config files were found in config root');
    }
  } catch (error) {
    pushCheck(target, 'server-bot config snapshot', {
      status: 'failed',
      detail: error?.message || String(error),
    });
    target.errors.push(`[server-bot config snapshot] ${error?.message || String(error)}`);
  }
}

async function addWatcherRuntimeCheck(target, context) {
  const env = context.env;
  const watcherEnabled = resolveWatcherEnabledLocally(env);
  const logPath = String(env.SCUM_LOG_PATH || '').trim();
  const baseUrl = resolveWatcherHealthBaseUrl(env);

  if (!watcherEnabled) {
    pushCheck(target, 'server-bot watcher health', {
      status: 'warning',
      detail: 'watcher is disabled on this machine',
    });
    target.warnings.push('[server-bot watcher health] watcher is disabled on this machine');
    return;
  }

  if (!baseUrl) {
    pushCheck(target, 'server-bot watcher health', {
      status: 'failed',
      detail: 'SCUM_WATCHER_HEALTH_PORT is missing while watcher is enabled',
    });
    target.errors.push('[server-bot watcher health] SCUM_WATCHER_HEALTH_PORT is missing while watcher is enabled');
    return;
  }

  if (!logPath) {
    pushCheck(target, 'server-bot watcher health', {
      status: 'failed',
      detail: 'SCUM_LOG_PATH is missing while watcher is enabled',
    });
    target.errors.push('[server-bot watcher health] SCUM_LOG_PATH is missing while watcher is enabled');
    return;
  }

  const payload = await checkHealthEndpoint(
    target,
    'server-bot watcher health',
    baseUrl,
    {
      required: true,
      timeoutMs: context.options.timeoutMs,
    },
  );
  if (!payload) return;

  const data = unwrapRuntimePayload(payload);
  if (data.watch?.fileExists === false) {
    target.errors.push('[server-bot watcher health] watcher is running but SCUM.log was not found');
  }
}

async function collectDeliveryAgentChecks(target, context, options = {}) {
  if (options.includeTopology !== false) {
    runChildJsonCheck(
      target,
      'delivery-agent topology',
      'scripts/doctor-topology.js',
      context.isProduction ? ['--production'] : [],
      context.options,
    );
  }
  const config = addConsoleAgentConfigCheck(target, context);
  if (config.ok) {
    await addConsoleAgentRuntimeChecks(target, context);
  } else {
    pushCheck(target, 'delivery-agent preflight', {
      status: 'skipped',
      detail: 'skipped because delivery-agent config is invalid',
    });
  }
}

async function collectServerBotChecks(target, context, options = {}) {
  if (options.includeTopology !== false) {
    runChildJsonCheck(
      target,
      'server-bot topology',
      'scripts/doctor-topology.js',
      context.isProduction ? ['--production'] : [],
      context.options,
    );
  }
  const controlPlane = addServerBotControlPlaneConfigCheck(target, context);
  if (controlPlane.ok) {
    await addControlPlaneReachabilityCheck(target, context, controlPlane.baseUrl);
  } else {
    pushCheck(target, 'server-bot control-plane reachability', {
      status: 'skipped',
      detail: 'skipped because server-bot control-plane config is invalid',
    });
  }
  addServerCommandTemplateCheck(target, context);
  addServerConfigSnapshotCheck(target, context);
  await addWatcherRuntimeCheck(target, context);
}

async function collectControlPlaneChecks(target, context) {
  runChildJsonCheck(
    target,
    'control-plane doctor',
    'scripts/doctor.js',
    [],
    context.options,
  );
  runChildJsonCheck(
    target,
    'control-plane security',
    'scripts/security-check.js',
    [],
    context.options,
  );
  runChildJsonCheck(
    target,
    'control-plane topology',
    'scripts/doctor-topology.js',
    context.isProduction ? ['--production'] : [],
    context.options,
  );
  runChildTextCheck(
    target,
    'control-plane web portal doctor',
    'apps/web-portal-standalone/scripts/doctor.js',
    context.isProduction ? ['--production'] : [],
    context.options,
  );
  runChildJsonCheck(
    target,
    'control-plane readiness gate',
    'scripts/readiness-gate.js',
    context.isProduction ? ['--production'] : [],
    context.options,
  );

  if (context.options.skipPreflight) {
    pushCheck(target, 'control-plane preflight', {
      status: 'skipped',
      detail: 'skipped by --skip-preflight',
    });
    return;
  }

  const preflightArgs = ['--skip-readiness'];
  if (context.options.withDeliveryTest) {
    preflightArgs.push('--with-delivery-test');
  }
  runChildTextCheck(
    target,
    'control-plane preflight',
    'scripts/preflight-prod.js',
    preflightArgs,
    context.options,
  );
}

async function buildRoleReport(context) {
  const target = createAccumulator(context);

  if (context.role === 'control-plane') {
    await collectControlPlaneChecks(target, context);
  } else if (context.role === 'delivery-agent') {
    await collectDeliveryAgentChecks(target, context);
  } else if (context.role === 'server-bot') {
    await collectServerBotChecks(target, context);
  } else if (context.role === 'game-node') {
    runChildJsonCheck(
      target,
      'game-node topology',
      'scripts/doctor-topology.js',
      context.isProduction ? ['--production'] : [],
      context.options,
    );
    await collectDeliveryAgentChecks(target, context, { includeTopology: false });
    await collectServerBotChecks(target, context, { includeTopology: false });
  } else {
    throw new Error(`Unsupported role: ${context.role}`);
  }

  return createValidationReport({
    kind: 'machine-validation',
    checks: target.checks,
    warnings: target.warnings,
    errors: target.errors,
    data: {
      role: context.role,
      nodeEnv: context.nodeEnv,
      cwd: ROOT_DIR,
      machineName: context.machineName,
      hostPlatform: process.platform,
      nodeVersion: process.version,
      controlPlaneUrlOverride: context.options.controlPlaneUrl || null,
    },
  });
}

function writeReportFile(report, context) {
  fs.mkdirSync(context.options.reportDir, { recursive: true });
  const fileName = `${report.data.role}-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(context.options.reportDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return filePath;
}

function printTextReport(report, reportFile) {
  console.log(`[machine-validation] role=${report.data.role}`);
  console.log(`[machine-validation] status=${report.status}`);
  console.log(`[machine-validation] summary=${report.summary}`);
  console.log(`[machine-validation] report=${reportFile}`);

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
  const nodeEnv = options.production
    ? 'production'
    : (String(process.env.NODE_ENV || 'development').trim().toLowerCase() || 'development');
  if (options.production) {
    process.env.NODE_ENV = 'production';
  }

  const context = {
    env: process.env,
    role: options.role,
    options,
    isProduction: nodeEnv === 'production',
    nodeEnv,
    machineName: process.env.COMPUTERNAME || os.hostname(),
  };

  const report = await buildRoleReport(context);
  const reportFile = writeReportFile(report, context);
  report.data.reportFile = reportFile;

  if (options.asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report, reportFile);
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message = error?.message || String(error);
    const report = createValidationReport({
      kind: 'machine-validation',
      checks: [
        createValidationCheck('machine-validation bootstrap', {
          status: 'failed',
          detail: message,
        }),
      ],
      errors: [message],
      data: {
        role: 'unknown',
        machineName: process.env.COMPUTERNAME || os.hostname(),
      },
    });
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.error(`[machine-validation] FAILED: ${message}`);
    }
    process.exit(1);
  });
}

module.exports = {
  buildRoleReport,
  normalizeRole,
  parseArgs,
  resolveConsoleAgentBaseUrl,
  resolveServerConfigRoot,
};
