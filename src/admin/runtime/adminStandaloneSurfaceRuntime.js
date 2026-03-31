'use strict';

const path = require('node:path');
const { URL } = require('node:url');

const {
  createAdminHttpRuntime,
} = require('./adminHttpRuntime');
const {
  createAdminPageRuntime,
} = require('./adminPageRuntime');

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractHostname(rawHost) {
  const input = String(rawHost || '').trim().toLowerCase();
  if (!input) return '';
  if (input.startsWith('[')) {
    const endIndex = input.indexOf(']');
    return endIndex > 0 ? input.slice(1, endIndex) : input;
  }
  const colonIndex = input.indexOf(':');
  return colonIndex >= 0 ? input.slice(0, colonIndex) : input;
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function createSurfaceBaseUrl(rawBaseUrl, host, port, defaultPort) {
  const normalized = trimTrailingSlash(rawBaseUrl);
  if (normalized) return normalized;
  const finalHost = String(host || '127.0.0.1').trim() || '127.0.0.1';
  const finalPort = asInt(port, defaultPort);
  return `http://${finalHost}:${finalPort}`;
}

function buildAbsoluteUrl(baseUrl, pathname, search = '') {
  const target = new URL(baseUrl);
  target.pathname = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${String(pathname || '')}`;
  target.search = String(search || '');
  return target.toString();
}

function rewriteAdminApiPathForSurface(surface, pathname) {
  const activeSurface = String(surface || '').trim().toLowerCase();
  const rawPath = String(pathname || '').trim();
  if (!rawPath.startsWith('/admin/api/')) return rawPath;
  if (activeSurface === 'owner') {
    return `/owner/api/${rawPath.slice('/admin/api/'.length)}`;
  }
  if (activeSurface === 'tenant') {
    return `/tenant/api/${rawPath.slice('/admin/api/'.length)}`;
  }
  return rawPath;
}

function isOwnerConsolePath(pathname) {
  const raw = String(pathname || '').trim().toLowerCase();
  return raw === '/owner'
    || raw === '/owner/'
    || (raw.startsWith('/owner/') && !raw.startsWith('/owner/login') && !raw.startsWith('/owner/api/'));
}

function isTenantConsolePath(pathname) {
  const raw = String(pathname || '').trim().toLowerCase();
  return raw === '/tenant'
    || raw === '/tenant/'
    || (raw.startsWith('/tenant/') && !raw.startsWith('/tenant/login') && !raw.startsWith('/tenant/api/'));
}

function isOwnerLoginPath(pathname) {
  const raw = String(pathname || '').trim().toLowerCase();
  return raw === '/owner/login' || raw === '/owner/login/' || raw === '/admin/login' || raw === '/admin/login/';
}

function isTenantLoginPath(pathname) {
  const raw = String(pathname || '').trim().toLowerCase();
  return raw === '/tenant/login' || raw === '/tenant/login/';
}

function isPublicPortalPath(pathname) {
  const raw = String(pathname || '').trim().toLowerCase();
  return raw === '/landing'
    || raw === '/landing/'
    || raw === '/pricing'
    || raw === '/pricing/'
    || raw === '/signup'
    || raw === '/signup/'
    || raw === '/login'
    || raw === '/forgot-password'
    || raw === '/forgot-password/'
    || raw === '/verify-email'
    || raw === '/verify-email/'
    || raw === '/checkout'
    || raw === '/checkout/'
    || raw === '/payment-result'
    || raw === '/payment-result/'
    || raw === '/player'
    || raw === '/player/'
    || raw.startsWith('/player/');
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : null;
}

function buildProxyRequestHeaders(sourceHeaders = {}, adminHostHeader = '') {
  const nextHeaders = {};
  for (const [rawKey, rawValue] of Object.entries(sourceHeaders || {})) {
    const key = String(rawKey || '').toLowerCase();
    if (!key || key === 'host' || key === 'connection' || key === 'content-length') {
      continue;
    }
    nextHeaders[key] = rawValue;
  }
  if (adminHostHeader) {
    nextHeaders.host = adminHostHeader;
  }
  return nextHeaders;
}

async function writeProxyResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key === 'connection' || key === 'transfer-encoding') return;
    headers[key] = value;
  });
  if (typeof response.headers.getSetCookie === 'function') {
    const setCookies = response.headers.getSetCookie();
    if (Array.isArray(setCookies) && setCookies.length > 0) {
      headers['set-cookie'] = setCookies;
    }
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (!Object.prototype.hasOwnProperty.call(headers, 'content-length')) {
    headers['content-length'] = String(body.length);
  }
  res.writeHead(response.status, headers);
  res.end(body);
}

function createAdminStandaloneSurfaceRuntime(options = {}) {
  const {
    surface,
    host = '127.0.0.1',
    port,
    defaultPort = surface === 'owner' ? 3201 : 3202,
    adminBaseUrl = `http://127.0.0.1:${process.env.ADMIN_WEB_PORT || '3200'}`,
    ownerBaseUrl = createSurfaceBaseUrl(process.env.OWNER_WEB_BASE_URL, host, process.env.OWNER_WEB_PORT, 3201),
    tenantBaseUrl = createSurfaceBaseUrl(process.env.TENANT_WEB_BASE_URL, host, process.env.TENANT_WEB_PORT, 3202),
    playerBaseUrl = trimTrailingSlash(process.env.WEB_PORTAL_BASE_URL)
      || `http://${isLoopbackHostname(host) ? host : '127.0.0.1'}:${process.env.WEB_PORTAL_PORT || '3300'}`,
    fetchImpl = global.fetch,
    assetsDirPath = path.resolve(__dirname, '..', 'assets'),
    scumItemsDirPath = path.resolve(process.cwd(), 'img', 'scum_items'),
    loginHtmlPath = path.resolve(__dirname, '..', 'login.html'),
    tenantLoginHtmlPath = path.resolve(__dirname, '..', 'tenant-login.html'),
    ownerConsoleHtmlPath = path.resolve(__dirname, '..', 'owner-console.html'),
    tenantConsoleHtmlPath = path.resolve(__dirname, '..', 'tenant-console.html'),
  } = options;

  const activeSurface = String(surface || '').trim().toLowerCase();
  if (activeSurface !== 'owner' && activeSurface !== 'tenant') {
    throw new Error(`Unsupported surface: ${surface}`);
  }

  const finalPort = asInt(port, defaultPort);
  const adminOrigin = trimTrailingSlash(adminBaseUrl) || 'http://127.0.0.1:3200';
  const adminHostHeader = (() => {
    try {
      return new URL(adminOrigin).host;
    } catch {
      return '';
    }
  })();

  const httpRuntime = createAdminHttpRuntime({
    adminWebHstsEnabled: false,
    adminWebHstsMaxAgeSec: 31536000,
    adminWebCsp: '',
    secureEqual: (left, right) => String(left || '') === String(right || ''),
  });
  const pageRuntime = createAdminPageRuntime({
    dashboardHtmlPath: loginHtmlPath,
    ownerConsoleHtmlPath,
    tenantConsoleHtmlPath,
    loginHtmlPath,
    tenantLoginHtmlPath,
    assetsDirPath,
    scumItemsDirPath,
    buildSecurityHeaders: httpRuntime.buildSecurityHeaders,
    sendText: httpRuntime.sendText,
  });

  function sendRedirect(res, baseUrl, pathname, search = '') {
    res.writeHead(302, {
      Location: buildAbsoluteUrl(baseUrl, pathname, search),
      'Cache-Control': 'no-store',
    });
    res.end();
  }

  async function proxyToAdmin(req, res, pathname, search = '') {
    const targetUrl = `${adminOrigin}${pathname}${search}`;
    const method = String(req.method || 'GET').toUpperCase();
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
    const response = await fetchImpl(targetUrl, {
      method,
      headers: buildProxyRequestHeaders(req.headers, adminHostHeader),
      body,
      redirect: 'manual',
    });
    await writeProxyResponse(res, response);
  }

  async function handleRequest(req, res) {
    const urlObj = new URL(req.url || '/', `http://${host}:${finalPort}`);
    const pathname = urlObj.pathname;
    try {
      if (await pageRuntime.tryServeAdminStaticAsset(req, res, pathname)) {
        return;
      }
      if (await pageRuntime.tryServeStaticScumIcon(req, res, pathname)) {
        return;
      }

      if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (pathname === '/healthz') {
        httpRuntime.sendJson(res, 200, {
          ok: true,
          data: {
            surface: activeSurface,
            now: new Date().toISOString(),
            upstream: adminOrigin,
            uptimeSec: Math.round(process.uptime()),
          },
        });
        return;
      }

      if (pathname === '/') {
        res.writeHead(302, {
          Location: activeSurface === 'owner' ? '/owner' : '/tenant',
          'Cache-Control': 'no-store',
        });
        res.end();
        return;
      }

      if (isPublicPortalPath(pathname)) {
        sendRedirect(res, playerBaseUrl, pathname, urlObj.search);
        return;
      }

      if (activeSurface === 'owner' && pathname.startsWith('/tenant')) {
        sendRedirect(res, tenantBaseUrl, pathname, urlObj.search);
        return;
      }

      if (activeSurface === 'tenant' && pathname.startsWith('/owner')) {
        sendRedirect(res, ownerBaseUrl, pathname, urlObj.search);
        return;
      }

      if (pathname.startsWith('/platform/api/') || pathname.startsWith('/admin/api/')) {
        const proxiedPath = rewriteAdminApiPathForSurface(activeSurface, pathname);
        await proxyToAdmin(req, res, proxiedPath, urlObj.search);
        return;
      }

      if (activeSurface === 'owner' && pathname.startsWith('/owner/api/')) {
        await proxyToAdmin(req, res, pathname, urlObj.search);
        return;
      }

      if (activeSurface === 'tenant' && pathname.startsWith('/tenant/api/')) {
        await proxyToAdmin(req, res, pathname, urlObj.search);
        return;
      }

      if (pathname.startsWith('/admin/auth/discord/')) {
        await proxyToAdmin(req, res, pathname, urlObj.search);
        return;
      }

      if (activeSurface === 'owner' && isOwnerLoginPath(pathname) && String(req.method || 'GET').toUpperCase() === 'GET') {
        httpRuntime.sendHtml(res, 200, pageRuntime.getLoginHtml());
        return;
      }

      if (activeSurface === 'tenant' && isTenantLoginPath(pathname) && String(req.method || 'GET').toUpperCase() === 'GET') {
        httpRuntime.sendHtml(res, 200, pageRuntime.getTenantLoginHtml());
        return;
      }

      if (activeSurface === 'owner' && isOwnerConsolePath(pathname) && String(req.method || 'GET').toUpperCase() === 'GET') {
        httpRuntime.sendHtml(res, 200, pageRuntime.getOwnerConsoleHtml());
        return;
      }

      if (activeSurface === 'tenant' && isTenantConsolePath(pathname) && String(req.method || 'GET').toUpperCase() === 'GET') {
        httpRuntime.sendHtml(res, 200, pageRuntime.getTenantConsoleHtml());
        return;
      }

      httpRuntime.sendText(res, 404, 'Not found');
    } catch (error) {
      console.error(`[${activeSurface}-web] request failed for ${String(req.method || 'GET').toUpperCase()} ${pathname}:`, error);
      if (res.headersSent || res.writableEnded) {
        return;
      }
      const isApiRequest = pathname.startsWith('/owner/api/')
        || pathname.startsWith('/tenant/api/')
        || pathname.startsWith('/admin/api/')
        || pathname.startsWith('/platform/api/')
        || pathname.startsWith('/admin/auth/');
      if (isApiRequest) {
        httpRuntime.sendJson(res, 502, {
          ok: false,
          error: 'surface_upstream_unavailable',
          message: 'The control plane is temporarily unavailable.',
          data: {
            surface: activeSurface,
            upstream: adminOrigin,
            pathname,
          },
        });
        return;
      }
      httpRuntime.sendText(res, 502, 'Service temporarily unavailable');
    }
  }

  return {
    surface: activeSurface,
    host,
    port: finalPort,
    ownerBaseUrl,
    tenantBaseUrl,
    playerBaseUrl,
    adminBaseUrl: adminOrigin,
    handleRequest,
  };
}

module.exports = {
  asInt,
  buildAbsoluteUrl,
  createAdminStandaloneSurfaceRuntime,
  createSurfaceBaseUrl,
  extractHostname,
  isLoopbackHostname,
  isOwnerConsolePath,
  isOwnerLoginPath,
  isPublicPortalPath,
  isTenantConsolePath,
  isTenantLoginPath,
  rewriteAdminApiPathForSurface,
  trimTrailingSlash,
};
