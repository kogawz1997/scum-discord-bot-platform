'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { getFilePath } = require('./_persist');

const FILE_PATH = getFilePath('admin-request-log.json');
const MAX_ENTRIES = Math.max(
  50,
  Math.min(5000, Math.trunc(Number(process.env.ADMIN_WEB_REQUEST_LOG_MAX || 800) || 800)),
);

let entries = null;
let persistTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function normalizeIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeString(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function normalizeMethod(value) {
  return normalizeString(String(value || '').toUpperCase(), 16) || 'GET';
}

function normalizeStatusCode(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function buildDefaultEntries() {
  return [];
}

function normalizeEntry(entry = {}) {
  const at = normalizeIso(entry.at) || nowIso();
  const statusCode = normalizeStatusCode(entry.statusCode);
  return {
    id:
      normalizeString(entry.id || entry.requestId, 120)
      || `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    at,
    method: normalizeMethod(entry.method),
    path: normalizeString(entry.path, 260) || '/',
    routeGroup: normalizeString(entry.routeGroup, 120) || 'unknown',
    statusCode,
    statusClass:
      statusCode >= 500
        ? '5xx'
        : statusCode >= 400
          ? '4xx'
          : statusCode >= 300
            ? '3xx'
            : statusCode >= 200
              ? '2xx'
              : 'other',
    latencyMs: Math.max(0, Math.trunc(Number(entry.latencyMs || 0) || 0)),
    ok: statusCode > 0 && statusCode < 400,
    authMode: normalizeString(entry.authMode, 80),
    user: normalizeString(entry.user, 180),
    role: normalizeString(entry.role, 80),
    tenantId: normalizeString(entry.tenantId, 120),
    ip: normalizeString(entry.ip, 120),
    origin: normalizeString(entry.origin, 240),
    userAgent: normalizeString(entry.userAgent, 240),
    source: normalizeString(entry.source, 120),
    note: normalizeString(entry.note, 400),
    error: normalizeString(entry.error, 400),
  };
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const payload = Array.isArray(entries) ? entries.slice(-MAX_ENTRIES) : [];
    const tmpPath = `${FILE_PATH}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpPath, FILE_PATH);
    } catch (error) {
      console.error('[adminRequestLogStore] failed to persist:', error.message);
    }
  }, 250);
  if (typeof persistTimer.unref === 'function') {
    persistTimer.unref();
  }
}

function initAdminRequestLogStore() {
  if (entries) return entries;
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        entries = Array.isArray(parsed) ? parsed.map((entry) => normalizeEntry(entry)) : [];
        return entries;
      }
    }
  } catch (error) {
    console.error('[adminRequestLogStore] failed to hydrate:', error.message);
  }
  entries = buildDefaultEntries();
  return entries;
}

function recordAdminRequestLog(entry = {}) {
  initAdminRequestLogStore();
  entries.push(normalizeEntry(entry));
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  schedulePersist();
  return entries[entries.length - 1];
}

function listAdminRequestLogs(options = {}) {
  initAdminRequestLogStore();
  const limit = Math.max(1, Math.min(MAX_ENTRIES, Math.trunc(Number(options.limit || 200) || 200)));
  const statusClass = normalizeString(options.statusClass, 8);
  const routeGroup = normalizeString(options.routeGroup, 120);
  const authMode = normalizeString(options.authMode, 80);
  const requestId = normalizeString(options.requestId, 120);
  const tenantId = normalizeString(options.tenantId, 120);
  const pathContains = normalizeString(options.pathContains, 200)?.toLowerCase() || null;
  const onlyErrors = options.onlyErrors === true;

  return entries
    .filter((entry) => {
      if (statusClass && entry.statusClass !== statusClass) return false;
      if (routeGroup && entry.routeGroup !== routeGroup) return false;
      if (authMode && entry.authMode !== authMode) return false;
      if (requestId && entry.id !== requestId) return false;
      if (tenantId && entry.tenantId !== tenantId) return false;
      if (pathContains && !String(entry.path || '').toLowerCase().includes(pathContains)) return false;
      if (onlyErrors && entry.ok) return false;
      return true;
    })
    .slice(-limit)
    .reverse();
}

function clearAdminRequestLogs() {
  entries = buildDefaultEntries();
  schedulePersist();
  return [];
}

function getAdminRequestLogMetrics(options = {}) {
  initAdminRequestLogStore();
  const windowMs = Math.max(
    60 * 1000,
    Math.trunc(Number(options.windowMs || 15 * 60 * 1000) || 15 * 60 * 1000),
  );
  const cutoff = Date.now() - windowMs;
  const recent = entries.filter((entry) => {
    const at = Number(new Date(entry.at).getTime());
    return Number.isFinite(at) && at >= cutoff;
  });
  return {
    windowMs,
    total: recent.length,
    errors: recent.filter((entry) => entry.statusCode >= 400).length,
    serverErrors: recent.filter((entry) => entry.statusCode >= 500).length,
    unauthorized: recent.filter((entry) => entry.statusCode === 401 || entry.statusCode === 403).length,
    latestRequestAt: recent[recent.length - 1]?.at || null,
  };
}

initAdminRequestLogStore();

module.exports = {
  clearAdminRequestLogs,
  getAdminRequestLogMetrics,
  initAdminRequestLogStore,
  listAdminRequestLogs,
  recordAdminRequestLog,
};
