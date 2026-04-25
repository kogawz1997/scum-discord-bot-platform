'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { prisma } = require('../prisma');
const {
  atomicWriteJson,
  getFilePath,
  isDbPersistenceEnabled,
  resolveStorePersistenceMode: resolveStorePersistenceModeBase,
} = require('./_persist');
const { assertTenantMutationScope } = require('../utils/tenantDbIsolation');

const FILE_PATH = getFilePath('admin-security-events.json');
const MAX_ENTRIES = Math.max(
  100,
  Math.min(5000, Math.trunc(Number(process.env.ADMIN_WEB_SECURITY_EVENT_MAX || 1200) || 1200)),
);

let events = [];
let initPromise = null;
let writeQueue = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function normalizeIso(value) {
  if (!value) return nowIso();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return nowIso();
  return date.toISOString();
}

function normalizeText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function normalizeSeverity(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'error' || text === 'warn' || text === 'info') return text;
  return 'info';
}

function getSecurityEventTenantId(entry = {}) {
  return normalizeText(
    entry?.tenantId
      || entry?.data?.tenantId
      || entry?.data?.tenant?.id,
    160,
  );
}

function isTenantOwnedSecurityEvent(entry = {}) {
  const type = normalizeText(entry.type, 120)?.toLowerCase() || '';
  if (entry.requireTenantScope === true || entry.tenantScoped === true) return true;
  if (getSecurityEventTenantId(entry)) return true;
  return type.startsWith('tenant-') || type.includes('tenant-boundary');
}

function assertAdminSecurityMutationScope(entry = {}, operation = 'record admin security event') {
  if (!isTenantOwnedSecurityEvent(entry)) return null;
  const tenantId = getSecurityEventTenantId(entry);
  return assertTenantMutationScope({
    tenantId,
    dataTenantId: tenantId,
    operation,
    entityType: 'admin-security-event',
  });
}

function parseDataJson(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const text = normalizeText(value, 10000);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeEvent(entry = {}) {
  return {
    id:
      normalizeText(entry.id, 120)
      || `admin-sec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    at: normalizeIso(entry.at || entry.occurredAt),
    type: normalizeText(entry.type, 120) || 'security-event',
    severity: normalizeSeverity(entry.severity),
    actor: normalizeText(entry.actor, 180),
    targetUser: normalizeText(entry.targetUser, 180),
    role: normalizeText(entry.role, 40),
    authMethod: normalizeText(entry.authMethod, 80),
    sessionId: normalizeText(entry.sessionId, 120),
    ip: normalizeText(entry.ip, 120),
    path: normalizeText(entry.path, 240),
    reason: normalizeText(entry.reason, 240),
    detail: normalizeText(entry.detail, 500),
    data: entry.data && typeof entry.data === 'object' ? entry.data : parseDataJson(entry.dataJson),
  };
}

function serializeEventRow(entry = {}) {
  const normalized = normalizeEvent(entry);
  return {
    id: normalized.id,
    occurredAt: new Date(normalized.at),
    type: normalized.type,
    severity: normalized.severity,
    actor: normalized.actor,
    targetUser: normalized.targetUser,
    role: normalized.role,
    authMethod: normalized.authMethod,
    sessionId: normalized.sessionId,
    ip: normalized.ip,
    path: normalized.path,
    reason: normalized.reason,
    detail: normalized.detail,
    dataJson: normalized.data ? JSON.stringify(normalized.data) : null,
  };
}

function getSecurityEventDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformAdminSecurityEvent;
  if (!delegate || typeof delegate.findMany !== 'function') return null;
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
  return resolveStorePersistenceMode(process.env.ADMIN_SECURITY_EVENT_STORE_MODE, 'db');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getSecurityEventDelegate();
  if (mode === 'file') {
    return fileWork();
  }
  if (!delegate) {
    throw new Error('admin-security-event-db-delegate-unavailable');
  }
  return dbWork(delegate);
}

function queueWrite(work, label) {
  writeQueue = writeQueue
    .then(async () => {
      await work();
    })
    .catch((error) => {
      console.error(`[adminSecurityEventStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function trimEvents(nextRows = []) {
  const normalized = new Map();
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    const event = normalizeEvent(row);
    normalized.set(event.id, event);
  }
  const ordered = Array.from(normalized.values()).sort((left, right) => {
    return String(left.at || '').localeCompare(String(right.at || ''));
  });
  if (ordered.length > MAX_ENTRIES) {
    ordered.splice(0, ordered.length - MAX_ENTRIES);
  }
  return ordered;
}

function writeEventsToDisk() {
  atomicWriteJson(FILE_PATH, events);
}

async function hydrateFromDisk() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        events = trimEvents(JSON.parse(raw));
        return;
      }
    }
  } catch (error) {
    console.error('[adminSecurityEventStore] failed to hydrate:', error.message);
  }
  events = [];
}

async function hydrateFromDatabase(delegate = getSecurityEventDelegate()) {
  if (!delegate) {
    events = [];
    return;
  }
  const rows = await delegate.findMany({
    orderBy: { occurredAt: 'asc' },
    take: MAX_ENTRIES,
  });
  events = trimEvents(Array.isArray(rows) ? rows : []);
}

async function writeEventsToDatabase(delegate = getSecurityEventDelegate()) {
  if (!delegate) return;
  const rows = trimEvents(events).map(serializeEventRow);
  await delegate.deleteMany({});
  if (rows.length > 0 && typeof delegate.upsert === 'function') {
    for (const row of rows) {
      await delegate.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      });
    }
    return;
  }
  if (rows.length > 0) {
    await delegate.createMany({ data: rows });
  }
}

async function persistRecordedEventToDatabase(entry, delegate = getSecurityEventDelegate(), staleIds = []) {
  if (!delegate) return;
  const row = serializeEventRow(entry);
  if (typeof delegate.upsert === 'function') {
    await delegate.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
    if (Array.isArray(staleIds) && staleIds.length > 0 && typeof delegate.deleteMany === 'function') {
      await delegate.deleteMany({
        where: {
          id: {
            in: staleIds,
          },
        },
      });
    }
    return;
  }
  await writeEventsToDatabase(delegate);
}

function initAdminSecurityEventStore() {
  if (!initPromise) {
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    );
  }
  return initPromise;
}

function recordAdminSecurityEvent(entry = {}) {
  assertAdminSecurityMutationScope(entry, 'record admin security event');
  const normalized = normalizeEvent(entry);
  const previousIds = new Set((Array.isArray(events) ? events : []).map((item) => item.id));
  events.push(normalized);
  events = trimEvents(events);
  const activeIds = new Set(events.map((item) => item.id));
  const staleIds = Array.from(previousIds).filter((id) => !activeIds.has(id));
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => persistRecordedEventToDatabase(normalized, delegate, staleIds),
      async () => writeEventsToDisk(),
    ),
    'record',
  );
  return { ...normalized };
}

async function listAdminSecurityEvents(options = {}) {
  await initAdminSecurityEventStore();
  const limit = Math.max(1, Math.min(MAX_ENTRIES, Math.trunc(Number(options.limit || 200) || 200)));
  const type = normalizeText(options.type, 120);
  const severity = normalizeText(options.severity, 16)?.toLowerCase() || null;
  const actor = normalizeText(options.actor, 180)?.toLowerCase() || null;
  const targetUser = normalizeText(options.targetUser, 180)?.toLowerCase() || null;
  const sessionId = normalizeText(options.sessionId, 120);
  return events
    .filter((event) => {
      if (type && event.type !== type) return false;
      if (severity && String(event.severity || '').toLowerCase() !== severity) return false;
      if (actor && !String(event.actor || '').toLowerCase().includes(actor)) return false;
      if (targetUser && !String(event.targetUser || '').toLowerCase().includes(targetUser)) return false;
      if (sessionId && event.sessionId !== sessionId) return false;
      return true;
    })
    .slice(-limit)
    .reverse()
    .map((event) => ({ ...event }));
}

async function replaceAdminSecurityEvents(nextRows = []) {
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    assertAdminSecurityMutationScope(row, 'replace admin security events');
  }
  await initAdminSecurityEventStore();
  events = trimEvents(nextRows);
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => writeEventsToDatabase(delegate),
      async () => writeEventsToDisk(),
    ),
    'replace',
  );
  return events.length;
}

async function clearAdminSecurityEvents() {
  await initAdminSecurityEventStore();
  events = [];
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => writeEventsToDatabase(delegate),
      async () => writeEventsToDisk(),
    ),
    'clear',
  );
  return [];
}

function waitForAdminSecurityEventPersistence() {
  return writeQueue;
}

void initAdminSecurityEventStore().catch((error) => {
  console.error('[adminSecurityEventStore] init failed:', error.message);
});

module.exports = {
  clearAdminSecurityEvents,
  initAdminSecurityEventStore,
  listAdminSecurityEvents,
  recordAdminSecurityEvent,
  replaceAdminSecurityEvents,
  waitForAdminSecurityEventPersistence,
};
