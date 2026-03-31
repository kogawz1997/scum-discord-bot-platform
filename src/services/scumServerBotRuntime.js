'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { executeCommandTemplate } = require('../utils/commandTemplate');
const { createPlatformAgentPresenceService } = require('./platformAgentPresenceService');
const { startRuntimeHealthServer } = require('./runtimeHealthServer');
const {
  getConfigFileDefinitions,
  getConfigSettingDefinitions,
  findConfigSettingDefinition,
  serializeSettingValue,
} = require('./serverBotConfigSchemaService');
const {
  listIniSettings,
  parseIniContent,
  readIniValue,
  patchIniContent,
  parseLineListContent,
  serializeLineListContent,
} = require('./serverBotIniService');

function trimText(value, maxLen = 600) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function asInt(value, fallback, minValue = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minValue, Math.trunc(numeric));
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeTextFileAtomic(targetPath, content) {
  const tempPath = `${targetPath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function copyFileAtomic(sourcePath, targetPath) {
  const tempPath = `${targetPath}.tmp`;
  fs.copyFileSync(sourcePath, tempPath);
  fs.renameSync(tempPath, targetPath);
}

function buildFilePathMap(configRoot) {
  return Object.fromEntries(
    getConfigFileDefinitions().map((definition) => [
      definition.file,
      path.join(configRoot, definition.file),
    ]),
  );
}

function compareLineLists(left, right) {
  const normalizedLeft = Array.isArray(left) ? left.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  const normalizedRight = Array.isArray(right) ? right.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((entry, index) => entry === normalizedRight[index]);
}

function buildKnownSettingKey(file, section, key) {
  return [
    trimText(file, 200).toLowerCase(),
    trimText(section, 160).toLowerCase(),
    trimText(key, 160).toLowerCase(),
  ].join('::');
}

function inferBooleanKey(key) {
  return /^(allow|enable|enabled|disable|disabled|is|has|use|can)/i.test(trimText(key, 160));
}

function inferSnapshotSettingType(rawValue, key) {
  const text = trimText(rawValue ?? '', 4000);
  const normalized = text.toLowerCase();
  if (['true', 'false', 'yes', 'no', 'on', 'off', 'enabled', 'disabled'].includes(normalized)) {
    return 'boolean';
  }
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    if ((text === '0' || text === '1') && inferBooleanKey(key)) {
      return 'boolean';
    }
    return 'number';
  }
  return 'string';
}

function verifyConfigFileUpdate(filePath, fileDefinition, fileChanges = []) {
  const definition = fileDefinition && typeof fileDefinition === 'object'
    ? fileDefinition
    : { parseMode: 'ini' };
  const content = readTextFile(filePath);
  if (String(definition.parseMode || 'ini') === 'line-list') {
    const expectedEntries = Array.isArray(fileChanges?.[0]?.value) ? fileChanges[0].value : [];
    const actualEntries = parseLineListContent(content);
    if (!compareLineLists(expectedEntries, actualEntries)) {
      throw new Error(`config-verification-failed:${path.basename(filePath)}`);
    }
    return;
  }

  const parsed = parseIniContent(content);
  for (const change of Array.isArray(fileChanges) ? fileChanges : []) {
    const settingDefinition = findConfigSettingDefinition(change);
    const expectedValue = settingDefinition
      ? serializeSettingValue(settingDefinition, change.value)
      : trimText(change.value ?? '', 4000);
    const actualValue = readIniValue(parsed, trimText(change.section, 160), trimText(change.key, 160));
    if (String(actualValue ?? '') !== String(expectedValue ?? '')) {
      throw new Error(`config-verification-failed:${path.basename(filePath)}:${trimText(change.key, 160)}`);
    }
  }
}

function verifyCopiedFileContent(sourcePath, targetPath) {
  if (readTextFile(sourcePath) !== readTextFile(targetPath)) {
    throw new Error(`rollback-verification-failed:${path.basename(targetPath)}`);
  }
}

function buildFileSnapshot(fileDefinition, filePath) {
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
  const content = readTextFile(filePath);
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
  const knownDefinitions = getConfigSettingDefinitions()
    .filter((definition) => definition.file === fileDefinition.file);
  const knownSettingKeys = new Set(knownDefinitions.map((definition) => buildKnownSettingKey(
    definition.file,
    definition.section,
    definition.key,
  )));
  const settings = knownDefinitions
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
  const discoveredSettings = listIniSettings(parsed)
    .filter((setting) => !knownSettingKeys.has(buildKnownSettingKey(
      fileDefinition.file,
      setting.section,
      setting.key,
    )))
    .map((setting) => ({
      file: fileDefinition.file,
      category: '',
      group: setting.section || 'additional',
      section: setting.section,
      key: setting.key,
      value: setting.value,
      rawValue: setting.value,
      defaultValue: null,
      requiresRestart: false,
      visibility: 'advanced',
      type: inferSnapshotSettingType(setting.value, setting.key),
      label: '',
      description: '',
    }));
  return {
    file: fileDefinition.file,
    path: filePath,
    parseMode: 'ini',
    exists: true,
    lastModifiedAt: stat.mtime.toISOString(),
    settings: [...settings, ...discoveredSettings],
    rawEntries: [],
  };
}

function createServerConfigSnapshot(configRoot) {
  const filePathMap = buildFilePathMap(configRoot);
  return {
    status: 'ready',
    collectedAt: new Date().toISOString(),
    files: getConfigFileDefinitions().map((definition) => buildFileSnapshot(definition, filePathMap[definition.file])),
  };
}

async function applyCommandTemplate(template, vars, cwd) {
  const command = trimText(template, 1200);
  if (!command) return { ok: true, skipped: true };
  const result = await executeCommandTemplate(command, vars, {
    cwd,
    timeoutMs: 30000,
  });
  return {
    ok: true,
    result,
  };
}

function startScumServerBotRuntime(options = {}) {
  const env = options.env || process.env;
  const configRoot = trimText(
    env.SCUM_SERVER_CONFIG_ROOT
    || env.SCUM_SERVER_SETTINGS_DIR
    || env.SCUM_SERVER_DIR,
    600,
  );
  const backupRoot = trimText(env.SCUM_SERVER_CONFIG_BACKUP_DIR, 600)
    || path.join(configRoot || process.cwd(), '.control-plane-backups');
  const syncIntervalMs = asInt(env.SCUM_SERVER_CONFIG_SYNC_INTERVAL_MS, 60000, 5000);
  const pollIntervalMs = asInt(env.SCUM_SERVER_CONFIG_JOB_POLL_MS, 15000, 3000);
  const applyTemplate = trimText(env.SCUM_SERVER_APPLY_TEMPLATE, 1200);
  const restartTemplate = trimText(env.SCUM_SERVER_RESTART_TEMPLATE, 1200);
  const startTemplate = trimText(env.SCUM_SERVER_START_TEMPLATE, 1200);
  const stopTemplate = trimText(env.SCUM_SERVER_STOP_TEMPLATE, 1200);
  const healthHost = trimText(env.SCUM_SERVER_BOT_HEALTH_HOST, 120) || '127.0.0.1';
  const healthPort = asInt(env.SCUM_SERVER_BOT_HEALTH_PORT, 0, 0);
  const presence = createPlatformAgentPresenceService({
    env,
    role: 'sync',
    scope: 'sync_only',
    runtimeKey: trimText(env.SCUM_SERVER_BOT_RUNTIME_KEY, 160) || 'scum-server-bot',
    agentId: trimText(env.SCUM_SERVER_BOT_AGENT_ID, 160) || 'scum-server-bot',
    displayName: trimText(env.SCUM_SERVER_BOT_NAME, 160) || 'SCUM Server Bot',
  });

  let syncTimer = null;
  let pollTimer = null;
  let healthServer = null;
  let startedAt = null;
  let ready = false;
  let lastSnapshotAt = null;
  let lastJobPollAt = null;
  let lastJobClaimAt = null;
  let lastJobCompletedAt = null;
  let lastJobStatus = null;
  let lastError = null;

  function getHealthPayload() {
    return {
      ready,
      status: ready ? (lastError ? 'degraded' : 'ready') : 'starting',
      role: 'sync',
      scope: 'sync_only',
      configRoot: configRoot || null,
      backupRoot: backupRoot || null,
      startedAt,
      lastSnapshotAt,
      lastJobPollAt,
      lastJobClaimAt,
      lastJobCompletedAt,
      lastJobStatus,
      lastError,
    };
  }

  async function publishSnapshot() {
    if (!configRoot) return { ok: false, error: 'server-config-root-missing' };
    const snapshot = createServerConfigSnapshot(configRoot);
    const result = await presence.uploadServerConfigSnapshot(snapshot);
    if (result?.ok) {
      lastSnapshotAt = new Date().toISOString();
      lastError = null;
    } else if (result?.error) {
      lastError = trimText(result.error, 1000);
    }
    return result;
  }

  async function processJob(job) {
    if (!job || !configRoot) return;
    ensureDirectory(backupRoot);
    const filePathMap = buildFilePathMap(configRoot);
    const vars = {
      configRoot,
      serverId: presence.serverId || '',
      tenantId: presence.tenantId || '',
      serverSettingsFile: filePathMap['ServerSettings.ini'] || '',
    };
    const backups = [];
    try {
      if (job.jobType === 'probe_sync') {
        const syncResult = await presence.postSync({
          syncRunId: `${job.id}-probe`,
          sourceType: 'server-bot-probe',
          sourcePath: configRoot,
          freshnessAt: new Date().toISOString(),
          eventCount: 1,
          events: [
            {
              type: 'server-bot-probe',
              summary: 'Tenant sync probe completed',
              detail: 'Server Bot posted a sync probe through the control plane.',
              runtimeKey: presence.runtimeKey,
              serverId: presence.serverId || null,
              createdAt: new Date().toISOString(),
            },
          ],
          payload: {
            kind: 'probe_sync',
            configRoot,
          },
        });
        if (!syncResult?.ok) {
          throw new Error(trimText(syncResult?.error, 1000) || 'server-bot-sync-probe-failed');
        }
      } else if (job.jobType === 'probe_config_access') {
        createServerConfigSnapshot(configRoot);
      } else if (job.jobType === 'probe_restart') {
        if (!restartTemplate && !applyTemplate) {
          throw new Error('restart-template-missing');
        }
      } else if (job.jobType === 'server_start') {
        if (!startTemplate) {
          throw new Error('server-start-template-missing');
        }
        await applyCommandTemplate(startTemplate, vars, configRoot);
      } else if (job.jobType === 'server_stop') {
        if (!stopTemplate) {
          throw new Error('server-stop-template-missing');
        }
        await applyCommandTemplate(stopTemplate, vars, configRoot);
      } else if (job.jobType === 'rollback') {
        const backup = job.meta && typeof job.meta.backup === 'object' ? job.meta.backup : null;
        if (!backup?.backupPath || !backup?.file) {
          throw new Error('rollback-backup-missing');
        }
        const targetPath = filePathMap[backup.file];
        copyFileAtomic(backup.backupPath, targetPath);
        verifyCopiedFileContent(backup.backupPath, targetPath);
      } else {
        const groupedChanges = new Map();
        for (const change of Array.isArray(job.changes) ? job.changes : []) {
          const file = trimText(change.file, 200);
          if (!file) continue;
          if (!groupedChanges.has(file)) groupedChanges.set(file, []);
          groupedChanges.get(file).push(change);
        }
        for (const [file, fileChanges] of groupedChanges.entries()) {
          const filePath = filePathMap[file];
          const fileDefinition = getConfigFileDefinitions().find((entry) => entry.file === file) || { parseMode: 'ini' };
          if (!filePath || !fs.existsSync(filePath)) {
            throw new Error(`config-file-missing:${file}`);
          }
          const originalContent = readTextFile(filePath);
          const backupPath = path.join(backupRoot, `${Date.now()}-${job.id}-${path.basename(filePath)}.bak`);
          fs.writeFileSync(backupPath, originalContent, 'utf8');
          backups.push({
            file,
            backupPath,
            changeSummary: fileChanges,
          });
          if (String(fileDefinition.parseMode || 'ini') === 'line-list') {
            const nextEntries = Array.isArray(fileChanges[0]?.value) ? fileChanges[0].value : [];
            writeTextFileAtomic(filePath, serializeLineListContent(nextEntries));
            verifyConfigFileUpdate(filePath, fileDefinition, fileChanges);
            continue;
          }
          const patched = patchIniContent(
            originalContent,
            fileChanges.map((change) => ({
              ...change,
              definition: findConfigSettingDefinition(change),
            })),
          );
          writeTextFileAtomic(filePath, patched.content);
          verifyConfigFileUpdate(filePath, fileDefinition, fileChanges);
        }
      }
      if (job.applyMode === 'save_apply') {
        await applyCommandTemplate(applyTemplate, vars, configRoot);
      }
      if (job.applyMode === 'save_restart') {
        await applyCommandTemplate(restartTemplate || applyTemplate, vars, configRoot);
      }
      const snapshot = createServerConfigSnapshot(configRoot);
      const detail = job.jobType === 'probe_sync'
        ? 'Sync probe reached the control plane successfully.'
        : job.jobType === 'probe_config_access'
          ? 'Config files were readable and a fresh snapshot was captured.'
          : job.jobType === 'probe_restart'
            ? 'Restart command template is configured and ready for restart jobs.'
            : job.jobType === 'server_start'
              ? 'Start command finished on the server machine.'
              : job.jobType === 'server_stop'
                ? 'Stop command finished on the server machine.'
                : null;
      await presence.reportServerConfigJobResult({
        jobId: job.id,
        status: 'succeeded',
        backups,
        result: {
          applyMode: job.applyMode,
          jobType: job.jobType,
          detail,
          startConfigured: Boolean(startTemplate),
          stopConfigured: Boolean(stopTemplate),
          restartConfigured: Boolean(restartTemplate || applyTemplate),
        },
        snapshot,
      });
      lastJobCompletedAt = new Date().toISOString();
      lastJobStatus = 'succeeded';
      lastError = null;
    } catch (error) {
      await presence.reportServerConfigJobResult({
        jobId: job.id,
        status: 'failed',
        backups,
        error: trimText(error?.message || error, 1000),
        result: {
          applyMode: job.applyMode,
          jobType: job.jobType,
          startConfigured: Boolean(startTemplate),
          stopConfigured: Boolean(stopTemplate),
          restartConfigured: Boolean(restartTemplate || applyTemplate),
        },
        snapshot: configRoot ? createServerConfigSnapshot(configRoot) : null,
      }).catch(() => null);
      lastJobCompletedAt = new Date().toISOString();
      lastJobStatus = 'failed';
      lastError = trimText(error?.message || error, 1000);
    }
  }

  async function pollJobs() {
    lastJobPollAt = new Date().toISOString();
    const claimed = await presence.claimNextServerConfigJob();
    if (!claimed.ok || !claimed.data) return;
    const job = claimed.data.job || claimed.data;
    if (job) {
      lastJobClaimAt = new Date().toISOString();
      lastJobStatus = 'processing';
      await processJob(job);
    }
  }

  async function start() {
    if (!healthServer && healthPort > 0) {
      healthServer = startRuntimeHealthServer({
        name: 'scum-server-bot',
        host: healthHost,
        port: healthPort,
        getPayload: getHealthPayload,
      });
    }
    if (!configRoot) {
      lastError = 'server-config-root-missing';
      return { ok: false, error: 'server-config-root-missing' };
    }
    ensureDirectory(backupRoot);
    const started = await presence.start({
      getDiagnostics: () => ({
        configRoot,
        backupRoot,
      }),
    });
    if (!started.ok) return started;
    startedAt = new Date().toISOString();
    ready = true;
    lastError = null;
    await publishSnapshot().catch(() => null);
    syncTimer = setInterval(() => {
      void publishSnapshot().catch(() => null);
    }, syncIntervalMs);
    pollTimer = setInterval(() => {
      void pollJobs().catch(() => null);
    }, pollIntervalMs);
    return { ok: true };
  }

  async function close() {
    ready = false;
    if (syncTimer) clearInterval(syncTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (healthServer) {
      await new Promise((resolve) => healthServer.close(resolve));
      healthServer = null;
    }
    await presence.close().catch(() => null);
  }

  return {
    close,
    start,
  };
}

module.exports = {
  compareLineLists,
  createServerConfigSnapshot,
  startScumServerBotRuntime,
  verifyConfigFileUpdate,
  verifyCopiedFileContent,
};
