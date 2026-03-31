const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('tenant v4 app redirects missing tenant scope to the correct surface', () => {
  const filePath = path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js');
  const source = fs.readFileSync(filePath, 'utf8');

  assert.match(source, /function redirectForMissingTenantScope\(me\)/);
  assert.match(source, /function buildTenantLoginRedirectUrl\(options = \{\}\)/);
  assert.match(source, /params\.set\('switch', '1'\)/);
  assert.match(source, /params\.set\('next', nextUrl\)/);
  assert.match(source, /const nextUrl = buildTenantLoginRedirectUrl\(\{ switch: true \}\)/);
  assert.match(source, /if \(!scopedTenantId\) \{\s*redirectForMissingTenantScope\(me\);\s*return;\s*\}/s);
  assert.doesNotMatch(source, /Tenant scope is required for the tenant admin workspace\./);
});
