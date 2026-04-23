const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReadinessReport, buildScriptSequence } = require('../scripts/readiness-gate');

test('readiness production includes smoke by default', () => {
  const scripts = buildScriptSequence({ isProduction: true, skipSmoke: false });

  assert.equal(scripts.includes('smoke:persistence'), true);
  assert.equal(scripts.includes('smoke:postdeploy'), true);
  assert.deepEqual(scripts.slice(0, 6), [
    'lint',
    'test:policy',
    'security:check',
    'doctor',
    'doctor:topology',
    'doctor:web-standalone',
  ]);
});

test('readiness production can skip smoke explicitly', () => {
  const scripts = buildScriptSequence({ isProduction: true, skipSmoke: true });

  assert.equal(scripts.includes('smoke:persistence'), true);
  assert.equal(scripts.includes('smoke:postdeploy'), false);
});

test('buildReadinessReport returns shared validation contract', () => {
  const report = buildReadinessReport([
    { name: 'check', script: 'check', ok: true, exitCode: 0, detail: '' },
    { name: 'doctor', script: 'doctor', ok: false, exitCode: 1, detail: 'doctor failed' },
  ], { isProduction: true });

  assert.equal(report.kind, 'readiness');
  assert.equal(report.ok, false);
  assert.equal(report.status, 'failed');
  assert.equal(report.checks.length, 2);
});
