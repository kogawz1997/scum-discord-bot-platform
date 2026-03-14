const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  tokenizeCommandTemplate,
  executeCommandTemplate,
  validateCommandTemplate,
} = require('../src/utils/commandTemplate');

test('tokenizeCommandTemplate keeps quoted args together', () => {
  const parsed = tokenizeCommandTemplate(
    'powershell -NoProfile -File "scripts/send-scum-admin-command.ps1" -Command "{command}"',
  );

  assert.equal(parsed.executable, 'powershell');
  assert.deepEqual(parsed.args, [
    '-NoProfile',
    '-File',
    'scripts/send-scum-admin-command.ps1',
    '-Command',
    '{command}',
  ]);
});

test('validateCommandTemplate rejects shell operators', () => {
  assert.throws(
    () => validateCommandTemplate('echo {command} > out.txt'),
    /unsupported shell operator/i,
  );
});

test('executeCommandTemplate passes command placeholder as a single safe argument', async () => {
  const tempFile = path.join(
    os.tmpdir(),
    `command-template-${Date.now()}-${Math.floor(Math.random() * 1000)}.txt`,
  );

  try {
    const result = await executeCommandTemplate(
      `node "${path.join(process.cwd(), 'scripts', 'agent-echo.js')}" "{command}"`,
      {
        command: `#Announce SAFE & echo PWNED > "${tempFile}"`,
      },
      {
        timeoutMs: 5000,
      },
    );

    assert.match(result.stdout, /AGENT-ECHO:#Announce SAFE & echo PWNED >/);
    assert.equal(fs.existsSync(tempFile), false);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
});
