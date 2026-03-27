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

function normalizeJobType(value, fallback = 'config_update') {
  const normalized = trimText(value, 60).toLowerCase();
  if (['config_update', 'apply', 'rollback'].includes(normalized)) {
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
          value: Object.prototype.hasOwnProperty.call(setting, 'value') ? setting.value : null,
          rawValue: Object.prototype.hasOwnProperty.call(setting, 'rawValue') ? setting.rawValue : null,
          defaultValue: Object.prototype.hasOwnProperty.call(setting, 'defaultValue')
            ? setting.defaultValue
            : null,
          requiresRestart: setting.requiresRestart === true,
          visibility: trimText(setting.visibility, 40) || 'basic',
          label: trimText(setting.label, 240) || null,
          description: trimText(setting.description, 600) || null,
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
  return {
    id: trimText(row.id, 160),
    tenantId: normalizeTenantId(row.tenantId) || '',
    serverId: normalizeServerId(row.serverId) || '',
    jobType: normalizeJobType(row.jobType, 'config_update'),
    applyMode: normalizeApplyMode(row.applyMode, 'save_only'),
    status: normalizeJobStatus(row.status, 'queued'),
    requestedBy: trimText(row.requestedBy, 200) || null,
    requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : null,
    claimedByRuntimeKey: normalizeRuntimeKey(row.claimedByRuntimeKey) || null,
    claimedAt: row.claimedAt ? new Date(row.claimedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    changes: parseJsonArray(row.changesJson),
    result: parseJsonObject(row.resultJson, {}),
    error: trimText(row.errorText, 1000) || null,
    meta: parseJsonObject(row.metaJson, {}),
  };
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

function buildWorkspaceFromSnapshot(server, snapshotRow, backups = []) {
  const categoryDefinitions = getConfigCategoryDefinitions().map(getCategoryDisplay);
  const snapshotIndex = buildSnapshotIndex(snapshotRow?.snapshot || {});
  const fileDefinitions = getConfigFileDefinitions().map(getFileDisplay);
  const fileLabelMap = new Map(fileDefinitions.map((entry) => [entry.file, entry.label]));
  const settingDefinitions = getConfigSettingDefinitions();
  const categories = categoryDefinitions.map((category) => {
    const rows = settingDefinitions
      .filter((definition) => String(definition.category || '').trim().toLowerCase() === category.key)
      .map((definition) => {
        const snapshotValue = snapshotIndex.settingIndex.get(
          buildSnapshotSettingKey(definition.file, definition.section, definition.key),
        );
        const value = snapshotValue
          ? snapshotValue.value
          : Object.prototype.hasOwnProperty.call(definition, 'defaultValue')
            ? definition.defaultValue
            : null;
        return buildSettingRow(definition, value, {
          hasCurrentValue: Boolean(snapshotValue),
          sourceFileLabel: fileLabelMap.get(definition.file) || definition.file,
        });
      });
    return {
      ...category,
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
    const tenantPrisma = getTenantScopedPrismaClient(normalizedTenantId);
    return withTenantDbIsolation(
      tenantPrisma,
      { tenantId: normalizedTenantId, enforce: true },
      work,
    );
  }

  async function ensurePlatformServerConfigTables(db) {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_server_config_snapshots (
        server_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        runtime_key TEXT,
        status TEXT,
        snapshot_json TEXT,
        collected_at TIMESTAMPTZ,
        updated_by TEXT,
        last_job_id TEXT,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_server_config_jobs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        apply_mode TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT,
        requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        claimed_by_runtime_key TEXT,
        claimed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        changes_json TEXT,
        result_json TEXT,
        error_text TEXT,
        meta_json TEXT
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_server_config_backups (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        job_id TEXT,
        file_name TEXT NOT NULL,
        backup_path TEXT,
        changed_by TEXT,
        change_summary_json TEXT,
        meta_json TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async function readSnapshotRow(db, serverId) {
    await ensurePlatformServerConfigTables(db);
    const rows = await db.$queryRaw`
      SELECT
        server_id AS "serverId",
        tenant_id AS "tenantId",
        runtime_key AS "runtimeKey",
        status,
        snapshot_json AS "snapshotJson",
        collected_at AS "collectedAt",
        updated_by AS "updatedBy",
        last_job_id AS "lastJobId",
        last_error AS "lastError",
        updated_at AS "updatedAt"
      FROM platform_server_config_snapshots
      WHERE server_id = ${serverId}
      LIMIT 1
    `;
    return normalizeSnapshotRow(Array.isArray(rows) ? rows[0] : null);
  }

  async function readBackupRows(db, serverId, limit = 20) {
    await ensurePlatformServerConfigTables(db);
    const rows = await db.$queryRaw`
      SELECT
        id,
        tenant_id AS "tenantId",
        server_id AS "serverId",
        job_id AS "jobId",
        file_name AS "fileName",
        backup_path AS "backupPath",
        changed_by AS "changedBy",
        change_summary_json AS "changeSummaryJson",
        meta_json AS "metaJson",
        created_at AS "createdAt"
      FROM platform_server_config_backups
      WHERE server_id = ${serverId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return Array.isArray(rows) ? rows.map(normalizeBackupRow).filter(Boolean) : [];
  }

  async function readJobRow(db, jobId) {
    await ensurePlatformServerConfigTables(db);
    const rows = await db.$queryRaw`
      SELECT
        id,
        tenant_id AS "tenantId",
        server_id AS "serverId",
        job_type AS "jobType",
        apply_mode AS "applyMode",
        status,
        requested_by AS "requestedBy",
        requested_at AS "requestedAt",
        claimed_by_runtime_key AS "claimedByRuntimeKey",
        claimed_at AS "claimedAt",
        completed_at AS "completedAt",
        changes_json AS "changesJson",
        result_json AS "resultJson",
        error_text AS "errorText",
        meta_json AS "metaJson"
      FROM platform_server_config_jobs
      WHERE id = ${jobId}
      LIMIT 1
    `;
    return normalizeJobRow(Array.isArray(rows) ? rows[0] : null);
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
      await db.$executeRaw`
        INSERT INTO platform_server_config_snapshots (
          server_id,
          tenant_id,
          runtime_key,
          status,
          snapshot_json,
          collected_at,
          updated_by,
          last_job_id,
          last_error,
          updated_at
        )
        VALUES (
          ${serverId},
          ${tenantId},
          ${runtimeKey},
          ${snapshot.status || 'ready'},
          ${JSON.stringify(snapshot)},
          ${snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date()},
          ${trimText(actor, 200) || 'server-bot'},
          ${trimText(input.lastJobId, 160) || null},
          ${trimText(input.lastError, 1000) || null},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (server_id)
        DO UPDATE SET
          runtime_key = EXCLUDED.runtime_key,
          status = EXCLUDED.status,
          snapshot_json = EXCLUDED.snapshot_json,
          collected_at = EXCLUDED.collected_at,
          updated_by = EXCLUDED.updated_by,
          last_job_id = EXCLUDED.last_job_id,
          last_error = EXCLUDED.last_error,
          updated_at = CURRENT_TIMESTAMP
      `;
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
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      await db.$executeRaw`
        INSERT INTO platform_server_config_jobs (
          id,
          tenant_id,
          server_id,
          job_type,
          apply_mode,
          status,
          requested_by,
          requested_at,
          changes_json,
          result_json,
          error_text,
          meta_json
        )
        VALUES (
          ${jobId},
          ${tenantId},
          ${serverId},
          ${'config_update'},
          ${applyMode},
          ${'queued'},
          ${requestedBy},
          CURRENT_TIMESTAMP,
          ${JSON.stringify(changes)},
          ${JSON.stringify({})},
          ${null},
          ${JSON.stringify({
            requiresRestart,
            requestedApplyMode: applyMode,
          })}
        )
      `;
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
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      await db.$executeRaw`
        INSERT INTO platform_server_config_jobs (
          id,
          tenant_id,
          server_id,
          job_type,
          apply_mode,
          status,
          requested_by,
          requested_at,
          changes_json,
          result_json,
          error_text,
          meta_json
        )
        VALUES (
          ${jobId},
          ${tenantId},
          ${serverId},
          ${'apply'},
          ${applyMode},
          ${'queued'},
          ${trimText(actor, 200) || 'admin-web'},
          CURRENT_TIMESTAMP,
          ${JSON.stringify([])},
          ${JSON.stringify({})},
          ${null},
          ${JSON.stringify({ requestedApplyMode: applyMode })}
        )
      `;
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
    return withTenantConfigDb(tenantId, async (db) => {
      await ensurePlatformServerConfigTables(db);
      const backups = await readBackupRows(db, serverId, 200);
      const backup = backups.find((entry) => entry.id === backupId) || null;
      if (!backup) return { ok: false, reason: 'server-config-backup-not-found' };
      const jobId = trimText(input.jobId, 160) || createId('cfgjob');
      await db.$executeRaw`
        INSERT INTO platform_server_config_jobs (
          id,
          tenant_id,
          server_id,
          job_type,
          apply_mode,
          status,
          requested_by,
          requested_at,
          changes_json,
          result_json,
          error_text,
          meta_json
        )
        VALUES (
          ${jobId},
          ${tenantId},
          ${serverId},
          ${'rollback'},
          ${applyMode},
          ${'queued'},
          ${trimText(actor, 200) || 'admin-web'},
          CURRENT_TIMESTAMP,
          ${JSON.stringify([])},
          ${JSON.stringify({})},
          ${null},
          ${JSON.stringify({ backup })}
        )
      `;
      return {
        ok: true,
        job: await readJobRow(db, jobId),
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
      const rows = await db.$queryRaw`
        SELECT
          id,
          tenant_id AS "tenantId",
          server_id AS "serverId",
          job_type AS "jobType",
          apply_mode AS "applyMode",
          status,
          requested_by AS "requestedBy",
          requested_at AS "requestedAt",
          claimed_by_runtime_key AS "claimedByRuntimeKey",
          claimed_at AS "claimedAt",
          completed_at AS "completedAt",
          changes_json AS "changesJson",
          result_json AS "resultJson",
          error_text AS "errorText",
          meta_json AS "metaJson"
        FROM platform_server_config_jobs
        WHERE server_id = ${serverId}
          AND status = ${'queued'}
        ORDER BY requested_at ASC
        LIMIT 1
      `;
      const job = normalizeJobRow(Array.isArray(rows) ? rows[0] : null);
      if (!job) return { ok: true, job: null };
      await db.$executeRaw`
        UPDATE platform_server_config_jobs
        SET
          status = ${'processing'},
          claimed_by_runtime_key = ${runtimeKey},
          claimed_at = CURRENT_TIMESTAMP
        WHERE id = ${job.id}
      `;
      return {
        ok: true,
        job: await readJobRow(db, job.id),
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
      await db.$executeRaw`
        UPDATE platform_server_config_jobs
        SET
          status = ${jobStatus},
          completed_at = CURRENT_TIMESTAMP,
          error_text = ${lastError},
          result_json = ${JSON.stringify(result)},
          claimed_by_runtime_key = COALESCE(claimed_by_runtime_key, ${runtimeKey})
        WHERE id = ${jobId}
      `;

      for (const backup of backups) {
        await db.$executeRaw`
          INSERT INTO platform_server_config_backups (
            id,
            tenant_id,
            server_id,
            job_id,
            file_name,
            backup_path,
            changed_by,
            change_summary_json,
            meta_json,
            created_at
          )
          VALUES (
            ${backup.id},
            ${tenantId},
            ${serverId},
            ${jobId},
            ${backup.file},
            ${backup.backupPath},
            ${backup.changedBy},
            ${JSON.stringify(backup.changeSummary)},
            ${JSON.stringify(backup.meta)},
            CURRENT_TIMESTAMP
          )
        `;
      }

      if (snapshotInput) {
        const snapshot = normalizeSnapshotInput(snapshotInput);
        await db.$executeRaw`
          INSERT INTO platform_server_config_snapshots (
            server_id,
            tenant_id,
            runtime_key,
            status,
            snapshot_json,
            collected_at,
            updated_by,
            last_job_id,
            last_error,
            updated_at
          )
          VALUES (
            ${serverId},
            ${tenantId},
            ${runtimeKey},
            ${snapshot.status || (jobStatus === 'succeeded' ? 'ready' : 'error')},
            ${JSON.stringify(snapshot)},
            ${snapshot.collectedAt ? new Date(snapshot.collectedAt) : new Date()},
            ${trimText(actor, 200) || 'server-bot'},
            ${jobId},
            ${lastError},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (server_id)
          DO UPDATE SET
            runtime_key = EXCLUDED.runtime_key,
            status = EXCLUDED.status,
            snapshot_json = EXCLUDED.snapshot_json,
            collected_at = EXCLUDED.collected_at,
            updated_by = EXCLUDED.updated_by,
            last_job_id = EXCLUDED.last_job_id,
            last_error = EXCLUDED.last_error,
            updated_at = CURRENT_TIMESTAMP
        `;
      } else {
        await db.$executeRaw`
          UPDATE platform_server_config_snapshots
          SET
            last_job_id = ${jobId},
            last_error = ${lastError},
            updated_by = ${trimText(actor, 200) || 'server-bot'},
            updated_at = CURRENT_TIMESTAMP
          WHERE server_id = ${serverId}
        `;
      }

      return {
        ok: true,
        job: await readJobRow(db, jobId),
        snapshot: await readSnapshotRow(db, serverId),
        backups: await readBackupRows(db, serverId, 20),
      };
    });
  }

  return {
    ensurePlatformServerConfigTables,
    getServerConfigCategory,
    getServerConfigWorkspace,
    listServerConfigBackups,
    createServerConfigSaveJob,
    createServerConfigApplyJob,
    createServerConfigRollbackJob,
    claimNextServerConfigJob,
    completeServerConfigJob,
    upsertServerConfigSnapshot,
  };
}

module.exports = {
  createPlatformServerConfigService,
};
