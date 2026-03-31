const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDiscordId,
} = require('../src/store/playerAccountStore');

test('player account store accepts legacy 14-digit discord ids used by live player profiles', () => {
  assert.equal(normalizeDiscordId('91774928273550'), '91774928273550');
  assert.equal(normalizeDiscordId('123456789012345678'), '123456789012345678');
  assert.equal(normalizeDiscordId('1234567890123'), null);
  assert.equal(normalizeDiscordId('discord-user'), null);
});
