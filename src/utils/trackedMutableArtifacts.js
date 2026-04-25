'use strict';

const { execFileSync } = require('node:child_process');

const MUTABLE_ROOT_PREFIXES = [
  'data',
  'output',
];

function normalizeRepoPath(filePath) {
  const normalized = String(filePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '');
  return normalized.replace(/^\/+/, '');
}

function isTemporaryPrefix(part) {
  return /^(tmp-|tmp_|temp_)/i.test(part);
}

function classifyTrackedMutableArtifact(filePath) {
  const normalized = normalizeRepoPath(filePath);
  if (!normalized) return null;

  const parts = normalized.split('/').filter(Boolean);
  const first = parts[0] || '';
  if (MUTABLE_ROOT_PREFIXES.includes(first)) {
    return {
      file: normalized,
      reason: `${first}/ contains runtime or mutable artifacts and must not be tracked`,
    };
  }

  if (isTemporaryPrefix(first)) {
    return {
      file: normalized,
      reason: 'temporary audit/proof folders must not be tracked',
    };
  }

  return null;
}

function collectTrackedMutableArtifacts(filePaths = []) {
  return filePaths
    .map((filePath) => classifyTrackedMutableArtifact(filePath))
    .filter(Boolean);
}

function isGitUnavailableError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '').trim().toUpperCase();
  const pathValue = String(error.path || '').trim().toLowerCase();
  const message = String(error.message || '').trim().toLowerCase();
  return code === 'ENOENT' && (pathValue === 'git' || message.includes('git'));
}

function createSkippedMutableArtifactsResult(reason, detail) {
  const result = [];
  Object.defineProperties(result, {
    skipped: {
      value: true,
      enumerable: false,
    },
    reason: {
      value: reason,
      enumerable: false,
    },
    detail: {
      value: detail,
      enumerable: false,
    },
  });
  return result;
}

function listTrackedMutableArtifacts({
  cwd = process.cwd(),
  execFileSyncImpl = execFileSync,
} = {}) {
  let output = '';
  try {
    output = execFileSyncImpl('git', ['ls-files', '-z'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (isGitUnavailableError(error)) {
      return createSkippedMutableArtifactsResult(
        'git-unavailable',
        'git is not available in PATH; skipped tracked runtime artifact scan',
      );
    }
    throw error;
  }

  const filePaths = output
    .split('\0')
    .map((entry) => normalizeRepoPath(entry))
    .filter(Boolean);
  return collectTrackedMutableArtifacts(filePaths);
}

module.exports = {
  classifyTrackedMutableArtifact,
  collectTrackedMutableArtifacts,
  isGitUnavailableError,
  listTrackedMutableArtifacts,
  normalizeRepoPath,
};
