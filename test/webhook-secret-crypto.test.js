'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encryptWebhookSecret,
  decryptWebhookSecret,
  isEncryptedWebhookSecret,
} = require('../src/utils/webhookSecretCrypto');

test('encrypt + decrypt roundtrip with master key', () => {
  const env = { PLATFORM_WEBHOOK_SECRET_KEY: 'a'.repeat(64) };
  const encrypted = encryptWebhookSecret('super-secret-value', env);
  assert.ok(isEncryptedWebhookSecret(encrypted));
  assert.notEqual(encrypted, 'super-secret-value');
  assert.equal(decryptWebhookSecret(encrypted, env), 'super-secret-value');
});

test('encryption is non-deterministic (random IV)', () => {
  const env = { PLATFORM_WEBHOOK_SECRET_KEY: 'a'.repeat(64) };
  const a = encryptWebhookSecret('value', env);
  const b = encryptWebhookSecret('value', env);
  assert.notEqual(a, b);
});

test('plaintext passthrough when no master key configured', () => {
  const env = {};
  assert.equal(encryptWebhookSecret('plain', env), 'plain');
  assert.equal(decryptWebhookSecret('plain', env), 'plain');
});

test('legacy plaintext value is returned unchanged when decrypted', () => {
  const env = { PLATFORM_WEBHOOK_SECRET_KEY: 'a'.repeat(64) };
  assert.equal(decryptWebhookSecret('legacy-plaintext-secret', env), 'legacy-plaintext-secret');
});

test('decrypt returns empty string on tamper', () => {
  const env = { PLATFORM_WEBHOOK_SECRET_KEY: 'a'.repeat(64) };
  const encrypted = encryptWebhookSecret('value', env);
  const lastChar = encrypted.slice(-1);
  const tampered = `${encrypted.slice(0, -1)}${lastChar === '0' ? '1' : '0'}`;
  assert.equal(decryptWebhookSecret(tampered, env), '');
});

test('already-encrypted value is not double-encrypted', () => {
  const env = { PLATFORM_WEBHOOK_SECRET_KEY: 'a'.repeat(64) };
  const once = encryptWebhookSecret('value', env);
  const twice = encryptWebhookSecret(once, env);
  assert.equal(once, twice);
});
