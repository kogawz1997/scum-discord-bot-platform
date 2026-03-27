const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantDeliveryAgentsV4Html,
  createTenantDeliveryAgentsV4Model,
} = require('../src/admin/assets/tenant-delivery-agents-v4.js');

test('tenant delivery agents v4 model filters execute runtimes and keeps provisioning context', () => {
  const model = createTenantDeliveryAgentsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [
      {
        runtimeKey: 'delivery-1',
        status: 'online',
        version: '1.4.2',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentRole: 'execute', agentScope: 'execute_only', serverId: 'server-alpha' },
      },
      {
        runtimeKey: 'watcher-1',
        status: 'online',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentRole: 'sync', agentScope: 'sync_only', serverId: 'server-alpha' },
      },
    ],
    queueItems: [{}, {}],
    deadLetters: [{}],
  });

  assert.equal(model.header.title, 'Delivery Agent');
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].name, 'delivery-1');
  assert.equal(model.selectedServerId, 'server-alpha');
});

test('tenant delivery agents v4 html exposes provisioning hooks and current runtime table', () => {
  const html = buildTenantDeliveryAgentsV4Html(createTenantDeliveryAgentsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [],
  }));

  assert.match(html, /Delivery Agent/);
  assert.match(html, /สร้าง Delivery Agent ใหม่/);
  assert.match(html, /data-runtime-server-id="delivery-agents"/);
  assert.match(html, /data-runtime-display-name="delivery-agents"/);
  assert.match(html, /data-runtime-runtime-key="delivery-agents"/);
  assert.match(html, /data-runtime-provision-button="delivery-agents"/);
});

test('tenant delivery agents preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-delivery-agents-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-delivery-agents-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-delivery-agents-v4\.js/);
  assert.match(html, /tenantDeliveryAgentsV4PreviewRoot/);
});
