const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.join(__dirname, '..');
const corruptionSentinels = new RegExp([
  String.fromCharCode(0x00C3),
  String.fromCharCode(0x00E0, 0x00B8),
  String.fromCharCode(0x00C2, 0x00B7),
].join('|'));
const filePattern = /\.(js|html|json|css)$/i;

function collectUiFiles(rootDir) {
  const absoluteRoot = path.join(workspaceRoot, rootDir);
  const results = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (filePattern.test(entry.name)) {
        results.push(path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/'));
      }
    }
  }
  return results.sort();
}

[
  ...collectUiFiles('src/admin/assets'),
  ...collectUiFiles('apps/web-portal-standalone/public/assets'),
  ...collectUiFiles('apps/web-portal-standalone/runtime'),
].forEach((relativePath) => {
  test(`utf-8 guard: ${relativePath} does not contain mojibake sentinels`, () => {
    const content = fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');
    const sanitizedContent = content.replace(
      /const MOJIBAKE_MARKERS = \[[\s\S]*?\];/g,
      'const MOJIBAKE_MARKERS = [];',
    );
    assert.doesNotMatch(sanitizedContent, corruptionSentinels);
  });
});
