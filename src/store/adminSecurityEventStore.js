'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { getFilePath } = require('./_persist');

const FILE_PATH = getFilePath('admin-security-events.json');
const MAX_ENTRIES = Math.max(
  100,
  Math.min(5000, Math.trunc(Number(process.env.ADMIN_WEB_SECURITY_EVENT_MAX || 1200) || 1200)),
);

let events = null;
let persistTimer = null;

function ensureParentDir() {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
}

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

function normalizeEvent(entry = {}) {
  return {
    id:
      normalizeText(entry.id, 120)
      || `admin-sec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    at: normalizeIso(entry.at),
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
    data: entry.data && typeof entry.data === 'object' ? entry.data : null,
  };
}

function buildDefaultEvents() {
  return [];
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    ensureParentDir();
    const tmpPath = `${FILE_PATH}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(events || [], null, 2), 'utf8');
      fs.renameSync(tmpPath, FILE_PATH);
    } catch (error) {
      console.error('[adminSecurityEventStore] failed to persist:', error.message);
    }
  }, 250);
  if (typeof persistTimer.unref === 'function') {
    persistTimer.unref();
  }
}

function initAdminSecurityEventStore() {
  if (events) return events;
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        events = Array.isArray(parsed) ? parsed.map((entry) => normalizeEvent(entry)) : [];
        return events;
      }
    }
  } catch (error) {
    console.error('[adminSecurityEventStore] failed to hydrate:', error.message);
  }
  events = buildDefaultEvents();
  return events;
}

function recordAdminSecurityEvent(entry = {}) {
  initAdminSecurityEventStore();
  events.push(normalizeEvent(entry));
  if (events.length > MAX_ENTRIES) {
    events.splice(0, events.length - MAX_ENTRIES);
  }
  schedulePersist();
  return { ...events[events.length - 1] };
}

function listAdminSecurityEvents(options = {}) {
  initAdminSecurityEventStore();
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

function replaceAdminSecurityEvents(nextRows = []) {
  events = buildDefaultEvents();
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    events.push(normalizeEvent(row));
  }
  if (events.length > MAX_ENTRIES) {
    events.splice(0, events.length - MAX_ENTRIES);
  }
  schedulePersist();
  return events.length;
}

function clearAdminSecurityEvents() {
  events = buildDefaultEvents();
  schedulePersist();
  return [];
}

initAdminSecurityEventStore();

module.exports = {
  clearAdminSecurityEvents,
  initAdminSecurityEventStore,
  listAdminSecurityEvents,
  recordAdminSecurityEvent,
  replaceAdminSecurityEvents,
};
