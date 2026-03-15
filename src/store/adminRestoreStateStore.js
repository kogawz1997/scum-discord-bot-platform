const fs = require('node:fs');
const path = require('node:path');

const { getFilePath } = require('./_persist');

const FILE_PATH = getFilePath('admin-restore-state.json');

const VALID_STATUS = new Set(['idle', 'running', 'succeeded', 'failed']);
const VALID_ROLLBACK_STATUS = new Set([
  'none',
  'pending',
  'not-needed',
  'succeeded',
  'failed',
]);

let state = null;

function nowIso() {
  return new Date().toISOString();
}

function normalizeIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeString(value, maxLen = 500) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return JSON.parse(JSON.stringify(value));
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeString(entry, 200))
    .filter(Boolean);
}

function buildDefaultState() {
  return {
    schemaVersion: 1,
    status: 'idle',
    active: false,
    maintenance: false,
    operationId: null,
    backup: null,
    confirmBackup: null,
    rollbackBackup: null,
    actor: null,
    role: null,
    note: null,
    startedAt: null,
    endedAt: null,
    updatedAt: nowIso(),
    lastCompletedAt: null,
    durationMs: null,
    lastError: null,
    rollbackStatus: 'none',
    rollbackError: null,
    counts: null,
    currentCounts: null,
    diff: null,
    warnings: [],
    previewToken: null,
    previewBackup: null,
    previewIssuedAt: null,
    previewExpiresAt: null,
  };
}

function normalizeState(nextState = {}) {
  const base = buildDefaultState();
  const merged = {
    ...base,
    ...(state || {}),
    ...(nextState && typeof nextState === 'object' ? nextState : {}),
  };

  const status = VALID_STATUS.has(String(merged.status || '').trim())
    ? String(merged.status || '').trim()
    : 'idle';
  const rollbackStatus = VALID_ROLLBACK_STATUS.has(String(merged.rollbackStatus || '').trim())
    ? String(merged.rollbackStatus || '').trim()
    : 'none';
  const active = status === 'running';

  return {
    schemaVersion: 1,
    status,
    active,
    maintenance: merged.maintenance === true || active,
    operationId: normalizeString(merged.operationId, 120),
    backup: normalizeString(merged.backup, 260),
    confirmBackup: normalizeString(merged.confirmBackup, 260),
    rollbackBackup: normalizeString(merged.rollbackBackup, 260),
    actor: normalizeString(merged.actor, 180),
    role: normalizeString(merged.role, 80),
    note: normalizeString(merged.note, 260),
    startedAt: normalizeIso(merged.startedAt),
    endedAt: normalizeIso(merged.endedAt),
    updatedAt: normalizeIso(merged.updatedAt) || nowIso(),
    lastCompletedAt: normalizeIso(merged.lastCompletedAt),
    durationMs:
      Number.isFinite(Number(merged.durationMs)) && Number(merged.durationMs) >= 0
        ? Math.round(Number(merged.durationMs))
        : null,
    lastError: normalizeString(merged.lastError, 1000),
    rollbackStatus,
    rollbackError: normalizeString(merged.rollbackError, 1000),
    counts: normalizeObject(merged.counts),
    currentCounts: normalizeObject(merged.currentCounts),
    diff: normalizeObject(merged.diff),
    warnings: normalizeWarnings(merged.warnings),
    previewToken: normalizeString(merged.previewToken, 160),
    previewBackup: normalizeString(merged.previewBackup, 260),
    previewIssuedAt: normalizeIso(merged.previewIssuedAt),
    previewExpiresAt: normalizeIso(merged.previewExpiresAt),
  };
}

function writeStateToDisk() {
  const snapshot = normalizeState(state || {});
  const tmpPath = `${FILE_PATH}.tmp`;
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), 'utf8');
  fs.renameSync(tmpPath, FILE_PATH);
}

function initAdminRestoreStateStore() {
  if (state) return state;
  const fallback = buildDefaultState();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        state = normalizeState(JSON.parse(raw));
        return state;
      }
    }
  } catch (error) {
    console.error('[adminRestoreStateStore] failed to hydrate:', error.message);
  }
  state = fallback;
  return state;
}

function getAdminRestoreState() {
  initAdminRestoreStateStore();
  return normalizeState(state || {});
}

function setAdminRestoreState(nextState = {}) {
  initAdminRestoreStateStore();
  state = normalizeState(nextState);
  try {
    writeStateToDisk();
  } catch (error) {
    console.error('[adminRestoreStateStore] failed to persist:', error.message);
  }
  return getAdminRestoreState();
}

function isAdminRestoreMaintenanceActive() {
  const snapshot = getAdminRestoreState();
  return snapshot.active === true || snapshot.maintenance === true;
}

initAdminRestoreStateStore();

module.exports = {
  getAdminRestoreState,
  initAdminRestoreStateStore,
  isAdminRestoreMaintenanceActive,
  setAdminRestoreState,
};
