'use strict';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeId(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.trunc(parsed);
  return normalized > 0 ? normalized : null;
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

async function ensureRaidLegacyTables(scope, initializedScopes) {
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

async function readNextLegacyId(scope, tableName) {
  const rows = await scope.db.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ${tableName}`);
  const value = readRowValue(Array.isArray(rows) ? rows[0] : null, ['next_id', 'NEXT_ID'], 1);
  return Math.max(1, normalizeId(value) || 1);
}

function buildWhereClause(filters = {}) {
  const clauses = [];
  const serverId = normalizeText(filters.serverId);
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

async function listRaidRequestsLegacy(scope, options = {}, limit = 20) {
  return scope.db.$queryRawUnsafe(`
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
}

async function listRaidWindowsLegacy(scope, options = {}, limit = 20) {
  return scope.db.$queryRawUnsafe(`
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
}

async function listRaidSummariesLegacy(scope, options = {}, limit = 20) {
  return scope.db.$queryRawUnsafe(`
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
}

async function getRaidRequestByIdLegacy(scope, requestId) {
  const rows = await scope.db.$queryRawUnsafe(`
    SELECT *
    FROM platform_raid_requests
    WHERE id = ${requestId}
    LIMIT 1
  `);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function createRaidRequestLegacy(scope, input = {}) {
  const id = await readNextLegacyId(scope, 'platform_raid_requests');
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
      ${sqlString(input.requesterUserId)},
      ${sqlString(input.requesterName)},
      ${sqlString(input.requestText)},
      ${sqlString(input.preferredWindow)},
      'pending',
      NULL,
      NULL,
      NULL,
      ${sqlString(input.serverId)},
      ${sqlString(now)},
      ${sqlString(now)}
    )
  `);

  return {
    id,
    tenantId: scope.tenantId || null,
    requesterUserId: input.requesterUserId,
    requesterName: input.requesterName,
    requestText: input.requestText,
    preferredWindow: input.preferredWindow,
    status: 'pending',
    decisionNote: null,
    reviewedBy: null,
    reviewedAt: null,
    serverId: input.serverId,
    createdAt: now,
    updatedAt: now,
  };
}

async function reviewRaidRequestLegacy(scope, input = {}) {
  const now = new Date().toISOString();
  await scope.db.$executeRawUnsafe(`
    UPDATE platform_raid_requests
    SET
      status = ${sqlString(input.status)},
      decision_note = ${sqlString(input.decisionNote)},
      reviewed_by = ${sqlString(input.reviewedBy)},
      reviewed_at = ${sqlString(now)},
      updated_at = ${sqlString(now)}
    WHERE id = ${input.requestId}
  `);

  return {
    ...input.existing,
    status: input.status,
    decisionNote: input.decisionNote,
    reviewedBy: input.reviewedBy,
    reviewedAt: now,
    updatedAt: now,
  };
}

async function createRaidWindowLegacy(scope, input = {}) {
  const id = await readNextLegacyId(scope, 'platform_raid_windows');
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
      ${input.requestId || 'NULL'},
      ${sqlString(input.title)},
      ${sqlString(input.startsAt)},
      ${sqlString(input.endsAt)},
      ${sqlString(input.status)},
      ${sqlString(input.notes)},
      ${sqlString(input.actor)},
      ${sqlString(input.serverId)},
      ${sqlString(now)},
      ${sqlString(now)}
    )
  `);

  return {
    id,
    tenantId: scope.tenantId || null,
    requestId: input.requestId,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status,
    notes: input.notes,
    actor: input.actor,
    serverId: input.serverId,
    createdAt: now,
    updatedAt: now,
  };
}

async function createRaidSummaryLegacy(scope, input = {}) {
  const id = await readNextLegacyId(scope, 'platform_raid_summaries');
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
      ${input.requestId || 'NULL'},
      ${input.windowId || 'NULL'},
      ${sqlString(input.outcome)},
      ${sqlString(input.notes)},
      ${sqlString(input.createdBy)},
      ${sqlString(input.serverId)},
      ${sqlString(now)}
    )
  `);

  if (input.windowId) {
    await scope.db.$executeRawUnsafe(`
      UPDATE platform_raid_windows
      SET
        status = 'completed',
        updated_at = ${sqlString(now)}
      WHERE id = ${input.windowId}
    `);
  }

  return {
    id,
    tenantId: scope.tenantId || null,
    requestId: input.requestId,
    windowId: input.windowId,
    outcome: input.outcome,
    notes: input.notes,
    createdBy: input.createdBy,
    serverId: input.serverId,
    createdAt: now,
  };
}

module.exports = {
  createRaidRequestLegacy,
  createRaidSummaryLegacy,
  createRaidWindowLegacy,
  ensureRaidLegacyTables,
  getRaidRequestByIdLegacy,
  listRaidRequestsLegacy,
  listRaidSummariesLegacy,
  listRaidWindowsLegacy,
  reviewRaidRequestLegacy,
};
