'use strict';

const { getTenantScopedPrismaClient } = require('../prisma');
const { withTenantDbIsolation } = require('../utils/tenantDbIsolation');
const { createId } = require('../contracts/agent/agentContracts');
const {
  getConfigFileDefinitions,
  getConfigCategoryDefinitions,
  getConfigSettingDefinitions,
  findConfigSettingDefinition,
  normalizeSettingValue,
} = require('./serverBotConfigSchemaService');
const {
  completeRestartPlan,
  recordRestartExecution,
  scheduleRestartPlan,
} = require('./platformRestartOrchestrationService');
const { publishAdminLiveUpdate } = require('./adminLiveBus');

function trimText(value, maxLen = 400) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeTenantId(value) {
  return trimText(value, 160) || null;
}

function normalizeServerId(value) {
  return trimText(value, 160) || null;
}

function normalizeRuntimeKey(value) {
  return trimText(value, 200) || null;
}

function parseJsonObject(value, fallback = {}) {
  if (value == null || String(value).trim() === '') {
    return fallback && typeof fallback === 'object' ? fallback : {};
  }
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return fallback && typeof fallback === 'object' ? fallback : {};
  }
  return fallback && typeof fallback === 'object' ? fallback : {};
}

function parseJsonArray(value) {
  if (value == null || String(value).trim() === '') return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeApplyMode(value, fallback = 'save_only') {
  const normalized = trimText(value, 40).toLowerCase();
  if (['save_only', 'save_apply', 'save_restart'].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeJobStatus(value, fallback = 'queued') {
  const normalized = trimText(value, 40).toLowerCase();
  if (['queued', 'processing', 'succeeded', 'failed', 'cancelled'].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function normalizeQueueJobStatus(value, fallback = 'pending') {
  const normalized = normalizeJobStatus(value, '');
  if (normalized === 'processing') return 'running';
  if (normalized === 'succeeded') return 'done';
  if (normalized === 'failed' || normalized === 'cancelled') return 'failed';
  if (normalized === 'queued') return 'pending';
  return fallback;
}

function expandQueueStatusFilter(value) {
  const normalized = trimText(value, 40).toLowerCase();
  if (normalized === 'pending') return ['queued'];
  if (normalized === 'running') return ['processing'];
  if (normalized === 'done') return ['succeeded'];
  if (normalized === 'failed') return ['failed', 'cancelled'];
  return [];
}

function isRetryableJobStatus(value) {
  const normalized = normalizeJobStatus(value, '');
  return normalized === 'failed' || normalized === 'cancelled';
}

function normalizeJobType(value, fallback = 'config_update') {
  const normalized = trimText(value, 60).toLowerCase();
  if ([
    'config_update',
    'apply',
    'rollback',
    'server_start',
    'server_stop',
    'probe_sync',
    'probe_config_access',
    'probe_restart',
  ].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function looksLikeMojibake(text) {
  return /à|Ã|â/.test(String(text || ''));
}

function humanizeIdentifier(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const CATEGORY_LABEL_FALLBACKS = Object.freeze({
  general: 'General',
  world: 'World / Time',
  respawn: 'Respawn',
  vehicles: 'Vehicles',
  damage: 'Damage',
  features: 'Features',
  security: 'Security / Admin',
  events: 'Bunker / Events',
  advanced: 'Advanced',
});

const CATEGORY_DESCRIPTION_FALLBACKS = Object.freeze({
  general: 'Server identity and the first things players see.',
  world: 'Time flow and world pacing.',
  respawn: 'Respawn timing and player return rules.',
  vehicles: 'Vehicle availability and starting conditions.',
  damage: 'Combat damage and survival intensity.',
  features: 'Player-facing gameplay options.',
  security: 'Admin access and protected lists.',
  events: 'Bunkers and world event controls.',
  advanced: 'Raw sources and technical settings for advanced users.',
});

const FILE_LABEL_FALLBACKS = Object.freeze({
  'ServerSettings.ini': 'Server Settings',
  'AdminUsers.ini': 'Admin Users',
  'BannedUsers.ini': 'Banned Users',
});

function normalizeCategoryKey(value) {
  return trimText(value, 120).toLowerCase();
}

function sanitizeDisplayText(value, fallback = '') {
  const text = trimText(value, 500);
  if (!text || looksLikeMojibake(text)) return fallback;
  return text;
}

function getCategoryDisplay(definition = {}) {
  const key = trimText(definition.key, 120).toLowerCase();
  return {
    key,
    label: sanitizeDisplayText(definition.label, CATEGORY_LABEL_FALLBACKS[key] || humanizeIdentifier(key)),
    description: sanitizeDisplayText(
      definition.description,
      CATEGORY_DESCRIPTION_FALLBACKS[key] || '',
    ),
    labelKey: trimText(definition.labelKey, 240) || null,
    descriptionKey: trimText(definition.descriptionKey, 240) || null,
  };
}

function getFileDisplay(definition = {}) {
  const file = trimText(definition.file, 200);
  return {
    file,
    label: sanitizeDisplayText(definition.label, FILE_LABEL_FALLBACKS[file] || file),
    description: sanitizeDisplayText(definition.description, ''),
    labelKey: trimText(definition.labelKey, 240) || null,
    descriptionKey: trimText(definition.descriptionKey, 240) || null,
    parseMode: trimText(definition.parseMode, 60) || 'ini',
  };
}

function getSettingDisplay(definition = {}) {
  const key = trimText(definition.key, 160);
  return {
    label: sanitizeDisplayText(definition.label, humanizeIdentifier(key)),
    description: sanitizeDisplayText(definition.description, ''),
    labelKey: trimText(definition.labelKey, 240) || null,
    descriptionKey: trimText(definition.descriptionKey, 240) || null,
  };
}

function buildSettingRow(definition, currentValue, options = {}) {
  const display = getSettingDisplay(definition);
  const categoryDisplay = getCategoryDisplay({ key: definition.category });
  return {
    id: trimText(definition.id, 200),
    file: trimText(definition.file, 200),
    category: trimText(definition.category, 120),
    categoryLabel: categoryDisplay.label,
    group: trimText(definition.group, 120) || 'general',
    groupLabel: humanizeIdentifier(definition.group || 'general'),
    section: trimText(definition.section, 120) || '',
    key: trimText(definition.key, 160),
    label: display.label,
    labelKey: display.labelKey,
    description: display.description,
    descriptionKey: display.descriptionKey,
    type: trimText(definition.type, 40) || 'string',
    value: currentValue,
    currentValue,
    defaultValue: Object.prototype.hasOwnProperty.call(definition, 'defaultValue')
      ? definition.defaultValue
      : null,
    min: Number.isFinite(Number(definition.min)) ? Number(definition.min) : null,
    max: Number.isFinite(Number(definition.max)) ? Number(definition.max) : null,
    options: Array.isArray(definition.options) ? definition.options.map((entry) => ({ ...entry })) : [],
    requiresRestart: definition.requiresRestart === true,
    visibility: trimText(definition.visibility, 40) || 'basic',
    sourceFileLabel: options.sourceFileLabel || FILE_LABEL_FALLBACKS[definition.file] || definition.file,
    hasCurrentValue: options.hasCurrentValue === true,
  };
}

function inferSnapshotSettingType(setting = {}) {
  const explicitType = trimText(setting.type, 40).toLowerCase();
  if (['boolean', 'number', 'select', 'string'].includes(explicitType)) {
    return explicitType;
  }
  const raw = trimText(
    Object.prototype.hasOwnProperty.call(setting, 'rawValue') ? setting.rawValue : setting.value,
    4000,
  );
  const normalized = raw.toLowerCase();
  if (['true', 'false', 'yes', 'no', 'on', 'off', 'enabled', 'disabled'].includes(normalized)) {
    return 'boolean';
  }
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    if ((raw === '0' || raw === '1') && /^(allow|enable|enabled|disable|disabled|is|has|use|can)/i.test(trimText(setting.key, 160))) {
      return 'boolean';
    }
    return 'number';
  }
  return 'string';
}

function buildDynamicCategoryDisplay(categoryKey, sectionName = '') {
  const normalizedCategoryKey = normalizeCategoryKey(categoryKey) || 'advanced';
  const title = trimText(sectionName, 120) || normalizedCategoryKey;
  return {
    key: normalizedCategoryKey,
    label: humanizeIdentifier(title),
    description: sectionName
      ? `Discovered from the ${trimText(sectionName, 120)} section of the live server config.`
      : 'Discovered from the live server config snapshot.',
    labelKey: null,
    descriptionKey: null,
  };
}

function deriveSnapshotCategoryKey(setting = {}, categoryMap = new Map()) {
  const declaredCategory = normalizeCategoryKey(setting.category);
  if (declaredCategory) return declaredCategory;
  const sectionCategory = normalizeCategoryKey(setting.section);
  if (sectionCategory && categoryMap.has(sectionCategory)) return sectionCategory;
  return sectionCategory || 'advanced';
}

function buildDiscoveredSettingRow(snapshotSetting = {}, options = {}) {
  const file = trimText(snapshotSetting.file, 200);
  const section = trimText(snapshotSetting.section, 160);
  const key = trimText(snapshotSetting.key, 160);
  const type = inferSnapshotSettingType(snapshotSetting);
  const value = Object.prototype.hasOwnProperty.call(snapshotSetting, 'value')
    ? snapshotSetting.value
    : snapshotSetting.rawValue;
  const id = trimText(snapshotSetting.id, 200)
    || `snapshot.${file}.${section}.${key}`.replace(/[^\w.-]+/g, '_');
  return {
    id,
    file,
    category: normalizeCategoryKey(options.categoryKey || snapshotSetting.category || section) || 'advanced',
    categoryLabel: humanizeIdentifier(trimText(options.categoryKey || snapshotSetting.category || section, 120) || 'advanced'),
    group: trimText(snapshotSetting.group, 120) || normalizeCategoryKey(section) || 'additional',
    groupLabel: humanizeIdentifier(trimText(snapshotSetting.group, 120) || section || 'additional'),
    section,
    key,
    label: sanitizeDisplayText(snapshotSetting.label, humanizeIdentifier(key)),
    labelKey: trimText(snapshotSetting.labelKey, 240) || null,
    description: sanitizeDisplayText(
      snapshotSetting.description,
      section ? `Discovered from the live ${section} section.` : 'Discovered from the live server config.',
    ),
    descriptionKey: trimText(snapshotSetting.descriptionKey, 240) || null,
    type,
    value,
    currentValue: value,
    defaultValue: Object.prototype.hasOwnProperty.call(snapshotSetting, 'defaultValue')
      ? snapshotSetting.defaultValue
      : null,
    min: Number.isFinite(Number(snapshotSetting.min)) ? Number(snapshotSetting.min) : null,
    max: Number.isFinite(Number(snapshotSetting.max)) ? Number(snapshotSetting.max) : null,
    options: Array.isArray(snapshotSetting.options) ? snapshotSetting.options.map((entry) => ({ ...entry })) : [],
    requiresRestart: snapshotSetting.requiresRestart === true,
    visibility: trimText(snapshotSetting.visibility, 40) || 'advanced',
    sourceFileLabel: options.sourceFileLabel || FILE_LABEL_FALLBACKS[file] || file,
    hasCurrentValue: Object.prototype.hasOwnProperty.call(snapshotSetting, 'value')
      || Object.prototype.hasOwnProperty.call(snapshotSetting, 'rawValue'),
  };
}

function buildSnapshotSettingKey(file, section, key) {
  return [
    trimText(file, 200).toLowerCase(),
    trimText(section, 160).toLowerCase(),
    trimText(key, 160).toLowerCase(),
  ].join('::');
}

function buildSnapshotIndex(snapshot) {
  const files = Array.isArray(snapshot?.files) ? snapshot.files : [];
  const settingIndex = new Map();
  for (const file of files) {
    const fileName = trimText(file?.file, 200);
    const settings = Array.isArray(file?.settings) ? file.settings : [];
    for (const setting of settings) {
      const indexKey = buildSnapshotSettingKey(
        fileName,
        trimText(setting?.section, 160),
        trimText(setting?.key, 160),
      );
      settingIndex.set(indexKey, {
        ...setting,
        file: fileName,
      });
    }
  }
  return {
    files,
    settingIndex,
  };
}

function normalizeSnapshotFile(file = {}) {
  return {
    file: trimText(file.file, 200),
    path: trimText(file.path, 600) || null,
    exists: file.exists !== false,
    parseMode: trimText(file.parseMode, 60) || 'ini',
    lastModifiedAt: trimText(file.lastModifiedAt, 80) || null,
    readError: trimText(file.readError, 500) || null,
    settings: Array.isArray(file.settings)
      ? file.settings.map((setting) => ({
          file: trimText(setting.file || file.file, 200),
          category: trimText(setting.category, 120),
          group: trimText(setting.group, 120),
          section: trimText(setting.section, 160),
          key: trimText(setting.key, 160),
          type: trimText(setting.type, 40) || null,
          value: Object.prototype.hasOwnProperty.call(setting, 'value') ? setting.value : null,
          rawValue: Object.prototype.hasOwnProperty.call(setting, 'rawValue') ? setting.rawValue : null,
          defaultValue: Object.prototype.hasOwnProperty.call(setting, 'defaultValue')
            ? setting.defaultValue
            : null,
          min: Number.isFinite(Number(setting.min)) ? Number(setting.min) : null,
          max: Number.isFinite(Number(setting.max)) ? Number(setting.max) : null,
          options: Array.isArray(setting.options) ? setting.options.map((entry) => ({ ...entry })) : [],
          requiresRestart: setting.requiresRestart === true,
          visibility: trimText(setting.visibility, 40) || 'basic',
          label: trimText(setting.label, 240) || null,
          labelKey: trimText(setting.labelKey, 240) || null,
          description: trimText(setting.description, 600) || null,
          descriptionKey: trimText(setting.descriptionKey, 240) || null,
        }))
      : [],
    rawEntries: Array.isArray(file.rawEntries)
      ? file.rawEntries.map((entry) => trimText(entry, 600)).filter(Boolean)
      : [],
  };
}

function normalizeSnapshotInput(input = {}) {
  return {
    status: trimText(input.status, 40) || 'ready',
    collectedAt: trimText(input.collectedAt, 80) || new Date().toISOString(),
    files: Array.isArray(input.files) ? input.files.map(normalizeSnapshotFile) : [],
    diagnostics: input.diagnostics && typeof input.diagnostics === 'object' && !Array.isArray(input.diagnostics)
      ? input.diagnostics
      : {},
  };
}

function normalizeChangeEntry(change = {}) {
  const file = trimText(change.file, 200);
  const section = trimText(change.section, 160);
  const key = trimText(change.key, 160);
  const definition = findConfigSettingDefinition({ file, section, key });
  const value = definition
    ? normalizeSettingValue(definition, change.value)
    : change.value;
  return {
    file,
    section,
    key,
    value,
    definitionId: trimText(definition?.id, 200) || null,
  };
}

function normalizeJobRow(row) {
  if (!row) return null;
  const status = normalizeJobStatus(row.status, 'queued');
  const jobType = normalizeJobType(row.jobType, 'config_update');
  const applyMode = normalizeApplyMode(row.applyMode, 'save_only');
  return {
    id: trimText(row.id, 160),
    tenantId: normalizeTenantId(row.tenantId) || '',
    serverId: normalizeServerId(row.serverId) || '',
    jobType,
    applyMode,
    status,
    queueStatus: normalizeQueueJobStatus(status, 'pending'),
    requestedBy: trimText(row.requestedBy, 200) || null,
    requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : null,
    claimedByRuntimeKey: normalizeRuntimeKey(row.claimedByRuntimeKey) || null,
    claimedAt: row.claimedAt ? new Date(row.claimedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    changes: parseJsonArray(row.changesJson),
    result: parseJsonObject(row.resultJson, {}),
    error: trimText(row.errorText, 1000) || null,
    meta: parseJsonObject(row.metaJson, {}),
    retryable: isRetryableJobStatus(status),
  };
}

function normalizeJobChangesForKey(changes = []) {
  return (Array.isArray(changes) ? changes : []).map((entry) => ({
    file: trimText(entry?.file, 200) || null,
    section: trimText(entry?.section, 160) || null,
    key: trimText(entry?.key, 160) || null,
    value: Object.prototype.hasOwnProperty.call(entry || {}, 'value') ? entry.value : null,
    definitionId: trimText(entry?.definitionId, 200) || null,
  }));
}

function buildServerConfigJobRequestKey(input = {}) {
  return JSON.stringify({
    jobType: normalizeJobType(input.jobType, 'config_update'),
    applyMode: normalizeApplyMode(input.applyMode, 'save_only'),
    changes: normalizeJobChangesForKey(input.changes),
    backupId: trimText(input.backupId, 160) || null,
    runtimeKey: normalizeRuntimeKey(input.runtimeKey) || null,
    restartMode: trimText(input.restartMode, 80) || null,
    controlMode: trimText(input.controlMode, 80) || null,
    delaySeconds: Number(input.delaySeconds || 0) || 0,
    restartReason: trimText(input.restartReason, 240) || null,
    channel: trimText(input.channel, 120) || null,
    displayName: trimText(input.displayName, 160) || null,
    retryOfJobId: trimText(input.retryOfJobId, 160) || null,
  });
}

function getJobRequestKey(job = {}) {
  return trimText(job?.meta?.requestKey, 4000) || '';
}

function normalizeBackupRow(row) {
  if (!row) return null;
  return {
    id: trimText(row.id, 160),
    tenantId: normalizeTenantId(row.tenantId) || '',
    serverId: normalizeServerId(row.serverId) || '',
    jobId: trimText(row.jobId, 160) || null,
    file: trimText(row.fileName, 200),
    backupPath: trimText(row.backupPath, 800) || null,
    changedBy: trimText(row.changedBy, 200) || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    changeSummary: parseJsonArray(row.changeSummaryJson),
    meta: parseJsonObject(row.metaJson, {}),
  };
}

function getLatestArtifactDateMs(row = {}, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    const date = parseDateValue(row?.[key]);
    if (date) return date.getTime();
  }
  return Number.NEGATIVE_INFINITY;
}

function selectRetentionArtifactIds(rows = [], options = {}) {
  const keepLatest = Math.max(0, Number(options.keepLatest || 0) || 0);
  const cutoffMs = Number.isFinite(options.cutoffMs) ? options.cutoffMs : Number.NaN;
  const dateKeys = Array.isArray(options.dateKeys) ? options.dateKeys : ['createdAt'];
  const allowRow = typeof options.allowRow === 'function' ? options.allowRow : (() => true);
  return (Array.isArray(rows) ? rows : [])
    .slice()
    .sort((left, right) => getLatestArtifactDateMs(right, dateKeys) - getLatestArtifactDateMs(left, dateKeys))
    .filter((row, index) => {
      if (index < keepLatest) return false;
      if (!allowRow(row)) return false;
      if (!Number.isFinite(cutoffMs)) return true;
      return getLatestArtifactDateMs(row, dateKeys) <= cutoffMs;
    })
    .map((row) => trimText(row?.id, 160))
    .filter(Boolean);
}

function normalizeSnapshotRow(row) {
  if (!row) return null;
  const snapshot = normalizeSnapshotInput(parseJsonObject(row.snapshotJson, {}));
  return {
    tenantId: normalizeTenantId(row.tenantId) || '',
    serverId: normalizeServerId(row.serverId) || '',
    runtimeKey: normalizeRuntimeKey(row.runtimeKey) || null,
    status: trimText(row.status, 40) || snapshot.status || 'unknown',
    collectedAt: row.collectedAt ? new Date(row.collectedAt).toISOString() : snapshot.collectedAt || null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    updatedBy: trimText(row.updatedBy, 200) || null,
    lastJobId: trimText(row.lastJobId, 160) || null,
    lastError: trimText(row.lastError, 1000) || null,
    snapshot,
  };
}

function splitIntoGroups(settings = []) {
  const grouped = new Map();
  for (const setting of settings) {
    const groupKey = trimText(setting.group, 120) || 'general';
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: groupKey,
        label: humanizeIdentifier(groupKey),
        settings: [],
      });
    }
    grouped.get(groupKey).settings.push(setting);
  }
  return Array.from(grouped.values());
}

function getServerConfigSnapshotDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformServerConfigSnapshot : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.upsert !== 'function') {
    return null;
  }
  return delegate;
}

function getServerConfigJobDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformServerConfigJob : null;
  if (!delegate || typeof delegate.findUnique !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getServerConfigBackupDelegate(client = null) {
  const delegate = client && typeof client === 'object' ? client.platformServerConfigBackup : null;
  if (!delegate || typeof delegate.findMany !== 'function' || typeof delegate.create !== 'function') {
    return null;
  }
  return delegate;
}

function getServerConfigDelegates(client = null) {
  const snapshot = getServerConfigSnapshotDelegate(client);
  const job = getServerConfigJobDelegate(client);
  const backup = getServerConfigBackupDelegate(client);
  if (!snapshot || !job || !backup) {
    return null;
  }
  return { snapshot, job, backup };
}

function getServerConfigDelegatesOrThrow(client = null) {
  const delegates = getServerConfigDelegates(client);
  if (delegates) return delegates;
  throw new Error('platform-server-config-delegates-unavailable');
}

function buildWorkspaceFromSnapshot(server, snapshotRow, backups = []) {
  const categoryDefinitions = getConfigCategoryDefinitions().map(getCategoryDisplay);
  const snapshotIndex = buildSnapshotIndex(snapshotRow?.snapshot || {});
  const fileDefinitions = getConfigFileDefinitions().map(getFileDisplay);
  const fileLabelMap = new Map(fileDefinitions.map((entry) => [entry.file, entry.label]));
  const settingDefinitions = getConfigSettingDefinitions();
  const categoryMap = new Map(categoryDefinitions.map((category) => [
    category.key,
    { ...category, settings: [] },
  ]));
  const knownSettingKeys = new Set();

  for (const definition of settingDefinitions) {
    const categoryKey = normalizeCategoryKey(definition.category);
    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, { ...buildDynamicCategoryDisplay(categoryKey), settings: [] });
    }
    const snapshotKey = buildSnapshotSettingKey(definition.file, definition.section, definition.key);
    knownSettingKeys.add(snapshotKey);
    const snapshotValue = snapshotIndex.settingIndex.get(snapshotKey);
    const value = snapshotValue
      ? snapshotValue.value
      : Object.prototype.hasOwnProperty.call(definition, 'defaultValue')
        ? definition.defaultValue
        : null;
    categoryMap.get(categoryKey).settings.push(buildSettingRow(definition, value, {
      hasCurrentValue: Boolean(snapshotValue),
      sourceFileLabel: fileLabelMap.get(definition.file) || definition.file,
    }));
  }

  for (const file of snapshotIndex.files) {
    for (const snapshotSetting of Array.isArray(file?.settings) ? file.settings : []) {
      const fileName = trimText(snapshotSetting.file || file.file, 200);
      const section = trimText(snapshotSetting.section, 160);
      const key = trimText(snapshotSetting.key, 160);
      if (!fileName || !key) continue;
      const snapshotKey = buildSnapshotSettingKey(fileName, section, key);
      if (knownSettingKeys.has(snapshotKey)) continue;
      const categoryKey = deriveSnapshotCategoryKey(snapshotSetting, categoryMap);
      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          ...buildDynamicCategoryDisplay(categoryKey, section),
          settings: [],
        });
      }
      categoryMap.get(categoryKey).settings.push(buildDiscoveredSettingRow(snapshotSetting, {
        categoryKey,
        sourceFileLabel: fileLabelMap.get(fileName) || fileName,
      }));
    }
  }

  const categories = Array.from(categoryMap.values()).map((category) => {
    const rows = Array.isArray(category.settings) ? category.settings : [];
    return {
      key: category.key,
      label: category.label,
      description: category.description,
      labelKey: category.labelKey || null,
      descriptionKey: category.descriptionKey || null,
      groups: splitIntoGroups(rows),
      settingCount: rows.length,
    };
  });

  return {
    tenantId: normalizeTenantId(server?.tenantId) || '',
    serverId: normalizeServerId(server?.id) || '',
    server: server ? { ...server } : null,
    snapshotStatus: snapshotRow?.status || 'missing',
    snapshotCollectedAt: snapshotRow?.collectedAt || null,
    snapshotUpdatedAt: snapshotRow?.updatedAt || null,
    snapshotUpdatedBy: snapshotRow?.updatedBy || null,
    lastError: snapshotRow?.lastError || null,
    files: fileDefinitions.map((definition) => {
      const source = snapshotIndex.files.find((entry) => entry.file === definition.file) || null;
      return {
        ...definition,
        exists: source ? source.exists !== false : false,
        path: source?.path || null,
        lastModifiedAt: source?.lastModifiedAt || null,
        readError: source?.readError || null,
        rawEntries: Array.isArray(source?.rawEntries) ? source.rawEntries : [],
      };
    }),
    categories,
    backups,
    advanced: {
      rawSnapshot: snapshotRow?.snapshot || { files: [] },
      hasSnapshot: Boolean(snapshotRow),
    },
  };
}

function createPlatformServerConfigService(deps = {}) {
  const {
    listServerRegistry,
    getTenantScopedPrismaClient: getTenantScopedPrismaClientOverride,
    withTenantDbIsolation: withTenantDbIsolationOverride,
  } = deps;

  async function resolveServer(tenantId, serverId) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedServerId = normalizeServerId(serverId);
    if (!normalizedTenantId || !normalizedServerId) return null;
    const rows = typeof listServerRegistry === 'function'
      ? await listServerRegistry({ tenantId: normalizedTenantId, serverId: normalizedServerId })
      : [];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async function withTenantConfigDb(tenantId, work) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    if (!normalizedTenantId) {
      throw new Error('tenantId is required');
    }
    const resolveTenantScopedDb = typeof getTenantScopedPrismaClientOverride === 'function'
      ? getTenantScopedPrismaClientOverride
      : getTenantScopedPrismaClient;
    const isolateTenantDb = typeof withTenantDbIsolationOverride === 'function'
      ? withTenantDbIsolationOverride
      : withTenantDbIsolation;
    const tenantPrisma = resolveTenantScopedDb(normalizedTenantId);
    return isolateTenantDb(
      tenantPrisma,
      { tenantId: normalizedTenantId, enforce: true },
      work,
    );
  }

  async function ensurePlatformServerConfigTables(db) {
    getServerConfigDelegatesOrThrow(db);
  }

  async function readSnapshotRow(db, serverId) {
    await ensurePlatformServerConfigTables(db);
    const { snapshot } = getServerConfigDelegatesOrThrow(db);
    const row = await snapshot.findUnique({
      where: { serverId },
    });
    return normalizeSnapshotRow(row);
  }

  async function readBackupRows(db, serverId, limit = 20) {
    await ensurePlatformServerConfigTables(db);
    const { backup } = getServerConfigDelegatesOrThrow(db);
    const rows = await backup.findMany({
      where: { serverId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Array.isArray(rows) ? rows.map(normalizeBackupRow).filter(Boolean) : [];
  }

  async function readJobRow(db, jobId) {
    await ensurePlatformServerConfigTables(db);
    const { job } = getServerConfigDelegatesOrThrow(db);
    const row = await job.findUnique({
      where: { id: jobId },
    });
    return normalizeJobRow(row);
  }

  async function readJobRows(db, options = {}) {
    await ensurePlatformServerConfigTables(db);
    const { job } = getServerConfigDelegatesOrThrow(db);
    const serverId = normalizeServerId(options.serverId);
    const jobId = trimText(options.jobId, 160) || null;
    const rawStatus = normalizeJobStatus(options.status, '');
    const queueStatuses = expandQueueStatusFilter(options.queueStatus);
    const rawStatuses = queueStatuses.length
      ? queueStatuses
      : (rawStatus ? [rawStatus] : []);
    const jobType = normalizeJobType(options.jobType, '');
    const limit = Math.max(1, Math.min(100, Number(options.limit || 20) || 20));
    const rows = await job.findMany({
      where: {
        ...(serverId ? { serverId } : {}),
        ...(jobId ? { id: jobId } : {}),
        ...(rawStatuses.length ? { status: { in: rawStatuses } } : {}),
        ...(jobType ? { jobType } : {}),
      },
      orderBy: [
        { requestedAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });
    return Array.isArray(rows) ? rows.map(normalizeJobRow).filter(Boolean) : [];
  }

  async function findReusablePendingJob(db, options = {}) {
    await ensurePlatformServerConfigTables(db);
    const { job } = getServerConfigDelegatesOrThrow(db);
    const serverId = normalizeServerId(options.serverId);
    const jobType = normalizeJobType(options.jobType, '');
    const requestKey = trimText(options.requestKey, 4000);
    if (!serverId || !jobType || !requestKey) return null;
    const rows = await job.findMany({
      where: {
        serverId,
        jobType,
        status: {
          in: ['queued', 'processing'],
        },
      },
      orderBy: [
        { requestedAt: 'desc' },
        { id: 'desc' },
      ],
      take: 25,
    });
    const normalizedRows = Array.isArray(rows) ? rows.map(normalizeJobRow).filter(Boolean) : [];
    return normalizedRows.find((row) => getJobRequestKey(row) === requestKey) || null;
  }

  async function getServerConfigWorkspace(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const serverId = normalizeServerId(options.serverId);
    if (!tenantId || !serverId) {
      throw new Error('tenantId and serverId are required');
    }
    const server = await resolveServer(tenantId, serverId);
    if (!server) {
      const error = new Error('server-not-found');
      error.statusCode = 404;
      throw error;
    }
    return withTenantConfigDb(tenantId, async (db) => {
      const snapshotRow = await readSnapshotRow(db, serverId);
      const backups = await readBackupRows(db, serverId, Math.max(1, Math.min(50, Number(options.limit || 20) || 20)));
      return buildWorkspaceFromSnapshot(server, snapshotRow, backups);
    });
  }

  async function getServerConfigCategory(options = {}) {
    const categoryKey = trimText(options.category, 120).toLowerCase();
    const workspace = await getServerConfigWorkspace(options);
    const category = workspace.categories.find((entry) => entry.key === categoryKey) || null;
    if (!category) {
      const error = new Error('config-category-not-found');
      error.statusCode = 404;
      throw error;
    }
    return {
      ...category,
      serverId: workspace.serverId,
      tenantId: workspace.tenantId,
      snapshotStatus: workspace.snapshotStatus,
      snapshotCollectedAt: workspace.snapshotCollectedAt,
      backups: workspace.backups,
    };
  }

  async function listServerConfigBackups(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const serverId = normalizeServerId(options.serverId);
    if (!tenantId || !serverId) {
      throw new Error('tenantId and serverId are required');
    }
    return withTenantConfigDb(tenantId, (db) => readBackupRows(
      db,
      serverId,
      Math.max(1, Math.min(100, Number(options.limit || 30) || 30)),
    ));
  }

  async function getServerConfigJob(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const serverId = normalizeServerId(options.serverId);
    const jobId = trimText(options.jobId, 160);
    if (!tenantId || !serverId || !jobId) {
      throw new Error('tenantId, serverId, and jobId are required');
    }
    return withTenantConfigDb(tenantId, async (db) => {
      const row = await readJobRow(db, jobId);
      if (!row || row.serverId !== serverId) return null;
      return row;
    });
  }

  async function listServerConfigJobs(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const serverId = normalizeServerId(options.serverId);
    if (!tenantId || !serverId) {
      throw new Error('tenantId and serverId are required');
    }
    return withTenantConfigDb(tenantId, (db) => readJobRows(db, {
      serverId,
      jobId: options.jobId,
      status: options.status,
      queueStatus: options.queueStatus,
      jobType: options.jobType,
      limit: options.limit,
    }));
  }

  async function upsertServerConfigSnapshot(input = {}, actor = 'server-bot') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    if (!tenantId || !serverId) {
      return { ok: false, reason: 'server-config-snapshot-invalid' };
    }
    const server = await resolveServer(tenantId, serverId);
    if (!server) return { ok: false, reason: 'server-not-found' };
    const snapshot = normalizeSnapshotInput(input.snapshot || input);
    const runtimeKey = normalizeRuntimeKey(input.runtimeKey);
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const { snapshot: snapshotDelegate } = getServerConfigDelegatesOrThrow(db);
      await snapshotDelegate.upsert({
        where: { serverId },
        create: {
          serverId,
          tenantId,
          runtimeKey,
          status: snapshot.status || 'ready',
          snapshotJson: JSON.stringify(snapshot),
          collectedAt: snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date(),
          updatedBy: trimText(actor, 200) || 'server-bot',
          lastJobId: trimText(input.lastJobId, 160) || null,
          lastError: trimText(input.lastError, 1000) || null,
        },
        update: {
          tenantId,
          runtimeKey,
          status: snapshot.status || 'ready',
          snapshotJson: JSON.stringify(snapshot),
          collectedAt: snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date(),
          updatedBy: trimText(actor, 200) || 'server-bot',
          lastJobId: trimText(input.lastJobId, 160) || null,
          lastError: trimText(input.lastError, 1000) || null,
        },
      });
      return {
        ok: true,
        snapshot: await readSnapshotRow(db, serverId),
      };
    });
  }

  async function createServerConfigSaveJob(input = {}, actor = 'admin-web') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    if (!tenantId || !serverId) return { ok: false, reason: 'server-config-job-invalid' };
    const server = await resolveServer(tenantId, serverId);
    if (!server) return { ok: false, reason: 'server-not-found' };
    const changes = Array.isArray(input.changes)
      ? input.changes.map(normalizeChangeEntry).filter((entry) => entry.file && entry.key)
      : [];
    if (!changes.length) return { ok: false, reason: 'server-config-job-empty' };
    const applyMode = normalizeApplyMode(input.applyMode, 'save_only');
    const jobId = trimText(input.jobId, 160) || createId('cfgjob');
    const requestedBy = trimText(actor, 200) || 'admin-web';
    const requiresRestart = changes.some((entry) => findConfigSettingDefinition(entry)?.requiresRestart === true);
    const requestKey = buildServerConfigJobRequestKey({
      jobType: 'config_update',
      applyMode,
      changes,
      runtimeKey: input.runtimeKey,
      restartMode: input.restartMode,
      controlMode: input.controlMode,
      delaySeconds: input.delaySeconds,
      restartReason: input.restartReason,
      channel: input.channel,
    });
    const meta = {
      requiresRestart,
      requestedApplyMode: applyMode,
      requestKey,
    };
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const existingJob = await findReusablePendingJob(db, {
        serverId,
        jobType: 'config_update',
        requestKey,
      });
      if (existingJob) {
        return {
          ok: true,
          reused: true,
          job: existingJob,
        };
      }
      if (applyMode === 'save_restart') {
        const restartPlan = await scheduleRestartPlan({
          tenantId,
          serverId,
          guildId: trimText(server.guildId, 160) || null,
          runtimeKey: normalizeRuntimeKey(input.runtimeKey) || null,
          delaySeconds: Number(input.delaySeconds || 0) || 0,
          restartMode: trimText(input.restartMode, 80) || 'safe_restart',
          controlMode: trimText(input.controlMode, 80) || 'service',
          reason: trimText(input.restartReason, 240) || 'config-update',
          channel: trimText(input.channel, 120) || null,
        }, actor).catch(() => null);
        if (restartPlan?.ok) {
          meta.restartPlanId = restartPlan.plan?.id || null;
          meta.restartScheduledFor = restartPlan.plan?.scheduledFor || null;
        }
      }
      const { job: jobDelegate } = getServerConfigDelegatesOrThrow(db);
      await jobDelegate.create({
        data: {
          id: jobId,
          tenantId,
          serverId,
          jobType: 'config_update',
          applyMode,
          status: 'queued',
          requestedBy,
          changesJson: JSON.stringify(changes),
          resultJson: JSON.stringify({}),
          errorText: null,
          metaJson: JSON.stringify(meta),
        },
      });
      return {
        ok: true,
        job: await readJobRow(db, jobId),
      };
    });
  }

  async function createServerConfigApplyJob(input = {}, actor = 'admin-web') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    if (!tenantId || !serverId) return { ok: false, reason: 'server-config-apply-invalid' };
    const server = await resolveServer(tenantId, serverId);
    if (!server) return { ok: false, reason: 'server-not-found' };
    const applyMode = normalizeApplyMode(input.applyMode, 'save_apply');
    const jobId = trimText(input.jobId, 160) || createId('cfgjob');
    const requestKey = buildServerConfigJobRequestKey({
      jobType: 'apply',
      applyMode,
      runtimeKey: input.runtimeKey,
      restartMode: input.restartMode,
      controlMode: input.controlMode,
      delaySeconds: input.delaySeconds,
      restartReason: input.restartReason,
      channel: input.channel,
    });
    const meta = {
      requestedApplyMode: applyMode,
      requestKey,
    };
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const existingJob = await findReusablePendingJob(db, {
        serverId,
        jobType: 'apply',
        requestKey,
      });
      if (existingJob) {
        return {
          ok: true,
          reused: true,
          job: existingJob,
        };
      }
      if (applyMode === 'save_restart') {
        const restartPlan = await scheduleRestartPlan({
          tenantId,
          serverId,
          guildId: trimText(server.guildId, 160) || null,
          runtimeKey: normalizeRuntimeKey(input.runtimeKey) || null,
          delaySeconds: Number(input.delaySeconds || 0) || 0,
          restartMode: trimText(input.restartMode, 80) || 'safe_restart',
          controlMode: trimText(input.controlMode, 80) || 'service',
          reason: trimText(input.restartReason, 240) || 'config-apply',
          channel: trimText(input.channel, 120) || null,
        }, actor).catch(() => null);
        if (restartPlan?.ok) {
          meta.restartPlanId = restartPlan.plan?.id || null;
          meta.restartScheduledFor = restartPlan.plan?.scheduledFor || null;
        }
      }
      const { job: jobDelegate } = getServerConfigDelegatesOrThrow(db);
      await jobDelegate.create({
        data: {
          id: jobId,
          tenantId,
          serverId,
          jobType: 'apply',
          applyMode,
          status: 'queued',
          requestedBy: trimText(actor, 200) || 'admin-web',
          changesJson: JSON.stringify([]),
          resultJson: JSON.stringify({}),
          errorText: null,
          metaJson: JSON.stringify(meta),
        },
      });
      return {
        ok: true,
        job: await readJobRow(db, jobId),
      };
    });
  }

  async function createServerConfigRollbackJob(input = {}, actor = 'admin-web') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    const backupId = trimText(input.backupId, 160);
    if (!tenantId || !serverId || !backupId) return { ok: false, reason: 'server-config-rollback-invalid' };
    const server = await resolveServer(tenantId, serverId);
    if (!server) return { ok: false, reason: 'server-not-found' };
    const applyMode = normalizeApplyMode(input.applyMode, 'save_restart');
    const requestKey = buildServerConfigJobRequestKey({
      jobType: 'rollback',
      applyMode,
      backupId,
      runtimeKey: input.runtimeKey,
      restartMode: input.restartMode,
      controlMode: input.controlMode,
      delaySeconds: input.delaySeconds,
      restartReason: input.restartReason,
      channel: input.channel,
    });
    const rollbackMeta = {
      backupId,
      requestedApplyMode: applyMode,
      requestKey,
    };
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const backups = await readBackupRows(db, serverId, 200);
      const backup = backups.find((entry) => entry.id === backupId) || null;
      if (!backup) return { ok: false, reason: 'server-config-backup-not-found' };
      const existingJob = await findReusablePendingJob(db, {
        serverId,
        jobType: 'rollback',
        requestKey,
      });
      if (existingJob) {
        return {
          ok: true,
          reused: true,
          job: existingJob,
        };
      }
      if (applyMode === 'save_restart') {
        const restartPlan = await scheduleRestartPlan({
          tenantId,
          serverId,
          guildId: trimText(server.guildId, 160) || null,
          runtimeKey: normalizeRuntimeKey(input.runtimeKey) || null,
          delaySeconds: Number(input.delaySeconds || 0) || 0,
          restartMode: trimText(input.restartMode, 80) || 'safe_restart',
          controlMode: trimText(input.controlMode, 80) || 'service',
          reason: trimText(input.restartReason, 240) || 'config-rollback',
          channel: trimText(input.channel, 120) || null,
        }, actor).catch(() => null);
        if (restartPlan?.ok) {
          rollbackMeta.restartPlanId = restartPlan.plan?.id || null;
          rollbackMeta.restartScheduledFor = restartPlan.plan?.scheduledFor || null;
        }
      }
      const jobId = trimText(input.jobId, 160) || createId('cfgjob');
      const { job: jobDelegate } = getServerConfigDelegatesOrThrow(db);
      await jobDelegate.create({
        data: {
          id: jobId,
          tenantId,
          serverId,
          jobType: 'rollback',
          applyMode,
          status: 'queued',
          requestedBy: trimText(actor, 200) || 'admin-web',
          changesJson: JSON.stringify([]),
          resultJson: JSON.stringify({}),
          errorText: null,
          metaJson: JSON.stringify({ ...rollbackMeta, backup }),
        },
      });
      return {
        ok: true,
        job: await readJobRow(db, jobId),
      };
    });
  }

  async function createServerBotActionJob(input = {}, actor = 'admin-web') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    const jobType = normalizeJobType(input.jobType, '');
    if (!tenantId || !serverId || !jobType) {
      return { ok: false, reason: 'server-bot-action-invalid' };
    }
    const server = await resolveServer(tenantId, serverId);
    if (!server) return { ok: false, reason: 'server-not-found' };
    const supportedActions = new Set([
      'server_start',
      'server_stop',
      'probe_sync',
      'probe_config_access',
      'probe_restart',
    ]);
    if (!supportedActions.has(jobType)) {
      return { ok: false, reason: 'server-bot-action-unsupported' };
    }
    const jobId = trimText(input.jobId, 160) || createId('cfgjob');
    const requestKey = buildServerConfigJobRequestKey({
      jobType,
      applyMode: 'save_only',
      runtimeKey: input.runtimeKey,
      displayName: input.displayName,
    });
    const meta = {
      controlAction: jobType,
      requestedApplyMode: 'save_only',
      displayName: trimText(input.displayName, 160) || null,
      requestKey,
    };
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const existingJob = await findReusablePendingJob(db, {
        serverId,
        jobType,
        requestKey,
      });
      if (existingJob) {
        return {
          ok: true,
          reused: true,
          job: existingJob,
        };
      }
      const { job: jobDelegate } = getServerConfigDelegatesOrThrow(db);
      await jobDelegate.create({
        data: {
          id: jobId,
          tenantId,
          serverId,
          jobType,
          applyMode: 'save_only',
          status: 'queued',
          requestedBy: trimText(actor, 200) || 'admin-web',
          changesJson: JSON.stringify([]),
          resultJson: JSON.stringify({}),
          errorText: null,
          metaJson: JSON.stringify({
            ...meta,
            serverName: trimText(server.name, 200) || null,
            runtimeKey: normalizeRuntimeKey(input.runtimeKey) || null,
          }),
        },
      });
      return {
        ok: true,
        job: await readJobRow(db, jobId),
      };
    });
  }

  async function retryServerConfigJob(input = {}, actor = 'admin-web') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    const jobId = trimText(input.jobId, 160);
    if (!tenantId || !serverId || !jobId) {
      return { ok: false, reason: 'server-config-retry-invalid' };
    }
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const sourceJob = await readJobRow(db, jobId);
      if (!sourceJob || sourceJob.serverId !== serverId) {
        return { ok: false, reason: 'server-config-job-not-found' };
      }
      if (!isRetryableJobStatus(sourceJob.status)) {
        return { ok: false, reason: 'server-config-job-not-retryable', job: sourceJob };
      }
      const retryJobId = trimText(input.nextJobId, 160) || createId('cfgjob');
      const requestedBy = trimText(actor, 200) || 'admin-web';
      const priorRetryAttempt = Number(sourceJob?.meta?.retryAttempt || sourceJob?.meta?.retryCount || 0);
      const retryAttempt = Number.isFinite(priorRetryAttempt)
        ? Math.max(1, priorRetryAttempt + 1)
        : 1;
      const requestKey = buildServerConfigJobRequestKey({
        jobType: sourceJob.jobType,
        applyMode: sourceJob.applyMode,
        changes: sourceJob.changes,
        retryOfJobId: sourceJob.id,
      });
      const existingJob = await findReusablePendingJob(db, {
        serverId,
        jobType: sourceJob.jobType,
        requestKey,
      });
      if (existingJob) {
        return {
          ok: true,
          reused: true,
          sourceJob,
          job: existingJob,
        };
      }
      const meta = {
        ...(sourceJob.meta && typeof sourceJob.meta === 'object' && !Array.isArray(sourceJob.meta)
          ? sourceJob.meta
          : {}),
        requestKey,
        retryOfJobId: sourceJob.id,
        retryRequestedBy: requestedBy,
        retryRequestedAt: new Date().toISOString(),
        retryAttempt,
      };
      const { job: jobDelegate } = getServerConfigDelegatesOrThrow(db);
      await jobDelegate.create({
        data: {
          id: retryJobId,
          tenantId,
          serverId,
          jobType: sourceJob.jobType,
          applyMode: sourceJob.applyMode,
          status: 'queued',
          requestedBy,
          changesJson: JSON.stringify(Array.isArray(sourceJob.changes) ? sourceJob.changes : []),
          resultJson: JSON.stringify({}),
          errorText: null,
          metaJson: JSON.stringify(meta),
        },
      });
      return {
        ok: true,
        sourceJob,
        job: await readJobRow(db, retryJobId),
      };
    });
  }

  async function claimNextServerConfigJob(input = {}, actor = 'server-bot') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    const runtimeKey = normalizeRuntimeKey(input.runtimeKey);
    if (!tenantId || !serverId) return { ok: false, reason: 'server-config-claim-invalid' };
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const nextJob = await db.$transaction(async (tx) => {
        const { job: jobDelegate } = getServerConfigDelegatesOrThrow(tx);
        const queuedJob = await jobDelegate.findFirst({
          where: {
            serverId,
            status: 'queued',
          },
          orderBy: {
            requestedAt: 'asc',
          },
        });
        if (!queuedJob) return null;
        return jobDelegate.update({
          where: { id: queuedJob.id },
          data: {
            status: 'processing',
            claimedByRuntimeKey: runtimeKey,
            claimedAt: new Date(),
          },
        });
      });
      if (!nextJob) return { ok: true, job: null };
      return {
        ok: true,
        job: normalizeJobRow(nextJob),
      };
    });
  }

  async function completeServerConfigJob(input = {}, actor = 'server-bot') {
    const tenantId = normalizeTenantId(input.tenantId);
    const serverId = normalizeServerId(input.serverId);
    const jobId = trimText(input.jobId, 160);
    if (!tenantId || !serverId || !jobId) return { ok: false, reason: 'server-config-complete-invalid' };
    const jobStatus = normalizeJobStatus(input.status, 'failed');
    const runtimeKey = normalizeRuntimeKey(input.runtimeKey);
    const result = input.result && typeof input.result === 'object' && !Array.isArray(input.result)
      ? input.result
      : {};
    const snapshotInput = input.snapshot && typeof input.snapshot === 'object' && !Array.isArray(input.snapshot)
      ? input.snapshot
      : null;
    const lastError = trimText(input.error || result.error, 1000) || null;
    const backups = Array.isArray(input.backups)
      ? input.backups.map((entry) => ({
          id: trimText(entry.id, 160) || createId('cfgbak'),
          file: trimText(entry.file, 200),
          backupPath: trimText(entry.backupPath, 800) || null,
          changedBy: trimText(entry.changedBy || actor, 200) || 'server-bot',
          changeSummary: Array.isArray(entry.changeSummary) ? entry.changeSummary : [],
          meta: entry.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta) ? entry.meta : {},
        })).filter((entry) => entry.file)
      : [];

    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const completion = await db.$transaction(async (tx) => {
        const {
          job: jobDelegate,
          backup: backupDelegate,
          snapshot: snapshotDelegate,
        } = getServerConfigDelegatesOrThrow(tx);
        const currentJob = await jobDelegate.findUnique({
          where: { id: jobId },
        });
        const updatedJob = await jobDelegate.update({
          where: { id: jobId },
          data: {
            status: jobStatus,
            completedAt: new Date(),
            errorText: lastError,
            resultJson: JSON.stringify(result),
            claimedByRuntimeKey: trimText(currentJob?.claimedByRuntimeKey, 200) || runtimeKey,
          },
        });

        for (const backup of backups) {
          await backupDelegate.create({
            data: {
              id: backup.id,
              tenantId,
              serverId,
              jobId,
              fileName: backup.file,
              backupPath: backup.backupPath,
              changedBy: backup.changedBy,
              changeSummaryJson: JSON.stringify(backup.changeSummary),
              metaJson: JSON.stringify(backup.meta),
            },
          });
        }

        if (snapshotInput) {
          const snapshot = normalizeSnapshotInput(snapshotInput);
          await snapshotDelegate.upsert({
            where: { serverId },
            create: {
              serverId,
              tenantId,
              runtimeKey,
              status: snapshot.status || (jobStatus === 'succeeded' ? 'ready' : 'error'),
              snapshotJson: JSON.stringify(snapshot),
              collectedAt: snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date(),
              updatedBy: trimText(actor, 200) || 'server-bot',
              lastJobId: jobId,
              lastError,
            },
            update: {
              tenantId,
              runtimeKey,
              status: snapshot.status || (jobStatus === 'succeeded' ? 'ready' : 'error'),
              snapshotJson: JSON.stringify(snapshot),
              collectedAt: snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date(),
              updatedBy: trimText(actor, 200) || 'server-bot',
              lastJobId: jobId,
              lastError,
            },
          });
        } else {
          await snapshotDelegate.updateMany({
            where: { serverId },
            data: {
              lastJobId: jobId,
              lastError,
              updatedBy: trimText(actor, 200) || 'server-bot',
            },
          });
        }

        return {
          currentJob: normalizeJobRow(currentJob),
          updatedJob: normalizeJobRow(updatedJob),
        };
      });

      const restartPlanId = trimText(completion.currentJob?.meta?.restartPlanId, 160) || null;
      if (restartPlanId) {
        await recordRestartExecution({
          planId: restartPlanId,
          tenantId,
          serverId,
          runtimeKey,
          action: 'restart',
          resultStatus: jobStatus === 'succeeded' ? 'succeeded' : 'failed',
          exitCode: jobStatus === 'succeeded' ? 0 : 1,
          detail: lastError || trimText(result.detail, 800) || `Config job ${jobStatus}`,
          metadata: {
            jobId,
            jobType: completion.currentJob?.jobType || null,
            applyMode: completion.currentJob?.applyMode || null,
          },
        }).catch(() => null);
        await completeRestartPlan({
          planId: restartPlanId,
          status: jobStatus === 'succeeded' ? 'completed' : 'failed',
          healthStatus: jobStatus === 'succeeded' ? 'pending_verification' : 'failed',
          payload: {
            jobId,
            resultStatus: jobStatus,
          },
        }).catch(() => null);
      }

      if (jobStatus === 'failed') {
        publishAdminLiveUpdate('server-config-job-result', {
          source: trimText(actor, 120) || 'server-bot',
          tenantId,
          serverId,
          runtimeKey,
          jobId,
          jobType: completion.currentJob?.jobType || null,
          jobLabel: completion.currentJob?.meta?.displayName || completion.currentJob?.jobType || 'config job',
          applyMode: completion.currentJob?.applyMode || null,
          status: jobStatus,
          detail: lastError || trimText(result.detail, 240) || 'Config apply failed',
        });
      }

      return {
        ok: true,
        job: completion.updatedJob,
        snapshot: await readSnapshotRow(db, serverId),
        backups: await readBackupRows(db, serverId, 20),
      };
    });
  }

  async function pruneServerConfigArtifacts(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId);
    const serverId = normalizeServerId(options.serverId) || null;
    if (!tenantId) return { ok: false, reason: 'tenantId-required' };
    const now = parseDateValue(options.now) || new Date();
    const jobRetentionMs = options.jobRetentionMs == null
      ? 30 * 24 * 60 * 60 * 1000
      : Number(options.jobRetentionMs);
    const backupRetentionMs = options.backupRetentionMs == null
      ? 30 * 24 * 60 * 60 * 1000
      : Number(options.backupRetentionMs);
    const keepLatestJobs = options.keepLatestJobs == null
      ? 20
      : Math.max(0, Number(options.keepLatestJobs) || 0);
    const keepLatestBackups = options.keepLatestBackups == null
      ? 20
      : Math.max(0, Number(options.keepLatestBackups) || 0);
    const jobCutoffMs = now.getTime() - Math.max(0, Number.isFinite(jobRetentionMs) ? jobRetentionMs : 0);
    const backupCutoffMs = now.getTime() - Math.max(0, Number.isFinite(backupRetentionMs) ? backupRetentionMs : 0);

    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const { job, backup } = getServerConfigDelegatesOrThrow(db);
      const [jobRows, backupRows] = await Promise.all([
        job.findMany({
          where: {
            ...(serverId ? { serverId } : {}),
          },
          orderBy: [
            { requestedAt: 'desc' },
            { id: 'desc' },
          ],
          take: 1000,
        }),
        backup.findMany({
          where: {
            ...(serverId ? { serverId } : {}),
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: 1000,
        }),
      ]);

      const normalizedJobs = Array.isArray(jobRows) ? jobRows.map(normalizeJobRow).filter(Boolean) : [];
      const normalizedBackups = Array.isArray(backupRows) ? backupRows.map(normalizeBackupRow).filter(Boolean) : [];

      const removableJobIds = selectRetentionArtifactIds(normalizedJobs, {
        cutoffMs: jobCutoffMs,
        keepLatest: keepLatestJobs,
        dateKeys: ['completedAt', 'requestedAt'],
        allowRow: (row) => ['succeeded', 'failed', 'cancelled'].includes(normalizeJobStatus(row?.status, '')),
      });
      const removableBackupIds = selectRetentionArtifactIds(normalizedBackups, {
        cutoffMs: backupCutoffMs,
        keepLatest: keepLatestBackups,
        dateKeys: ['createdAt'],
      });

      const [removedJobs, removedBackups] = await Promise.all([
        removableJobIds.length > 0
          ? job.deleteMany({
            where: {
              tenantId,
              ...(serverId ? { serverId } : {}),
              id: { in: removableJobIds },
            },
          }).then((result) => result?.count || 0)
          : Promise.resolve(0),
        removableBackupIds.length > 0
          ? backup.deleteMany({
            where: {
              tenantId,
              ...(serverId ? { serverId } : {}),
              id: { in: removableBackupIds },
            },
          }).then((result) => result?.count || 0)
          : Promise.resolve(0),
      ]);

      return {
        ok: true,
        tenantId,
        serverId,
        removed: {
          jobs: removedJobs,
          backups: removedBackups,
        },
        cutoffAt: {
          jobs: new Date(jobCutoffMs).toISOString(),
          backups: new Date(backupCutoffMs).toISOString(),
        },
      };
    });
  }

  return {
    ensurePlatformServerConfigTables,
    getServerConfigCategory,
    getServerConfigJob,
    getServerConfigWorkspace,
    listServerConfigJobs,
    listServerConfigBackups,
    createServerConfigSaveJob,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    createServerBotActionJob,
    claimNextServerConfigJob,
    completeServerConfigJob,
    retryServerConfigJob,
    pruneServerConfigArtifacts,
    upsertServerConfigSnapshot,
  };
}

module.exports = {
  buildWorkspaceFromSnapshot,
  createPlatformServerConfigService,
};
