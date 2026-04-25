const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readOwnerAppSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'admin', 'assets', 'owner-v4-app.js'), 'utf8');
}

test('owner v4 app stages optional owner reads behind the core payload', () => {
  const source = readOwnerAppSource();
  assert.match(source, /function optionalOwnerRead\(path, fallback, timeoutMs = 2500\)/);
  assert.match(source, /async function loadOwnerOptionalPayload\(\)/);
  assert.match(source, /loadOwnerOptionalPayload\(\)\s*\.then\(\(optionalPayload\) =>/);
  assert.match(source, /agents:\s*\[\],[\s\S]*agentRegistry:\s*\[\],[\s\S]*requestLogs:\s*\{\s*metrics:\s*\{\},\s*items:\s*\[\]\s*\}/);
  assert.match(source, /กำลังโหลดรายชื่อลูกค้า สุขภาพบริการ และเหตุการณ์ล่าสุดของแพลตฟอร์ม/);
  assert.match(source, /กำลังโหลดรายละเอียดลูกค้า\.\.\./);
});

test('owner v4 app keeps the loading card visible while owner payload is still loading', () => {
  const source = readOwnerAppSource();
  assert.match(source, /if \(!state\.payload\) \{[\s\S]*if \(state\.refreshing\) \{[\s\S]*renderMessageCard\(\s*t\('owner\.app\.card\.loadingTitle'/);
  assert.match(source, /if \(!state\.payload\) \{[\s\S]*else \{[\s\S]*renderMessageCard\(\s*t\('owner\.app\.card\.emptyTitle'/);
});

test('owner v4 app maps tenant detail and support routes back to canonical owner paths', () => {
  const source = readOwnerAppSource();
  assert.match(source, /dashboard:\s*'overview'/);
  assert.match(source, /if \(segments\[0\] === 'tenants' && segments\[1\]\) \{\s*return `tenant-\$\{decodeURIComponent\(segments\[1\]\)\.trim\(\)\.toLowerCase\(\)\}`;\s*\}/);
  assert.match(source, /if \(segments\[0\] === 'support' && segments\[1\]\) \{\s*return `support-\$\{decodeURIComponent\(segments\[1\]\)\.trim\(\)\.toLowerCase\(\)\}`;\s*\}/);
  assert.match(source, /if \(segments\[0\] === 'runtime' && segments\[1\]\) \{/);
  assert.match(source, /if \(runtimeSegment === 'overview'\) return 'runtime';/);
  assert.match(source, /if \(runtimeSegment === 'create-server'\) return 'runtime-create-server';/);
  assert.match(source, /if \(runtimeSegment === 'provision-runtime'\) return 'runtime-provision-runtime';/);
  assert.match(source, /if \(segments\[0\] === 'analytics' && segments\[1\] === 'overview'\) return 'analytics';/);
  assert.match(source, /if \(segments\[0\] === 'security' && segments\[1\] === 'overview'\) return 'security';/);
  assert.match(source, /if \(segments\[0\] === 'settings' && segments\[1\] === 'overview'\) return 'settings';/);
  assert.match(source, /if \(segments\[0\] === 'recovery' && segments\[1\] === 'overview'\) return 'recovery';/);
  assert.match(source, /if \(normalizedRoute\.startsWith\('tenant-'\)\) \{\s*return `\/owner\/tenants\/\$\{encodeURIComponent\(normalizedRoute\.slice\('tenant-'\.length\)\)\}`;\s*\}/);
  assert.match(source, /if \(normalizedRoute\.startsWith\('support-'\)\) \{\s*return `\/owner\/support\/\$\{encodeURIComponent\(normalizedRoute\.slice\('support-'\.length\)\)\}`;\s*\}/);
  assert.match(source, /if \(normalizedRoute === 'runtime-create-server'\) return '\/owner\/runtime\/create-server';/);
  assert.match(source, /if \(normalizedRoute === 'runtime-provision-runtime'\) return '\/owner\/runtime\/provision-runtime';/);
  assert.match(source, /if \(normalizedRoute === 'agents-bots'\) return '\/owner\/runtime\/agents-bots';/);
  assert.match(source, /if \(normalizedRoute === 'fleet-diagnostics'\) return '\/owner\/runtime\/fleet-diagnostics';/);
  assert.match(source, /if \(normalizedRoute === 'runtime' \|\| normalizedRoute === 'runtime-health'\) return '\/owner\/runtime\/overview';/);
  assert.match(source, /if \(normalizedRoute === 'observability' \|\| normalizedRoute === 'analytics'\) return '\/owner\/analytics\/overview';/);
  assert.match(source, /if \(normalizedRoute === 'security'\) return '\/owner\/security\/overview';/);
  assert.match(source, /if \(normalizedRoute === 'settings'\) return '\/owner\/settings\/overview';/);
  assert.match(source, /if \(normalizedRoute === 'recovery'\) return '\/owner\/recovery\/overview';/);
  assert.doesNotMatch(source, /#support-\$\{normalizedRoute\.slice\('tenant-'\.length\)\}/);
  assert.doesNotMatch(source, /#tenant-\$\{normalizedRoute\.slice\('support-'\.length\)\}/);
});

test('owner v4 app wires owner identity follow-up actions through the review route', () => {
  const source = readOwnerAppSource();
  assert.match(source, /action === 'resolve-identity-followup' \|\| action === 'reassign-identity-followup'/);
  assert.match(source, /ownerMutation\('\/admin\/api\/player\/identity\/review'/);
  assert.match(source, /buildOwnerIdentityFollowupReason/);
});

test('owner v4 app wires backup and restore payloads into the recovery route', () => {
  const source = readOwnerAppSource();
  assert.match(source, /recovery:\s*'recovery'/);
  assert.match(source, /if \(normalizedRoute === 'recovery'\) return '\/owner\/recovery\/overview';/);
  assert.match(source, /restorePreview:\s*null/);
  assert.match(source, /if \(action === 'backup-create'\)/);
  assert.match(source, /if \(action === 'backup-preview'\)/);
  assert.match(source, /if \(action === 'backup-restore'\)/);
  assert.match(source, /optionalOwnerRead\('\/admin\/api\/backup\/restore\/status', \{\}, 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/admin\/api\/backup\/restore\/history\?limit=12', \[\], 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/admin\/api\/backup\/list', \[\], 2500\)/);
  assert.match(source, /restorePreview:\s*state\.ownerUi\.restorePreview/);
});

test('owner v4 app wires automation preview state and manual automation actions into settings', () => {
  const source = readOwnerAppSource();
  assert.match(source, /automationPreview:\s*null/);
  assert.match(source, /automationPreview:\s*state\.ownerUi\.automationPreview/);
  assert.match(source, /if \(action === 'run-platform-automation'\)/);
  assert.match(source, /ownerMutation\('\/admin\/api\/platform\/automation\/run'/);
});

test('owner v4 app provisions runtimes from the owner control workspace', () => {
  const source = readOwnerAppSource();
  assert.match(source, /if \(action === 'create-platform-server'\)/);
  assert.match(source, /ownerMutation\('\/owner\/api\/platform\/server'/);
  assert.match(source, /if \(action === 'provision-runtime'\)/);
  assert.match(source, /runtimeKind === 'delivery-agents'/);
  assert.match(source, /scope: 'execute_only'/);
  assert.match(source, /scope: 'sync_only'/);
  assert.match(source, /ownerMutation\('\/owner\/api\/platform\/agent-provision'/);
  assert.match(source, /state\.ownerUi\.runtimeBootstrap = result/);
  assert.match(source, /navigateOwnerRoute\('\/owner\/runtime\/provision-runtime'\)/);
  assert.match(source, /navigateOwnerRoute\('\/owner\/runtime\/agents-bots'\)/);
});

test('owner v4 app keeps legacy control aliases mapped to active owner surfaces', () => {
  const source = readOwnerAppSource();
  assert.match(source, /if \(normalizedRoute === 'control'\) return '\/owner\/control';/);
  assert.match(source, /if \(normalizedRoute === 'access'\) return '\/owner\/access';/);
  assert.match(source, /if \(normalizedRoute === 'diagnostics'\) return '\/owner\/diagnostics';/);
  assert.match(source, /'agents-bots': \{/);
  assert.match(source, /'fleet-diagnostics': \{/);
  assert.match(source, /normalizedRoute === 'control' \|\| normalizedRoute === 'access' \|\| normalizedRoute === 'diagnostics'/);
  assert.match(source, /OWNER_ROUTE_PRESENTATION\.control = \{/);
  assert.match(source, /OWNER_ROUTE_PRESENTATION\.access = \{/);
  assert.match(source, /OWNER_ROUTE_PRESENTATION\.diagnostics = \{/);
});

test('owner v4 app navigates stitched routes in place without a full document reload', () => {
  const source = readOwnerAppSource();
  assert.match(source, /function syncOwnerStitchRouteFromLocation\(\)/);
  assert.match(source, /window\.__OWNER_STITCH_ROUTE__ = canonicalPath/);
  assert.match(source, /window\.history\.pushState\(\{\}, '', nextUrl\)/);
  assert.match(source, /window\.__navigateOwnerStitchRoute = navigateOwnerRoute/);
  assert.match(source, /window\.addEventListener\('popstate', \(\) => \{[\s\S]*syncOwnerStitchRouteFromLocation\(\);[\s\S]*renderCurrentPage\(\);/);
});

test('owner v4 app allows export forms to submit natively', () => {
  const source = readOwnerAppSource();
  assert.match(source, /const NATIVE_OWNER_FORM_ACTIONS = new Set\(\[/);
  assert.match(source, /'export-tenant-diagnostics'/);
  assert.match(source, /'export-tenant-support-case'/);
  assert.match(source, /'export-delivery-lifecycle'/);
  assert.match(source, /if \(NATIVE_OWNER_FORM_ACTIONS\.has\(formAction\)\) \{\s*return;\s*\}/);
});
