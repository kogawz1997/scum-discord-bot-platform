'use strict';

const { URL } = require('node:url');

function createHttpError(statusCode, message) {
  const error = new Error(String(message || 'Request error'));
  error.statusCode = Number(statusCode) || 500;
  return error;
}

function createAdminRequestRuntime(options = {}) {
  const {
    adminWebMaxBodyBytes,
    adminWebTrustProxy,
    adminWebEnforceOriginCheck,
    adminWebAllowedOrigins,
    getAdminRestoreState,
    sendJson,
  } = options;

  function shouldBypassRestoreMaintenance(pathname) {
    const normalized = String(pathname || '').trim();
    return (
      normalized === '/admin/api/login'
      || normalized === '/admin/api/logout'
      || normalized === '/admin/api/backup/restore'
    );
  }

  function sendRestoreMaintenanceUnavailable(res) {
    return sendJson(res, 503, {
      ok: false,
      error: 'Backup restore is in progress',
      data: {
        restore: typeof getAdminRestoreState === 'function'
          ? getAdminRestoreState()
          : null,
      },
    });
  }

  function getClientIp(req) {
    if (adminWebTrustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim();
      if (forwarded) return forwarded;
    }
    return String(req.socket?.remoteAddress || '').trim() || 'unknown';
  }

  function setRequestMeta(req, patch = {}) {
    if (!req || typeof req !== 'object') return {};
    const current = req.__adminRequestMeta && typeof req.__adminRequestMeta === 'object'
      ? req.__adminRequestMeta
      : {};
    req.__adminRequestMeta = {
      ...current,
      ...(patch && typeof patch === 'object' ? patch : {}),
    };
    return req.__adminRequestMeta;
  }

  function normalizeOrigin(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      return new URL(raw).origin.toLowerCase();
    } catch {
      return '';
    }
  }

  function buildAllowedOrigins(host, port) {
    const out = new Set();
    const add = (value) => {
      const normalized = normalizeOrigin(value);
      if (normalized) out.add(normalized);
    };
    const splitOriginDefaults = [
      process.env.OWNER_WEB_BASE_URL,
      process.env.TENANT_WEB_BASE_URL,
      'http://127.0.0.1:3201',
      'http://localhost:3201',
      'http://127.0.0.1:3202',
      'http://localhost:3202',
    ];

    add(`http://127.0.0.1:${port}`);
    add(`http://localhost:${port}`);
    if (host && host !== '0.0.0.0' && host !== '::') {
      add(`http://${host}:${port}`);
    }
    splitOriginDefaults.forEach(add);

    for (const item of String(adminWebAllowedOrigins || '').split(',')) {
      add(item);
    }

    return out;
  }

  function getRequestOrigin(req) {
    const fromOrigin = normalizeOrigin(req.headers.origin);
    if (fromOrigin) return fromOrigin;
    const referrer = String(req.headers.referer || '').trim();
    if (!referrer) return '';
    try {
      return new URL(referrer).origin.toLowerCase();
    } catch {
      return '';
    }
  }

  function isSafeHttpMethod(method) {
    const text = String(method || '').toUpperCase();
    return text === 'GET' || text === 'HEAD' || text === 'OPTIONS';
  }

  function violatesBrowserOriginPolicy(req, allowedOrigins) {
    if (!adminWebEnforceOriginCheck) return false;
    const fetchSite = String(req.headers['sec-fetch-site'] || '')
      .trim()
      .toLowerCase();
    if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
      return true;
    }

    const origin = getRequestOrigin(req);
    if (!origin) return false;
    return !allowedOrigins.has(origin);
  }

  function readJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      let bytes = 0;
      let done = false;
      req.on('data', (chunk) => {
        if (done) return;
        body += chunk;
        bytes += Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk));
        if (bytes > adminWebMaxBodyBytes) {
          done = true;
          reject(createHttpError(413, 'เนื้อหาคำขอใหญ่เกินกำหนด'));
          req.resume();
        }
      });
      req.on('end', () => {
        if (done) return;
        done = true;
        if (!body.trim()) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(createHttpError(400, 'รูปแบบ JSON ไม่ถูกต้อง'));
        }
      });
      req.on('error', (error) => {
        if (done) return;
        done = true;
        reject(error);
      });
    });
  }

  return {
    buildAllowedOrigins,
    getClientIp,
    getRequestOrigin,
    isSafeHttpMethod,
    readJsonBody,
    sendRestoreMaintenanceUnavailable,
    setRequestMeta,
    shouldBypassRestoreMaintenance,
    violatesBrowserOriginPolicy,
  };
}

module.exports = {
  createAdminRequestRuntime,
};
