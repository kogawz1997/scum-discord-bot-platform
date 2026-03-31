const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildTenantDeliveryAgentsV4Html,
  createTenantDeliveryAgentsV4Model,
} = require('../src/admin/assets/tenant-delivery-agents-v4.js');

test('tenant delivery agents v4 model keeps runtime management context', () => {
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
        meta: { agentId: 'agent-delivery-1', agentRole: 'execute', agentScope: 'execute_only', serverId: 'server-alpha' },
      },
      {
        runtimeKey: 'watcher-1',
        status: 'online',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentId: 'agent-sync-1', agentRole: 'sync', agentScope: 'sync_only', serverId: 'server-alpha' },
      },
    ],
    agentDevices: [
      {
        id: 'device-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        hostname: 'machine-a',
        status: 'online',
      },
    ],
    agentCredentials: [
      {
        id: 'cred-1',
        apiKeyId: 'apikey-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        status: 'active',
      },
    ],
    agentProvisioning: [
      {
        id: 'token-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        role: 'execute',
        scope: 'execute_only',
        displayName: 'Delivery Agent Alpha',
        status: 'pending_activation',
        expiresAt: '2026-03-30T10:00:00.000Z',
      },
    ],
    agentSessions: [
      {
        id: 'session-1',
        sessionId: 'session-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        displayName: 'Delivery Agent Alpha',
        role: 'execute',
        scope: 'execute_only',
        status: 'online',
        hostname: 'machine-a',
        version: '1.4.2',
        heartbeatAt: '2026-03-27T10:05:00.000Z',
      },
    ],
    queueItems: [{}, {}],
    deadLetters: [{}],
  });

  assert.equal(model.header.title, 'บอตส่งของ');
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].name, 'delivery-1');
  assert.equal(model.rows[0].deviceId, 'device-1');
  assert.equal(model.rows[0].apiKeyId, 'apikey-1');
  assert.equal(model.tokens.length, 1);
  assert.equal(model.tokens[0].tokenId, 'token-1');
  assert.equal(model.history.length, 1);
  assert.equal(model.history[0].sessionId, 'session-1');
});

test('tenant delivery agents v4 html exposes provisioning and management hooks', () => {
  const html = buildTenantDeliveryAgentsV4Html(createTenantDeliveryAgentsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [
      {
        runtimeKey: 'delivery-1',
        status: 'online',
        version: '1.4.2',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        meta: { agentId: 'agent-delivery-1', agentRole: 'execute', agentScope: 'execute_only', serverId: 'server-alpha' },
      },
    ],
    agentDevices: [
      {
        id: 'device-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        hostname: 'machine-a',
        status: 'online',
      },
    ],
    agentCredentials: [
      {
        id: 'cred-1',
        apiKeyId: 'apikey-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        status: 'active',
      },
    ],
    agentProvisioning: [
      {
        id: 'token-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        role: 'execute',
        scope: 'execute_only',
        displayName: 'Delivery Agent Alpha',
        status: 'pending_activation',
        expiresAt: '2026-03-30T10:00:00.000Z',
      },
    ],
    agentSessions: [
      {
        id: 'session-1',
        sessionId: 'session-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        displayName: 'Delivery Agent Alpha',
        role: 'execute',
        scope: 'execute_only',
        status: 'online',
        hostname: 'machine-a',
        version: '1.4.2',
        heartbeatAt: '2026-03-27T10:05:00.000Z',
      },
    ],
    __provisioningResult: {
      'delivery-agents': {
        instructions: {
          title: 'ตัวติดตั้งบอตส่งของพร้อมแล้ว',
          detail: 'Download the installer package for the target machine.',
          downloads: [
            { key: 'install-ps1', label: 'ดาวน์โหลดสคริปต์ติดตั้ง (.ps1)' },
            { key: 'quick-install-cmd', label: 'ดาวน์โหลดตัวติดตั้งแบบเร็ว (.cmd)' },
          ],
        },
      },
    },
  }));

  assert.match(html, /บอตส่งของ/);
  assert.match(html, /data-runtime-server-id="delivery-agents"/);
  assert.match(html, /data-runtime-display-name="delivery-agents"/);
  assert.match(html, /data-runtime-runtime-key="delivery-agents"/);
  assert.match(html, /data-runtime-provision-button="delivery-agents"/);
  assert.match(html, /data-runtime-action="rotate-token"/);
  assert.match(html, /data-runtime-action="revoke-token"/);
  assert.match(html, /data-runtime-action="revoke-device"/);
  assert.match(html, /data-runtime-action="reissue-provision"/);
  assert.match(html, /data-runtime-action="revoke-provision"/);
  assert.match(html, /data-runtime-download-kind="delivery-agents"/);
  assert.match(html, /data-runtime-download-key="install-ps1"/);
  assert.match(html, /ดาวน์โหลดสคริปต์ติดตั้ง \(\.ps1\)|ดาวน์โหลดไฟล์/);
  assert.match(html, /ความเคลื่อนไหวล่าสุดของบอต/);
  assert.match(html, /กติกาการผูกเครื่อง/);
  assert.match(html, /หมุนคีย์บอต/);
  assert.match(html, /ยกเลิกสิทธิ์บอต/);
});

test('tenant delivery agents v4 guides the user when no server exists yet', () => {
  const html = buildTenantDeliveryAgentsV4Html(createTenantDeliveryAgentsV4Model({
    tenantLabel: 'Codex Test Community',
    servers: [],
    agents: [],
    agentDevices: [],
    agentCredentials: [],
    agentProvisioning: [],
  }));

  assert.match(html, /data-runtime-empty-kind="missing-server"/);
  assert.match(html, /data-runtime-empty-action="delivery-agents"/);
  assert.match(html, /#server-status/);
  assert.match(html, />เปิดหน้าเซิร์ฟเวอร์</);
});

test('tenant delivery agents v4 guides the user to install pending setup tokens', () => {
  const html = buildTenantDeliveryAgentsV4Html(createTenantDeliveryAgentsV4Model({
    tenantLabel: 'Codex Test Community',
    activeServer: { id: 'server-alpha', name: 'Alpha Server' },
    servers: [{ id: 'server-alpha', name: 'Alpha Server' }],
    agents: [],
    agentDevices: [],
    agentCredentials: [],
    agentProvisioning: [
      {
        id: 'token-1',
        agentId: 'agent-delivery-1',
        serverId: 'server-alpha',
        runtimeKey: 'delivery-1',
        role: 'execute',
        scope: 'execute_only',
        displayName: 'Delivery Agent Alpha',
        status: 'pending_activation',
        expiresAt: '2026-03-30T10:00:00.000Z',
      },
    ],
  }));

  assert.match(html, /data-runtime-empty-kind="pending-install"/);
  assert.match(html, /data-runtime-empty-action="delivery-agents"/);
});

test('tenant delivery agents preview html references parallel assets', () => {
  const previewPath = path.join(__dirname, '..', 'src', 'admin', 'v4', 'tenant-delivery-agents-v4.preview.html');
  const html = fs.readFileSync(previewPath, 'utf8');

  assert.match(html, /\.\.\/assets\/tenant-delivery-agents-v4\.css/);
  assert.match(html, /\.\.\/assets\/tenant-delivery-agents-v4\.js/);
  assert.match(html, /tenantDeliveryAgentsV4PreviewRoot/);
});
