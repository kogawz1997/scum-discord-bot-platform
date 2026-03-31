'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { prisma } = require('../prisma');
const { atomicWriteJson, getFilePath, isDbPersistenceEnabled } = require('./_persist');

const FILE_PATH = getFilePath('admin-restore-state.json');
const STATE_ROW_ID = 'admin-restore-state';
const MAX_HISTORY_ENTRIES = 25;

const VALID_STATUS = new Set(['idle', 'running', 'succeeded', 'failed']);
const VALID_ROLLBACK_STATUS = new Set([
  'none',
  'pending',
  'not-needed',
  'succeeded',
  'failed',
]);

let state = null;
let initPromise = null;
let writeQueue = Promise.resolve();
let mutationVersion = 0;

function nowIso() {
  return new Date().toISOString();
}

function normalizeIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
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

function normalizeVerificationChecks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const id = normalizeString(entry.id, 80);
      if (!id) return null;
      return {
        id,
        label: normalizeString(entry.label, 160) || id,
        ok: entry.ok === true,
        detail: normalizeString(entry.detail, 400),
      };
    })
    .filter(Boolean);
}

function normalizeVerification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    checkedAt: normalizeIso(value.checkedAt),
    ready: value.ready === true,
    countsMatch: value.countsMatch === true,
    configMatch: value.configMatch === true,
    rollbackBackupCreated: value.rollbackBackupCreated === true,
    checks: normalizeVerificationChecks(value.checks),
    summary: normalizeObject(value.summary),
  };
}

function normalizeHistoryEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const operationId = normalizeString(value.operationId, 120);
  const recordedAt =
    normalizeIso(value.recordedAt)
    || normalizeIso(value.endedAt)
    || normalizeIso(value.updatedAt)
    || nowIso();
  return {
    operationId,
    status: VALID_STATUS.has(String(value.status || '').trim())
      ? String(value.status || '').trim()
      : 'idle',
    backup: normalizeString(value.backup, 260),
    confirmBackup: normalizeString(value.confirmBackup, 260),
    rollbackBackup: normalizeString(value.rollbackBackup, 260),
    actor: normalizeString(value.actor, 180),
    role: normalizeString(value.role, 80),
    note: normalizeString(value.note, 260),
    startedAt: normalizeIso(value.startedAt),
    endedAt: normalizeIso(value.endedAt),
    durationMs:
      Number.isFinite(Number(value.durationMs)) && Number(value.durationMs) >= 0
        ? Math.round(Number(value.durationMs))
        : null,
    lastError: normalizeString(value.lastError, 1000),
    rollbackStatus: VALID_ROLLBACK_STATUS.has(String(value.rollbackStatus || '').trim())
      ? String(value.rollbackStatus || '').trim()
      : 'none',
    rollbackError: normalizeString(value.rollbackError, 1000),
    warnings: normalizeWarnings(value.warnings),
    verification: normalizeVerification(value.verification),
    counts: normalizeObject(value.counts),
    currentCounts: normalizeObject(value.currentCounts),
    diff: normalizeObject(value.diff),
    recordedAt,
  };
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeHistoryEntry(entry))
    .filter(Boolean)
    .sort((left, right) => new Date(right.recordedAt || 0) - new Date(left.recordedAt || 0))
    .slice(0, MAX_HISTORY_ENTRIES);
}

function buildDefaultState() {
  return {
    schemaVersion: 2,
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
    verification: null,
    previewToken: null,
    previewBackup: null,
    previewIssuedAt: null,
    previewExpiresAt: null,
    history: [],
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
    schemaVersion: 2,
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
    verification: normalizeVerification(merged.verification),
    previewToken: normalizeString(merged.previewToken, 160),
    previewBackup: normalizeString(merged.previewBackup, 260),
    previewIssuedAt: normalizeIso(merged.previewIssuedAt),
    previewExpiresAt: normalizeIso(merged.previewExpiresAt),
    history: normalizeHistory(merged.history),
  };
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStateRecord(row) {
  if (!row || typeof row !== 'object') {
    return buildDefaultState();
  }
  return normalizeState({
    status: row.status,
    active: row.active,
    maintenance: row.maintenance,
    operationId: row.operationId,
    backup: row.backup,
    confirmBackup: row.confirmBackup,
    rollbackBackup: row.rollbackBackup,
    actor: row.actor,
    role: row.role,
    note: row.note,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    updatedAt: row.updatedAt,
    lastCompletedAt: row.lastCompletedAt,
    durationMs: row.durationMs,
    lastError: row.lastError,
    rollbackStatus: row.rollbackStatus,
    rollbackError: row.rollbackError,
    counts: parseJsonObject(row.countsJson),
    currentCounts: parseJsonObject(row.currentCountsJson),
    diff: parseJsonObject(row.diffJson),
    warnings: parseJsonArray(row.warningsJson),
    verification: parseJsonObject(row.verificationJson),
    previewToken: row.previewToken,
    previewBackup: row.previewBackup,
    previewIssuedAt: row.previewIssuedAt,
    previewExpiresAt: row.previewExpiresAt,
    history: parseJsonArray(row.historyJson),
  });
}

function serializeStateRow(snapshot = {}) {
  const normalized = normalizeState(snapshot);
  return {
    id: STATE_ROW_ID,
    status: normalized.status,
    active: normalized.active,
    maintenance: normalized.maintenance,
    operationId: normalized.operationId,
    backup: normalized.backup,
    confirmBackup: normalized.confirmBackup,
    rollbackBackup: normalized.rollbackBackup,
    actor: normalized.actor,
    role: normalized.role,
    note: normalized.note,
    startedAt: normalized.startedAt ? new Date(normalized.startedAt) : null,
    endedAt: normalized.endedAt ? new Date(normalized.endedAt) : null,
    lastCompletedAt: normalized.lastCompletedAt ? new Date(normalized.lastCompletedAt) : null,
    durationMs: normalized.durationMs,
    lastError: normalized.lastError,
    rollbackStatus: normalized.rollbackStatus,
    rollbackError: normalized.rollbackError,
    countsJson: normalized.counts ? JSON.stringify(normalized.counts) : null,
    currentCountsJson: normalized.currentCounts ? JSON.stringify(normalized.currentCounts) : null,
    diffJson: normalized.diff ? JSON.stringify(normalized.diff) : null,
    warningsJson: JSON.stringify(normalized.warnings || []),
    verificationJson: normalized.verification ? JSON.stringify(normalized.verification) : null,
    previewToken: normalized.previewToken,
    previewBackup: normalized.previewBackup,
    previewIssuedAt: normalized.previewIssuedAt ? new Date(normalized.previewIssuedAt) : null,
    previewExpiresAt: normalized.previewExpiresAt ? new Date(normalized.previewExpiresAt) : null,
    historyJson: JSON.stringify(normalized.history || []),
  };
}

function getRestoreStateDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformAdminRestoreState;
  if (!delegate || typeof delegate.findUnique !== 'function') return null;
  return delegate;
}

function getPersistenceMode() {
  const explicit = String(process.env.ADMIN_RESTORE_STATE_STORE_MODE || '').trim().toLowerCase();
  if (explicit === 'file') return 'file';
  if (explicit === 'db') return 'db';
  if (typeof isDbPersistenceEnabled === 'function' && isDbPersistenceEnabled()) {
    return 'db';
  }
  return 'auto';
}

function shouldFallbackToFile(error) {
  const code = String(error?.code || '').trim().toUpperCase();
  if (['P2021', 'P2022', 'P1017'].includes(code)) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('no such table')
    || message.includes('does not exist')
    || message.includes('unknown table')
    || message.includes('error validating datasource')
    || message.includes('url must start with the protocol')
    || message.includes('platformadminrestorestate');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getRestoreStateDelegate();
  if (mode === 'file' || !delegate) {
    return fileWork();
  }
  try {
    return await dbWork(delegate);
  } catch (error) {
    if (mode === 'db' || !shouldFallbackToFile(error)) {
      throw error;
    }
    return fileWork();
  }
}

function queueWrite(work, label) {
  writeQueue = writeQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[adminRestoreStateStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeStateToDisk() {
  const snapshot = normalizeState(state || {});
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  atomicWriteJson(FILE_PATH, snapshot);
}

async function hydrateFromDisk() {
  const fallback = buildDefaultState();
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        return normalizeState(JSON.parse(raw));
      }
    }
  } catch (error) {
    console.error('[adminRestoreStateStore] failed to hydrate:', error.message);
  }
  return fallback;
}

async function hydrateFromDatabase(delegate = getRestoreStateDelegate()) {
  if (!delegate) {
    return buildDefaultState();
  }
  const row = await delegate.findUnique({
    where: { id: STATE_ROW_ID },
  });
  return normalizeStateRecord(row);
}

async function persistStateToDatabase(delegate = getRestoreStateDelegate()) {
  if (!delegate) return;
  const payload = serializeStateRow(state || buildDefaultState());
  await delegate.upsert({
    where: { id: STATE_ROW_ID },
    create: payload,
    update: {
      status: payload.status,
      active: payload.active,
      maintenance: payload.maintenance,
      operationId: payload.operationId,
      backup: payload.backup,
      confirmBackup: payload.confirmBackup,
      rollbackBackup: payload.rollbackBackup,
      actor: payload.actor,
      role: payload.role,
      note: payload.note,
      startedAt: payload.startedAt,
      endedAt: payload.endedAt,
      lastCompletedAt: payload.lastCompletedAt,
      durationMs: payload.durationMs,
      lastError: payload.lastError,
      rollbackStatus: payload.rollbackStatus,
      rollbackError: payload.rollbackError,
      countsJson: payload.countsJson,
      currentCountsJson: payload.currentCountsJson,
      diffJson: payload.diffJson,
      warningsJson: payload.warningsJson,
      verificationJson: payload.verificationJson,
      previewToken: payload.previewToken,
      previewBackup: payload.previewBackup,
      previewIssuedAt: payload.previewIssuedAt,
      previewExpiresAt: payload.previewExpiresAt,
      historyJson: payload.historyJson,
    },
  });
}

function initAdminRestoreStateStore() {
  if (!initPromise) {
    const startVersion = mutationVersion;
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).then((hydrated) => {
      if (startVersion === mutationVersion) {
        state = normalizeState(hydrated || {});
      } else if (!state) {
        state = normalizeState(hydrated || {});
      }
      return state;
    }).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[adminRestoreStateStore] failed to hydrate from prisma:', error.message);
      state = await hydrateFromDisk();
      return state;
    });
  }
  return initPromise;
}

function getAdminRestoreState() {
  void initAdminRestoreStateStore();
  if (!state) {
    state = buildDefaultState();
  }
  return normalizeState(state || {});
}

function setAdminRestoreState(nextState = {}) {
  void initAdminRestoreStateStore();
  mutationVersion += 1;
  state = normalizeState(nextState);
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => persistStateToDatabase(delegate),
      async () => writeStateToDisk(),
    ),
    'persist',
  );
  return getAdminRestoreState();
}

function appendAdminRestoreHistory(entry = {}) {
  void initAdminRestoreStateStore();
  const normalizedEntry = normalizeHistoryEntry(entry);
  if (!normalizedEntry) {
    return listAdminRestoreHistory();
  }
  mutationVersion += 1;
  const current = getAdminRestoreState();
  const currentHistory = Array.isArray(current.history) ? current.history : [];
  const dedupeKey = [
    normalizedEntry.operationId || '',
    normalizedEntry.status || '',
    normalizedEntry.recordedAt || '',
  ].join('::');
  const nextHistory = [
    normalizedEntry,
    ...currentHistory.filter((row) => (
      [
        String(row?.operationId || ''),
        String(row?.status || ''),
        String(row?.recordedAt || ''),
      ].join('::') !== dedupeKey
    )),
  ].slice(0, MAX_HISTORY_ENTRIES);
  state = normalizeState({
    ...current,
    history: nextHistory,
    updatedAt: nowIso(),
  });
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => persistStateToDatabase(delegate),
      async () => writeStateToDisk(),
    ),
    'persist-history',
  );
  return listAdminRestoreHistory();
}

function listAdminRestoreHistory(limit = MAX_HISTORY_ENTRIES) {
  const snapshot = getAdminRestoreState();
  const max = Math.max(1, Math.min(MAX_HISTORY_ENTRIES, Math.trunc(Number(limit) || MAX_HISTORY_ENTRIES)));
  return Array.isArray(snapshot.history) ? snapshot.history.slice(0, max) : [];
}

function isAdminRestoreMaintenanceActive() {
  const snapshot = getAdminRestoreState();
  return snapshot.active === true || snapshot.maintenance === true;
}

function waitForAdminRestoreStatePersistence() {
  return writeQueue;
}

void initAdminRestoreStateStore().catch((error) => {
  console.error('[adminRestoreStateStore] init failed:', error.message);
});

module.exports = {
  appendAdminRestoreHistory,
  getAdminRestoreState,
  initAdminRestoreStateStore,
  isAdminRestoreMaintenanceActive,
  listAdminRestoreHistory,
  setAdminRestoreState,
  waitForAdminRestoreStatePersistence,
};
