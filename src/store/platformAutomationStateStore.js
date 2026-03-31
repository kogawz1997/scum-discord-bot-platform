const fs = require('node:fs');

const { prisma } = require('../prisma');
const { atomicWriteJson, getFilePath, isDbPersistenceEnabled } = require('./_persist');

const FILE_PATH = getFilePath('platform-automation-state.json');
const STATE_ROW_ID = 'platform-automation-state';

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

function normalizeIsoMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = trimText(key, 120);
    const normalizedAt = normalizeIso(entry);
    if (!normalizedKey || !normalizedAt) continue;
    out[normalizedKey] = normalizedAt;
  }
  return out;
}

function normalizeIntMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = trimText(key, 120);
    const parsed = Number(entry);
    if (!normalizedKey || !Number.isFinite(parsed) || parsed < 0) continue;
    out[normalizedKey] = Math.trunc(parsed);
  }
  return out;
}

function normalizeResultMap(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = trimText(key, 120);
    if (!normalizedKey || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    out[normalizedKey] = {
      at: normalizeIso(entry.at) || nowIso(),
      ok: entry.ok === true,
      action: trimText(entry.action, 120),
      runtimeKey: trimText(entry.runtimeKey, 120),
      status: trimText(entry.status, 80),
      reason: trimText(entry.reason, 240),
      exitCode: Number.isFinite(Number(entry.exitCode)) ? Math.trunc(Number(entry.exitCode)) : null,
    };
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
    lastAutomationAt: null,
    lastForcedMonitoringAt: null,
    lastRecoveryAtByKey: {},
    recoveryWindowStartedAtByKey: {},
    recoveryAttemptsByKey: {},
    lastRecoveryResultByKey: {},
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
    lastAutomationAt: normalizeIso(merged.lastAutomationAt),
    lastForcedMonitoringAt: normalizeIso(merged.lastForcedMonitoringAt),
    lastRecoveryAtByKey: normalizeIsoMap(merged.lastRecoveryAtByKey),
    recoveryWindowStartedAtByKey: normalizeIsoMap(merged.recoveryWindowStartedAtByKey),
    recoveryAttemptsByKey: normalizeIntMap(merged.recoveryAttemptsByKey),
    lastRecoveryResultByKey: normalizeResultMap(merged.lastRecoveryResultByKey),
  };
}

function normalizeStateRecord(row) {
  if (!row || typeof row !== 'object') {
    return buildDefaultState();
  }
  return normalizeState({
    updatedAt: row.updatedAt,
    lastAutomationAt: row.lastAutomationAt,
    lastForcedMonitoringAt: row.lastForcedMonitoringAt,
    lastRecoveryAtByKey: parseJsonMap(row.lastRecoveryAtByKeyJson),
    recoveryWindowStartedAtByKey: parseJsonMap(row.recoveryWindowStartedAtByKeyJson),
    recoveryAttemptsByKey: parseJsonMap(row.recoveryAttemptsByKeyJson),
    lastRecoveryResultByKey: parseJsonMap(row.lastRecoveryResultByKeyJson),
  });
}

function serializeStateRow(snapshot) {
  const normalized = normalizeState(snapshot || {});
  return {
    id: STATE_ROW_ID,
    lastAutomationAt: normalized.lastAutomationAt ? new Date(normalized.lastAutomationAt) : null,
    lastForcedMonitoringAt: normalized.lastForcedMonitoringAt ? new Date(normalized.lastForcedMonitoringAt) : null,
    lastRecoveryAtByKeyJson: JSON.stringify(normalized.lastRecoveryAtByKey),
    recoveryWindowStartedAtByKeyJson: JSON.stringify(normalized.recoveryWindowStartedAtByKey),
    recoveryAttemptsByKeyJson: JSON.stringify(normalized.recoveryAttemptsByKey),
    lastRecoveryResultByKeyJson: JSON.stringify(normalized.lastRecoveryResultByKey),
  };
}

function getAutomationStateDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformAutomationState;
  if (!delegate || typeof delegate.findUnique !== 'function') return null;
  return delegate;
}

function getPersistenceMode() {
  const explicit = String(process.env.PLATFORM_AUTOMATION_STATE_STORE_MODE || '').trim().toLowerCase();
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
    || message.includes('platformautomationstate');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getAutomationStateDelegate();
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
      console.error(`[platformAutomationStateStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeStateToDisk() {
  const snapshot = normalizeState(state || {});
  atomicWriteJson(FILE_PATH, snapshot);
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
    console.error('[platformAutomationStateStore] failed to hydrate:', error.message);
  }
  state = buildDefaultState();
}

async function hydrateFromDatabase(delegate = getAutomationStateDelegate()) {
  if (!delegate) {
    state = buildDefaultState();
    return;
  }
  const row = await delegate.findUnique({
    where: { id: STATE_ROW_ID },
  });
  state = normalizeStateRecord(row);
}

async function persistStateToDatabase(delegate = getAutomationStateDelegate()) {
  if (!delegate) return;
  const payload = serializeStateRow(state || buildDefaultState());
  await delegate.upsert({
    where: { id: STATE_ROW_ID },
    create: payload,
    update: {
      lastAutomationAt: payload.lastAutomationAt,
      lastForcedMonitoringAt: payload.lastForcedMonitoringAt,
      lastRecoveryAtByKeyJson: payload.lastRecoveryAtByKeyJson,
      recoveryWindowStartedAtByKeyJson: payload.recoveryWindowStartedAtByKeyJson,
      recoveryAttemptsByKeyJson: payload.recoveryAttemptsByKeyJson,
      lastRecoveryResultByKeyJson: payload.lastRecoveryResultByKeyJson,
    },
  });
}

function initPlatformAutomationStateStore() {
  if (!initPromise) {
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[platformAutomationStateStore] failed to hydrate from prisma:', error.message);
      await hydrateFromDisk();
    });
  }
  return initPromise;
}

async function getPlatformAutomationState() {
  await initPlatformAutomationStateStore();
  return normalizeState(state || {});
}

async function updatePlatformAutomationState(patch = {}) {
  await initPlatformAutomationStateStore();
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

async function resetPlatformAutomationState() {
  await initPlatformAutomationStateStore();
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

function waitForPlatformAutomationStatePersistence() {
  return writeQueue;
}

void initPlatformAutomationStateStore().catch((error) => {
  console.error('[platformAutomationStateStore] init failed:', error.message);
});

module.exports = {
  getPlatformAutomationState,
  initPlatformAutomationStateStore,
  resetPlatformAutomationState,
  updatePlatformAutomationState,
  waitForPlatformAutomationStatePersistence,
};
