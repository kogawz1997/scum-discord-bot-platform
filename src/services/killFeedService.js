const { resolveTenantServerStoreScope } = require('../store/tenantStoreScope');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
}

function clampLimit(value, fallback = 20, min = 1, max = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(numeric)));
}

function stringifyMetadata(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseMetadata(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value) {
  const date = normalizeDate(value);
  return date ? date.toISOString() : null;
}

function normalizeScopedSchemaTenantId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isMissingKillFeedTableError(error, tenantId = null) {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '').trim().toUpperCase();
  if (code !== 'P2021' && code !== 'P2022') return false;
  const message = String(error.message || '').toLowerCase();
  const table = String(error?.meta?.table || '').toLowerCase();
  const normalizedTenantId = normalizeScopedSchemaTenantId(tenantId);
  const schemaName = normalizedTenantId ? `tenant_${normalizedTenantId}` : '';
  return message.includes('does not exist in the current database')
    || message.includes('no such table')
    || table.endsWith('.kill_feed_events')
    || table === 'kill_feed_events'
    || (schemaName && table.includes(`${schemaName}.kill_feed_events`));
}

function normalizeKillFeedRow(row = {}) {
  const id = Number(row?.id || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id: Math.trunc(id),
    tenantId: normalizeText(row?.tenantId) || null,
    serverId: normalizeText(row?.serverId) || null,
    killerName: normalizeText(row?.killerName) || 'Unknown',
    killerSteamId: normalizeText(row?.killerSteamId) || null,
    killerUserId: normalizeText(row?.killerUserId) || null,
    victimName: normalizeText(row?.victimName) || 'Unknown',
    victimSteamId: normalizeText(row?.victimSteamId) || null,
    victimUserId: normalizeText(row?.victimUserId) || null,
    weapon: normalizeText(row?.weapon) || 'Unknown weapon',
    distance: normalizeInteger(row?.distance),
    hitZone: normalizeText(row?.hitZone) || null,
    sector: normalizeText(row?.sector) || null,
    mapImageUrl: normalizeText(row?.mapImageUrl) || null,
    occurredAt: toIsoString(row?.occurredAt || row?.createdAt),
    createdAt: toIsoString(row?.createdAt || row?.occurredAt),
    metadata: parseMetadata(row?.metadataJson),
  };
}

async function recordKillFeedEntry(payload = {}, options = {}) {
  const scope = resolveTenantServerStoreScope({
    ...options,
    tenantId: options.tenantId || payload.tenantId,
    serverId: options.serverId || payload.serverId,
  });
  const occurredAt = normalizeDate(payload.occurredAt) || new Date();
  const created = await scope.db.killFeedEvent.create({
    data: {
      tenantId: scope.tenantId || null,
      serverId: scope.serverId || null,
      killerName: normalizeText(payload.killerName || payload.killer) || 'Unknown',
      killerSteamId: normalizeText(payload.killerSteamId) || null,
      killerUserId: normalizeText(payload.killerUserId) || null,
      victimName: normalizeText(payload.victimName || payload.victim) || 'Unknown',
      victimSteamId: normalizeText(payload.victimSteamId) || null,
      victimUserId: normalizeText(payload.victimUserId) || null,
      weapon: normalizeText(payload.weapon) || 'Unknown weapon',
      distance: normalizeInteger(payload.distance),
      hitZone: normalizeText(payload.hitZone) || null,
      sector: normalizeText(payload.sector) || null,
      mapImageUrl: normalizeText(payload.mapImageUrl) || null,
      metadataJson: stringifyMetadata(payload.metadata || payload.meta),
      occurredAt,
    },
  });
  return normalizeKillFeedRow(created);
}

async function listKillFeedEntries(options = {}) {
  const scope = resolveTenantServerStoreScope(options);
  const limit = clampLimit(options.limit, 20, 1, 100);
  const search = normalizeText(options.q).toLowerCase();
  const where = {};
  if (scope.tenantId) {
    where.tenantId = scope.tenantId;
  }
  if (scope.serverId) {
    where.OR = [
      { serverId: scope.serverId },
      { serverId: null },
    ];
  }

  let rows = [];
  try {
    rows = await scope.db.killFeedEvent.findMany({
      where,
      orderBy: [
        { occurredAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });
  } catch (error) {
    if (!isMissingKillFeedTableError(error, scope.tenantId)) {
      throw error;
    }
    rows = [];
  }

  const normalizedRows = rows.map(normalizeKillFeedRow).filter(Boolean);
  if (!search) {
    return normalizedRows;
  }
  return normalizedRows.filter((row) => {
    const haystack = [
      row.killerName,
      row.victimName,
      row.weapon,
      row.sector,
      row.killerSteamId,
      row.victimSteamId,
      row.killerUserId,
      row.victimUserId,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}

module.exports = {
  normalizeKillFeedRow,
  recordKillFeedEntry,
  listKillFeedEntries,
};
