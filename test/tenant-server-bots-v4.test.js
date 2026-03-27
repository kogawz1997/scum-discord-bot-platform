const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantServerBotsV4Html,
  createTenantServerBotsV4Model,
} = require('../src/admin/assets/tenant-server-bots-v4.js');

test('tenant server bots v4 model filters sync runtimes and keeps operational signals', () => {
  const model = createTenantServerBotsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [
      {
        runtimeKey: 'watcher-1',
        status: 'online',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentRole: 'sync', agentScope: 'sync_only', serverId: 'server-alpha', capabilities: ['sync', 'config', 'restart'] },
      },
      {
        runtimeKey: 'delivery-1',
        status: 'online',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentRole: 'execute', agentScope: 'execute_only', serverId: 'server-alpha', capabilities: ['delivery'] },
      },
    ],
    queueItems: [{}],
    deadLetters: [{}],
  });

  assert.equal(model.header.title, 'Server Bot');
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].name, 'watcher-1');
  assert.equal(model.selectedServerId, 'server-alpha');
});

test('tenant server bots v4 html exposes provisioning hooks and current runtime table', () => {
  const html = buildTenantServerBotsV4Html(createTenantServerBotsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [],
  }));

  assert.match(html, /Server Bot/);
  assert.match(html, /สร้าง Server Bot ใหม่/);
  assert.match(html, /data-runtime-server-id="server-bots"/);
  assert.match(html, /data-runtime-display-name="server-bots"/);
  assert.match(html, /data-runtime-runtime-key="server-bots"/);
  assert.match(html, /data-runtime-provision-button="server-bots"/);
});

test('tenant server bots preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-server-bots-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-server-bots-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-server-bots-v4\.js/);
  assert.match(html, /tenantServerBotsV4PreviewRoot/);
});
