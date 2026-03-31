const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readDictionary(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.dictionary || {};
}

test('admin extra locales include tenant notice fallback keys in english and thai', () => {
  const en = readDictionary(path.join(__dirname, '..', 'src', 'admin', 'assets', 'locales', 'en', 'admin-ui-extra.json'));
  const th = readDictionary(path.join(__dirname, '..', 'src', 'admin', 'assets', 'locales', 'th', 'admin-ui-extra.json'));

  for (const key of [
    'tenant.notice.previewDetail',
    'tenant.notice.unknownTitle',
    'tenant.notice.unknownDetail',
  ]) {
    assert.equal(typeof en[key], 'string');
    assert.ok(en[key].trim().length > 0);
    assert.equal(typeof th[key], 'string');
    assert.ok(th[key].trim().length > 0);
  }
});
