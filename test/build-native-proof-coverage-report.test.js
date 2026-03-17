const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCoverageMarkdown,
  buildCoverageSummary,
} = require('../scripts/build-native-proof-coverage-report.js');

test('buildCoverageSummary summarizes current and pending native-proof environments', () => {
  const summary = buildCoverageSummary({
    registry: {
      currentEnvironmentId: 'env-a',
      environments: [
        {
          id: 'env-a',
          status: 'verified',
          label: 'Environment A',
          executionMode: 'agent',
          topologyMode: 'shared',
          proofSources: ['SCUM.db', 'SCUM.log'],
        },
        {
          id: 'env-b',
          status: 'pending',
          label: 'Environment B',
          coverageGoal: 'Capture a second workstation',
        },
      ],
    },
    itemMatrix: {
      results: [
        {
          label: 'consumable-water',
          deliveryClass: 'consumable',
          strategy: 'world-spawn-delta',
          ok: true,
          verificationOk: true,
        },
        {
          label: 'ammo-762',
          deliveryClass: 'ammo',
          strategy: 'world-spawn-delta',
          ok: false,
          verificationOk: false,
        },
      ],
    },
    wrapperMatrix: {
      results: [
        {
          label: 'teleport-wrapper',
          deliveryProfile: 'teleport_spawn',
          strategy: 'world-spawn-delta',
          ok: true,
          verificationOk: true,
        },
      ],
    },
    experimentalCases: [
      {
        label: 'ammo-762',
        deliveryClass: 'ammo',
        notes: 'still unproved',
      },
    ],
  });

  assert.equal(summary.currentEnvironment.id, 'env-a');
  assert.deepEqual(summary.coverage.provedDeliveryClasses, ['consumable']);
  assert.equal(summary.coverage.classCoverage.length, 2);
  assert.equal(summary.coverage.wrapperCoverage.length, 1);
  assert.equal(summary.openCoverageRequirements.length, 1);
  assert.equal(summary.openCoverageRequirements[0].id, 'env-b');
});

test('buildCoverageMarkdown renders current environment and pending targets', () => {
  const markdown = buildCoverageMarkdown({
    generatedAt: '2026-03-17T00:00:00.000Z',
    currentEnvironment: {
      id: 'env-a',
      label: 'Environment A',
      workstationProfile: 'Workstation A',
      scumServerProfile: 'Server A',
      executionMode: 'agent',
      topologyMode: 'shared',
      proofSources: ['SCUM.db', 'SCUM.log'],
      notes: 'local only',
    },
    coverage: {
      classCoverage: [
        {
          deliveryClass: 'consumable',
          proved: true,
          strategies: ['world-spawn-delta'],
          cases: ['consumable-water'],
        },
      ],
      wrapperCoverage: [
        {
          label: 'teleport-wrapper',
          deliveryProfile: 'teleport_spawn',
          proved: true,
          strategy: 'world-spawn-delta',
        },
      ],
      experimentalCases: [
        {
          label: 'ammo-762',
          deliveryClass: 'ammo',
          notes: 'still unproved',
        },
      ],
    },
    openCoverageRequirements: [
      {
        label: 'Environment B',
        coverageGoal: 'Capture a second workstation',
        notes: 'pending',
      },
    ],
  });

  assert.match(markdown, /Current Verified Environment/);
  assert.match(markdown, /Environment A/);
  assert.match(markdown, /consumable-water/);
  assert.match(markdown, /Environment B/);
  assert.match(markdown, /ammo-762/);
});
