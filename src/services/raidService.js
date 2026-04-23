const {
  normalizeServerScopeId,
  resolveTenantStoreScope,
} = require('../store/tenantStoreScope');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { resolveLegacyRuntimeBootstrapPolicy } = require('../utils/legacyRuntimeBootstrapPolicy');
const {
  createRaidRequestLegacy,
  createRaidSummaryLegacy,
  createRaidWindowLegacy,
  ensureRaidLegacyTables,
  getRaidRequestByIdLegacy,
  listRaidRequestsLegacy,
  listRaidSummariesLegacy,
  listRaidWindowsLegacy,
  reviewRaidRequestLegacy,
} = require('./raidLegacyCompatibilityService');

const initializedScopes = new Map();
const PLATFORM_RAID_RUNTIME_BOOTSTRAP_ENV = 'PLATFORM_RAID_RUNTIME_BOOTSTRAP';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeId(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
}

function normalizeLimit(value, fallback = 20, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(parsed)));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPrismaClientLike(db) {
  return Boolean(
    db
    && typeof db === 'object'
    && typeof db.$transaction === 'function'
    && typeof db.$disconnect === 'function',
  );
}

function toIsoString(value) {
  const date = normalizeDate(value);
  return date ? date.toISOString() : null;
}

function readRowValue(row, keys, fallback = null) {
  if (!row || typeof row !== 'object') return fallback;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] != null) {
      return row[key];
    }
  }
  return fallback;
}

function normalizeRequestStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['approved', 'rejected', 'pending'].includes(normalized)) {
    return normalized;
  }
  return 'pending';
}

function withRaidOperation(options = {}, operation = 'raid service operation') {
  return {
    ...options,
    operation: normalizeText(options.operation) || operation,
  };
}

function normalizeWindowStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['scheduled', 'live', 'completed', 'cancelled', 'canceled'].includes(normalized)) {
    return normalized === 'cancelled' ? 'canceled' : normalized;
  }
  return 'scheduled';
}

function mapRaidRequest(row) {
  return {
    id: normalizeId(readRowValue(row, ['id'])) || 0,
    tenantId: normalizeText(readRowValue(row, ['tenantId', 'tenant_id'])) || null,
    requesterUserId: normalizeText(readRowValue(row, ['requesterUserId', 'requester_user_id'])),
    requesterName: normalizeText(readRowValue(row, ['requesterName', 'requester_name'])) || 'Player',
    requestText: normalizeText(readRowValue(row, ['requestText', 'request_text'])),
    preferredWindow: normalizeText(readRowValue(row, ['preferredWindow', 'preferred_window'])) || null,
    status: normalizeRequestStatus(readRowValue(row, ['status'])),
    decisionNote: normalizeText(readRowValue(row, ['decisionNote', 'decision_note'])) || null,
    reviewedBy: normalizeText(readRowValue(row, ['reviewedBy', 'reviewed_by'])) || null,
    reviewedAt: toIsoString(readRowValue(row, ['reviewedAt', 'reviewed_at'])),
    serverId: normalizeText(readRowValue(row, ['serverId', 'server_id'])) || null,
    createdAt: toIsoString(readRowValue(row, ['createdAt', 'created_at'])),
    updatedAt: toIsoString(readRowValue(row, ['updatedAt', 'updated_at'])),
  };
}

function mapRaidWindow(row) {
  return {
    id: normalizeId(readRowValue(row, ['id'])) || 0,
    tenantId: normalizeText(readRowValue(row, ['tenantId', 'tenant_id'])) || null,
    requestId: normalizeId(readRowValue(row, ['requestId', 'request_id'])),
    title: normalizeText(readRowValue(row, ['title'])) || 'Raid window',
    startsAt: toIsoString(readRowValue(row, ['startsAt', 'starts_at'])),
    endsAt: toIsoString(readRowValue(row, ['endsAt', 'ends_at'])),
    status: normalizeWindowStatus(readRowValue(row, ['status'])),
    notes: normalizeText(readRowValue(row, ['notes'])) || null,
    actor: normalizeText(readRowValue(row, ['actor'])) || null,
    serverId: normalizeText(readRowValue(row, ['serverId', 'server_id'])) || null,
    createdAt: toIsoString(readRowValue(row, ['createdAt', 'created_at'])),
    updatedAt: toIsoString(readRowValue(row, ['updatedAt', 'updated_at'])),
  };
}

function mapRaidSummary(row) {
  return {
    id: normalizeId(readRowValue(row, ['id'])) || 0,
    tenantId: normalizeText(readRowValue(row, ['tenantId', 'tenant_id'])) || null,
    requestId: normalizeId(readRowValue(row, ['requestId', 'request_id'])),
    windowId: normalizeId(readRowValue(row, ['windowId', 'window_id'])),
    outcome: normalizeText(readRowValue(row, ['outcome'])) || 'summary',
    notes: normalizeText(readRowValue(row, ['notes'])) || null,
    createdBy: normalizeText(readRowValue(row, ['createdBy', 'created_by'])) || null,
    serverId: normalizeText(readRowValue(row, ['serverId', 'server_id'])) || null,
    createdAt: toIsoString(readRowValue(row, ['createdAt', 'created_at'])),
  };
}

function getRaidPersistenceMode(scope) {
  if (getRaidDelegates(scope)) {
    return 'prisma';
  }
  const runtime = resolveDatabaseRuntime();
  return runtime.isServerEngine ? 'prisma' : 'sql';
}

function getRaidDelegates(scope) {
  const db = scope?.db;
  if (!db || typeof db !== 'object') return null;
  const delegates = {
    requests: db.platformRaidRequest,
    windows: db.platformRaidWindow,
    summaries: db.platformRaidSummary,
  };
  return Object.values(delegates).every((delegate) => delegate && typeof delegate === 'object')
    ? delegates
    : null;
}

function getRaidDelegatesOrThrow(scope) {
  const delegates = getRaidDelegates(scope);
  if (delegates) return delegates;
  const error = new Error(
    'Platform raid schema is not ready. Run Prisma generate and database migrations before using raid tools.',
  );
  error.code = 'PLATFORM_RAID_SCHEMA_REQUIRED';
  error.statusCode = 500;
  throw error;
}

function resolveRaidRuntimeBootstrapPolicy(scope = {}) {
  const runtime = resolveDatabaseRuntime();
  return resolveLegacyRuntimeBootstrapPolicy({
    env: process.env,
    envName: PLATFORM_RAID_RUNTIME_BOOTSTRAP_ENV,
    runtime,
    prismaClientLike: isPrismaClientLike(scope?.db),
    policy: 'platform-raid',
  });
}

function isRaidRuntimeBootstrapAllowed(scope = {}) {
  return resolveRaidRuntimeBootstrapPolicy(scope).allowed;
}

function buildRaidSchemaRequiredError(details = {}) {
  const error = new Error(
    'Platform raid schema is not ready. Run Prisma generate and database migrations before using raid tools, or explicitly enable local runtime bootstrap for compatibility only.',
  );
  error.code = 'PLATFORM_RAID_SCHEMA_REQUIRED';
  error.statusCode = 500;
  error.raidSchema = details;
  return error;
}

async function ensureRaidTables(options = {}) {
  const scope = resolveTenantStoreScope(withRaidOperation(options, 'raid persistence'));
  if (getRaidPersistenceMode(scope) === 'prisma') {
    getRaidDelegatesOrThrow(scope);
    return scope;
  }
  if (!isRaidRuntimeBootstrapAllowed(scope)) {
    const bootstrapPolicy = resolveRaidRuntimeBootstrapPolicy(scope);
    throw buildRaidSchemaRequiredError({
      env: PLATFORM_RAID_RUNTIME_BOOTSTRAP_ENV,
      engine: resolveDatabaseRuntime().engine,
      datasourceKey: scope?.datasourceKey || null,
      bootstrapPolicy,
    });
  }
  return ensureRaidLegacyTables(scope, initializedScopes);
}

function sortRaidRequests(rows = []) {
  return [...rows].sort((left, right) => {
    const leftPending = String(left?.status || '') === 'pending' ? 0 : 1;
    const rightPending = String(right?.status || '') === 'pending' ? 0 : 1;
    if (leftPending !== rightPending) return leftPending - rightPending;
    const leftUpdated = new Date(left?.updatedAt || left?.createdAt || 0).getTime() || 0;
    const rightUpdated = new Date(right?.updatedAt || right?.createdAt || 0).getTime() || 0;
    if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;
    return Number(right?.id || 0) - Number(left?.id || 0);
  });
}

async function listRaidRequests(options = {}) {
  const scope = await ensureRaidTables(withRaidOperation(options, 'list raid requests'));
  const limit = normalizeLimit(options.limit, 20, 100);
  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const where = {};
    if (scope.tenantId) where.tenantId = scope.tenantId;
    if (options.serverId) where.serverId = normalizeServerScopeId(options.serverId);
    if (options.requesterUserId) where.requesterUserId = normalizeText(options.requesterUserId);
    if (options.status) where.status = normalizeRequestStatus(options.status);
    const rows = await delegates.requests.findMany({
      where,
      orderBy: [
        { updatedAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });
    return sortRaidRequests((Array.isArray(rows) ? rows : []).map(mapRaidRequest).filter(Boolean)).slice(0, limit);
  }

  const rows = await listRaidRequestsLegacy(scope, options, limit);
  return (Array.isArray(rows) ? rows : []).map(mapRaidRequest);
}

async function listRaidWindows(options = {}) {
  const scope = await ensureRaidTables(withRaidOperation(options, 'list raid windows'));
  const limit = normalizeLimit(options.limit, 20, 100);
  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const where = {};
    if (scope.tenantId) where.tenantId = scope.tenantId;
    if (options.serverId) where.serverId = normalizeServerScopeId(options.serverId);
    if (options.requestId != null) where.requestId = normalizeId(options.requestId);
    if (options.status) where.status = normalizeWindowStatus(options.status);
    const rows = await delegates.windows.findMany({
      where,
      orderBy: [
        { startsAt: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
    });
    return (Array.isArray(rows) ? rows : []).map(mapRaidWindow).filter(Boolean);
  }

  const rows = await listRaidWindowsLegacy(scope, options, limit);
  return (Array.isArray(rows) ? rows : []).map(mapRaidWindow);
}

async function listRaidSummaries(options = {}) {
  const scope = await ensureRaidTables(withRaidOperation(options, 'list raid summaries'));
  const limit = normalizeLimit(options.limit, 20, 100);
  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const where = {};
    if (scope.tenantId) where.tenantId = scope.tenantId;
    if (options.serverId) where.serverId = normalizeServerScopeId(options.serverId);
    if (options.requestId != null) where.requestId = normalizeId(options.requestId);
    if (options.windowId != null) where.windowId = normalizeId(options.windowId);
    const rows = await delegates.summaries.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });
    return (Array.isArray(rows) ? rows : []).map(mapRaidSummary).filter(Boolean);
  }

  const rows = await listRaidSummariesLegacy(scope, options, limit);
  return (Array.isArray(rows) ? rows : []).map(mapRaidSummary);
}

async function getRaidRequestById(id, options = {}) {
  const scope = await ensureRaidTables(withRaidOperation(options, 'get raid request'));
  const requestId = normalizeId(id);
  if (!requestId) return null;
  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const row = await delegates.requests.findUnique({
      where: { id: requestId },
    });
    return mapRaidRequest(row);
  }

  return mapRaidRequest(await getRaidRequestByIdLegacy(scope, requestId));
}

async function createRaidRequest(params = {}) {
  const scope = await ensureRaidTables(withRaidOperation(params, 'create raid request'));
  const requesterUserId = normalizeText(params.requesterUserId);
  const requesterName = normalizeText(params.requesterName) || requesterUserId || 'Player';
  const requestText = normalizeText(params.requestText);
  const preferredWindow = normalizeText(params.preferredWindow) || null;
  const serverId = normalizeServerScopeId(params.serverId);
  if (!requesterUserId || !requestText) {
    return { ok: false, reason: 'invalid-input' };
  }

  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const created = await delegates.requests.create({
      data: {
        tenantId: scope.tenantId || null,
        requesterUserId,
        requesterName,
        requestText,
        preferredWindow,
        status: 'pending',
        serverId,
      },
    });
    return {
      ok: true,
      request: mapRaidRequest(created),
    };
  }

  return {
    ok: true,
    request: await createRaidRequestLegacy(scope, {
      requesterUserId,
      requesterName,
      requestText,
      preferredWindow,
      serverId,
    }),
  };
}

async function reviewRaidRequest(params = {}) {
  const scope = await ensureRaidTables(withRaidOperation(params, 'review raid request'));
  const requestId = normalizeId(params.id);
  const nextStatus = normalizeRequestStatus(params.status);
  const decisionNote = normalizeText(params.decisionNote) || null;
  const reviewedBy = normalizeText(params.reviewedBy) || 'admin-web';
  if (!requestId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const existing = await getRaidRequestById(requestId, withRaidOperation(params, 'review raid request'));
  if (!existing) {
    return { ok: false, reason: 'not-found' };
  }

  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const updated = await delegates.requests.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        decisionNote,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
    return {
      ok: true,
      request: mapRaidRequest(updated),
    };
  }

  return {
    ok: true,
    request: await reviewRaidRequestLegacy(scope, {
      requestId,
      status: nextStatus,
      decisionNote,
      reviewedBy,
      existing,
    }),
  };
}

async function createRaidWindow(params = {}) {
  const scope = await ensureRaidTables(withRaidOperation(params, 'create raid window'));
  const requestId = normalizeId(params.requestId);
  const title = normalizeText(params.title);
  const startsAt = normalizeText(params.startsAt);
  const endsAt = normalizeText(params.endsAt) || null;
  const notes = normalizeText(params.notes) || null;
  const status = normalizeWindowStatus(params.status);
  const actor = normalizeText(params.actor) || 'admin-web';
  const serverId = normalizeServerScopeId(params.serverId);
  if (!title || !startsAt) {
    return { ok: false, reason: 'invalid-input' };
  }

  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const created = await delegates.windows.create({
      data: {
        tenantId: scope.tenantId || null,
        requestId,
        title,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        status,
        notes,
        actor,
        serverId,
      },
    });
    return {
      ok: true,
      window: mapRaidWindow(created),
    };
  }

  return {
    ok: true,
    window: await createRaidWindowLegacy(scope, {
      requestId,
      title,
      startsAt,
      endsAt,
      status,
      notes,
      actor,
      serverId,
    }),
  };
}

async function createRaidSummary(params = {}) {
  const scope = await ensureRaidTables(withRaidOperation(params, 'create raid summary'));
  const requestId = normalizeId(params.requestId);
  const windowId = normalizeId(params.windowId);
  const outcome = normalizeText(params.outcome);
  const notes = normalizeText(params.notes) || null;
  const createdBy = normalizeText(params.createdBy) || 'admin-web';
  const serverId = normalizeServerScopeId(params.serverId);
  if (!outcome) {
    return { ok: false, reason: 'invalid-input' };
  }

  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const created = await delegates.summaries.create({
      data: {
        tenantId: scope.tenantId || null,
        requestId,
        windowId,
        outcome,
        notes,
        createdBy,
        serverId,
      },
    });

    if (windowId) {
      await delegates.windows.update({
        where: { id: windowId },
        data: {
          status: 'completed',
        },
      }).catch(() => null);
    }

    return {
      ok: true,
      summary: mapRaidSummary(created),
    };
  }

  return {
    ok: true,
    summary: await createRaidSummaryLegacy(scope, {
      requestId,
      windowId,
      outcome,
      notes,
      createdBy,
      serverId,
    }),
  };
}

async function listRaidActivitySnapshot(options = {}) {
  const [requests, windows, summaries] = await Promise.all([
    listRaidRequests(withRaidOperation(options, 'list raid activity snapshot requests')),
    listRaidWindows(withRaidOperation(options, 'list raid activity snapshot windows')),
    listRaidSummaries(withRaidOperation(options, 'list raid activity snapshot summaries')),
  ]);
  return {
    requests,
    windows,
    summaries,
  };
}

module.exports = {
  createRaidRequest,
  createRaidSummary,
  createRaidWindow,
  ensureRaidTables,
  listRaidActivitySnapshot,
  listRaidRequests,
  listRaidSummaries,
  listRaidWindows,
  resolveRaidRuntimeBootstrapPolicy,
  reviewRaidRequest,
};
