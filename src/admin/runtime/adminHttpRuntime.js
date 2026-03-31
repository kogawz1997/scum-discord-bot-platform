'use strict';

const crypto = require('node:crypto');

function envBool(name, fallback = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeCookiePath(value, fallback = '/') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (!text.startsWith('/')) return fallback;
  return text;
}

function normalizeSameSite(value, fallback = 'Lax') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'strict') return 'Strict';
  if (raw === 'none') return 'None';
  if (raw === 'lax') return 'Lax';
  return fallback;
}

function normalizeCookieDomain(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/[;\s]/.test(text)) return '';
  return text;
}

function decodeBase32(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  if (!clean) return Buffer.alloc(0);
  let bits = '';
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function computeTotp(secretBuffer, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function createAdminHttpRuntime(options = {}) {
  function verifyTotpCode(secretText, otpInput, windowSteps = 1) {
    const secret = decodeBase32(secretText);
    if (!secret.length) return false;
    const otp = String(otpInput || '').trim();
    if (!/^\d{6}$/.test(otp)) return false;
    const nowCounter = Math.floor(Date.now() / 1000 / 30);
    const drift = Math.max(0, Math.trunc(Number(windowSteps || 0)));
    for (let i = -drift; i <= drift; i += 1) {
      const code = computeTotp(secret, nowCounter + i);
      if (options.secureEqual(code, otp)) return true;
    }
    return false;
  }

  function jsonReplacer(_key, value) {
    if (typeof value === 'bigint') return Number(value);
    if (value instanceof Date) return value.toISOString();
    return value;
  }

  function buildSecurityHeaders(extraHeaders = {}, runtimeOptions = {}) {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    };
    if (options.adminWebHstsEnabled) {
      headers['Strict-Transport-Security'] = `max-age=${options.adminWebHstsMaxAgeSec}; includeSubDomains`;
    }
    if (runtimeOptions.isHtml && options.adminWebCsp) {
      headers['Content-Security-Policy'] = options.adminWebCsp;
    }
    return { ...headers, ...extraHeaders };
  }

  function sendJson(res, statusCode, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload, jsonReplacer);
    res.writeHead(
      statusCode,
      buildSecurityHeaders({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders,
      }),
    );
    res.end(body);
  }

  function sendHtml(res, statusCode, html) {
    res.writeHead(
      statusCode,
      buildSecurityHeaders(
        {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
        { isHtml: true },
      ),
    );
    res.end(html);
  }

  function sendText(res, statusCode, text) {
    res.writeHead(
      statusCode,
      buildSecurityHeaders({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      }),
    );
    res.end(text);
  }

  function sendDownload(res, statusCode, body, downloadOptions = {}) {
    const filename = String(downloadOptions.filename || 'download.txt').trim() || 'download.txt';
    const safeFilename = filename.replace(/["\r\n]/g, '');
    const encodedFilename = encodeURIComponent(safeFilename);
    const contentType = String(downloadOptions.contentType || 'application/octet-stream').trim()
      || 'application/octet-stream';
    const cacheControl = String(downloadOptions.cacheControl || 'no-store').trim() || 'no-store';
    res.writeHead(
      statusCode,
      buildSecurityHeaders({
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
      }),
    );
    res.end(body);
  }

  return {
    buildSecurityHeaders,
    jsonReplacer,
    sendDownload,
    sendHtml,
    sendJson,
    sendText,
    verifyTotpCode,
  };
}

module.exports = {
  createAdminHttpRuntime,
  envBool,
  normalizeCookieDomain,
  normalizeCookiePath,
  normalizeSameSite,
};
