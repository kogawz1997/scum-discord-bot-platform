'use strict';

const crypto = require('node:crypto');

function trimText(value, maxLen = 1200) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function resolveAgentStateSecret(env = process.env) {
  return trimText(
    env.PLATFORM_AGENT_STATE_SECRET
      || env.SCUM_PLATFORM_AGENT_STATE_SECRET
      || env.PLATFORM_AGENT_SETUP_TOKEN
      || env.SCUM_PLATFORM_SETUP_TOKEN,
    1200,
  );
}

function deriveAgentStateKey(secret, runtimeKey = 'platform-agent') {
  return crypto.scryptSync(
    String(secret || ''),
    `platform-agent-state:${trimText(runtimeKey, 160) || 'platform-agent'}`,
    32,
  );
}

function encryptAgentStateToken(token, env = process.env, runtimeKey = 'platform-agent') {
  const secret = resolveAgentStateSecret(env);
  const rawToken = trimText(token, 4000);
  if (!secret || !rawToken) return '';
  const iv = crypto.randomBytes(12);
  const key = deriveAgentStateKey(secret, runtimeKey);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawToken, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join('.');
}

function decryptAgentStateToken(payload, env = process.env, runtimeKey = 'platform-agent') {
  const secret = resolveAgentStateSecret(env);
  const text = trimText(payload, 12000);
  if (!secret || !text) return '';
  const [version, ivHex, authTagHex, ciphertextHex] = text.split('.');
  if (version !== 'v1' || !ivHex || !authTagHex || !ciphertextHex) return '';
  try {
    const key = deriveAgentStateKey(secret, runtimeKey);
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
    return trimText(decrypted.toString('utf8'), 4000);
  } catch {
    return '';
  }
}

module.exports = {
  decryptAgentStateToken,
  encryptAgentStateToken,
  resolveAgentStateSecret,
};
