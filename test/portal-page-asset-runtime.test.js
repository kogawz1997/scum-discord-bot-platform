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
