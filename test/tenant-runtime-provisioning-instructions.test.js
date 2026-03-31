const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('tenant runtime provisioning instructions point to the real runtime entrypoints', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /apps\\\\server-bot\\\\server\.js/);
  assert.match(source, /apps\\\\agent\\\\server\.js/);
  assert.doesNotMatch(source, /apps\\\\watcher\\\\server\.js/);
});

test('tenant runtime provisioning instructions include display-name env wiring', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /SCUM_SERVER_BOT_NAME/);
  assert.match(source, /SCUM_CONSOLE_AGENT_NAME/);
  assert.match(source, /PLATFORM_AGENT_DISPLAY_NAME/);
  assert.match(source, /PLATFORM_AGENT_SETUP_TOKEN/);
});

test('tenant runtime provisioning instructions generate downloadable installer files', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /downloadClientFile/);
  assert.match(source, /requestServerDownload/);
  assert.match(source, /runtime-download\/prepare/);
  assert.match(source, /install-server-bot\.ps1/);
  assert.match(source, /install-delivery-agent\.ps1/);
  assert.match(source, /Download install script \(\.ps1\)/);
  assert.match(source, /Download quick install \(\.cmd\)/);
});
