const {
  normalizeServerScopeId,
  resolveTenantStoreScope,
} = require('../store/tenantStoreScope');
const { resolveDatabaseRuntime } = require('../utils/dbEngine');
const { resolveLegacyRuntimeBootstrapPolicy } = require('../utils/legacyRuntimeBootstrapPolicy');

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

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
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
  const scope = resolveTenantStoreScope(options);
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

  const existing = initializedScopes.get(scope.datasourceKey);
  if (existing) {
    await existing;
    return scope;
  }

  const initPromise = (async () => {
    await scope.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_raid_requests (
        id INTEGER PRIMARY KEY,
        requester_user_id TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        request_text TEXT NOT NULL,
        preferred_window TEXT,
        status TEXT NOT NULL,
        decision_note TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        server_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await scope.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_raid_windows (
        id INTEGER PRIMARY KEY,
        request_id INTEGER,
        title TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        actor TEXT,
        server_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await scope.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS platform_raid_summaries (
        id INTEGER PRIMARY KEY,
        request_id INTEGER,
        window_id INTEGER,
        outcome TEXT NOT NULL,
        notes TEXT,
        created_by TEXT,
        server_id TEXT,
        created_at TEXT NOT NULL
      )
    `);
    await scope.db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_raid_requests_status_updated
      ON platform_raid_requests (status, updated_at)
    `);
    await scope.db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_raid_windows_status_starts
      ON platform_raid_windows (status, starts_at)
    `);
    await scope.db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_platform_raid_summaries_created
      ON platform_raid_summaries (created_at)
    `);
  })().catch((error) => {
    initializedScopes.delete(scope.datasourceKey);
    throw error;
  });

  initializedScopes.set(scope.datasourceKey, initPromise);
  await initPromise;
  return scope;
}

async function readNextId(scope, tableName) {
  const rows = await scope.db.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${tableName}`);
  const value = readRowValue(Array.isArray(rows) ? rows[0] : null, ['next_id', 'NEXT_ID'], 1);
  return Math.max(1, normalizeId(value) || 1);
}

function buildWhereClause(filters = {}) {
  const clauses = [];
  const serverId = normalizeServerScopeId(filters.serverId);
  const requesterUserId = normalizeText(filters.requesterUserId);
  const requestId = normalizeId(filters.requestId);
  const windowId = normalizeId(filters.windowId);
  const status = normalizeText(filters.status).toLowerCase();

  if (serverId) clauses.push(`server_id = ${sqlString(serverId)}`);
  if (requesterUserId) clauses.push(`requester_user_id = ${sqlString(requesterUserId)}`);
  if (requestId) clauses.push(`request_id = ${requestId}`);
  if (windowId) clauses.push(`window_id = ${windowId}`);
  if (status) clauses.push(`status = ${sqlString(status)}`);

  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
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
  const scope = await ensureRaidTables(options);
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

  const rows = await scope.db.$queryRawUnsafe(`
    SELECT *
    FROM platform_raid_requests
    ${buildWhereClause({
      serverId: options.serverId,
      requesterUserId: options.requesterUserId,
      status: options.status,
    })}
    ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at DESC, id DESC
    LIMIT ${limit}
  `);
  return (Array.isArray(rows) ? rows : []).map(mapRaidRequest);
}

async function listRaidWindows(options = {}) {
  const scope = await ensureRaidTables(options);
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

  const rows = await scope.db.$queryRawUnsafe(`
    SELECT *
    FROM platform_raid_windows
    ${buildWhereClause({
      serverId: options.serverId,
      requestId: options.requestId,
      status: options.status,
    })}
    ORDER BY starts_at ASC, id ASC
    LIMIT ${limit}
  `);
  return (Array.isArray(rows) ? rows : []).map(mapRaidWindow);
}

async function listRaidSummaries(options = {}) {
  const scope = await ensureRaidTables(options);
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

  const rows = await scope.db.$queryRawUnsafe(`
    SELECT *
    FROM platform_raid_summaries
    ${buildWhereClause({
      serverId: options.serverId,
      requestId: options.requestId,
      windowId: options.windowId,
    })}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `);
  return (Array.isArray(rows) ? rows : []).map(mapRaidSummary);
}

async function getRaidRequestById(id, options = {}) {
  const scope = await ensureRaidTables(options);
  const requestId = normalizeId(id);
  if (!requestId) return null;
  const delegates = getRaidDelegates(scope);
  if (delegates) {
    const row = await delegates.requests.findUnique({
      where: { id: requestId },
    });
    return mapRaidRequest(row);
  }

  const rows = await scope.db.$queryRawUnsafe(`
    SELECT *
    FROM platform_raid_requests
    WHERE id = ${requestId}
    LIMIT 1
  `);
  return Array.isArray(rows) && rows[0] ? mapRaidRequest(rows[0]) : null;
}

async function createRaidRequest(params = {}) {
  const scope = await ensureRaidTables(params);
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

  const id = await readNextId(scope, 'platform_raid_requests');
  const now = new Date().toISOString();
  await scope.db.$executeRawUnsafe(`
    INSERT INTO platform_raid_requests (
      id,
      requester_user_id,
      requester_name,
      request_text,
      preferred_window,
      status,
      decision_note,
      reviewed_by,
      reviewed_at,
      server_id,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${sqlString(requesterUserId)},
      ${sqlString(requesterName)},
      ${sqlString(requestText)},
      ${sqlString(preferredWindow)},
      'pending',
      NULL,
      NULL,
      NULL,
      ${sqlString(serverId)},
      ${sqlString(now)},
      ${sqlString(now)}
    )
  `);

  return {
    ok: true,
    request: {
      id,
      tenantId: scope.tenantId || null,
      requesterUserId,
      requesterName,
      requestText,
      preferredWindow,
      status: 'pending',
      decisionNote: null,
      reviewedBy: null,
      reviewedAt: null,
      serverId,
      createdAt: now,
      updatedAt: now,
    },
  };
}

async function reviewRaidRequest(params = {}) {
  const scope = await ensureRaidTables(params);
  const requestId = normalizeId(params.id);
  const nextStatus = normalizeRequestStatus(params.status);
  const decisionNote = normalizeText(params.decisionNote) || null;
  const reviewedBy = normalizeText(params.reviewedBy) || 'admin-web';
  if (!requestId) {
    return { ok: false, reason: 'invalid-input' };
  }

  const existing = await getRaidRequestById(requestId, params);
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

  const now = new Date().toISOString();
  await scope.db.$executeRawUnsafe(`
    UPDATE platform_raid_requests
    SET
      status = ${sqlString(nextStatus)},
      decision_note = ${sqlString(decisionNote)},
      reviewed_by = ${sqlString(reviewedBy)},
      reviewed_at = ${sqlString(now)},
      updated_at = ${sqlString(now)}
    WHERE id = ${requestId}
  `);

  return {
    ok: true,
    request: {
      ...existing,
      status: nextStatus,
      decisionNote,
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    },
  };
}

async function createRaidWindow(params = {}) {
  const scope = await ensureRaidTables(params);
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

  const id = await readNextId(scope, 'platform_raid_windows');
  const now = new Date().toISOString();
  await scope.db.$executeRawUnsafe(`
    INSERT INTO platform_raid_windows (
      id,
      request_id,
      title,
      starts_at,
      ends_at,
      status,
      notes,
      actor,
      server_id,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${requestId || 'NULL'},
      ${sqlString(title)},
      ${sqlString(startsAt)},
      ${sqlString(endsAt)},
      ${sqlString(status)},
      ${sqlString(notes)},
      ${sqlString(actor)},
      ${sqlString(serverId)},
      ${sqlString(now)},
      ${sqlString(now)}
    )
  `);

  return {
    ok: true,
    window: {
      id,
      tenantId: scope.tenantId || null,
      requestId,
      title,
      startsAt,
      endsAt,
      status,
      notes,
      actor,
      serverId,
      createdAt: now,
      updatedAt: now,
    },
  };
}

async function createRaidSummary(params = {}) {
  const scope = await ensureRaidTables(params);
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

  const id = await readNextId(scope, 'platform_raid_summaries');
  const now = new Date().toISOString();
  await scope.db.$executeRawUnsafe(`
    INSERT INTO platform_raid_summaries (
      id,
      request_id,
      window_id,
      outcome,
      notes,
      created_by,
      server_id,
      created_at
    ) VALUES (
      ${id},
      ${requestId || 'NULL'},
      ${windowId || 'NULL'},
      ${sqlString(outcome)},
      ${sqlString(notes)},
      ${sqlString(createdBy)},
      ${sqlString(serverId)},
      ${sqlString(now)}
    )
  `);

  if (windowId) {
    await scope.db.$executeRawUnsafe(`
      UPDATE platform_raid_windows
      SET
        status = 'completed',
        updated_at = ${sqlString(now)}
      WHERE id = ${windowId}
    `);
  }

  return {
    ok: true,
    summary: {
      id,
      tenantId: scope.tenantId || null,
      requestId,
      windowId,
      outcome,
      notes,
      createdBy,
      serverId,
      createdAt: now,
    },
  };
}

async function listRaidActivitySnapshot(options = {}) {
  const [requests, windows, summaries] = await Promise.all([
    listRaidRequests(options),
    listRaidWindows(options),
    listRaidSummaries(options),
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
