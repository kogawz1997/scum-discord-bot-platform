const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');

const {
  createPortalPageAssetRuntime,
} = require('../apps/web-portal-standalone/runtime/portalPageAssetRuntime');

function createResponse() {
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 200;
  res.headers = {};
  res.body = '';
  res.writeHead = (statusCode, headers) => {
    res.statusCode = statusCode;
    res.headers = headers;
  };
  const originalEnd = res.end.bind(res);
  res.end = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), encoding || 'utf8'));
    }
    res.body = Buffer.concat(chunks).toString('utf8');
    return originalEnd(callback);
  };
  return res;
}

test('portal page asset runtime renders login template and public docs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-page-assets-'));
  const docsDir = path.join(root, 'docs');
  const assetsDir = path.join(root, 'assets');
  const scumItemsDirPath = path.join(root, 'items');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDirPath, { recursive: true });

  const authLoginHtmlPath = path.join(root, 'auth-login.html');
  const playerLoginHtmlPath = path.join(root, 'player-login.html');
  const playerHtmlPath = path.join(root, 'player.html');
  const legacyPlayerHtmlPath = path.join(root, 'player-legacy.html');
  const landingHtmlPath = path.join(root, 'landing.html');
  const dashboardHtmlPath = path.join(root, 'dashboard.html');
  const pricingHtmlPath = path.join(root, 'pricing.html');
  const signupHtmlPath = path.join(root, 'signup.html');
  const forgotPasswordHtmlPath = path.join(root, 'forgot.html');
  const verifyEmailHtmlPath = path.join(root, 'verify.html');
  const checkoutHtmlPath = path.join(root, 'checkout.html');
  const paymentResultHtmlPath = path.join(root, 'payment-result.html');
  const previewHtmlPath = path.join(root, 'preview.html');
  const trialHtmlPath = path.join(root, 'trial.html');
  const showcaseHtmlPath = path.join(root, 'showcase.html');
  fs.writeFileSync(authLoginHtmlPath, '<div>auth-login</div>');
  fs.writeFileSync(playerLoginHtmlPath, '<div>__ERROR_MESSAGE__</div>');
  fs.writeFileSync(playerHtmlPath, '<div>player</div>');
  fs.writeFileSync(legacyPlayerHtmlPath, '<div>legacy-player</div>');
  fs.writeFileSync(landingHtmlPath, '<div>landing</div>');
  fs.writeFileSync(dashboardHtmlPath, '<div>dashboard</div>');
  fs.writeFileSync(pricingHtmlPath, '<div>pricing</div>');
  fs.writeFileSync(signupHtmlPath, '<div>signup</div>');
  fs.writeFileSync(forgotPasswordHtmlPath, '<div>forgot</div>');
  fs.writeFileSync(verifyEmailHtmlPath, '<div>verify</div>');
  fs.writeFileSync(checkoutHtmlPath, '<div>checkout</div>');
  fs.writeFileSync(paymentResultHtmlPath, '<div>payment-result</div>');
  fs.writeFileSync(previewHtmlPath, '<div>preview</div>');
  fs.writeFileSync(trialHtmlPath, '<div>trial</div>');
  fs.writeFileSync(showcaseHtmlPath, '<div>showcase</div>');
  fs.writeFileSync(path.join(assetsDir, 'portal.css'), 'body{color:steelblue}');
  fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');

  const runtime = createPortalPageAssetRuntime({
    isProduction: false,
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
    discordOAuthConfigured: true,
    googleOAuthConfigured: false,
    publicAssetsDirPath: assetsDir,
    docsDirPath: docsDir,
    scumItemsDirPath,
    faviconSvg: '<svg></svg>',
    sendJson() {
      throw new Error('sendJson should not be called in this test');
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    buildSecurityHeaders: (headers) => headers,
    escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    },
  });

  assert.equal(
    runtime.renderPlayerLoginPage('<script>alert(1)</script>'),
    '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>',
  );
  assert.equal(runtime.getAuthLoginHtml(), '<div>auth-login</div>');
  assert.equal(runtime.getPlayerHtml(), '<div>player</div>');
  assert.equal(runtime.getLegacyPlayerHtml(), '<div>legacy-player</div>');
  assert.equal(runtime.getLandingHtml(), '<div>landing</div>');
  assert.equal(runtime.getDashboardHtml(), '<div>dashboard</div>');
  assert.equal(runtime.getPricingHtml(), '<div>pricing</div>');
  assert.equal(runtime.getSignupHtml(), '<div>signup</div>');
  assert.equal(runtime.getForgotPasswordHtml(), '<div>forgot</div>');
  assert.equal(runtime.getVerifyEmailHtml(), '<div>verify</div>');
  assert.equal(runtime.getCheckoutHtml(), '<div>checkout</div>');
  assert.equal(runtime.getPaymentResultHtml(), '<div>payment-result</div>');
  assert.equal(runtime.getPreviewHtml(), '<div>preview</div>');
  assert.equal(runtime.getTrialHtml(), '<div>trial</div>');
  assert.equal(runtime.getShowcaseHtml(), '<div>showcase</div>');

  const assetRes = createResponse();
  return runtime.tryServePortalStaticAsset(
    { method: 'GET' },
    assetRes,
    '/player/assets/ui/portal.css',
  ).then((served) => {
    assert.equal(served, true);
    assert.equal(assetRes.statusCode, 200);
    assert.match(String(assetRes.headers['Content-Type'] || ''), /text\/css/i);
    assert.equal(assetRes.body, 'body{color:steelblue}');

    const res = createResponse();
    const docServed = runtime.tryServePublicDoc('/docs/guide.md', res);
    assert.equal(docServed, true);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /Guide/);
  });
});

test('portal page asset runtime injects public status and change links into public navigation templates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-page-status-nav-'));
  const docsDir = path.join(root, 'docs');
  const assetsDir = path.join(root, 'assets');
  const scumItemsDirPath = path.join(root, 'items');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDirPath, { recursive: true });

  const authLoginHtmlPath = path.join(root, 'auth-login.html');
  const playerLoginHtmlPath = path.join(root, 'player-login.html');
  const playerHtmlPath = path.join(root, 'player.html');
  const legacyPlayerHtmlPath = path.join(root, 'player-legacy.html');
  const landingHtmlPath = path.join(root, 'landing.html');
  const dashboardHtmlPath = path.join(root, 'dashboard.html');
  const pricingHtmlPath = path.join(root, 'pricing.html');
  const signupHtmlPath = path.join(root, 'signup.html');
  const forgotPasswordHtmlPath = path.join(root, 'forgot.html');
  const verifyEmailHtmlPath = path.join(root, 'verify.html');
  const checkoutHtmlPath = path.join(root, 'checkout.html');
  const paymentResultHtmlPath = path.join(root, 'payment-result.html');
  const previewHtmlPath = path.join(root, 'preview.html');
  const trialHtmlPath = path.join(root, 'trial.html');
  const showcaseHtmlPath = path.join(root, 'showcase.html');

  fs.writeFileSync(authLoginHtmlPath, [
    '<nav class="site-nav">',
    '  <a class="site-nav-link" href="/landing">Overview</a>',
    '  <a class="site-nav-link" href="/pricing">Packages</a>',
    '  <a class="site-nav-link" href="/signup">Create account</a>',
    '</nav>',
  ].join('\n'));
  fs.writeFileSync(playerLoginHtmlPath, '<div>__ERROR_MESSAGE__</div>');
  fs.writeFileSync(playerHtmlPath, '<div>player</div>');
  fs.writeFileSync(legacyPlayerHtmlPath, '<div>legacy-player</div>');
  fs.writeFileSync(landingHtmlPath, [
    '<nav class="site-nav">',
    '  <a class="site-nav-link is-active" href="/landing">ภาพรวม</a>',
    '  <a class="site-nav-link" href="/pricing">แพ็กเกจ</a>',
    '  <a class="site-nav-link" href="/signup">สร้างบัญชี</a>',
    '</nav>',
  ].join('\n'));
  fs.writeFileSync(dashboardHtmlPath, [
    '<nav class="site-nav">',
    '  <a class="site-nav-link is-active" href="/dashboard">ทางเข้า</a>',
    '  <a class="site-nav-link" href="/landing">Public Site</a>',
    '  <a class="site-nav-link" href="/player/login">Player Portal</a>',
    '</nav>',
  ].join('\n'));
  fs.writeFileSync(pricingHtmlPath, [
    '<nav class="site-nav">',
    '  <a class="site-nav-link" href="/landing">ภาพรวม</a>',
    '  <a class="site-nav-link is-active" href="/pricing">แพ็กเกจ</a>',
    '  <a class="site-nav-link" href="/signup">สร้างบัญชี</a>',
    '</nav>',
  ].join('\n'));
  fs.writeFileSync(signupHtmlPath, '<div>signup</div>');
  fs.writeFileSync(forgotPasswordHtmlPath, '<div>forgot</div>');
  fs.writeFileSync(verifyEmailHtmlPath, '<div>verify</div>');
  fs.writeFileSync(checkoutHtmlPath, '<div>checkout</div>');
  fs.writeFileSync(paymentResultHtmlPath, '<div>payment-result</div>');
  fs.writeFileSync(previewHtmlPath, '<div>preview</div>');
  fs.writeFileSync(trialHtmlPath, '<div>trial</div>');
  fs.writeFileSync(showcaseHtmlPath, '<div>showcase</div>');

  const runtime = createPortalPageAssetRuntime({
    isProduction: false,
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
    publicAssetsDirPath: assetsDir,
    docsDirPath: docsDir,
    scumItemsDirPath,
    faviconSvg: '<svg></svg>',
    sendJson() {
      throw new Error('sendJson should not be called in this test');
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    buildSecurityHeaders: (headers) => headers,
    escapeHtml(value) {
      return String(value || '');
    },
  });

  assert.match(runtime.getLandingHtml(), /href="\/status"/);
  assert.match(runtime.getLandingHtml(), /href="\/changes"/);
  assert.match(runtime.getDashboardHtml(), /href="\/status"/);
  assert.match(runtime.getDashboardHtml(), /href="\/changes"/);
  assert.match(runtime.getPricingHtml(), /href="\/status"/);
  assert.match(runtime.getPricingHtml(), /href="\/changes"/);
  assert.match(runtime.getAuthLoginHtml(), /href="\/status"/);
  assert.match(runtime.getAuthLoginHtml(), /href="\/changes"/);
});

test('portal page asset runtime renders configured oauth buttons on player login page', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-page-player-login-'));
  const docsDir = path.join(root, 'docs');
  const assetsDir = path.join(root, 'assets');
  const scumItemsDirPath = path.join(root, 'items');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDirPath, { recursive: true });

  const authLoginHtmlPath = path.join(root, 'auth-login.html');
  const playerLoginHtmlPath = path.join(root, 'player-login.html');
  const playerHtmlPath = path.join(root, 'player.html');
  const legacyPlayerHtmlPath = path.join(root, 'player-legacy.html');
  const landingHtmlPath = path.join(root, 'landing.html');
  const dashboardHtmlPath = path.join(root, 'dashboard.html');
  const pricingHtmlPath = path.join(root, 'pricing.html');
  const signupHtmlPath = path.join(root, 'signup.html');
  const forgotPasswordHtmlPath = path.join(root, 'forgot.html');
  const verifyEmailHtmlPath = path.join(root, 'verify.html');
  const checkoutHtmlPath = path.join(root, 'checkout.html');
  const paymentResultHtmlPath = path.join(root, 'payment-result.html');
  const previewHtmlPath = path.join(root, 'preview.html');
  const trialHtmlPath = path.join(root, 'trial.html');
  const showcaseHtmlPath = path.join(root, 'showcase.html');
  fs.writeFileSync(authLoginHtmlPath, '<div>auth-login</div>');
  fs.writeFileSync(
    playerLoginHtmlPath,
    '<div>__PLAYER_AUTH_BRAND_DETAIL__</div><div>__PLAYER_AUTH_PROVIDER_COPY__</div><div class="site-tool-cluster">__PLAYER_OAUTH_BUTTONS__</div><div class="player-auth-note-grid">__PLAYER_AUTH_NOTES__</div><div>__ERROR_MESSAGE__</div>',
  );
  fs.writeFileSync(playerHtmlPath, '<div>player</div>');
  fs.writeFileSync(legacyPlayerHtmlPath, '<div>legacy-player</div>');
  fs.writeFileSync(landingHtmlPath, '<div>landing</div>');
  fs.writeFileSync(dashboardHtmlPath, '<div>dashboard</div>');
  fs.writeFileSync(pricingHtmlPath, '<div>pricing</div>');
  fs.writeFileSync(signupHtmlPath, '<div>signup</div>');
  fs.writeFileSync(forgotPasswordHtmlPath, '<div>forgot</div>');
  fs.writeFileSync(verifyEmailHtmlPath, '<div>verify</div>');
  fs.writeFileSync(checkoutHtmlPath, '<div>checkout</div>');
  fs.writeFileSync(paymentResultHtmlPath, '<div>payment-result</div>');
  fs.writeFileSync(previewHtmlPath, '<div>preview</div>');
  fs.writeFileSync(trialHtmlPath, '<div>trial</div>');
  fs.writeFileSync(showcaseHtmlPath, '<div>showcase</div>');

  const runtime = createPortalPageAssetRuntime({
    isProduction: false,
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
    discordOAuthConfigured: true,
    googleOAuthConfigured: true,
    publicAssetsDirPath: assetsDir,
    docsDirPath: docsDir,
    scumItemsDirPath,
    faviconSvg: '<svg></svg>',
    sendJson() {
      throw new Error('sendJson should not be called in this test');
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    buildSecurityHeaders: (headers) => headers,
    escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    },
  });

  const html = runtime.renderPlayerLoginPage('denied');
  assert.match(html, /href="\/auth\/discord\/start"/);
  assert.match(html, /href="\/auth\/google\/start"/);
  assert.match(html, /ใช้ Discord หรือ Google หรือเมจิกลิงก์ทางอีเมล/i);
  assert.match(html, /Google ใช้เป็นทางเข้าที่สะดวกสำหรับบัญชีเว็บ/i);
  assert.match(html, /denied/);
});

test('portal page asset runtime localizes oauth callback errors on player login page', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-page-player-login-errors-'));
  const docsDir = path.join(root, 'docs');
  const assetsDir = path.join(root, 'assets');
  const scumItemsDirPath = path.join(root, 'items');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDirPath, { recursive: true });

  const authLoginHtmlPath = path.join(root, 'auth-login.html');
  const playerLoginHtmlPath = path.join(root, 'player-login.html');
  const playerHtmlPath = path.join(root, 'player.html');
  const legacyPlayerHtmlPath = path.join(root, 'player-legacy.html');
  const landingHtmlPath = path.join(root, 'landing.html');
  const dashboardHtmlPath = path.join(root, 'dashboard.html');
  const pricingHtmlPath = path.join(root, 'pricing.html');
  const signupHtmlPath = path.join(root, 'signup.html');
  const forgotPasswordHtmlPath = path.join(root, 'forgot.html');
  const verifyEmailHtmlPath = path.join(root, 'verify.html');
  const checkoutHtmlPath = path.join(root, 'checkout.html');
  const paymentResultHtmlPath = path.join(root, 'payment-result.html');
  const previewHtmlPath = path.join(root, 'preview.html');
  const trialHtmlPath = path.join(root, 'trial.html');
  const showcaseHtmlPath = path.join(root, 'showcase.html');
  fs.writeFileSync(authLoginHtmlPath, '<div>auth-login</div>');
  fs.writeFileSync(playerLoginHtmlPath, '<div>__ERROR_MESSAGE__</div>');
  fs.writeFileSync(playerHtmlPath, '<div>player</div>');
  fs.writeFileSync(legacyPlayerHtmlPath, '<div>legacy-player</div>');
  fs.writeFileSync(landingHtmlPath, '<div>landing</div>');
  fs.writeFileSync(dashboardHtmlPath, '<div>dashboard</div>');
  fs.writeFileSync(pricingHtmlPath, '<div>pricing</div>');
  fs.writeFileSync(signupHtmlPath, '<div>signup</div>');
  fs.writeFileSync(forgotPasswordHtmlPath, '<div>forgot</div>');
  fs.writeFileSync(verifyEmailHtmlPath, '<div>verify</div>');
  fs.writeFileSync(checkoutHtmlPath, '<div>checkout</div>');
  fs.writeFileSync(paymentResultHtmlPath, '<div>payment-result</div>');
  fs.writeFileSync(previewHtmlPath, '<div>preview</div>');
  fs.writeFileSync(trialHtmlPath, '<div>trial</div>');
  fs.writeFileSync(showcaseHtmlPath, '<div>showcase</div>');

  const runtime = createPortalPageAssetRuntime({
    isProduction: false,
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
    discordOAuthConfigured: true,
    googleOAuthConfigured: true,
    publicAssetsDirPath: assetsDir,
    docsDirPath: docsDir,
    scumItemsDirPath,
    faviconSvg: '<svg></svg>',
    sendJson() {
      throw new Error('sendJson should not be called in this test');
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    buildSecurityHeaders: (headers) => headers,
    escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    },
  });

  assert.equal(
    runtime.renderPlayerLoginPage('Google account must be linked to a Discord player identity'),
    '<div>บัญชี Google นี้ยังไม่เชื่อมกับบัญชีผู้เล่นที่มี Discord identity</div>',
  );
});

test('portal page asset runtime builds release feed entries from docs releases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-page-releases-'));
  const docsDir = path.join(root, 'docs');
  const releasesDir = path.join(docsDir, 'releases');
  const assetsDir = path.join(root, 'assets');
  const scumItemsDirPath = path.join(root, 'items');
  fs.mkdirSync(releasesDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(scumItemsDirPath, { recursive: true });

  const authLoginHtmlPath = path.join(root, 'auth-login.html');
  const playerLoginHtmlPath = path.join(root, 'player-login.html');
  const playerHtmlPath = path.join(root, 'player.html');
  const legacyPlayerHtmlPath = path.join(root, 'player-legacy.html');
  const landingHtmlPath = path.join(root, 'landing.html');
  const dashboardHtmlPath = path.join(root, 'dashboard.html');
  const pricingHtmlPath = path.join(root, 'pricing.html');
  const signupHtmlPath = path.join(root, 'signup.html');
  const forgotPasswordHtmlPath = path.join(root, 'forgot.html');
  const verifyEmailHtmlPath = path.join(root, 'verify.html');
  const checkoutHtmlPath = path.join(root, 'checkout.html');
  const paymentResultHtmlPath = path.join(root, 'payment-result.html');
  const previewHtmlPath = path.join(root, 'preview.html');
  const trialHtmlPath = path.join(root, 'trial.html');
  const showcaseHtmlPath = path.join(root, 'showcase.html');

  fs.writeFileSync(authLoginHtmlPath, '<div>auth-login</div>');
  fs.writeFileSync(playerLoginHtmlPath, '<div>__ERROR_MESSAGE__</div>');
  fs.writeFileSync(playerHtmlPath, '<div>player</div>');
  fs.writeFileSync(legacyPlayerHtmlPath, '<div>legacy-player</div>');
  fs.writeFileSync(landingHtmlPath, '<div>landing</div>');
  fs.writeFileSync(dashboardHtmlPath, '<div>dashboard</div>');
  fs.writeFileSync(pricingHtmlPath, '<div>pricing</div>');
  fs.writeFileSync(signupHtmlPath, '<div>signup</div>');
  fs.writeFileSync(forgotPasswordHtmlPath, '<div>forgot</div>');
  fs.writeFileSync(verifyEmailHtmlPath, '<div>verify</div>');
  fs.writeFileSync(checkoutHtmlPath, '<div>checkout</div>');
  fs.writeFileSync(paymentResultHtmlPath, '<div>payment-result</div>');
  fs.writeFileSync(previewHtmlPath, '<div>preview</div>');
  fs.writeFileSync(trialHtmlPath, '<div>trial</div>');
  fs.writeFileSync(showcaseHtmlPath, '<div>showcase</div>');
  fs.writeFileSync(path.join(releasesDir, 'README.md'), '# Release Notes');
  fs.writeFileSync(path.join(releasesDir, 'TEMPLATE.md'), '# Template');
  fs.writeFileSync(path.join(releasesDir, 'v1.0.0.md'), [
    '# Release Notes v1.0.0',
    '',
    'Reference date: **2026-03-15**',
    '',
    '## Summary',
    '',
    'This release established the current split-runtime layout.',
    '',
    '## Main Changes',
    '',
    '### Runtime',
    '',
    '- Separated worker and portal runtimes',
    '',
    '### Operations',
    '',
    '- Added restore preview guardrails',
    '',
    '## Operator Impact',
    '',
    '- Runtime responsibilities are clearer',
    '',
    '## Known Limitations',
    '',
    '- Visual evidence is still limited',
  ].join('\n'));
  fs.writeFileSync(path.join(releasesDir, 'v0.9.0.md'), [
    '# Release Notes v0.9.0',
    '',
    'Reference date: **2026-02-01**',
    '',
    '## Summary',
    '',
    'Earlier operator baseline.',
  ].join('\n'));

  const runtime = createPortalPageAssetRuntime({
    isProduction: false,
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
    publicAssetsDirPath: assetsDir,
    docsDirPath: docsDir,
    scumItemsDirPath,
    faviconSvg: '<svg></svg>',
    sendJson() {
      throw new Error('sendJson should not be called in this test');
    },
    sendHtml(res, statusCode, html) {
      res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    },
    buildSecurityHeaders: (headers) => headers,
    escapeHtml(value) {
      return String(value || '');
    },
  });

  const entries = runtime.getReleaseFeedEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].version, 'v1.0.0');
  assert.equal(entries[0].referenceDate, '2026-03-15');
  assert.match(entries[0].summary, /split-runtime layout/i);
  assert.deepEqual(entries[0].highlights, ['Runtime', 'Operations']);
  assert.match(entries[0].url, /\/docs\/releases\/v1\.0\.0\.md/);
});
