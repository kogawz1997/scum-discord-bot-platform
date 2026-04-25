const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('owner login template uses the dedicated owner shell and clean copy', () => {
  const html = fs.readFileSync('C:\\new\\src\\admin\\owner-login.html', 'utf8');

  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="usernameInput"/);
  assert.match(html, /id="passwordInput"/);
  assert.match(html, /id="otpWrap" class="field-group" hidden/);
  assert.match(html, /id="otpInput"/);
  assert.match(html, /id="errorBox"/);
  assert.match(html, /id="loginSubmit"/);
  assert.match(html, /id="ownerLoginLanguage"/);
  assert.match(html, /owner-stitch-shared\.css/);
  assert.match(html, /admin-i18n\.js/);
  assert.match(html, /admin-login-v4\.js/);
  assert.match(html, /data-i18n="owner\.login\.heroTitle"/);
  assert.match(html, /data-i18n="owner\.login\.heroDetail"/);
  assert.match(html, /data-i18n="owner\.login\.formTitle"/);
  assert.match(html, /data-i18n="owner\.login\.formDetail"/);
  assert.match(html, /class="hero-visual-frame"/);
  assert.match(html, /class="hero-signals"/);
  assert.match(html, /class="panel-footer"/);
  assert.doesNotMatch(html, /Ãƒ|Ã‚|\ufffd/);
});
