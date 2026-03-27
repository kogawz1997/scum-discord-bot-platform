'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { executeCommandTemplate } = require('../utils/commandTemplate');
const { createPlatformAgentPresenceService } = require('./platformAgentPresenceService');
const {
  getConfigFileDefinitions,
  getConfigSettingDefinitions,
  findConfigSettingDefinition,
} = require('./serverBotConfigSchemaService');
const {
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

  async function publishSnapshot() {
    if (!configRoot) return { ok: false, error: 'server-config-root-missing' };
    const snapshot = createServerConfigSnapshot(configRoot);
    return presence.uploadServerConfigSnapshot(snapshot);
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
      if (job.jobType === 'rollback') {
        const backup = job.meta && typeof job.meta.backup === 'object' ? job.meta.backup : null;
        if (!backup?.backupPath || !backup?.file) {
          throw new Error('rollback-backup-missing');
        }
        const targetPath = filePathMap[backup.file];
        copyFileAtomic(backup.backupPath, targetPath);
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
        }
      }
      if (job.applyMode === 'save_apply') {
        await applyCommandTemplate(applyTemplate, vars, configRoot);
      }
      if (job.applyMode === 'save_restart') {
        await applyCommandTemplate(restartTemplate || applyTemplate, vars, configRoot);
      }
      const snapshot = createServerConfigSnapshot(configRoot);
      await presence.reportServerConfigJobResult({
        jobId: job.id,
        status: 'succeeded',
        backups,
        result: { applyMode: job.applyMode, jobType: job.jobType },
        snapshot,
      });
    } catch (error) {
      await presence.reportServerConfigJobResult({
        jobId: job.id,
        status: 'failed',
        backups,
        error: trimText(error?.message || error, 1000),
        result: { applyMode: job.applyMode, jobType: job.jobType },
        snapshot: configRoot ? createServerConfigSnapshot(configRoot) : null,
      }).catch(() => null);
    }
  }

  async function pollJobs() {
    const claimed = await presence.claimNextServerConfigJob();
    if (!claimed.ok || !claimed.data) return;
    const job = claimed.data.job || claimed.data;
    if (job) {
      await processJob(job);
    }
  }

  async function start() {
    if (!configRoot) {
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
    if (syncTimer) clearInterval(syncTimer);
    if (pollTimer) clearInterval(pollTimer);
    await presence.close().catch(() => null);
  }

  return {
    close,
    start,
  };
}

module.exports = {
  createServerConfigSnapshot,
  startScumServerBotRuntime,
};
