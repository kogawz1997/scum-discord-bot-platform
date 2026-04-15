const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('owner console loads split risk module before owner control module', () => {
  const html = fs.readFileSync('C:\\new\\src\\admin\\owner-console.html', 'utf8');

  const riskScriptPattern = /\/admin\/assets\/owner-control-risk-v4\.js\?v=[^"]+/;
  const controlScriptPattern = /\/admin\/assets\/owner-control-v4\.js\?v=[^"]+/;
  const riskScript = html.match(riskScriptPattern)?.[0] || '';
  const controlScript = html.match(controlScriptPattern)?.[0] || '';

  assert.ok(riskScript, 'owner-control-risk-v4.js script should be present');
  assert.ok(controlScript, 'owner-control-v4.js script should be present');
  assert.ok(html.indexOf(riskScript) < html.indexOf(controlScript));
});
