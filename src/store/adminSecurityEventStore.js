'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { prisma } = require('../prisma');
const { atomicWriteJson, getFilePath, isDbPersistenceEnabled } = require('./_persist');

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

function getPersistenceMode() {
  const explicit = String(process.env.ADMIN_SECURITY_EVENT_STORE_MODE || '').trim().toLowerCase();
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
    || message.includes('platformadminsecurityevent');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getSecurityEventDelegate();
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

function initAdminSecurityEventStore() {
  if (!initPromise) {
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[adminSecurityEventStore] failed to hydrate from prisma:', error.message);
      await hydrateFromDisk();
    });
  }
  return initPromise;
}

function recordAdminSecurityEvent(entry = {}) {
  const normalized = normalizeEvent(entry);
  events.push(normalized);
  events = trimEvents(events);
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => writeEventsToDatabase(delegate),
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
