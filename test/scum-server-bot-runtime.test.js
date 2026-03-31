const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { patchIniContent } = require('../src/services/serverBotIniService');
const {
  createServerConfigSnapshot,
  verifyConfigFileUpdate,
  verifyCopiedFileContent,
} = require('../src/services/scumServerBotRuntime');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scum-server-bot-runtime-'));
}

test('verifyConfigFileUpdate accepts ini files when changed keys were written correctly', () => {
  const tempDir = createTempDir();
  const filePath = path.join(tempDir, 'ServerSettings.ini');
  const original = [
    '[General]',
    'ServerName=Old Name',
    'MaxPlayers=64',
    '',
  ].join('\n');
  const changes = [
    { file: 'ServerSettings.ini', section: 'General', key: 'ServerName', value: 'New Name' },
    { file: 'ServerSettings.ini', section: 'General', key: 'MaxPlayers', value: 80 },
  ];

  const patched = patchIniContent(original, changes);
  fs.writeFileSync(filePath, patched.content, 'utf8');

  assert.doesNotThrow(() => {
    verifyConfigFileUpdate(filePath, { parseMode: 'ini' }, changes);
  });
});

test('verifyConfigFileUpdate rejects ini files when written values do not match requested changes', () => {
  const tempDir = createTempDir();
  const filePath = path.join(tempDir, 'ServerSettings.ini');
  fs.writeFileSync(filePath, '[General]\nServerName=Wrong Name\n', 'utf8');

  assert.throws(() => {
    verifyConfigFileUpdate(filePath, { parseMode: 'ini' }, [
      { file: 'ServerSettings.ini', section: 'General', key: 'ServerName', value: 'Expected Name' },
    ]);
  }, /config-verification-failed/);
});

test('verifyConfigFileUpdate accepts line-list files when entries match after write', () => {
  const tempDir = createTempDir();
  const filePath = path.join(tempDir, 'AdminUsers.ini');
  fs.writeFileSync(filePath, '76561198000000000\n76561198000000001\n', 'utf8');

  assert.doesNotThrow(() => {
    verifyConfigFileUpdate(filePath, { parseMode: 'line-list' }, [
      {
        file: 'AdminUsers.ini',
        section: '',
        key: 'entries',
        value: ['76561198000000000', '76561198000000001'],
      },
    ]);
  });
});

test('createServerConfigSnapshot includes discovered ini keys beyond the curated schema', () => {
  const tempDir = createTempDir();
  fs.writeFileSync(path.join(tempDir, 'ServerSettings.ini'), [
    '[General]',
    'ServerName=Live Server',
    'ExtraWelcomeRule=Enabled',
    '',
    '[Loot]',
    'LootRespawnMultiplier=1.5',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(tempDir, 'AdminUsers.ini'), '', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'BannedUsers.ini'), '', 'utf8');

  const snapshot = createServerConfigSnapshot(tempDir);
  const serverSettings = snapshot.files.find((entry) => entry.file === 'ServerSettings.ini');
  const discovered = serverSettings.settings.find((entry) => entry.section === 'Loot' && entry.key === 'LootRespawnMultiplier');
  const extraGeneral = serverSettings.settings.find((entry) => entry.section === 'General' && entry.key === 'ExtraWelcomeRule');

  assert.ok(discovered);
  assert.equal(discovered.type, 'number');
  assert.equal(discovered.visibility, 'advanced');
  assert.ok(extraGeneral);
  assert.equal(extraGeneral.type, 'boolean');
});

test('verifyCopiedFileContent rejects rollback copies when target does not match backup', () => {
  const tempDir = createTempDir();
  const sourcePath = path.join(tempDir, 'source.bak');
  const targetPath = path.join(tempDir, 'target.ini');
  fs.writeFileSync(sourcePath, 'ServerName=Backup\n', 'utf8');
  fs.writeFileSync(targetPath, 'ServerName=Different\n', 'utf8');

  assert.throws(() => {
    verifyCopiedFileContent(sourcePath, targetPath);
  }, /rollback-verification-failed/);
});
