'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');

const { prisma } = require('../prisma');
const { atomicWriteJson, getFilePath, isDbPersistenceEnabled } = require('./_persist');

const FILE_PATH = getFilePath('admin-request-log.json');
const MAX_ENTRIES = Math.max(
  50,
  Math.min(5000, Math.trunc(Number(process.env.ADMIN_WEB_REQUEST_LOG_MAX || 800) || 800)),
);

let entries = [];
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

function averageFromValues(values = []) {
  const numbers = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  if (numbers.length === 0) return null;
  const total = numbers.reduce((sum, value) => sum + value, 0);
  return total / numbers.length;
}

function percentileFromValues(values = [], percentile = 95) {
  const numbers = values
    .filter((value) => Number.isFinite(Number(value)))
    .map((value) => Number(value))
    .sort((left, right) => left - right);
  if (numbers.length === 0) return null;
  const normalizedPercentile = Math.max(0, Math.min(100, Number(percentile) || 0));
  const rank = Math.max(
    0,
    Math.min(numbers.length - 1, Math.ceil((normalizedPercentile / 100) * numbers.length) - 1),
  );
  return numbers[rank];
}

function summarizeRouteHotspots(entriesToSummarize = [], limit = 5) {
  const grouped = new Map();
  for (const entry of entriesToSummarize) {
    const routeGroup = normalizeString(entry?.routeGroup, 120) || 'unknown';
    const samplePath = normalizeString(entry?.path, 260) || '/';
    if (!grouped.has(routeGroup)) {
      grouped.set(routeGroup, {
        routeGroup,
        samplePath,
        requests: 0,
        errors: 0,
        serverErrors: 0,
        unauthorized: 0,
        slowRequests: 0,
        latencies: [],
        latestAt: null,
      });
    }
    const bucket = grouped.get(routeGroup);
    bucket.requests += 1;
    if (Number(entry?.statusCode || 0) >= 400) bucket.errors += 1;
    if (Number(entry?.statusCode || 0) >= 500) bucket.serverErrors += 1;
    if (Number(entry?.statusCode || 0) === 401 || Number(entry?.statusCode || 0) === 403) {
      bucket.unauthorized += 1;
    }
    const latencyMs = Math.max(0, Math.trunc(Number(entry?.latencyMs || 0) || 0));
    bucket.latencies.push(latencyMs);
    if (latencyMs >= 1000) bucket.slowRequests += 1;
    const at = normalizeIso(entry?.at);
    if (at && (!bucket.latestAt || at > bucket.latestAt)) {
      bucket.latestAt = at;
    }
    if (bucket.samplePath === '/' && samplePath !== '/') {
      bucket.samplePath = samplePath;
    }
  }

  return Array.from(grouped.values())
    .map((bucket) => ({
      routeGroup: bucket.routeGroup,
      samplePath: bucket.samplePath,
      requests: bucket.requests,
      errors: bucket.errors,
      serverErrors: bucket.serverErrors,
      unauthorized: bucket.unauthorized,
      slowRequests: bucket.slowRequests,
      avgLatencyMs: averageFromValues(bucket.latencies),
      p95LatencyMs: percentileFromValues(bucket.latencies, 95),
      latestAt: bucket.latestAt,
    }))
    .sort((left, right) => {
      if (right.errors !== left.errors) return right.errors - left.errors;
      if (right.slowRequests !== left.slowRequests) return right.slowRequests - left.slowRequests;
      if (right.requests !== left.requests) return right.requests - left.requests;
      return Number(right.p95LatencyMs || 0) - Number(left.p95LatencyMs || 0);
    })
    .slice(0, Math.max(1, Math.min(20, Math.trunc(Number(limit) || 5))));
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

function serializeEntryRow(entry = {}) {
  const normalized = normalizeEntry(entry);
  return {
    id: normalized.id,
    occurredAt: new Date(normalized.at),
    method: normalized.method,
    path: normalized.path,
    routeGroup: normalized.routeGroup,
    statusCode: normalized.statusCode,
    statusClass: normalized.statusClass,
    latencyMs: normalized.latencyMs,
    ok: normalized.ok,
    authMode: normalized.authMode,
    user: normalized.user,
    role: normalized.role,
    tenantId: normalized.tenantId,
    ip: normalized.ip,
    origin: normalized.origin,
    userAgent: normalized.userAgent,
    source: normalized.source,
    note: normalized.note,
    error: normalized.error,
  };
}

function getRequestLogDelegate(client = prisma) {
  if (!client || typeof client !== 'object') return null;
  const delegate = client.platformAdminRequestLog;
  if (!delegate || typeof delegate.findMany !== 'function') return null;
  return delegate;
}

function getPersistenceMode() {
  const explicit = String(process.env.ADMIN_REQUEST_LOG_STORE_MODE || '').trim().toLowerCase();
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
    || message.includes('platformadminrequestlog');
}

async function runWithPreferredPersistence(dbWork, fileWork) {
  const mode = getPersistenceMode();
  const delegate = getRequestLogDelegate();
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
      console.error(`[adminRequestLogStore] ${label} failed:`, error.message);
    });
  return writeQueue;
}

function writeEntriesToDisk() {
  const payload = Array.isArray(entries) ? entries.slice(-MAX_ENTRIES) : [];
  atomicWriteJson(FILE_PATH, payload);
}

async function writeEntriesToDatabase(delegate = getRequestLogDelegate()) {
  if (!delegate) return;
  const rows = (Array.isArray(entries) ? entries : [])
    .slice(-MAX_ENTRIES)
    .map(serializeEntryRow);
  await delegate.deleteMany({});
  if (rows.length > 0) {
    await delegate.createMany({ data: rows });
  }
}

async function hydrateFromDisk() {
  try {
    if (fs.existsSync(FILE_PATH)) {
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((entry) => normalizeEntry(entry)) : [];
      }
    }
  } catch (error) {
    console.error('[adminRequestLogStore] failed to hydrate:', error.message);
  }
  return buildDefaultEntries();
}

async function hydrateFromDatabase(delegate = getRequestLogDelegate()) {
  if (!delegate) {
    return buildDefaultEntries();
  }
  const rows = await delegate.findMany({
    orderBy: { occurredAt: 'asc' },
    take: MAX_ENTRIES,
  });
  return Array.isArray(rows) ? rows.map((entry) => normalizeEntry({
    id: entry.id,
    at: entry.occurredAt,
    method: entry.method,
    path: entry.path,
    routeGroup: entry.routeGroup,
    statusCode: entry.statusCode,
    latencyMs: entry.latencyMs,
    authMode: entry.authMode,
    user: entry.user,
    role: entry.role,
    tenantId: entry.tenantId,
    ip: entry.ip,
    origin: entry.origin,
    userAgent: entry.userAgent,
    source: entry.source,
    note: entry.note,
    error: entry.error,
  })) : [];
}

function mergeHydratedEntries(hydrated = []) {
  const currentById = new Map((Array.isArray(entries) ? entries : []).map((entry) => [entry.id, entry]));
  for (const entry of Array.isArray(hydrated) ? hydrated : []) {
    if (!currentById.has(entry.id)) {
      currentById.set(entry.id, entry);
    }
  }
  entries = Array.from(currentById.values())
    .sort((left, right) => String(left.at || '').localeCompare(String(right.at || '')))
    .slice(-MAX_ENTRIES);
}

function initAdminRequestLogStore() {
  if (!initPromise) {
    const startVersion = mutationVersion;
    initPromise = runWithPreferredPersistence(
      (delegate) => hydrateFromDatabase(delegate),
      () => hydrateFromDisk(),
    ).then((hydrated) => {
      if (startVersion === mutationVersion) {
        entries = Array.isArray(hydrated) ? hydrated.slice(-MAX_ENTRIES) : buildDefaultEntries();
      } else {
        mergeHydratedEntries(hydrated);
      }
      return entries;
    }).catch(async (error) => {
      if (getPersistenceMode() === 'db' || !shouldFallbackToFile(error)) {
        throw error;
      }
      console.error('[adminRequestLogStore] failed to hydrate from prisma:', error.message);
      entries = await hydrateFromDisk();
      return entries;
    });
  }
  return initPromise;
}

function recordAdminRequestLog(entry = {}) {
  void initAdminRequestLogStore();
  mutationVersion += 1;
  entries.push(normalizeEntry(entry));
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => writeEntriesToDatabase(delegate),
      async () => writeEntriesToDisk(),
    ),
    'persist',
  );
  return entries[entries.length - 1];
}

function listAdminRequestLogs(options = {}) {
  void initAdminRequestLogStore();
  const limit = Math.max(1, Math.min(MAX_ENTRIES, Math.trunc(Number(options.limit || 200) || 200)));
  const windowMs = Number.isFinite(Number(options.windowMs))
    ? Math.max(60 * 1000, Math.trunc(Number(options.windowMs) || 0))
    : null;
  const cutoff = windowMs == null ? null : Date.now() - windowMs;
  const statusClass = normalizeString(options.statusClass, 8);
  const routeGroup = normalizeString(options.routeGroup, 120);
  const authMode = normalizeString(options.authMode, 80);
  const requestId = normalizeString(options.requestId, 120);
  const tenantId = normalizeString(options.tenantId, 120);
  const pathContains = normalizeString(options.pathContains, 200)?.toLowerCase() || null;
  const onlyErrors = options.onlyErrors === true;

  return entries
    .filter((entry) => {
      if (cutoff != null) {
        const at = Number(new Date(entry.at).getTime());
        if (!Number.isFinite(at) || at < cutoff) return false;
      }
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
  void initAdminRequestLogStore();
  mutationVersion += 1;
  entries = buildDefaultEntries();
  queueWrite(
    () => runWithPreferredPersistence(
      (delegate) => writeEntriesToDatabase(delegate),
      async () => writeEntriesToDisk(),
    ),
    'clear',
  );
  return [];
}

function getAdminRequestLogMetrics(options = {}) {
  void initAdminRequestLogStore();
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
    slowRequests: recent.filter((entry) => Number(entry.latencyMs || 0) >= 1000).length,
    avgLatencyMs: averageFromValues(recent.map((entry) => entry.latencyMs)),
    p95LatencyMs: percentileFromValues(recent.map((entry) => entry.latencyMs), 95),
    routeHotspots: summarizeRouteHotspots(recent, 5),
    statusCounts: {
      success: recent.filter((entry) => entry.statusCode >= 200 && entry.statusCode < 400).length,
      clientError: recent.filter((entry) => entry.statusCode >= 400 && entry.statusCode < 500).length,
      serverError: recent.filter((entry) => entry.statusCode >= 500).length,
    },
    latestRequestAt: recent[recent.length - 1]?.at || null,
  };
}

function waitForAdminRequestLogPersistence() {
  return writeQueue;
}

void initAdminRequestLogStore().catch((error) => {
  console.error('[adminRequestLogStore] init failed:', error.message);
});

module.exports = {
  clearAdminRequestLogs,
  getAdminRequestLogMetrics,
  initAdminRequestLogStore,
  listAdminRequestLogs,
  recordAdminRequestLog,
  waitForAdminRequestLogPersistence,
};
