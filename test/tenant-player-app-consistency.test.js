const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function extractObject(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n  \\};`));
  assert.ok(match, `missing object constant ${name}`);
  return vm.runInNewContext(`({${match[1]}\n})`);
}

function extractArray(source, name) {
  const match = source.match(new RegExp(`const ${name} = [^\\[]*\\[([\\s\\S]*?)\\n  \\];`));
  assert.ok(match, `missing array constant ${name}`);
  return vm.runInNewContext(`[${match[1]}\n]`);
}

function extractPlayerPageKeyMap(source) {
  const match = source.match(/const keyMap = \{([\s\S]*?)\n\s{4}\};/);
  assert.ok(match, 'missing player page keyMap');
  return vm.runInNewContext(`({${match[1]}\n})`);
}

function extractTranslationKeys(source) {
  return [...new Set([...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((match) => match[1]))];
}

function assertI18nHasKeys(i18nSource, keys, label) {
  for (const key of keys) {
    assert.match(i18nSource, new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:`), `${label} missing ${key}`);
  }
}

test('tenant v4 app keeps page metadata maps aligned', () => {
  const source = readFile('src/admin/assets/tenant-v4-app.js');
  const pageTitleKeys = extractObject(source, 'PAGE_TITLE_KEYS');
  const pageFeatureRules = extractObject(source, 'PAGE_FEATURE_RULES');
  const pageSectionKeys = extractObject(source, 'PAGE_SECTION_KEYS');
  const pageAliases = extractObject(source, 'PAGE_ALIASES');
  const pathPageAliases = extractObject(source, 'PATH_PAGE_ALIASES');

  const canonicalPages = Object.keys(pageTitleKeys).sort();
  assert.deepEqual(Object.keys(pageFeatureRules).sort(), canonicalPages);
  assert.deepEqual(Object.keys(pageSectionKeys).sort(), canonicalPages);

  for (const pageKey of Object.values(pageAliases)) {
    assert.ok(canonicalPages.includes(pageKey), `PAGE_ALIASES points to unknown page ${pageKey}`);
  }
  for (const pageKey of Object.values(pathPageAliases)) {
    assert.ok(canonicalPages.includes(pageKey), `PATH_PAGE_ALIASES points to unknown page ${pageKey}`);
  }
});

test('tenant v4 app translation keys exist in admin i18n runtime', () => {
  const appSource = readFile('src/admin/assets/tenant-v4-app.js');
  const i18nSource = readFile('src/admin/assets/admin-i18n.js');
  assertI18nHasKeys(i18nSource, extractTranslationKeys(appSource), 'admin-i18n');
});

test('player v4 app keeps page labels and title key map aligned', () => {
  const source = readFile('apps/web-portal-standalone/public/assets/player-v4-app.js');
  const pageKeys = Array.from(extractArray(source, 'PLAYER_PAGE_KEYS')).sort();
  const pageTitleLabels = Array.from(Object.keys(extractObject(source, 'PAGE_TITLE_LABELS'))).sort();
  const keyMap = Array.from(Object.keys(extractPlayerPageKeyMap(source))).sort();

  assert.deepEqual(pageTitleLabels, pageKeys);
  assert.deepEqual(keyMap, pageKeys);
});

test('player v4 app translation keys exist in portal i18n runtime', () => {
  const appSource = readFile('apps/web-portal-standalone/public/assets/player-v4-app.js');
  const i18nSource = readFile('apps/web-portal-standalone/public/assets/portal-i18n.js');
  assertI18nHasKeys(i18nSource, extractTranslationKeys(appSource), 'portal-i18n');
});

test('player v4 app wires identity support actions from profile controls', () => {
  const appSource = readFile('apps/web-portal-standalone/public/assets/player-v4-app.js');
  assert.match(appSource, /data-player-identity-support/);
  assert.match(appSource, /data-player-support-prefill/);
  assert.match(appSource, /state\.pendingSupportDraft\s*=/);
  assert.match(appSource, /applyPendingSupportDraft\(\)/);
  assert.match(appSource, /navigatePlayerRoute\(buildCanonicalPlayerPath\('support'\)\)/);
  assert.match(appSource, /\/player\/api\/support\/tickets/);
});

test('tenant surfaces use normalized admin player steam routes for identity support', () => {
  const tenantV4Source = readFile('src/admin/assets/tenant-v4-app.js');
  const tenantConsoleSource = readFile('src/admin/assets/tenant-console.js');

  assert.match(tenantV4Source, /\/admin\/api\/player\/steam\/bind/);
  assert.match(tenantV4Source, /\/admin\/api\/player\/steam\/unbind/);
  assert.match(tenantV4Source, /\/admin\/api\/player\/identity\/review/);
  assert.doesNotMatch(tenantV4Source, /\/admin\/api\/link\/set/);
  assert.doesNotMatch(tenantV4Source, /\/admin\/api\/link\/remove/);

  assert.match(tenantConsoleSource, /\/admin\/api\/player\/steam\/bind/);
  assert.match(tenantConsoleSource, /\/admin\/api\/player\/steam\/unbind/);
  assert.doesNotMatch(tenantConsoleSource, /\/admin\/api\/link\/set/);
  assert.doesNotMatch(tenantConsoleSource, /\/admin\/api\/link\/remove/);
  assert.match(tenantConsoleSource, /tenantId,\s*userId,\s*steamId/);
  assert.match(tenantConsoleSource, /const supportIntent = action === 'remove' \? 'unlink' : 'bind';/);
  assert.match(tenantConsoleSource, /const supportOutcome = 'reviewing';/);
  assert.match(tenantConsoleSource, /const supportSource = 'tenant-console';/);
  assert.match(tenantConsoleSource, /supportIntent,\s*supportOutcome,\s*supportReason,\s*supportSource/);
});
