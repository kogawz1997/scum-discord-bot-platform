const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDiscordId,
  resolveStoreScope,
} = require('../src/store/playerAccountStore');

test('player account store accepts legacy 14-digit discord ids used by live player profiles', () => {
  assert.equal(normalizeDiscordId('91774928273550'), '91774928273550');
  assert.equal(normalizeDiscordId('123456789012345678'), '123456789012345678');
  assert.equal(normalizeDiscordId('1234567890123'), null);
  assert.equal(normalizeDiscordId('discord-user'), null);
});

test('player account store requires tenant scope in strict postgres mode', () => {
  assert.throws(
    () =>
      resolveStoreScope({
        env: {
          DATABASE_URL: 'postgresql://scum:test@localhost:5432/scum',
          TENANT_DB_ISOLATION_MODE: 'strict',
        },
      }),
    (error) => error?.code === 'TENANT_DB_SCOPE_REQUIRED',
  );
});
