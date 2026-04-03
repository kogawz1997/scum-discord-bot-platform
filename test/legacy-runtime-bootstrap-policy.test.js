const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseExplicitBootstrapValue,
  resolveLegacyRuntimeBootstrapPolicy,
} = require('../src/utils/legacyRuntimeBootstrapPolicy');

test('legacy runtime bootstrap policy parses explicit boolean-like values', () => {
  assert.deepEqual(parseExplicitBootstrapValue('1'), {
    explicit: true,
    normalized: '1',
    value: true,
  });
  assert.deepEqual(parseExplicitBootstrapValue('off'), {
    explicit: true,
    normalized: 'off',
    value: false,
  });
  assert.deepEqual(parseExplicitBootstrapValue('maybe'), {
    explicit: false,
    normalized: 'maybe',
    value: null,
  });
});

test('legacy runtime bootstrap policy denies prisma-client runtimes by default', () => {
  const policy = resolveLegacyRuntimeBootstrapPolicy({
    env: { NODE_ENV: 'test' },
    envName: 'EXAMPLE_BOOTSTRAP',
    runtime: { engine: 'sqlite', provider: 'sqlite', isServerEngine: false },
    prismaClientLike: true,
    policy: 'example-bootstrap',
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.reason, 'prisma-client-runtime');
  assert.equal(policy.explicit, false);
});

test('legacy runtime bootstrap policy allows non-production compatibility for raw runtimes', () => {
  const policy = resolveLegacyRuntimeBootstrapPolicy({
    env: { NODE_ENV: 'test' },
    envName: 'EXAMPLE_BOOTSTRAP',
    runtime: { engine: 'sqlite', provider: 'sqlite', isServerEngine: false },
    prismaClientLike: false,
    policy: 'example-bootstrap',
  });

  assert.equal(policy.allowed, true);
  assert.equal(policy.reason, 'non-production-compatibility');
  assert.equal(policy.source, 'default');
});

test('legacy runtime bootstrap policy honors explicit opt-in and opt-out', () => {
  const optIn = resolveLegacyRuntimeBootstrapPolicy({
    env: { NODE_ENV: 'production', EXAMPLE_BOOTSTRAP: '1' },
    envName: 'EXAMPLE_BOOTSTRAP',
    runtime: { engine: 'sqlite', provider: 'sqlite', isServerEngine: false },
    prismaClientLike: true,
    policy: 'example-bootstrap',
  });
  const optOut = resolveLegacyRuntimeBootstrapPolicy({
    env: { NODE_ENV: 'test', EXAMPLE_BOOTSTRAP: 'off' },
    envName: 'EXAMPLE_BOOTSTRAP',
    runtime: { engine: 'sqlite', provider: 'sqlite', isServerEngine: false },
    prismaClientLike: false,
    policy: 'example-bootstrap',
  });

  assert.equal(optIn.allowed, true);
  assert.equal(optIn.reason, 'explicit-opt-in');
  assert.equal(optIn.explicitValue, '1');
  assert.equal(optOut.allowed, false);
  assert.equal(optOut.reason, 'explicit-opt-out');
  assert.equal(optOut.explicitValue, 'off');
});
