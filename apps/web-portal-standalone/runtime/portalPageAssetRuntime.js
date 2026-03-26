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

function getPortalAssetContentType(ext) {
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

function createPortalPageAssetRuntime(options = {}) {
  const {
    isProduction,
    authLoginHtmlPath,
    playerLoginHtmlPath,
    playerHtmlPath,
    legacyPlayerHtmlPath,
    landingHtmlPath,
    pricingHtmlPath,
    signupHtmlPath,
    forgotPasswordHtmlPath,
    verifyEmailHtmlPath,
    checkoutHtmlPath,
    paymentResultHtmlPath,
    previewHtmlPath,
    trialHtmlPath,
    showcaseHtmlPath,
    publicAssetsDirPath,
    docsDirPath,
    scumItemsDirPath,
    visualAssetsDirPath,
    faviconSvg,
    sendJson,
    sendHtml,
    buildSecurityHeaders,
    escapeHtml,
  } = options;
  const resolvedLegacyPlayerHtmlPath = legacyPlayerHtmlPath || playerHtmlPath;
  const resolvedPublicAssetsDirPath = publicAssetsDirPath || path.join(path.dirname(playerHtmlPath), 'assets');
  const resolvedVisualAssetsDirPath = visualAssetsDirPath
    || path.resolve(
      resolvedPublicAssetsDirPath,
      'visuals',
    );

  let cachedAuthLoginHtml = null;
  let cachedPlayerLoginHtml = null;
  let cachedPlayerHtml = null;
  let cachedLegacyPlayerHtml = null;
  let cachedLandingHtml = null;
  let cachedPricingHtml = null;
  let cachedSignupHtml = null;
  let cachedForgotPasswordHtml = null;
  let cachedVerifyEmailHtml = null;
  let cachedCheckoutHtml = null;
  let cachedPaymentResultHtml = null;
  let cachedPreviewHtml = null;
  let cachedTrialHtml = null;
  let cachedShowcaseHtml = null;
  let cachedAuthLoginHtmlMtimeMs = 0;
  let cachedPlayerLoginHtmlMtimeMs = 0;
  let cachedPlayerHtmlMtimeMs = 0;
  let cachedLegacyPlayerHtmlMtimeMs = 0;
  let cachedLandingHtmlMtimeMs = 0;
  let cachedPricingHtmlMtimeMs = 0;
  let cachedSignupHtmlMtimeMs = 0;
  let cachedForgotPasswordHtmlMtimeMs = 0;
  let cachedVerifyEmailHtmlMtimeMs = 0;
  let cachedCheckoutHtmlMtimeMs = 0;
  let cachedPaymentResultHtmlMtimeMs = 0;
  let cachedPreviewHtmlMtimeMs = 0;
  let cachedTrialHtmlMtimeMs = 0;
  let cachedShowcaseHtmlMtimeMs = 0;

  function getFileMtimeMs(filePath) {
    try {
      const stat = fs.statSync(filePath);
      return Number(stat.mtimeMs || 0);
    } catch {
      return 0;
    }
  }

  function loadHtmlTemplate(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  function sendFavicon(res) {
    res.writeHead(
      200,
      buildSecurityHeaders({
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      }),
    );
    res.end(faviconSvg);
  }

  async function tryServeStaticScumIcon(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;
    const prefixes = ['/assets/scum-items/', '/player/assets/scum-items/'];
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
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
      res.writeHead(
        200,
        buildSecurityHeaders({
          'Content-Type': getIconContentType(ext),
          'Cache-Control': 'public, max-age=86400',
        }),
      );
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }
  }

  async function tryServePortalStaticAsset(req, res, pathname) {
    if (String(req.method || '').toUpperCase() !== 'GET') return false;
    const prefix = '/player/assets/ui/';
    if (!String(pathname || '').startsWith(prefix)) return false;

    if (String(pathname || '').startsWith('/player/assets/ui/visuals/')) {
      let relativeName = '';
      try {
        relativeName = decodeURIComponent(String(pathname || '').slice('/player/assets/ui/visuals/'.length));
      } catch {
        return false;
      }
      if (!relativeName || relativeName.includes('..')) {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
      const ext = path.extname(relativeName).toLowerCase();
      if (!new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']).has(ext)) {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
      const absPath = path.resolve(resolvedVisualAssetsDirPath, relativeName);
      if (!absPath.startsWith(resolvedVisualAssetsDirPath)) {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
      try {
        const stat = await fs.promises.stat(absPath);
        if (!stat.isFile()) {
          sendJson(res, 404, { ok: false, error: 'Not found' });
          return true;
        }
        res.writeHead(
          200,
          buildSecurityHeaders({
            'Content-Type': getVisualAssetContentType(ext),
            'Cache-Control': 'public, max-age=86400',
          }),
        );
        await pipeline(fs.createReadStream(absPath), res);
        return true;
      } catch {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
    }

    let relativeName = '';
    try {
      relativeName = decodeURIComponent(String(pathname || '').slice(prefix.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('..')) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (ext !== '.css' && ext !== '.js') {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    const absPath = path.resolve(resolvedPublicAssetsDirPath, relativeName);
    if (!absPath.startsWith(resolvedPublicAssetsDirPath)) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    try {
      const stat = await fs.promises.stat(absPath);
      if (!stat.isFile()) {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return true;
      }
      res.writeHead(
        200,
        buildSecurityHeaders({
          'Content-Type': getPortalAssetContentType(ext),
          'Cache-Control': 'public, max-age=300',
        }),
      );
      await pipeline(fs.createReadStream(absPath), res);
      return true;
    } catch {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }
  }

  function getPlayerHtml() {
    const mtimeMs = getFileMtimeMs(playerHtmlPath);
    if (!cachedPlayerHtml || !isProduction || mtimeMs > cachedPlayerHtmlMtimeMs) {
      cachedPlayerHtml = loadHtmlTemplate(playerHtmlPath);
      cachedPlayerHtmlMtimeMs = mtimeMs;
    }
    return cachedPlayerHtml;
  }

  function getLegacyPlayerHtml() {
    const mtimeMs = getFileMtimeMs(resolvedLegacyPlayerHtmlPath);
    if (!cachedLegacyPlayerHtml || !isProduction || mtimeMs > cachedLegacyPlayerHtmlMtimeMs) {
      cachedLegacyPlayerHtml = loadHtmlTemplate(resolvedLegacyPlayerHtmlPath);
      cachedLegacyPlayerHtmlMtimeMs = mtimeMs;
    }
    return cachedLegacyPlayerHtml;
  }

  function getLandingHtml() {
    const mtimeMs = getFileMtimeMs(landingHtmlPath);
    if (!cachedLandingHtml || !isProduction || mtimeMs > cachedLandingHtmlMtimeMs) {
      cachedLandingHtml = loadHtmlTemplate(landingHtmlPath);
      cachedLandingHtmlMtimeMs = mtimeMs;
    }
    return cachedLandingHtml;
  }

  function getTrialHtml() {
    const mtimeMs = getFileMtimeMs(trialHtmlPath);
    if (!cachedTrialHtml || !isProduction || mtimeMs > cachedTrialHtmlMtimeMs) {
      cachedTrialHtml = loadHtmlTemplate(trialHtmlPath);
      cachedTrialHtmlMtimeMs = mtimeMs;
    }
    return cachedTrialHtml;
  }

  function getShowcaseHtml() {
    const mtimeMs = getFileMtimeMs(showcaseHtmlPath);
    if (!cachedShowcaseHtml || !isProduction || mtimeMs > cachedShowcaseHtmlMtimeMs) {
      cachedShowcaseHtml = loadHtmlTemplate(showcaseHtmlPath);
      cachedShowcaseHtmlMtimeMs = mtimeMs;
    }
    return cachedShowcaseHtml;
  }

  function renderMarkdownDocument(title, markdown) {
    return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;background:linear-gradient(155deg,#071018,#0c151e 48%,#142231);color:#edf3fb;font-family:ui-sans-serif,system-ui,sans-serif}
    .shell{width:min(980px,calc(100% - 24px));margin:0 auto;padding:22px 0 42px}
    .card{background:rgba(17,28,38,.94);border:1px solid rgba(171,194,219,.16);border-radius:24px;padding:22px;box-shadow:0 24px 72px rgba(0,0,0,.34)}
    a{color:#94d0ff}
    h1{margin:0 0 16px;font-size:32px}
    p{color:#a6b8cb}
    pre{white-space:pre-wrap;line-height:1.7;font-size:14px;color:#d8e3ef}
  </style>
</head>
<body>
  <div class="shell">
    <div class="card">
      <p><a href="/landing">กลับหน้า Landing</a></p>
      <h1>${escapeHtml(title)}</h1>
      <pre>${escapeHtml(markdown)}</pre>
    </div>
  </div>
</body>
</html>`;
  }

  function tryServePublicDoc(pathname, res) {
    if (!String(pathname || '').startsWith('/docs/')) return false;
    const relative = String(pathname || '').slice('/docs/'.length);
    if (!relative || !relative.toLowerCase().endsWith('.md')) return false;
    const absolute = path.resolve(docsDirPath, relative);
    if (!absolute.startsWith(docsDirPath)) return false;
    if (!fs.existsSync(absolute)) return false;
    const markdown = fs.readFileSync(absolute, 'utf8');
    sendHtml(res, 200, renderMarkdownDocument(path.basename(relative), markdown));
    return true;
  }

  function getAuthLoginHtml() {
    const mtimeMs = getFileMtimeMs(authLoginHtmlPath);
    if (!cachedAuthLoginHtml || !isProduction || mtimeMs > cachedAuthLoginHtmlMtimeMs) {
      cachedAuthLoginHtml = loadHtmlTemplate(authLoginHtmlPath);
      cachedAuthLoginHtmlMtimeMs = mtimeMs;
    }
    return cachedAuthLoginHtml;
  }

  function renderPlayerLoginPage(message) {
    const mtimeMs = getFileMtimeMs(playerLoginHtmlPath);
    if (!cachedPlayerLoginHtml || !isProduction || mtimeMs > cachedPlayerLoginHtmlMtimeMs) {
      cachedPlayerLoginHtml = loadHtmlTemplate(playerLoginHtmlPath);
      cachedPlayerLoginHtmlMtimeMs = mtimeMs;
    }
    const safe = escapeHtml(String(message || ''));
    return cachedPlayerLoginHtml.replace('__ERROR_MESSAGE__', safe);
  }

  function getPricingHtml() {
    const mtimeMs = getFileMtimeMs(pricingHtmlPath);
    if (!cachedPricingHtml || !isProduction || mtimeMs > cachedPricingHtmlMtimeMs) {
      cachedPricingHtml = loadHtmlTemplate(pricingHtmlPath);
      cachedPricingHtmlMtimeMs = mtimeMs;
    }
    return cachedPricingHtml;
  }

  function getSignupHtml() {
    const mtimeMs = getFileMtimeMs(signupHtmlPath);
    if (!cachedSignupHtml || !isProduction || mtimeMs > cachedSignupHtmlMtimeMs) {
      cachedSignupHtml = loadHtmlTemplate(signupHtmlPath);
      cachedSignupHtmlMtimeMs = mtimeMs;
    }
    return cachedSignupHtml;
  }

  function getForgotPasswordHtml() {
    const mtimeMs = getFileMtimeMs(forgotPasswordHtmlPath);
    if (!cachedForgotPasswordHtml || !isProduction || mtimeMs > cachedForgotPasswordHtmlMtimeMs) {
      cachedForgotPasswordHtml = loadHtmlTemplate(forgotPasswordHtmlPath);
      cachedForgotPasswordHtmlMtimeMs = mtimeMs;
    }
    return cachedForgotPasswordHtml;
  }

  function getVerifyEmailHtml() {
    const mtimeMs = getFileMtimeMs(verifyEmailHtmlPath);
    if (!cachedVerifyEmailHtml || !isProduction || mtimeMs > cachedVerifyEmailHtmlMtimeMs) {
      cachedVerifyEmailHtml = loadHtmlTemplate(verifyEmailHtmlPath);
      cachedVerifyEmailHtmlMtimeMs = mtimeMs;
    }
    return cachedVerifyEmailHtml;
  }

  function getCheckoutHtml() {
    const mtimeMs = getFileMtimeMs(checkoutHtmlPath);
    if (!cachedCheckoutHtml || !isProduction || mtimeMs > cachedCheckoutHtmlMtimeMs) {
      cachedCheckoutHtml = loadHtmlTemplate(checkoutHtmlPath);
      cachedCheckoutHtmlMtimeMs = mtimeMs;
    }
    return cachedCheckoutHtml;
  }

  function getPaymentResultHtml() {
    const mtimeMs = getFileMtimeMs(paymentResultHtmlPath);
    if (!cachedPaymentResultHtml || !isProduction || mtimeMs > cachedPaymentResultHtmlMtimeMs) {
      cachedPaymentResultHtml = loadHtmlTemplate(paymentResultHtmlPath);
      cachedPaymentResultHtmlMtimeMs = mtimeMs;
    }
    return cachedPaymentResultHtml;
  }

  function getPreviewHtml() {
    const mtimeMs = getFileMtimeMs(previewHtmlPath);
    if (!cachedPreviewHtml || !isProduction || mtimeMs > cachedPreviewHtmlMtimeMs) {
      cachedPreviewHtml = loadHtmlTemplate(previewHtmlPath);
      cachedPreviewHtmlMtimeMs = mtimeMs;
    }
    return cachedPreviewHtml;
  }

  return {
    sendFavicon,
    tryServePortalStaticAsset,
    tryServeStaticScumIcon,
    getAuthLoginHtml,
    renderPlayerLoginPage,
    getPlayerHtml,
    getLegacyPlayerHtml,
    getLandingHtml,
    getPricingHtml,
    getSignupHtml,
    getForgotPasswordHtml,
    getVerifyEmailHtml,
    getCheckoutHtml,
    getPaymentResultHtml,
    getPreviewHtml,
    getTrialHtml,
    getShowcaseHtml,
    tryServePublicDoc,
  };
}

module.exports = {
  createPortalPageAssetRuntime,
};
