const crypto = require('node:crypto');
const { resolveTenantStoreScope } = require('./tenantStoreScope');

const MAX_MESSAGES_PER_GROUP = 300;
const MAX_MESSAGE_LENGTH = 280;

function getPartyChatDb(options = {}, operation = 'party chat store operation') {
  return resolveTenantStoreScope({
    ...options,
    operation: String(options.operation || '').trim() || operation,
  }).db;
}

function normalizePartyKey(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '');
  if (!key) return null;
  return key.length > 80 ? key.slice(0, 80) : key;
}

function normalizeMessageText(value) {
  const text = String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r/g, '')
    .trim();
  if (!text) return null;
  return text.length > MAX_MESSAGE_LENGTH
    ? text.slice(0, MAX_MESSAGE_LENGTH)
    : text;
}

function normalizeMessageEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const partyKey = normalizePartyKey(raw.partyKey);
  const userId = String(raw.userId || '').trim();
  const displayName = String(raw.displayName || '').trim() || userId || 'Unknown';
  const message = normalizeMessageText(raw.message || raw.text);
  const createdAt = raw.createdAt
    ? new Date(raw.createdAt).toISOString()
    : new Date().toISOString();
  if (!partyKey || !userId || !message) return null;
  return {
    id: String(raw.id || '').trim() || `msg_${Date.now()}`,
    partyKey,
    userId,
    displayName,
    message,
    createdAt,
  };
}

function toMessageView(row) {
  if (!row) return null;
  const message = normalizeMessageEntry({
    id: row.id,
    partyKey: row.partyKey,
    userId: row.userId,
    displayName: row.displayName,
    message: row.message,
    createdAt: row.createdAt,
  });
  return message ? { ...message } : null;
}

async function listPartyMessages(partyKey, limit = 80, options = {}) {
  const key = normalizePartyKey(partyKey);
  if (!key) return [];

  const max = Math.max(1, Math.min(200, Math.trunc(Number(limit || 80))));
  const rows = await getPartyChatDb(options, 'list party messages').partyChatMessage.findMany({
    where: { partyKey: key },
    orderBy: { createdAt: 'desc' },
    take: max,
  });

  return rows
    .slice()
    .reverse()
    .map((row) => toMessageView(row))
    .filter(Boolean);
}

async function trimPartyMessages(partyKey, options = {}) {
  const rows = await getPartyChatDb(options, 'trim party messages').partyChatMessage.findMany({
    where: { partyKey },
    orderBy: { createdAt: 'desc' },
    skip: MAX_MESSAGES_PER_GROUP,
    select: { id: true },
  });
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);
  await getPartyChatDb(options, 'trim party messages').partyChatMessage.deleteMany({
    where: { id: { in: ids } },
  });
}

async function addPartyMessage(partyKey, payload = {}, options = {}) {
  const key = normalizePartyKey(partyKey);
  if (!key) return { ok: false, reason: 'invalid-party-key' };

  const row = normalizeMessageEntry({
    id:
      typeof crypto.randomUUID === 'function'
        ? `pm_${crypto.randomUUID()}`
        : `pm_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    partyKey: key,
    userId: payload.userId,
    displayName: payload.displayName,
    message: payload.message,
    createdAt: new Date().toISOString(),
  });

  if (!row) return { ok: false, reason: 'invalid-message' };

  const created = await getPartyChatDb(options, 'add party message').partyChatMessage.create({
    data: {
      id: row.id,
      partyKey: row.partyKey,
      userId: row.userId,
      displayName: row.displayName,
      message: row.message,
      createdAt: new Date(row.createdAt),
    },
  });

  await trimPartyMessages(key, options);

  return { ok: true, data: toMessageView(created) };
}

async function clearPartyMessages(partyKey, options = {}) {
  const key = normalizePartyKey(partyKey);
  if (!key) return false;
  const result = await getPartyChatDb(options, 'clear party messages').partyChatMessage.deleteMany({
    where: { partyKey: key },
  });
  return result.count > 0;
}

async function listAllPartyMessages(limit = 5000, options = {}) {
  const rows = await getPartyChatDb(options, 'list all party messages').partyChatMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Number(limit || 5000)),
  });
  return rows.map((row) => toMessageView(row)).filter(Boolean);
}

async function replacePartyMessages(nextRows = [], options = {}) {
  await getPartyChatDb(options, 'replace party messages').$transaction(async (tx) => {
    await tx.partyChatMessage.deleteMany();
    for (const row of Array.isArray(nextRows) ? nextRows : []) {
      const normalized = normalizeMessageEntry(row);
      if (!normalized) continue;
      await tx.partyChatMessage.create({
        data: {
          id: normalized.id,
          partyKey: normalized.partyKey,
          userId: normalized.userId,
          displayName: normalized.displayName,
          message: normalized.message,
          createdAt: new Date(normalized.createdAt),
        },
      });
    }
  });
}

module.exports = {
  normalizePartyKey,
  listPartyMessages,
  addPartyMessage,
  clearPartyMessages,
  listAllPartyMessages,
  replacePartyMessages,
};
