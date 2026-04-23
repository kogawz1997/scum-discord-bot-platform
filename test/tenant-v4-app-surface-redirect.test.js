const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('tenant v4 app redirects missing tenant scope to the correct surface', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /function redirectForMissingTenantScope\(me\)/);
  assert.match(source, /function readTenantScopeFromUrl\(\)/);
  assert.match(source, /function buildCanonicalTenantHref\(pageKey, extraParams = \{\}\)/);
  assert.match(source, /function buildTenantLoginRedirectUrl\(options = \{\}\)/);
  assert.match(source, /params\.set\('switch', '1'\)/);
  assert.match(source, /params\.set\('next', nextUrl\)/);
  assert.match(source, /const nextUrl = buildTenantLoginRedirectUrl\(\{ switch: true \}\)/);
  assert.match(source, /const requestedTenantId = readTenantScopeFromUrl\(\);/);
  assert.match(source, /const scopedTenantId = String\(me\?\.tenantId \|\| \(me \? requestedTenantId : ''\) \|\| ''\)\.trim\(\);/);
  assert.match(source, /if \(!scopedTenantId\) \{\s*redirectForMissingTenantScope\(me\);\s*return;\s*\}/s);
  assert.doesNotMatch(source, /Tenant scope is required for the tenant admin workspace\./);
});

test('tenant v4 app wires analytics as a first-class tenant page', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /analytics:\s*'analytics'/);
  assert.match(source, /analytics:\s*'tenant\.app\.page\.analytics'/);
  assert.match(source, /analytics:\s*\['analytics_module'\]/);
  assert.match(source, /case 'analytics':\s*return '\/tenant\/analytics';/s);
  assert.match(source, /analytics:\s*\(\)\s*=>\s*window\.TenantAnalyticsV4\.renderTenantAnalyticsV4\(target, renderState\)/);
});

test('tenant v4 app preserves identity handoff context after support actions', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /function readSupportOutcomeFromUrl\(\)/);
  assert.match(source, /function normalizeIdentitySupportIntent\(value, fallbackIntent = 'review'\)/);
  assert.match(source, /function normalizeIdentitySupportOutcome\(value, fallback = 'reviewing'\)/);
  assert.match(source, /function resolveIdentityFollowupAction\(intent, submittedAction, requestedFollowupAction\)/);
  assert.match(source, /const playerSupportIntentField = playerSupportForm\?\.querySelector\('\[name="supportIntent"\]'\);/);
  assert.match(source, /const playerSupportOutcomeField = playerSupportForm\?\.querySelector\('\[name="supportOutcome"\]'\);/);
  assert.match(source, /const playerSupportFollowupField = playerSupportForm\?\.querySelector\('\[name="followupAction"\]'\);/);
  assert.match(source, /const normalizedIntent = normalizeIdentitySupportIntent\(\s*requestedAction,\s*renderState\?\.selectedIdentityAction,\s*\)/s);
  assert.match(source, /const outcome = normalizeIdentitySupportOutcome\(\s*button\.getAttribute\('data-tenant-player-support-outcome'\)\s*\|\|\s*renderState\?\.selectedSupportOutcome\s*\|\|\s*'reviewing',\s*\)/s);
  assert.match(source, /playerSupportIntentField\.value = normalizedIntent;/);
  assert.match(source, /playerSupportOutcomeField\.value = outcome;/);
  assert.match(source, /playerSupportFollowupField\.value = resolveIdentityFollowupAction\(\s*normalizedIntent,\s*resolveIdentitySupportFormAction\(normalizedIntent\),\s*\);/s);
  assert.match(source, /const supportIntent = normalizeIdentitySupportIntent\(\s*formData\.get\('supportIntent'\),\s*action === 'remove' \? 'unlink' : action === 'set' \? 'bind' : 'review',\s*\)/s);
  assert.match(source, /const followupAction = resolveIdentityFollowupAction\(\s*supportIntent,\s*action,\s*formData\.get\('followupAction'\),\s*\)/s);
  assert.match(source, /const supportReason = String\(formData\.get\('supportReason'\) \|\| ''\)\.trim\(\);/);
  assert.match(source, /const supportSource = String\(\s*formData\.get\('supportSource'\)\s*\|\|\s*renderState\?\.selectedSupportSource\s*\|\|\s*'tenant',\s*\)\.trim\(\) \|\| 'tenant';/s);
  assert.match(source, /const supportOutcome = normalizeIdentitySupportOutcome\(\s*formData\.get\('supportOutcome'\)\s*\|\|\s*renderState\?\.selectedSupportOutcome\s*\|\|\s*'reviewing',\s*\)/s);
  assert.match(source, /\/admin\/api\/player\/identity\/review/);
  assert.match(source, /const nextIdentityAction = resolveIdentityFollowupAction\(supportIntent, action, followupAction\);/);
  assert.match(source, /writePlayerIdentityWorkflowToUrl\(\s*userId,\s*nextIdentityAction,\s*supportReason,\s*supportSource,\s*supportOutcome,\s*\);/s);
});
