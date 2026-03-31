'use strict';

const fs = require('node:fs');

const {
  atomicWriteJson,
  getFilePath,
} = require('./_persist');

function trimText(value, maxLen = 240) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function readSnapshot(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function createPersistentRuntimeStore(options = {}) {
  const persist = options.persist !== false;
  const filename = trimText(options.filename, 180);
  const persistDelayMs = Math.max(0, Math.trunc(Number(options.persistDelayMs) || 0));
  const expiryField = trimText(options.expiryField, 80) || '';
  const filePath = persist && filename ? getFilePath(filename) : '';
  const map = new Map();
  let persistTimer = null;

  function hydrateFromDisk() {
    const snapshot = readSnapshot(filePath);
    const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const key = trimText(entry[0], 240);
      if (!key) continue;
      map.set(key, entry[1]);
    }
    cleanupExpiredEntries(false);
  }

  function buildSnapshot() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: Array.from(map.entries()),
    };
  }

  function flushPersist() {
    if (!filePath) return;
    atomicWriteJson(filePath, buildSnapshot());
  }

  function schedulePersist() {
    if (!filePath) return;
    if (persistDelayMs <= 0) {
      flushPersist();
      return;
    }
    if (persistTimer) {
      clearTimeout(persistTimer);
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      flushPersist();
    }, persistDelayMs);
  }

  function cleanupExpiredEntries(scheduleWrite = true) {
    if (!expiryField) return false;
    const now = Date.now();
    let removed = false;
    for (const [key, value] of map.entries()) {
      const expiresAt = Number(value?.[expiryField] || 0);
      if (!Number.isFinite(expiresAt) || expiresAt <= 0) continue;
      if (expiresAt > now) continue;
      map.delete(key);
      removed = true;
    }
    if (removed && scheduleWrite) {
      schedulePersist();
    }
    return removed;
  }

  hydrateFromDisk();

  return {
    get size() {
      cleanupExpiredEntries();
      return map.size;
    },
    clear() {
      if (map.size === 0) return;
      map.clear();
      schedulePersist();
    },
    delete(key) {
      cleanupExpiredEntries();
      const removed = map.delete(String(key || '').trim());
      if (removed) {
        schedulePersist();
      }
      return removed;
    },
    entries() {
      cleanupExpiredEntries();
      return map.entries();
    },
    forEach(callback, thisArg) {
      cleanupExpiredEntries();
      return map.forEach(callback, thisArg);
    },
    get(key) {
      cleanupExpiredEntries();
      return map.get(String(key || '').trim());
    },
    has(key) {
      cleanupExpiredEntries();
      return map.has(String(key || '').trim());
    },
    keys() {
      cleanupExpiredEntries();
      return map.keys();
    },
    set(key, value) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) return this;
      map.set(normalizedKey, value);
      schedulePersist();
      return this;
    },
    values() {
      cleanupExpiredEntries();
      return map.values();
    },
    flush() {
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      flushPersist();
    },
  };
}

module.exports = {
  createPersistentRuntimeStore,
};
