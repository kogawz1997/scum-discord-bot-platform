const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyTrackedMutableArtifact,
  collectTrackedMutableArtifacts,
  isGitUnavailableError,
  listTrackedMutableArtifacts,
  normalizeRepoPath,
} = require('../src/utils/trackedMutableArtifacts');

test('normalizeRepoPath converts Windows separators and trims prefixes', () => {
  assert.equal(normalizeRepoPath('.\\data\\runtime.json'), 'data/runtime.json');
  assert.equal(normalizeRepoPath('/output/report.json'), 'output/report.json');
});

test('classifyTrackedMutableArtifact flags tracked runtime data roots', () => {
  assert.deepEqual(classifyTrackedMutableArtifact('data/admin-request-log.json'), {
    file: 'data/admin-request-log.json',
    reason: 'data/ contains runtime or mutable artifacts and must not be tracked',
  });
  assert.deepEqual(classifyTrackedMutableArtifact('output/playwright/capture.png'), {
    file: 'output/playwright/capture.png',
    reason: 'output/ contains runtime or mutable artifacts and must not be tracked',
  });
});

test('classifyTrackedMutableArtifact flags tracked temporary roots', () => {
  assert.deepEqual(classifyTrackedMutableArtifact('tmp_audit_20260324/report.json'), {
    file: 'tmp_audit_20260324/report.json',
    reason: 'temporary audit/proof folders must not be tracked',
  });
});

test('collectTrackedMutableArtifacts ignores normal source files', () => {
  const result = collectTrackedMutableArtifacts([
    'src/bot.js',
    'docs/README.md',
    'data/admin-log.json',
    'tmp_capture/report.json',
  ]);

  assert.deepEqual(result, [
    {
      file: 'data/admin-log.json',
      reason: 'data/ contains runtime or mutable artifacts and must not be tracked',
    },
    {
      file: 'tmp_capture/report.json',
      reason: 'temporary audit/proof folders must not be tracked',
    },
  ]);
});

test('isGitUnavailableError detects missing git executable errors', () => {
  const error = new Error('spawnSync git ENOENT');
  error.code = 'ENOENT';
  error.path = 'git';

  assert.equal(isGitUnavailableError(error), true);
  assert.equal(isGitUnavailableError(new Error('permission denied')), false);
});

test('listTrackedMutableArtifacts reports skipped state when git is unavailable', () => {
  const error = new Error('spawnSync git ENOENT');
  error.code = 'ENOENT';
  error.path = 'git';

  const result = listTrackedMutableArtifacts({
    execFileSyncImpl() {
      throw error;
    },
  });

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 0);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'git-unavailable');
  assert.match(result.detail, /git is not available/i);
});

test('listTrackedMutableArtifacts rethrows non-git execution failures', () => {
  assert.throws(
    () => listTrackedMutableArtifacts({
      execFileSyncImpl() {
        throw new Error('unexpected git failure');
      },
    }),
    /unexpected git failure/,
  );
});
