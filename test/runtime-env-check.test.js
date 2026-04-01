'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeEnvCheckReport,
  normalizeRole,
  parseArgs,
} = require('../scripts/runtime-env-check');

test('normalizeRole maps runtime aliases', () => {
  assert.equal(normalizeRole('watcher'), 'server-bot');
  assert.equal(normalizeRole('console-agent'), 'delivery-agent');
});

test('parseArgs accepts env file and production flags', () => {
  const parsed = parseArgs([
    '--role=watcher',
    '--env-file',
    '.runtime/server-bot.env',
    '--production',
    '--json',
  ]);

  assert.equal(parsed.role, 'server-bot');
  assert.equal(parsed.envFile, '.runtime/server-bot.env');
  assert.equal(parsed.production, true);
  assert.equal(parsed.asJson, true);
});

test('delivery-agent report fails when platform-managed env is incomplete', () => {
  const report = buildRuntimeEnvCheckReport('delivery-agent', {
    SCUM_CONSOLE_AGENT_TOKEN: 'console-token-123456',
    SCUM_AGENT_ID: 'delivery-agent-main',
    SCUM_AGENT_RUNTIME_KEY: 'delivery-agent-main',
    PLATFORM_AGENT_SETUP_TOKEN: 'stp_example_1234567890',
  });

  assert.equal(report.status, 'failed');
  assert.match(report.errors.join('\n'), /PLATFORM_API_BASE_URL is required/);
  assert.match(report.errors.join('\n'), /PLATFORM_TENANT_ID is required/);
  assert.match(report.errors.join('\n'), /PLATFORM_SERVER_ID is required/);
});

test('server-bot report passes baseline validation for a complete local env bundle', () => {
  const report = buildRuntimeEnvCheckReport('server-bot', {
    PLATFORM_API_BASE_URL: 'http://127.0.0.1:3200',
    PLATFORM_AGENT_TOKEN: 'agent-token-1234567890',
    PLATFORM_TENANT_ID: 'tenant-demo',
    PLATFORM_SERVER_ID: 'server-demo',
    SCUM_SERVER_BOT_AGENT_ID: 'server-bot-main',
    SCUM_SERVER_BOT_RUNTIME_KEY: 'server-bot-main',
    SCUM_SERVER_CONFIG_ROOT: 'C:\\SCUM\\Config',
    SCUM_WATCHER_ENABLED: 'false',
  });

  assert.equal(report.status, 'passed');
  assert.equal(report.errors.length, 0);
});

test('server-bot report warns when watcher or restart template details are still missing', () => {
  const report = buildRuntimeEnvCheckReport('server-bot', {
    PLATFORM_API_BASE_URL: 'http://127.0.0.1:3200',
    PLATFORM_AGENT_TOKEN: 'agent-token-1234567890',
    PLATFORM_TENANT_ID: 'tenant-demo',
    PLATFORM_SERVER_ID: 'server-demo',
    SCUM_SERVER_BOT_AGENT_ID: 'server-bot-main',
    SCUM_SERVER_BOT_RUNTIME_KEY: 'server-bot-main',
    SCUM_SERVER_CONFIG_ROOT: 'C:\\SCUM\\Config',
  });

  assert.equal(report.status, 'passed');
  assert.match(report.warnings.join('\n'), /SCUM_LOG_PATH is empty/);
  assert.match(report.warnings.join('\n'), /SCUM_SERVER_RESTART_TEMPLATE is not set yet/);
});
