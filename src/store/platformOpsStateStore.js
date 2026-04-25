const fs = require('node:fs');

const { prisma } = require('../prisma');
const {
  atomicWriteJson,
  getFilePath,
  isDbPersistenceEnabled,
  resolveStorePersistenceMode: resolveStorePersistenceModeBase,
} = require('./_persist');

const FILE_PATH = getFilePath('platform-ops-state.json');
const STATE_ROW_ID = 'platform-ops-state';

let state = null;
let initPromise = null;
let writeQueue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function normalizeIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function normalizeAlertMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = trimText(key, 160);
    const normalizedAt = normalizeIso(entry);
    if (!normalizedKey || !normalizedAt) continue;
    out[normalizedKey] = normalizedAt;
  }
  return out;
}

function parseJsonMap(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const text = trimText(value, 20000);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildDefaultState() {
  return {
    schemaVersion: 1,
    updatedAt: nowIso(),
    lastMonitoringAt: null,
    lastAutoBackupAt: null,
    lastReconcileAt: null,
    lastAlertAtByKey: {},
  };
}

function normalizeState(next = {}) {
  const merged = {
    ...buildDefaultState(),
    ...(state || {}),
    ...(next && typeof next === 'object' ? next : {}),
  };
  return {
    schemaVersion: 1,
    updatedAt: normalizeIso(merged.updatedAt) || nowIso(),
    lastMonitoringAt: normalizeIso(merged.lastMonitoringAt),
    lastAutoBackupAt: normalizeIso(merged.lastAutoBackupAt),
    lastReconcileAt: normalizeIso(merged.lastReconcileAt),
    lastAlertAtByKey: normalizeAlertMap(merged.lastAlertAtByKey),
  };
}

function normalizeStateRecord(row) {
  if (!row || typeof row !== 'object') {
    return buildDefaultState();
  }
  return normalizeState({
    updatedAt: row.updatedAt,
    lastMonitoringAt: row.lastMonitoringAt,
    lastAutoBackupAt: row.lastAutoBackupAt,
    lastReconcileAt: row.lastReconcileAt,
    lastAlertAtByKey: parseJsonMap(row.lastAlertAtByKeyJson),
  });
}

function serializeStateRow(snapshot) {
  const normalized = normalizeState(snapshot || {});
  return {
    id: STATE_ROW_ID,
    lastMonitoringAt: normalized.lastMonitoringAt ? new Date(normalized.lastMonitoringAt) : null,
    lastAutoBackupAt: normalized.lastAutoBackupAt ? new Date(normalized.lastAutoBackupAt) : null,
    lastReconcileAt: normalized.lastReconcileAt ? new Date(normalized.lastReconcileAt) : null,
    lastAlertAtByKeyJson: JSON.stringify(normalized.lastAlertAtByKey),
  };
}

function getOpsStateDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformOpsState;
  if (!delegate || typeof delegate.findUnique !== 'function') return null;
  return delegate;
}

function resolveStorePersistenceMode(explicitValue, defaultMode) {
  if (typeof resolveStorePersistenceModeBase === 'function') {
    return resolveStorePersistenceModeBase(explicitValue, defaultMode);
  }
  const explicit = String(explicitValue || '').trim().toLowerCase();
  if (explicit === 'file') return 'file';
  if (explicit === 'db') return 'db';
  if (typeof isDbPersistenceEnabled === 'function' && isDbPersistenceEnabled()) {
    return 'db';
  }
  return defaultMode;
}

function getPersistenceMode() {
  return resolveStorePersistenceMode(process.env.PLATFORM_OPS_STATE_STORE_MODE, 'auto');
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
    || message.includes('platformopsstate');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getOpsStateDelegate();
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
      console.error(`[platformOpsStateStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeStateToDisk() {
  atomicWriteJson(FILE_PATH, normalizeState(state || {}));
}

async function hydrateFromDisk() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        state = normalizeState(JSON.parse(raw));
        return;
      }
    }
  } catch (error) {
    console.error('[platformOpsStateStore] failed to hydrate:', error.message);
  }
  state = buildDefaultState();
}

async function hydrateFromDatabase(delegate = getOpsStateDelegate()) {
  if (!delegate) {
    state = buildDefaultState();
    return;
  }
  const row = await delegate.findUnique({
    where: { id: STATE_ROW_ID },
  });
  state = normalizeStateRecord(row);
}

async function persistStateToDatabase(delegate = getOpsStateDelegate()) {
  if (!delegate) return;
  const payload = serializeStateRow(state || buildDefaultState());
  await delegate.upsert({
    where: { id: STATE_ROW_ID },
    create: payload,
    update: {
      lastMonitoringAt: payload.lastMonitoringAt,
      lastAutoBackupAt: payload.lastAutoBackupAt,
      lastReconcileAt: payload.lastReconcileAt,
      lastAlertAtByKeyJson: payload.lastAlertAtByKeyJson,
    },
  });
}

function initPlatformOpsStateStore() {
  if (!initPromise) {
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[platformOpsStateStore] failed to hydrate from prisma:', error.message);
      await hydrateFromDisk();
    });
  }
  return initPromise;
}

async function getPlatformOpsState() {
  await initPlatformOpsStateStore();
  return normalizeState(state || {});
}

async function updatePlatformOpsState(patch = {}) {
  await initPlatformOpsStateStore();
  state = normalizeState({
    ...(state || {}),
    ...(patch && typeof patch === 'object' ? patch : {}),
    updatedAt: nowIso(),
  });
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => persistStateToDatabase(delegate),
      async () => writeStateToDisk(),
    ),
    'persist',
  );
  return normalizeState(state || {});
}

async function resetPlatformOpsState() {
  await initPlatformOpsStateStore();
  state = buildDefaultState();
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => persistStateToDatabase(delegate),
      async () => writeStateToDisk(),
    ),
    'reset',
  );
  return normalizeState(state || {});
}

function waitForPlatformOpsStatePersistence() {
  return writeQueue;
}

void initPlatformOpsStateStore().catch((error) => {
  console.error('[platformOpsStateStore] init failed:', error.message);
});

module.exports = {
  getPlatformOpsState,
  initPlatformOpsStateStore,
  resetPlatformOpsState,
  updatePlatformOpsState,
  waitForPlatformOpsStatePersistence,
};
