const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readPlayerAppSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', 'apps', 'web-portal-standalone', 'public', 'assets', 'player-v4-app.js'),
    'utf8',
  );
}

test('player v4 app wires email verification and support appeal actions through the shared player mutation flow', () => {
  const source = readPlayerAppSource();

  assert.match(source, /data-player-email-verification-request/);
  assert.match(source, /\/player\/api\/profile\/email-verification\/request/);
  assert.match(source, /data-player-support-appeal-form/);
  assert.match(source, /Submitting appeal\.\.\./);
  assert.match(source, /navigateTo:\s*'profile'/);
});
