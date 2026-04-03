const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readTenantAppSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'admin', 'assets', 'tenant-v4-app.js'), 'utf8');
}

test('tenant v4 app fetches the tenant support case bundle for logs and sync follow-up context', () => {
  const source = readTenantAppSource();

  assert.match(source, /\/admin\/api\/platform\/tenant-support-case\?tenantId=/);
  assert.match(source, /tenantSupportCase:/);
});

test('tenant v4 app wires the logs and sync page into refresh and server bot probe actions', () => {
  const source = readTenantAppSource();

  assert.match(source, /function wireLogsSyncPage\(renderState, surfaceState\)/);
  assert.match(source, /\[data-tenant-logs-sync-refresh\]/);
  assert.match(source, /wireServerBotProbeActions\(renderState, surfaceState\);/);
});
