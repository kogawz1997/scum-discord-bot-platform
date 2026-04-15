const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLACEHOLDER_PAGES = [
  '20-owner-create-tenant.html',
  '21-owner-tenant-dossier.html',
  '22-owner-support-context.html',
  '23-owner-access-posture.html',
  '24-owner-diagnostics-and-evidence.html',
  '25-owner-platform-controls.html',
  '26-owner-automation-and-notifications.html',
];

test('owner placeholder pages do not expose internal stitch or overlay wording', () => {
  for (const fileName of PLACEHOLDER_PAGES) {
    const html = fs.readFileSync(path.join('C:\\new\\stitch\\owner-pages', fileName), 'utf8');
    assert.doesNotMatch(html, /stitch/i, `${fileName} should not mention Stitch`);
    assert.doesNotMatch(html, /\boverlay\b/i, `${fileName} should not mention overlay`);
  }
});
