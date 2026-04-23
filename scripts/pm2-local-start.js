'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pm2LocalConfig = require('../deploy/pm2.local.config.cjs');
const { refreshLocalSqliteArtifacts } = require('./refresh-local-sqlite-artifacts');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PM2_LOCAL_CONFIG_PATH = path.join(PROJECT_ROOT, 'deploy', 'pm2.local.config.cjs');

function getManagedLocalPm2AppNames(config = pm2LocalConfig) {
  return Array.isArray(config?.apps)
    ? config.apps
      .map((app) => String(app?.name || '').trim())
      .filter(Boolean)
    : [];
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && options.allowFailure !== true) {
    throw new Error(String(result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result;
}

function runPm2(args, options = {}) {
  if (process.platform === 'win32') {
    return runCommand('cmd', ['/c', 'pm2', ...args], options);
  }
  return runCommand('pm2', args, options);
}

function listExistingPm2AppNames() {
  const result = runPm2(['jlist'], {
    capture: true,
    allowFailure: true,
  });
  if (result.status !== 0) {
    return [];
  }
  try {
    const rows = JSON.parse(String(result.stdout || '[]'));
    return Array.isArray(rows)
      ? rows.map((row) => String(row?.name || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function pickExistingManagedLocalPm2AppNames(existingNames = [], config = pm2LocalConfig) {
  const known = new Set(existingNames.map((name) => String(name || '').trim()).filter(Boolean));
  return getManagedLocalPm2AppNames(config).filter((name) => known.has(name));
}

function startLocalPm2Profile() {
  const namesToDelete = pickExistingManagedLocalPm2AppNames(listExistingPm2AppNames());
  if (namesToDelete.length > 0) {
    runPm2(['delete', ...namesToDelete], {
      allowFailure: false,
    });
  }
  refreshLocalSqliteArtifacts();
  runPm2(['start', PM2_LOCAL_CONFIG_PATH, '--update-env']);
}

if (require.main === module) {
  startLocalPm2Profile();
}

module.exports = {
  getManagedLocalPm2AppNames,
  listExistingPm2AppNames,
  pickExistingManagedLocalPm2AppNames,
  PM2_LOCAL_CONFIG_PATH,
  startLocalPm2Profile,
};
