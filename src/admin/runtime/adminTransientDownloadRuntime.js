'use strict';

const { randomUUID } = require('node:crypto');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function sanitizeFilename(value, fallback = 'download.txt') {
  const cleaned = trimText(value, 240)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/g, '');
  return cleaned || fallback;
}

function normalizeContentType(value) {
  const normalized = trimText(value, 120).toLowerCase();
  if (/^(text\/plain|text\/csv|application\/json|application\/octet-stream)(;\s*charset=utf-8)?$/.test(normalized)) {
    return normalized;
  }
  return 'application/octet-stream';
}

function createAdminTransientDownloadRuntime(options = {}) {
  const maxAgeMs = Number(options.maxAgeMs) > 0 ? Number(options.maxAgeMs) : 5 * 60 * 1000;
  const maxEntries = Number(options.maxEntries) > 0 ? Number(options.maxEntries) : 128;
  const maxContentBytes = Number(options.maxContentBytes) > 0 ? Number(options.maxContentBytes) : 256 * 1024;
  const store = new Map();

  function pruneExpired(now = Date.now()) {
    for (const [token, entry] of store.entries()) {
      if (!entry || Number(entry.expiresAtMs) <= now) {
        store.delete(token);
      }
    }
    while (store.size > maxEntries) {
      const oldestToken = store.keys().next().value;
      if (!oldestToken) break;
      store.delete(oldestToken);
    }
  }

  function prepareTransientDownload(input = {}, context = {}) {
    pruneExpired();
    const content = typeof input.content === 'string'
      ? input.content
      : String(input.content ?? '');
    if (!content) {
      return { ok: false, reason: 'content-required' };
    }
    const body = Buffer.from(content, 'utf8');
    if (body.length > maxContentBytes) {
      return {
        ok: false,
        reason: 'content-too-large',
        maxContentBytes,
      };
    }
    const token = randomUUID();
    const now = Date.now();
    const expiresAtMs = now + maxAgeMs;
    const entry = {
      token,
      body,
      filename: sanitizeFilename(input.filename, 'download.txt'),
      contentType: normalizeContentType(input.mimeType),
      createdAtMs: now,
      expiresAtMs,
      user: trimText(context.user, 160),
      tenantId: trimText(context.tenantId, 160),
    };
    store.set(token, entry);
    pruneExpired(now);
    return {
      ok: true,
      token,
      filename: entry.filename,
      contentType: entry.contentType,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  function consumeTransientDownload(token, context = {}) {
    const key = trimText(token, 160);
    if (!key) return null;
    pruneExpired();
    const entry = store.get(key);
    if (!entry) return null;

    const requestUser = trimText(context.user, 160);
    if (entry.user && (!requestUser || entry.user !== requestUser)) {
      return null;
    }

    store.delete(key);
    return entry;
  }

  return {
    consumeTransientDownload,
    prepareTransientDownload,
  };
}

module.exports = {
  createAdminTransientDownloadRuntime,
  normalizeContentType,
  sanitizeFilename,
};
