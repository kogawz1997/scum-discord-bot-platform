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
  assert.match(source, /optionalOwnerRead\('\/owner\/api\/platform\/restart-plans\?limit=20', \[\], 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/owner\/api\/platform\/restart-executions\?limit=20', \[\], 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/owner\/api\/delivery\/audit\?limit=20', \[\], 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/owner\/api\/platform\/sync-runs\?limit=20', \[\], 2500\)/);
  assert.match(source, /optionalOwnerRead\('\/owner\/api\/platform\/sync-events\?limit=20', \[\], 2500\)/);
  assert.match(source, /deliveryLifecycle:\s*\{\},[\s\S]*deliveryAudit:\s*\[\],[\s\S]*restartPlans:\s*\[\],[\s\S]*restartExecutions:\s*\[\],[\s\S]*syncRuns:\s*\[\],[\s\S]*syncEvents:\s*\[\]/);
  assert.match(source, /กำลังโหลดรายชื่อลูกค้า สุขภาพบริการ และเหตุการณ์ล่าสุดของแพลตฟอร์ม/);
  assert.match(source, /กำลังโหลดรายละเอียดลูกค้า\.\.\./);
});

test('owner v4 app keeps the loading card visible while owner payload is still loading', () => {
  const source = readOwnerAppSource();
  assert.match(source, /if \(!state\.payload\) \{\s*if \(state\.refreshing\)/);
  assert.doesNotMatch(source, /if \(!state\.payload\) \{\s*renderMessageCard\(\s*t\('owner\.app\.card\.emptyTitle'/);
});

test('owner v4 app maps tenant detail and support routes back to canonical owner paths', () => {
  const source = readOwnerAppSource();
  assert.match(source, /if \(segments\[0\] === 'tenants' && segments\[1\]\) \{\s*return `tenant-\$\{decodeURIComponent\(segments\[1\]\)\.trim\(\)\.toLowerCase\(\)\}`;\s*\}/);
  assert.match(source, /if \(segments\[0\] === 'support' && segments\[1\]\) \{\s*return `support-\$\{decodeURIComponent\(segments\[1\]\)\.trim\(\)\.toLowerCase\(\)\}`;\s*\}/);
  assert.match(source, /if \(normalizedRoute\.startsWith\('tenant-'\)\) \{\s*return `\/owner\/tenants\/\$\{encodeURIComponent\(normalizedRoute\.slice\('tenant-'\.length\)\)\}`;\s*\}/);
  assert.match(source, /if \(normalizedRoute\.startsWith\('support-'\)\) \{\s*return `\/owner\/support\/\$\{encodeURIComponent\(normalizedRoute\.slice\('support-'\.length\)\)\}`;\s*\}/);
  assert.doesNotMatch(source, /#support-\$\{normalizedRoute\.slice\('tenant-'\.length\)\}/);
  assert.doesNotMatch(source, /#tenant-\$\{normalizedRoute\.slice\('support-'\.length\)\}/);
});
