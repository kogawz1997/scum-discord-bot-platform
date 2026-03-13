const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const BASE_DATA_DIR = process.env.BOT_DATA_DIR
  ? path.resolve(process.env.BOT_DATA_DIR)
  : path.join(PROJECT_ROOT, 'data');
const LOCK_DIR = path.join(BASE_DATA_DIR, 'runtime-locks');

const activeLocks = new Map();

function ensureLockDir() {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

function getLockPath(name) {
  const safeName = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-');
  if (!safeName) {
    throw new Error('runtime lock name is required');
  }
  ensureLockDir();
  return path.join(LOCK_DIR, `${safeName}.lock.json`);
}

function isPidAlive(pid) {
  const parsed = Number(pid);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    process.kill(parsed, 0);
    return true;
  } catch (error) {
    if (error?.code === 'EPERM') return true;
    return false;
  }
}

function readExistingLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeLockFile(lockPath, payload) {
  const fd = fs.openSync(lockPath, 'wx');
  try {
    fs.writeFileSync(fd, JSON.stringify(payload, null, 2), 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function releaseRuntimeLock(name) {
  const lockPath = getLockPath(name);
  const current = activeLocks.get(lockPath);
  if (!current) return false;

  try {
    fs.unlinkSync(lockPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.error(`[runtime-lock] failed to release ${current.name}:`, error.message);
      return false;
    }
  }

  activeLocks.delete(lockPath);
  return true;
}

function releaseAllRuntimeLocks() {
  for (const current of Array.from(activeLocks.values())) {
    releaseRuntimeLock(current.name);
  }
}

function acquireRuntimeLock(name, owner = 'runtime') {
  const lockPath = getLockPath(name);
  const payload = {
    name,
    owner,
    pid: process.pid,
    hostname: os.hostname(),
    acquiredAt: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeLockFile(lockPath, payload);
      activeLocks.set(lockPath, { ...payload, lockPath });
      return { ok: true, data: { ...payload, lockPath } };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        return { ok: false, reason: 'lock-write-failed', error };
      }

      const existing = readExistingLock(lockPath);
      if (existing && isPidAlive(existing.pid)) {
        return {
          ok: false,
          reason: 'already-locked',
          data: { ...existing, lockPath },
        };
      }

      try {
        fs.unlinkSync(lockPath);
      } catch (unlinkError) {
        if (unlinkError?.code !== 'ENOENT') {
          return { ok: false, reason: 'stale-lock-remove-failed', error: unlinkError };
        }
      }
    }
  }

  return { ok: false, reason: 'lock-acquire-failed' };
}

module.exports = {
  acquireRuntimeLock,
  releaseRuntimeLock,
  releaseAllRuntimeLocks,
};
