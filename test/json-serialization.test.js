const test = require('node:test');
const assert = require('node:assert/strict');

const {
  safeJsonStringify,
  installBigIntJsonSerialization,
} = require('../src/utils/jsonSerialization');

test('safeJsonStringify serializes bigint values safely', () => {
  const raw = safeJsonStringify({
    small: 42n,
    large: BigInt(Number.MAX_SAFE_INTEGER) + 5n,
  });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.small, 42);
  assert.equal(parsed.large, String(BigInt(Number.MAX_SAFE_INTEGER) + 5n));
});

test('installBigIntJsonSerialization enables plain JSON.stringify for bigint payloads', () => {
  installBigIntJsonSerialization();
  const raw = JSON.stringify({
    safe: 7n,
    large: BigInt(Number.MAX_SAFE_INTEGER) + 9n,
  });
  const parsed = JSON.parse(raw);
  assert.equal(parsed.safe, 7);
  assert.equal(parsed.large, String(BigInt(Number.MAX_SAFE_INTEGER) + 9n));
});
