const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  updateEnvironmentRegistry,
  writeCoverageArtifacts,
} = require('../scripts/run-live-native-proof-matrix.js');

test('updateEnvironmentRegistry records verified matrix results for a target environment', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-proof-registry-'));
  try {
    const registryPath = path.join(tempDir, 'environments.json');
    fs.writeFileSync(registryPath, JSON.stringify({
      currentEnvironmentId: 'env-a',
      environments: [
        {
          id: 'env-a',
          status: 'verified',
          label: 'Environment A',
          runtimeKind: 'workstation',
        },
        {
          id: 'env-b',
          status: 'pending',
          label: 'Environment B',
          runtimeKind: 'server-configuration',
        },
      ],
    }, null, 2));

    const matrixPath = path.join(tempDir, 'matrix.json');
    fs.writeFileSync(matrixPath, '{}');

    const payload = updateEnvironmentRegistry({
      generatedAt: '2026-03-27T00:00:00.000Z',
      executionMode: 'agent',
      nativeProofMode: 'required',
      results: [
        { ok: true, verificationOk: true },
      ],
    }, {
      environmentId: 'env-b',
      environmentRegistryPath: registryPath,
      jsonOut: matrixPath,
    });

    assert.equal(String(payload.registry.environments[0].id || ''), 'env-b');
    assert.equal(String(payload.registry.environments[0].status || ''), 'verified');
    assert.equal(String(payload.registry.environments[0].itemMatrixPath || ''), path.relative(process.cwd(), matrixPath).replace(/\\/g, '/'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('writeCoverageArtifacts emits a validation summary from the updated registry', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'native-proof-coverage-'));
  try {
    const registry = {
      currentEnvironmentId: 'env-a',
      environments: [
        {
          id: 'env-a',
          status: 'verified',
          label: 'Environment A',
          runtimeKind: 'workstation',
        },
      ],
    };

    const summary = writeCoverageArtifacts({
      generatedAt: '2026-03-27T00:00:00.000Z',
      results: [
        {
          label: 'consumable-water',
          deliveryClass: 'consumable',
          strategy: 'world-spawn-delta',
          ok: true,
          verificationOk: true,
        },
      ],
    }, {
      environmentRegistryPath: path.join(tempDir, 'environments.json'),
      coverageJsonOut: path.join(tempDir, 'coverage.json'),
      coverageMarkdownOut: path.join(tempDir, 'coverage.md'),
    }, {
      registry,
    });

    assert.equal(summary.validation.ready, false);
    assert.equal(
      summary.validation.checks.some((entry) => entry.id === 'baseline-environment-verified' && entry.ok === true),
      true,
    );
    assert.equal(fs.existsSync(path.join(tempDir, 'coverage.json')), true);
    assert.equal(fs.existsSync(path.join(tempDir, 'coverage.md')), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
