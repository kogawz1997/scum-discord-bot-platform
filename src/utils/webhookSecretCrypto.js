'use strict';

const crypto = require('node:crypto');

const ENC_PREFIX = 'enc:v1:';

function trimText(value, maxLen = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function resolveMasterSecret(env = process.env) {
  return trimText(
    env.PLATFORM_WEBHOOK_SECRET_KEY
      || env.PLATFORM_SECRET_ENCRYPTION_KEY
      || env.PLATFORM_AGENT_STATE_SECRET
      || env.SCUM_PLATFORM_AGENT_STATE_SECRET,
    1200,
  );
}

function deriveKey(secret) {
  return crypto.scryptSync(String(secret || ''), 'platform-webhook-secret-v1', 32);
}

function encryptWebhookSecret(plaintext, env = process.env) {
  const value = trimText(plaintext, 4000);
  if (!value) return '';
  if (value.startsWith(ENC_PREFIX)) return value;
  const masterSecret = resolveMasterSecret(env);
  if (!masterSecret) return value;
  const iv = crypto.randomBytes(12);
  const key = deriveKey(masterSecret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}.${authTag.toString('hex')}.${encrypted.toString('hex')}`;
}

function decryptWebhookSecret(stored, env = process.env) {
  const value = trimText(stored, 12000);
  if (!value) return '';
  if (!value.startsWith(ENC_PREFIX)) return value;
  const masterSecret = resolveMasterSecret(env);
  if (!masterSecret) return '';
  const payload = value.slice(ENC_PREFIX.length);
  const [ivHex, authTagHex, ciphertextHex] = payload.split('.');
  if (!ivHex || !authTagHex || !ciphertextHex) return '';
  try {
    const key = deriveKey(masterSecret);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

function isEncryptedWebhookSecret(value) {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

module.exports = {
  encryptWebhookSecret,
  decryptWebhookSecret,
  isEncryptedWebhookSecret,
  resolveMasterSecret,
};
