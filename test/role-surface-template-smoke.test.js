const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assertLiveTemplate(relativePath, checks = []) {
  const html = read(relativePath);
  assert.doesNotMatch(html, /data-surface-mode="discord-only"/);
  assert.doesNotMatch(html, /Discord-only deployment/);
  for (const pattern of checks) {
    assert.match(html, pattern);
  }
}

test('admin live templates expose login and V4 shells', () => {
  assertLiveTemplate(path.join('src', 'admin', 'login.html'), [
    /id="loginForm"/,
    /id="usernameInput"/,
    /id="passwordInput"/,
    /admin-login-v4\.js/,
  ]);

  assertLiveTemplate(path.join('src', 'admin', 'owner-console.html'), [
    /id="ownerV4AppRoot"/,
    /id="ownerV4RefreshBtn"/,
    /owner-v4-app\.js/,
    /owner-dashboard-v4\.css/,
    /href="\/owner\/tenants"/,
    /href="\/owner\/runtime"/,
  ]);
  const ownerHtml = read(path.join('src', 'admin', 'owner-console.html'));
  assert.doesNotMatch(ownerHtml, /href="\/tenant"/);
  assert.doesNotMatch(ownerHtml, /player\/login/);

  assertLiveTemplate(path.join('src', 'admin', 'tenant-console.html'), [
    /id="tenantV4AppRoot"/,
    /id="tenantV4RefreshBtn"/,
    /tenant-v4-app\.js/,
    /tenant-analytics-v4\.js/,
    /tenant-dashboard-v4\.css/,
  ]);

  const tenantHtml = read(path.join('src', 'admin', 'tenant-console.html'));
  assert.doesNotMatch(tenantHtml, /tenantOwnerScopeWrap/);
});

test('portal public templates expose public access chooser and marketing routes', () => {
  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'landing.html'), [
    /platform-site-v3\.css/,
    /href="\/signup"/,
    /href="\/pricing"/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'pricing.html'), [
    /BOT_LOG_DELIVERY/,
    /href="\/signup\?package=FULL_OPTION"/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'signup.html'), [
    /id="previewSignupForm"/,
    /id="previewSignupPackageId"/,
    /public-auth-v2\.js/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'login.html'), [
    /id="tenantLoginLink"/,
    /id="playerLoginLink"/,
    /id="publicAccessStatus"/,
    /public-auth-v2\.js/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'forgot-password.html'), [
    /id="publicPasswordResetForm"/,
    /id="publicPasswordResetEmail"/,
    /public-auth-v2\.js/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'preview.html'), [
    /id="previewSidebarNav"/,
    /id="previewUpgradeBtn"/,
    /id="previewLogoutBtn"/,
  ]);
});

test('player live templates expose player login and V4 portal shell', () => {
  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'player-login.html'), [
    /href="\/auth\/discord\/start"/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'player-core.html'), [
    /id="playerV4AppRoot"/,
    /player-v4-app\.js/,
    /player-home-v4\.js/,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'player.html'), [
    /href="\/player"|href="\/player\/login"|พอร์ทัลผู้เล่นรุ่นปัจจุบัน/i,
  ]);

  assertLiveTemplate(path.join('apps', 'web-portal-standalone', 'public', 'dashboard.html'), [
    /href="\/landing"|href="\/login"|href="\/preview"/,
  ]);
});
