const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('tenant console loads split player workflow module before tenant v4 app', () => {
  const html = fs.readFileSync('C:\\new\\src\\admin\\tenant-console.html', 'utf8');
  const workflowScript = '/admin/assets/tenant-player-workflow-v4.js?v=20260409-tenant-split-workflow-1';
  const appScript = '/admin/assets/tenant-v4-app.js?v=20260409-tenant-split-workflow-1';

  assert.match(html, new RegExp(escapeRegExp(workflowScript)));
  assert.match(html, new RegExp(escapeRegExp(appScript)));
  assert.ok(html.indexOf(workflowScript) < html.indexOf(appScript));
});
