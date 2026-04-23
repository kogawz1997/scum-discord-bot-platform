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
  if (normalized === '.json') return 'application/json; charset=utf-8';
  if (normalized === '.svg') return 'image/svg+xml; charset=utf-8';
  if (normalized === '.png') return 'image/png';
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg';
  if (normalized === '.webp') return 'image/webp';
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

function parseSemverLabel(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(value || '').trim());
  if (!match) return null;
  return match.slice(1).map((segment) => Number(segment) || 0);
}

function compareReleaseNamesDesc(left, right) {
  const leftParsed = parseSemverLabel(left);
  const rightParsed = parseSemverLabel(right);
  if (leftParsed && rightParsed) {
    for (let index = 0; index < 3; index += 1) {
      if (rightParsed[index] !== leftParsed[index]) {
        return rightParsed[index] - leftParsed[index];
      }
    }
    return String(right).localeCompare(String(left));
  }
  return String(right).localeCompare(String(left));
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMarkdownSection(markdown, headingPattern) {
  const lines = String(markdown || '').split(/\r?\n/);
  const headingRegex = new RegExp(`^##\\s+${headingPattern}\\s*$`, 'i');
  let startIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (headingRegex.test(lines[index].trim())) {
      startIndex = index + 1;
      break;
    }
  }
  if (startIndex < 0) {
    return '';
  }
  let endIndex = lines.length;
  for (let index = startIndex; index < lines.length; index += 1) {
    if (/^##\s+/i.test(lines[index].trim())) {
      endIndex = index;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join('\n').trim();
}

function extractMarkdownList(section) {
  return String(section || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => stripMarkdown(line.slice(2)))
    .filter(Boolean);
}

function extractReleaseSummary(markdown) {
  const summarySection = extractMarkdownSection(markdown, 'Summary');
  if (!summarySection) return '';
  const paragraph = summarySection
    .split(/\r?\n\r?\n/)
    .map((block) => stripMarkdown(block))
    .find(Boolean);
  return paragraph || '';
}

function extractReleaseHighlights(markdown) {
  const mainChanges = extractMarkdownSection(markdown, '(?:Main Changes|What Changed)');
  const headingHighlights = String(mainChanges || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('### '))
    .map((line) => stripMarkdown(line.slice(4)))
    .filter(Boolean);
  if (headingHighlights.length) {
    return headingHighlights;
  }
  return extractMarkdownList(mainChanges)
    .map((line) => stripMarkdown(line.split(':')[0] || line))
    .filter(Boolean)
    .slice(0, 6);
}

function extractReferenceDate(markdown) {
  const match = /^Reference date:\s*\*\*(.+?)\*\*/im.exec(String(markdown || ''));
  return String(match?.[1] || '').trim() || '';
}

function createPortalPageAssetRuntime(options = {}) {
  const {
    isProduction,
    authLoginHtmlPath,
    playerLoginHtmlPath,
    playerHtmlPath,
    legacyPlayerHtmlPath,
    landingHtmlPath,
    dashboardHtmlPath,
    pricingHtmlPath,
    signupHtmlPath,
    forgotPasswordHtmlPath,
    verifyEmailHtmlPath,
    checkoutHtmlPath,
    paymentResultHtmlPath,
    previewHtmlPath,
    trialHtmlPath,
    showcaseHtmlPath,
    discordOAuthConfigured = false,
    googleOAuthConfigured = false,
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
  let cachedDashboardHtml = null;
  let cachedPricingHtml = null;
  let cachedSignupHtml = null;
  let cachedForgotPasswordHtml = null;
  let cachedVerifyEmailHtml = null;
  let cachedCheckoutHtml = null;
  let cachedPaymentResultHtml = null;
  let cachedPreviewHtml = null;
  let cachedTrialHtml = null;
  let cachedShowcaseHtml = null;
  let cachedReleaseFeedEntries = null;
  let cachedReleaseFeedMtimeMs = 0;
  let cachedAuthLoginHtmlMtimeMs = 0;
  let cachedPlayerLoginHtmlMtimeMs = 0;
  let cachedPlayerHtmlMtimeMs = 0;
  let cachedLegacyPlayerHtmlMtimeMs = 0;
  let cachedLandingHtmlMtimeMs = 0;
  let cachedDashboardHtmlMtimeMs = 0;
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

  function injectNavLinkBeforePattern(source, href, label, pattern) {
    if (!source || source.includes(`href="${href}"`)) {
      return source;
    }
    return source.replace(
      pattern,
      `          <a class="site-nav-link" href="${href}">${label}</a>\n$1`,
    );
  }

  function injectPublicNavLinks(html, page) {
    const source = String(html || '');
    if (!source) {
      return source;
    }

    if (page === 'dashboard') {
      let updated = injectNavLinkBeforePattern(
        source,
        '/status',
        'Status',
        /(\s*<a class="site-nav-link" href="\/player\/login">Player Portal<\/a>)/,
      );
      updated = injectNavLinkBeforePattern(
        updated,
        '/changes',
        'Changes',
        /(\s*<a class="site-nav-link" href="\/player\/login">Player Portal<\/a>)/,
      );
      return updated;
    }

    let updated = injectNavLinkBeforePattern(
      source,
      '/status',
      'Status',
      /(\s*<a class="site-nav-link" href="\/signup"[^>]*>[\s\S]*?<\/a>)/,
    );
    updated = injectNavLinkBeforePattern(
      updated,
      '/changes',
      'Changes',
      /(\s*<a class="site-nav-link" href="\/signup"[^>]*>[\s\S]*?<\/a>)/,
    );
    return updated;
  }

  function getReleaseFeedEntries() {
    const releasesDirPath = path.join(docsDirPath, 'releases');
    const baseMtimeMs = getFileMtimeMs(releasesDirPath);
    const releaseFiles = fs.existsSync(releasesDirPath)
      ? fs.readdirSync(releasesDirPath)
        .filter((name) => /\.md$/i.test(name))
        .filter((name) => /^v.+\.md$/i.test(name))
      : [];
    const latestMtimeMs = releaseFiles.reduce((maxValue, fileName) => {
      const filePath = path.join(releasesDirPath, fileName);
      return Math.max(maxValue, getFileMtimeMs(filePath));
    }, baseMtimeMs);

    if (cachedReleaseFeedEntries && latestMtimeMs <= cachedReleaseFeedMtimeMs) {
      return cachedReleaseFeedEntries;
    }

    cachedReleaseFeedEntries = releaseFiles
      .map((fileName) => {
        const filePath = path.join(releasesDirPath, fileName);
        const markdown = fs.readFileSync(filePath, 'utf8');
        const titleMatch = /^#\s+(.+)$/m.exec(markdown);
        const version = fileName.replace(/\.md$/i, '');
        return {
          id: version,
          version,
          title: stripMarkdown(titleMatch?.[1] || version),
          url: `/docs/releases/${encodeURIComponent(fileName)}`,
          referenceDate: extractReferenceDate(markdown),
          summary: extractReleaseSummary(markdown),
          highlights: extractReleaseHighlights(markdown).slice(0, 6),
          operatorImpact: extractMarkdownList(extractMarkdownSection(markdown, 'Operator Impact')).slice(0, 4),
          knownLimitations: extractMarkdownList(extractMarkdownSection(markdown, '(?:Known Limitations|Known Limits In This Release)')).slice(0, 4),
        };
      })
      .sort((left, right) => compareReleaseNamesDesc(left.version, right.version));
    cachedReleaseFeedMtimeMs = latestMtimeMs;
    return cachedReleaseFeedEntries;
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
    const assetPrefix = '/player/assets/';
    if (!String(pathname || '').startsWith(assetPrefix)) return false;

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
      relativeName = decodeURIComponent(String(pathname || '').slice(assetPrefix.length));
    } catch {
      return false;
    }
    if (!relativeName || relativeName.includes('..')) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    const ext = path.extname(relativeName).toLowerCase();
    if (!new Set(['.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp']).has(ext)) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    const candidatePaths = [
      path.resolve(resolvedPublicAssetsDirPath, relativeName),
    ];
    if (relativeName.startsWith('ui/')) {
      candidatePaths.push(
        path.resolve(resolvedPublicAssetsDirPath, relativeName.slice('ui/'.length)),
      );
    } else {
      candidatePaths.push(
        path.resolve(resolvedPublicAssetsDirPath, 'ui', relativeName),
      );
    }
    const uniqueCandidatePaths = candidatePaths.filter((candidate, index, rows) => rows.indexOf(candidate) === index);

    const absPath = uniqueCandidatePaths.find((candidate) => candidate.startsWith(resolvedPublicAssetsDirPath));
    if (!absPath) {
      sendJson(res, 404, { ok: false, error: 'Not found' });
      return true;
    }

    try {
      let existingPath = null;
      for (const candidate of uniqueCandidatePaths) {
        if (!candidate.startsWith(resolvedPublicAssetsDirPath)) continue;
        const stat = await fs.promises.stat(candidate).catch(() => null);
        if (stat?.isFile()) {
          existingPath = candidate;
          break;
        }
      }
      if (!existingPath) {
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
      await pipeline(fs.createReadStream(existingPath), res);
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
      cachedLandingHtml = injectPublicNavLinks(loadHtmlTemplate(landingHtmlPath), 'landing');
      cachedLandingHtmlMtimeMs = mtimeMs;
    }
    return cachedLandingHtml;
  }

  function getDashboardHtml() {
    const mtimeMs = getFileMtimeMs(dashboardHtmlPath);
    if (!cachedDashboardHtml || !isProduction || mtimeMs > cachedDashboardHtmlMtimeMs) {
      cachedDashboardHtml = injectPublicNavLinks(loadHtmlTemplate(dashboardHtmlPath), 'dashboard');
      cachedDashboardHtmlMtimeMs = mtimeMs;
    }
    return cachedDashboardHtml;
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
      cachedAuthLoginHtml = injectPublicNavLinks(loadHtmlTemplate(authLoginHtmlPath), 'login');
      cachedAuthLoginHtmlMtimeMs = mtimeMs;
    }
    return cachedAuthLoginHtml;
  }

  function buildPlayerAuthProviderModel() {
    const providers = [];
    if (discordOAuthConfigured) {
      providers.push({
        key: 'discord',
        label: 'Discord',
        buttonTone: 'site-button-primary',
        href: '/auth/discord/start',
        title: 'Discord เป็นทางเข้าหลัก',
        detail: 'ถ้าบัญชี Discord ของคุณอยู่ในชุมชนของเซิร์ฟเวอร์แล้ว มักเข้าใช้งานได้เร็วที่สุดจากทางนี้',
      });
    }
    if (googleOAuthConfigured) {
      providers.push({
        key: 'google',
        label: 'Google',
        buttonTone: '',
        href: '/auth/google/start',
        title: 'Google ใช้เป็นทางเข้าที่สะดวกสำหรับบัญชีเว็บ',
        detail: 'ระบบจะตรวจสอบอีเมลที่ยืนยันแล้วและจับคู่กับ player identity ที่ผูกไว้ก่อนสร้าง session',
      });
    }
    return {
      providers,
      providerNames: providers.map((provider) => provider.label),
    };
  }

  function buildPlayerAuthProviderLabelList(labels = []) {
    const safeLabels = labels.filter(Boolean);
    if (!safeLabels.length) {
      return 'เมจิกลิงก์ทางอีเมล';
    }
    if (safeLabels.length === 1) {
      return safeLabels[0];
    }
    if (safeLabels.length === 2) {
      return `${safeLabels[0]} หรือ ${safeLabels[1]}`;
    }
    return `${safeLabels.slice(0, -1).join(', ')} หรือ ${safeLabels[safeLabels.length - 1]}`;
  }

  function buildPlayerOauthButtonsHtml(model = buildPlayerAuthProviderModel()) {
    const buttons = [];
    for (const provider of model.providers) {
      const toneClass = provider.buttonTone ? ` ${provider.buttonTone}` : '';
      buttons.push(`<a class="site-button${toneClass}" href="${provider.href}">เข้าสู่ระบบด้วย ${provider.label}</a>`);
    }
    if (!buttons.length) {
      buttons.push('<span class="form-status">OAuth sign-in is not configured on this portal.</span>');
    }
    return buttons.join('');
  }

  function buildPlayerAuthBrandDetail(model = buildPlayerAuthProviderModel()) {
    const providerText = buildPlayerAuthProviderLabelList(model.providerNames);
    return `ใช้ ${providerText} หรือเมจิกลิงก์ทางอีเมลเพื่อเข้าโปรไฟล์ผู้เล่น คำสั่งซื้อ การส่งของ และกิจกรรมของคุณ`;
  }

  function buildPlayerAuthProviderCopy(model = buildPlayerAuthProviderModel()) {
    const providerText = buildPlayerAuthProviderLabelList(model.providerNames);
    return `ใช้ ${providerText} หรือเมจิกลิงก์ทางอีเมลเพื่อเข้าโปรไฟล์ผู้เล่น คำสั่งซื้อ การส่งของ กิจกรรม และการสนับสนุนเซิร์ฟเวอร์ โดยไม่ต้องแยกบัญชีอีกชุด`;
  }

  function buildPlayerAuthNotesHtml(model = buildPlayerAuthProviderModel()) {
    const noteCards = model.providers.map((provider) => [
      '<div class="player-auth-note">',
      `<strong>${provider.title}</strong>`,
      `<p>${provider.detail}</p>`,
      '</div>',
    ].join(''));

    noteCards.push([
      '<div class="player-auth-note">',
      '<strong>เมจิกลิงก์ใช้กับบัญชีที่ผูกไว้แล้ว</strong>',
      '<p>ระบบจะส่งลิงก์เข้าใช้งานให้อีเมลที่เชื่อมกับบัญชีผู้เล่น ไม่ต้องตั้งรหัสผ่านใหม่</p>',
      '</div>',
    ].join(''));

    noteCards.push([
      '<div class="player-auth-note">',
      '<strong>งานดูแลเซิร์ฟเวอร์ไม่อยู่ในพอร์ทัลนี้</strong>',
      '<p>หน้าผู้เล่นจะโฟกัสที่โปรไฟล์ สถิติ ร้านค้า คำสั่งซื้อ การส่งของ และกิจกรรมเท่านั้น</p>',
      '</div>',
    ].join(''));

    return noteCards.join('');
  }

  function localizePlayerLoginError(message) {
    const normalized = String(message || '').trim();
    const mapping = {
      'Discord authorization denied': 'ยกเลิกการอนุญาต Discord แล้ว',
      'Discord login failed': 'เข้าสู่ระบบด้วย Discord ไม่สำเร็จ',
      'Google authorization denied': 'ยกเลิกการอนุญาต Google แล้ว',
      'Google login failed': 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
      'Google account must have a verified email': 'บัญชี Google นี้ยังไม่มีอีเมลที่ยืนยันแล้ว',
      'Google login requires a linked player identity': 'บัญชี Google นี้ยังไม่เชื่อมกับ player identity ในระบบ',
      'Google account must be linked to a Discord player identity': 'บัญชี Google นี้ยังไม่เชื่อมกับบัญชีผู้เล่นที่มี Discord identity',
      'Invalid OAuth state': 'สถานะการเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง',
      'Missing OAuth code': 'ไม่ได้รับรหัสยืนยันจากผู้ให้บริการเข้าสู่ระบบ',
    };
    return mapping[normalized] || normalized;
  }

  function renderPlayerLoginPage(message) {
    const mtimeMs = getFileMtimeMs(playerLoginHtmlPath);
    if (!cachedPlayerLoginHtml || !isProduction || mtimeMs > cachedPlayerLoginHtmlMtimeMs) {
      cachedPlayerLoginHtml = loadHtmlTemplate(playerLoginHtmlPath);
      cachedPlayerLoginHtmlMtimeMs = mtimeMs;
    }
    const model = buildPlayerAuthProviderModel();
    const safe = escapeHtml(localizePlayerLoginError(String(message || '')));
    return cachedPlayerLoginHtml
      .replace('__PLAYER_AUTH_BRAND_DETAIL__', escapeHtml(buildPlayerAuthBrandDetail(model)))
      .replace('__PLAYER_AUTH_PROVIDER_COPY__', escapeHtml(buildPlayerAuthProviderCopy(model)))
      .replace('__PLAYER_OAUTH_BUTTONS__', buildPlayerOauthButtonsHtml(model))
      .replace('__PLAYER_AUTH_NOTES__', buildPlayerAuthNotesHtml(model))
      .replace('__ERROR_MESSAGE__', safe);
  }

  function getPricingHtml() {
    const mtimeMs = getFileMtimeMs(pricingHtmlPath);
    if (!cachedPricingHtml || !isProduction || mtimeMs > cachedPricingHtmlMtimeMs) {
      cachedPricingHtml = injectPublicNavLinks(loadHtmlTemplate(pricingHtmlPath), 'pricing');
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
    getDashboardHtml,
    getPricingHtml,
    getSignupHtml,
    getForgotPasswordHtml,
    getVerifyEmailHtml,
    getCheckoutHtml,
    getPaymentResultHtml,
    getPreviewHtml,
    getTrialHtml,
    getShowcaseHtml,
    getReleaseFeedEntries,
    tryServePublicDoc,
  };
}

module.exports = {
  createPortalPageAssetRuntime,
};
