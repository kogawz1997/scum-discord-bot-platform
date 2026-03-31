const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isDiscordId,
} = require('../apps/web-portal-standalone/runtime/portalHelperRuntime');

test('portal helper runtime accepts legacy 14-digit discord ids used by local smoke data', () => {
  assert.equal(isDiscordId('91774928273550'), true);
  assert.equal(isDiscordId('123456789012345678'), true);
  assert.equal(isDiscordId('abc123'), false);
  assert.equal(isDiscordId('1234567890123'), false);
});
