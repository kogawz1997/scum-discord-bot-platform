'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

function getIconContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  return 'image/webp';
}

function getAssetContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.css') return 'text/css; charset=utf-8';
  if (normalized === '.js') return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function getVisualAssetContentType(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.svg') return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function createAdminPageRuntime(options = {}) {
  const {
    dashboardHtmlPath,
    ownerConsoleHtmlPath,
    tenantConsoleHtmlPath,
    loginHtmlPath,
    assetsDirPath,
    scumItemsDirPath,
    visualAssetsDirPath,
    buildSecurityHeaders,
    sendText,
  } = options;
  const resolvedVisualAssetsDirPath = visualAssetsDirPath
    || path.resolve(
      assetsDirPath,
      'visuals',
    );

  let cachedDashboardHtml = null;
  let cachedOwnerConsoleHtml = null;
  let cachedTenantConsoleHtml = null;
  let cachedLoginHtml = null;
  let cachedDashboardHtmlMtimeMs = 0;
  let cachedOwnerConsoleHtmlMtimeMs = 0;
  let cachedTenantConsoleHtmlMtimeMs = 0;
  let cachedLoginHtmlMtimeMs = 0;

  function readHtmlWithMtime(cacheValue, cacheMtimeMs, filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (!cacheValue || stat.mtimeMs !== cacheMtimeMs) {
        return {
          html: fs.readFileSync(filePath, 'utf8'),
          mtimeMs: stat.mtimeMs,
        };
      }
    } catch {
      if (!cacheValue) {
        throw new Error(`Unable to read HTML template: ${filePath}`);
      }
    }
    return {
      html: cacheValue,
      mtimeMs: cacheMtimeMs,
    };
  }

  async function tryServeAdminStaticAsset(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;
    if (!String(pathname || '').startsWith('/admin/assets/')) return false;

    if (String(pathname || '').startsWith('/admin/assets/visuals/')) {
      let relativeName = '';
      try {
        relativeName = decodeURIComponent(String(pathname || '').slice('/admin/assets/visuals/'.length));
      } catch {
        return false;
      }
      if (!relativeName || relativeName.includes('..')) {
        sendText(res, 404, 'Not found');
        return true;
      }
      const ext = path.extname(relativeName).toLowerCase();
      if (!new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']).has(ext)) {
        sendText(res, 404, 'Not found');
        return true;
      }
      const absPath = path.resolve(resolvedVisualAssetsDirPath, relativeName);
      if (!absPath.startsWith(resolvedVisualAssetsDirPath)) {
        sendText(res, 404, 'Not found');
        return true;
      }
      try {
        const stat = await fs.promises.stat(absPath);
        if (!stat.isFile()) {
          sendText(res, 404, 'Not found');
          return true;
        }
        res.writeHead(200, {
          ...buildSecurityHeaders({
            'Content-Type': getVisualAssetContentType(ext),
            'Cache-Control': 'public, max-age=86400',
          }),
        });
        await pipeline(fs.createReadStream(absPath), res);
        return true;
      } catch {
        sendText(res, 404, 'Not found');
        return true;
      }
    }

    let relativeName = '';
    try {
      relativeName = decodeURIComponent(String(pathname || '').slice('/admin/assets/'.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('/') || relativeName.includes('\\')) {
      sendText(res, 404, 'Not found');
      return true;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (ext !== '.css' && ext !== '.js') {
      sendText(res, 404, 'Not found');
      return true;
    }

    const absPath = path.resolve(assetsDirPath, relativeName);
    if (!absPath.startsWith(assetsDirPath)) {
      sendText(res, 404, 'Not found');
      return true;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) {
        sendText(res, 404, 'Not found');
        return true;
      }
      res.writeHead(200, {
        ...buildSecurityHeaders({
          'Content-Type': getAssetContentType(ext),
          'Cache-Control': 'public, max-age=300',
        }),
      });
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendText(res, 404, 'Not found');
      return true;
    }
  }

  async function tryServeStaticScumIcon(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;

    const prefixes = ['/assets/scum-items/', '/admin/assets/scum-items/'];
    const matchedPrefix = prefixes.find((prefix) => String(pathname || '').startsWith(prefix));
    if (!matchedPrefix) return false;

    let relativeName = '';
    try {
      relativeName = decodeURIComponent(String(pathname || '').slice(matchedPrefix.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('/') || relativeName.includes('\\')) {
      return false;
    }
    if (relativeName.includes('..')) {
      return false;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (!new Set(['.webp', '.png', '.jpg', '.jpeg']).has(ext)) {
      return false;
    }

    const absPath = path.resolve(scumItemsDirPath, relativeName);
    if (!absPath.startsWith(scumItemsDirPath)) {
      return false;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) {
        sendText(res, 404, 'Not found');
        return true;
      }
      res.writeHead(200, {
        ...buildSecurityHeaders({
          'Content-Type': getIconContentType(ext),
          'Cache-Control': 'public, max-age=86400',
        }),
      });
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendText(res, 404, 'Not found');
      return true;
    }
  }

  function getDashboardHtml() {
    const result = readHtmlWithMtime(cachedDashboardHtml, cachedDashboardHtmlMtimeMs, dashboardHtmlPath);
    cachedDashboardHtml = result.html;
    cachedDashboardHtmlMtimeMs = result.mtimeMs;
    return cachedDashboardHtml;
  }

  function getOwnerConsoleHtml() {
    const result = readHtmlWithMtime(cachedOwnerConsoleHtml, cachedOwnerConsoleHtmlMtimeMs, ownerConsoleHtmlPath);
    cachedOwnerConsoleHtml = result.html;
    cachedOwnerConsoleHtmlMtimeMs = result.mtimeMs;
    return cachedOwnerConsoleHtml;
  }

  function getTenantConsoleHtml() {
    const result = readHtmlWithMtime(cachedTenantConsoleHtml, cachedTenantConsoleHtmlMtimeMs, tenantConsoleHtmlPath);
    cachedTenantConsoleHtml = result.html;
    cachedTenantConsoleHtmlMtimeMs = result.mtimeMs;
    return cachedTenantConsoleHtml;
  }

  function getLoginHtml() {
    const result = readHtmlWithMtime(cachedLoginHtml, cachedLoginHtmlMtimeMs, loginHtmlPath);
    cachedLoginHtml = result.html;
    cachedLoginHtmlMtimeMs = result.mtimeMs;
    return cachedLoginHtml;
  }

  return {
    tryServeAdminStaticAsset,
    tryServeStaticScumIcon,
    getDashboardHtml,
    getOwnerConsoleHtml,
    getTenantConsoleHtml,
    getLoginHtml,
  };
}

module.exports = {
  createAdminPageRuntime,
};
